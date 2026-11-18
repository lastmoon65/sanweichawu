import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  FIRST_OWNER_BOOTSTRAP_LOCK_KEY,
  toSafeBootstrapDiagnostic,
} from './bootstrap-error-diagnostic.js';
import type { BootstrapPhase } from './bootstrap-error-diagnostic.js';
import { PasswordService } from './password.service.js';
import { APP_CONFIG } from '../config/app-config.module.js';
import type { AppConfig } from '../config/environment.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import { writeStructuredLog } from '../infrastructure/logging/structured-logger.js';

interface BootstrapResult {
  created: boolean;
  staffId?: bigint;
  storeId?: bigint;
}

const BOOTSTRAP_LOCK_WAIT_TIMEOUT_SECONDS = 10;

function sessionLockWaitTimeoutSeconds(value: unknown): number {
  let parsed: number;
  if (typeof value === 'bigint') {
    parsed =
      value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : Number.NaN;
  } else if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    parsed = Number(value);
  } else {
    parsed = Number.NaN;
  }

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('bootstrap_session_lock_wait_timeout_invalid');
  }
  return parsed;
}

@Injectable()
export class BootstrapOwnerService implements OnApplicationBootstrap {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    let phase: BootstrapPhase = 'unknown';
    try {
      await this.bootstrapOwner((nextPhase) => {
        phase = nextPhase;
      });
    } catch (error) {
      const diagnostic = toSafeBootstrapDiagnostic(error, phase);
      writeStructuredLog('error', 'bootstrap_owner_failed', {
        reason: 'bootstrap_failed',
        ...diagnostic,
      });
      throw new Error('bootstrap_owner_failed');
    }
  }

  private async bootstrapOwner(setPhase: (phase: BootstrapPhase) => void): Promise<void> {
    const username = this.config.bootstrapOwnerUsername;
    const password = this.config.bootstrapOwnerPassword;
    if (!username || !password) {
      return;
    }

    setPhase('hash');
    const passwordHash = await this.passwords.hash(password);
    setPhase('transaction_start');
    const result = await this.prisma.$transaction(
      async (transaction): Promise<BootstrapResult> => {
        setPhase('acquire_bootstrap_lock');
        const sessionRows = await transaction.$queryRaw<
          Array<{ innodb_lock_wait_timeout: bigint | number | string | null }>
        >`
          SELECT @@SESSION.innodb_lock_wait_timeout AS innodb_lock_wait_timeout
        `;
        const previousLockWaitTimeout = sessionLockWaitTimeoutSeconds(
          sessionRows[0]?.innodb_lock_wait_timeout,
        );

        try {
          await transaction.$executeRaw`
            SET SESSION innodb_lock_wait_timeout = ${BOOTSTRAP_LOCK_WAIT_TIMEOUT_SECONDS}
          `;

          const lockRows = await transaction.$queryRaw<Array<{ lock_key: string }>>`
            SELECT lock_key FROM bootstrap_locks
            WHERE lock_key = ${FIRST_OWNER_BOOTSTRAP_LOCK_KEY}
            FOR UPDATE
          `;
          if (lockRows.length !== 1) {
            throw new Error('bootstrap_lock_unavailable');
          }

          setPhase('select_store');
          const lockedStores = await transaction.$queryRaw<Array<{ id: bigint }>>`
            SELECT id FROM stores ORDER BY id ASC LIMIT 1 FOR UPDATE
          `;
          let storeId = lockedStores[0]?.id;

          if (storeId === undefined) {
            setPhase('create_store');
            const store = await transaction.store.create({
              data: {
                name: this.config.bootstrapStoreName ?? '三味茶屋',
                status: 'ACTIVE',
              },
              select: { id: true },
            });
            storeId = store.id;
          }

          setPhase('check_owner');
          const owner = await transaction.staff.findFirst({
            where: { storeId, role: 'OWNER' },
            select: { id: true },
          });
          if (owner) {
            setPhase('commit');
            return { created: false, staffId: owner.id, storeId };
          }

          setPhase('create_staff');
          const staff = await transaction.staff.create({
            data: {
              storeId,
              name: this.config.bootstrapOwnerName ?? 'OWNER',
              role: 'OWNER',
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          setPhase('create_credential');
          await transaction.staffCredential.create({
            data: {
              staffId: staff.id,
              username,
              passwordHash,
            },
          });

          setPhase('commit');
          return { created: true, staffId: staff.id, storeId };
        } finally {
          await transaction.$executeRaw`
            SET SESSION innodb_lock_wait_timeout = ${previousLockWaitTimeout}
          `;
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 15_000,
      },
    );

    if (result.created && result.staffId !== undefined && result.storeId !== undefined) {
      writeStructuredLog('info', 'bootstrap_owner_created', {
        staffId: result.staffId.toString(),
        storeId: result.storeId.toString(),
      });
    } else if (result.staffId !== undefined && result.storeId !== undefined) {
      writeStructuredLog('info', 'bootstrap_owner_skipped', {
        reason: 'owner_exists',
        staffId: result.staffId.toString(),
        storeId: result.storeId.toString(),
      });
    }
  }
}
