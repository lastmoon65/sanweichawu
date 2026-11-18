import 'reflect-metadata';

import { randomBytes, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import type { StaffRole } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createHttpHarness } from './support/http-harness.js';
import type { HttpResponse } from './support/http-harness.js';
import { createTestConfig } from './support/test-config.js';
import { requireTaskTestDatabaseUrl } from './support/task-database.js';

const PASSWORD = 'database integration password';

describe('staff authentication with a real database', () => {
  let prisma: PrismaClient | undefined;
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;
  const staffIds: bigint[] = [];
  const storeIds: bigint[] = [];
  const passwords = new PasswordService();

  beforeAll(async () => {
    const databaseUrl = requireTaskTestDatabaseUrl();

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        createTestConfig({
          databaseUrl,
          jwtAccessSecret: randomBytes(32).toString('base64url'),
          jwtAccessTtlSeconds: 60,
        }),
      )
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
  });

  afterEach(async () => {
    if (!prisma) {
      return;
    }
    for (const staffId of staffIds.splice(0)) {
      await prisma.staffCredential.deleteMany({ where: { staffId } });
      await prisma.staff.deleteMany({ where: { id: staffId } });
    }
    for (const storeId of storeIds.splice(0)) {
      await prisma.store.deleteMany({ where: { id: storeId } });
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  async function createStaff(role: StaffRole): Promise<{
    staffId: bigint;
    storeId: bigint;
    username: string;
  }> {
    if (!prisma) {
      throw new Error('Prisma is not initialized');
    }
    const suffix = randomUUID();
    const store = await prisma.store.create({
      data: { name: `auth-test-store-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    storeIds.push(store.id);
    const staff = await prisma.staff.create({
      data: {
        storeId: store.id,
        name: `auth-test-staff-${suffix}`,
        role,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    staffIds.push(staff.id);
    const username = `auth-test-${suffix}`;
    await prisma.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });
    return { staffId: staff.id, storeId: store.id, username };
  }

  async function api(
    method: string,
    path: string,
    options: { body?: unknown; token?: string; requestId?: string } = {},
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = {};
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    if (options.requestId) {
      headers['x-request-id'] = options.requestId;
    }
    return request(method, `/api/v1${path}`, { body: options.body, headers });
  }

  async function login(username: string, password: string, requestId?: string) {
    return api('POST', '/auth/staff/login', {
      body: { username, password },
      requestId,
    });
  }

  it('authenticates against StaffCredential and resolves current identity from the database', async () => {
    const created = await createStaff('OWNER');
    const response = await login(created.username, PASSWORD);

    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessBody<{
      accessToken: string;
      staff: { staffId: string; storeId: string; role: string; username: string };
    }>;
    expect(body.data.staff).toMatchObject({
      staffId: created.staffId.toString(),
      storeId: created.storeId.toString(),
      role: 'OWNER',
      username: created.username,
    });

    const meResponse = await api('GET', '/auth/staff/me?staffId=999999&role=STAFF', {
      token: body.data.accessToken,
    });
    expect(meResponse.status).toBe(200);
    expect((meResponse.body as ApiSuccessBody<Record<string, string>>).data).toMatchObject({
      staffId: created.staffId.toString(),
      storeId: created.storeId.toString(),
      role: 'OWNER',
      username: created.username,
    });

    const credential = await prisma?.staffCredential.findUnique({
      where: { staffId: created.staffId },
    });
    expect(credential?.passwordHash).not.toBe(PASSWORD);
    expect(credential?.passwordHash.startsWith('scrypt:')).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(credential?.passwordHash ?? '');
  });

  it('returns the same public failure for an unknown username and a wrong password', async () => {
    const created = await createStaff('STAFF');
    const unknownUsername = await login('missing-database-user', 'wrong password', 'db-failure');
    const wrongPassword = await login(created.username, 'wrong password', 'db-failure');

    expect(unknownUsername.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUsername.body).toEqual(wrongPassword.body);
    expect((unknownUsername.body as ApiErrorBody).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('persists the failure count, locks the credential and rejects the correct password', async () => {
    const created = await createStaff('MANAGER');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(created.username, 'wrong password')).status).toBe(401);
    }

    const lockedLogin = await login(created.username, PASSWORD);
    expect(lockedLogin.status).toBe(401);
    expect((lockedLogin.body as ApiErrorBody).error.code).toBe('INVALID_CREDENTIALS');

    const credential = await prisma?.staffCredential.findUnique({
      where: { staffId: created.staffId },
    });
    expect(credential?.failedAttempts).toBe(5);
    expect(credential?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an already-issued token after Staff is disabled in the database', async () => {
    const created = await createStaff('MANAGER');
    const loginResponse = await login(created.username, PASSWORD);
    const token = (loginResponse.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;

    expect((await api('GET', '/auth/staff/me', { token })).status).toBe(200);
    await prisma?.staff.update({ where: { id: created.staffId }, data: { status: 'DISABLED' } });

    const disabledResponse = await api('GET', '/auth/staff/me', { token });
    expect(disabledResponse.status).toBe(401);
    expect((disabledResponse.body as ApiErrorBody).error.code).toBe('UNAUTHORIZED');
  });
});
