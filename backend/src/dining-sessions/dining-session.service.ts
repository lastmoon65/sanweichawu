import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { insufficientPermissions } from '../auth/auth-errors.js';
import { parseDecimalBigIntId } from '../auth/store-resource.service.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import {
  invalidSessionStatus,
  sessionAlreadyOpen,
  sessionClosed,
  sessionHasOrders,
  sessionVersionConflict,
} from './dining-session.errors.js';

const SESSION_SELECT = {
  id: true,
  storeId: true,
  tableId: true,
  status: true,
  version: true,
  openedAt: true,
  closedAt: true,
  closedByStaffId: true,
} as const;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 10_000,
} as const;

interface DiningSessionRecord {
  readonly id: bigint;
  readonly storeId: bigint;
  readonly tableId: bigint;
  readonly status: 'OPEN' | 'CLOSED';
  readonly version: number;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  readonly closedByStaffId: bigint | null;
}

export interface DiningSessionResponse {
  readonly id: string;
  readonly storeId: string;
  readonly tableId: string;
  readonly status: 'OPEN' | 'CLOSED';
  readonly version: number;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly closedByStaffId: string | null;
}

export interface DiningSessionListResponse {
  readonly items: DiningSessionResponse[];
}

export type DiningSessionStatusFilter = 'OPEN' | 'CLOSED';

function serializeSession(session: DiningSessionRecord): DiningSessionResponse {
  return {
    id: session.id.toString(),
    storeId: session.storeId.toString(),
    tableId: session.tableId.toString(),
    status: session.status,
    version: session.version,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    closedByStaffId: session.closedByStaffId?.toString() ?? null,
  };
}

function parsePathId(value: string): bigint {
  const id = parseDecimalBigIntId(value);
  if (id === null) {
    throw insufficientPermissions();
  }
  return id;
}

@Injectable()
export class DiningSessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    storeId: bigint,
    status: DiningSessionStatusFilter | undefined,
  ): Promise<DiningSessionListResponse> {
    const sessions = await this.prisma.diningSession.findMany({
      where: status === undefined ? { storeId } : { storeId, status },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      select: SESSION_SELECT,
    });
    return { items: sessions.map(serializeSession) };
  }

  async get(storeId: bigint, sessionIdValue: string): Promise<DiningSessionResponse> {
    const sessionId = parsePathId(sessionIdValue);
    const session = await this.prisma.diningSession.findFirst({
      where: { id: sessionId, storeId },
      select: SESSION_SELECT,
    });
    if (!session) {
      throw insufficientPermissions();
    }
    return serializeSession(session);
  }

  async open(storeId: bigint, tableIdValue: string): Promise<DiningSessionResponse> {
    const tableId = parsePathId(tableIdValue);
    return this.prisma.$transaction(async (transaction) => {
      const lockedTables = await transaction.$queryRaw<Array<{ id: bigint }>>(
        Prisma.sql`
          SELECT id FROM dining_tables
          WHERE id = ${tableId} AND store_id = ${storeId}
          FOR UPDATE
        `,
      );
      if (lockedTables.length !== 1) {
        throw insufficientPermissions();
      }

      const existing = await transaction.diningSession.findFirst({
        where: { tableId, storeId, status: 'OPEN' },
        select: { id: true },
      });
      if (existing) {
        throw sessionAlreadyOpen();
      }

      const session = await transaction.diningSession.create({
        data: {
          storeId,
          tableId,
          status: 'OPEN',
          openedAt: new Date(),
          version: 1,
        },
        select: SESSION_SELECT,
      });
      return serializeSession(session);
    }, TRANSACTION_OPTIONS);
  }

  async close(
    storeId: bigint,
    staffId: bigint,
    sessionIdValue: string,
    version: number,
  ): Promise<DiningSessionResponse> {
    const sessionId = parsePathId(sessionIdValue);
    return this.prisma.$transaction(async (transaction) => {
      const lockedSessions = await transaction.$queryRaw<Array<{ id: bigint }>>(
        Prisma.sql`
          SELECT id FROM dining_sessions
          WHERE id = ${sessionId} AND store_id = ${storeId}
          FOR UPDATE
        `,
      );
      if (lockedSessions.length !== 1) {
        throw insufficientPermissions();
      }

      const session = await transaction.diningSession.findFirst({
        where: { id: sessionId, storeId },
        select: SESSION_SELECT,
      });
      if (!session) {
        throw insufficientPermissions();
      }
      if (session.status === 'CLOSED') {
        throw sessionClosed();
      }
      if (session.version !== version) {
        throw sessionVersionConflict(session.version);
      }

      const orderCount = await transaction.order.count({ where: { sessionId } });
      if (orderCount > 0) {
        throw sessionHasOrders(orderCount);
      }

      const updated = await transaction.diningSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedByStaffId: staffId,
          version: session.version + 1,
        },
        select: SESSION_SELECT,
      });
      return serializeSession(updated);
    }, TRANSACTION_OPTIONS);
  }

  static parseStatusFilter(
    value: string | string[] | undefined,
  ): DiningSessionStatusFilter | undefined {
    const status = Array.isArray(value) ? value[0] : value;
    if (status === undefined) {
      return undefined;
    }
    if (status === 'OPEN' || status === 'CLOSED') {
      return status;
    }
    throw invalidSessionStatus();
  }
}
