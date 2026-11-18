import 'reflect-metadata';

import { PrismaClient } from '@prisma/client';

import { BootstrapOwnerService } from '../../src/auth/bootstrap-owner.service.js';
import { PasswordService } from '../../src/auth/password.service.js';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service.js';
import { createTestConfig } from './test-config.js';
import { instrumentPrismaClient } from './instrumented-prisma.js';
import { requireTaskTestDatabaseUrl } from './task-database.js';

interface StartMessage {
  readonly type: 'start';
  readonly username: string;
  readonly password: string;
  readonly ownerName?: string;
  readonly storeName?: string;
}

const databaseUrl = requireTaskTestDatabaseUrl();
const rawClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
let started = false;

function send(message: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    if (!process.connected) {
      resolve();
      return;
    }
    process.send?.(message, () => resolve());
  });
}

process.on('message', (message: unknown) => {
  if (started || typeof message !== 'object' || message === null) return;
  if ((message as { type?: unknown }).type !== 'start') return;
  started = true;
  const start = message as StartMessage;
  let connectionId = '';
  let isolationLevel = '';
  const client = instrumentPrismaClient(rawClient, {
    onTransactionStart: (observation) => {
      connectionId = observation.connectionId;
      isolationLevel = observation.isolationLevel;
    },
  });
  const service = new BootstrapOwnerService(
    createTestConfig({
      bootstrapOwnerUsername: start.username,
      bootstrapOwnerPassword: start.password,
      bootstrapOwnerName: start.ownerName,
      bootstrapStoreName: start.storeName,
    }),
    client as unknown as PrismaService,
    new PasswordService(),
  );

  void service
    .onApplicationBootstrap()
    .then(async () => {
      const credential = await rawClient.staffCredential.findUnique({
        where: { username: start.username },
        select: { id: true },
      });
      await send({
        type: 'result',
        status: 'fulfilled',
        created: credential !== null,
        connectionId,
        isolationLevel,
      });
    })
    .catch(async () => {
      await send({
        type: 'result',
        status: 'rejected',
        created: false,
        connectionId,
        isolationLevel,
      });
    })
    .finally(async () => {
      await rawClient.$disconnect();
      if (process.connected) process.disconnect();
    });
});
