import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StaffCredential, Staff } from '@prisma/client';

import { invalidCredentials } from './auth-errors.js';
import { DUMMY_PASSWORD_HASH, PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import type { StaffLoginDto } from './dto/staff-login.dto.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

type CredentialWithStaff = StaffCredential & { staff: Staff };

type LoginTransactionResult =
  | { readonly authenticated: true; readonly value: StaffLoginResult }
  | { readonly authenticated: false };

export interface StaffLoginResult {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly staff: {
    readonly staffId: string;
    readonly storeId: string;
    readonly role: Staff['role'];
    readonly name: string;
    readonly username: string;
  };
}

@Injectable()
export class StaffAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  async login(input: StaffLoginDto, now = new Date()): Promise<StaffLoginResult> {
    const credential = (await this.prisma.staffCredential.findUnique({
      where: { username: input.username },
      include: { staff: true },
    })) as CredentialWithStaff | null;

    if (!credential) {
      await this.passwords.verify(input.password, DUMMY_PASSWORD_HASH);
      throw invalidCredentials();
    }

    const passwordMatches = await this.passwords.verify(input.password, credential.passwordHash);

    const transactionResult = await this.prisma.$transaction(
      async (transaction): Promise<LoginTransactionResult> => {
        await transaction.$queryRaw`
          SELECT id FROM staff_credentials WHERE id = ${credential.id} FOR UPDATE
        `;

        const current = (await transaction.staffCredential.findUnique({
          where: { id: credential.id },
          include: { staff: true },
        })) as CredentialWithStaff | null;
        if (!current) {
          return { authenticated: false };
        }

        const decisionTime = new Date();
        if (current.lockedUntil && current.lockedUntil > decisionTime) {
          return { authenticated: false };
        }

        if (!passwordMatches) {
          const previousAttempts =
            current.lockedUntil && current.lockedUntil <= decisionTime ? 0 : current.failedAttempts;
          const failedAttempts = previousAttempts + 1;
          await transaction.staffCredential.update({
            where: { id: current.id },
            data: {
              failedAttempts,
              lockedUntil:
                failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
                  ? new Date(decisionTime.getTime() + ACCOUNT_LOCK_DURATION_MS)
                  : null,
            },
          });
          return { authenticated: false };
        }

        if (current.staff.status !== 'ACTIVE') {
          return { authenticated: false };
        }

        if (current.failedAttempts !== 0 || current.lockedUntil !== null) {
          await transaction.staffCredential.update({
            where: { id: current.id },
            data: { failedAttempts: 0, lockedUntil: null },
          });
        }

        const accessToken = this.tokens.signAccessToken(
          {
            staffId: current.staff.id,
            role: current.staff.role,
            storeId: current.staff.storeId,
          },
          now.getTime(),
        );

        return {
          authenticated: true,
          value: {
            accessToken,
            tokenType: 'Bearer',
            expiresIn: this.tokens.getAccessTokenTtlSeconds(),
            staff: {
              staffId: current.staff.id.toString(),
              storeId: current.staff.storeId.toString(),
              role: current.staff.role,
              name: current.staff.name,
              username: current.username,
            },
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 10_000,
      },
    );

    if (!transactionResult.authenticated) {
      throw invalidCredentials();
    }
    return transactionResult.value;
  }
}
