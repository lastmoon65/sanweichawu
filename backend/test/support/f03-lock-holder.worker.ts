import 'reflect-metadata';

import { PrismaClient } from '@prisma/client';

import { FIRST_OWNER_BOOTSTRAP_LOCK_KEY } from '../../src/auth/bootstrap-error-diagnostic.js';
import { requireTaskTestDatabaseUrl } from './task-database.js';

const databaseUrl = requireTaskTestDatabaseUrl();
const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const keepAlive = new Promise<void>(() => undefined);

void client
  .$transaction(async (transaction) => {
    const rows = await transaction.$queryRawUnsafe<Array<{ connection_id: bigint | string }>>(
      'SELECT CONNECTION_ID() AS connection_id',
    );
    await transaction.$queryRawUnsafe(
      'SELECT lock_key FROM bootstrap_locks WHERE lock_key = ? FOR UPDATE',
      FIRST_OWNER_BOOTSTRAP_LOCK_KEY,
    );
    process.send?.({ type: 'locked', connectionId: String(rows[0]?.connection_id) });
    await keepAlive;
  })
  .catch(() => {
    process.exitCode = 1;
  });
