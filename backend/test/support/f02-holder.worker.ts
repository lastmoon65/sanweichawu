import 'reflect-metadata';

import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { PasswordService } from '../../src/auth/password.service.js';
import { StaffAuthService } from '../../src/auth/staff-auth.service.js';
import { TokenService } from '../../src/auth/token.service.js';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service.js';
import { instrumentPrismaClient } from './instrumented-prisma.js';
import { createTestConfig } from './test-config.js';
import { requireTaskTestDatabaseUrl } from './task-database.js';

interface StartMessage {
  readonly type: 'start';
  readonly username: string;
  readonly password: string;
}

function send(message: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    if (!process.connected) {
      resolve();
      return;
    }
    process.send?.(message, () => resolve());
  });
}

const databaseUrl = requireTaskTestDatabaseUrl();
const rawClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const release = new Promise<void>((resolve) => {
  process.on('message', (message: unknown) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'release'
    ) {
      resolve();
    }
  });
});

process.on('message', (message: unknown) => {
  if (
    typeof message !== 'object' ||
    message === null ||
    (message as { type?: unknown }).type !== 'start'
  ) {
    return;
  }
  const start = message as StartMessage;
  let connectionId = '';
  const client = instrumentPrismaClient(rawClient, {
    onTransactionStart: (observation) => {
      connectionId = observation.connectionId;
      void send({
        type: 'event',
        event: 'transaction_started',
        connectionId,
        isolationLevel: observation.isolationLevel,
      });
    },
    onMutation: async (model, operation) => {
      if (model !== 'staffCredential' || operation !== 'update') return;
      await send({
        type: 'event',
        event: 'holder_after_write',
        connectionId,
        atEpochMs: performance.timeOrigin + performance.now(),
      });
      await release;
    },
  });
  const service = new StaffAuthService(
    client as unknown as PrismaService,
    new PasswordService(),
    new TokenService(
      createTestConfig({
        jwtAccessSecret: randomBytes(32).toString('base64url'),
        jwtAccessTtlSeconds: 60,
      }),
    ),
  );

  void service
    .login({ username: start.username, password: start.password })
    .then(
      async () => send({ type: 'result', status: 'fulfilled', statusCode: 200 }),
      async (error: unknown) => {
        const statusCode = (error as { getStatus?: () => number }).getStatus?.() ?? null;
        await send({ type: 'result', status: 'rejected', statusCode });
      },
    )
    .finally(async () => {
      await rawClient.$disconnect();
      if (process.connected) process.disconnect();
    });
});
