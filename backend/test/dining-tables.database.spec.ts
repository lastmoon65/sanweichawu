import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import type { StaffRole, StaffStatus } from '@prisma/client';
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

const PASSWORD = 'dining-tables-database-password';
const TABLE_FIELDS = ['code', 'createdAt', 'id', 'name', 'storeId', 'updatedAt'];

interface DiningTableData {
  id: string;
  storeId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

interface DiningTableListData {
  items: DiningTableData[];
}

interface CreatedIdentity {
  staffId: bigint;
  storeId: bigint;
  username: string;
}

describe('dining table master data with a real database', () => {
  const passwords = new PasswordService();
  const createdStaffIds: bigint[] = [];
  const createdStoreIds: bigint[] = [];
  let prisma: PrismaClient;
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;

  beforeAll(async () => {
    const databaseUrl = requireTaskTestDatabaseUrl();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(createTestConfig({ databaseUrl }))
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
  });

  afterEach(async () => {
    for (const staffId of createdStaffIds.splice(0)) {
      await prisma.staffCredential.deleteMany({ where: { staffId } });
      await prisma.staff.deleteMany({ where: { id: staffId } });
    }
    for (const storeId of createdStoreIds.splice(0)) {
      await prisma.diningSession.deleteMany({ where: { storeId } });
      await prisma.diningTable.deleteMany({ where: { storeId } });
      await prisma.store.deleteMany({ where: { id: storeId } });
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  async function createIdentity(
    role: StaffRole = 'OWNER',
    status: StaffStatus = 'ACTIVE',
    existingStoreId?: bigint,
  ): Promise<CreatedIdentity> {
    const suffix = randomUUID();
    let storeId = existingStoreId;
    if (storeId === undefined) {
      const store = await prisma.store.create({
        data: { name: `sw007-dining-store-${suffix}`, status: 'ACTIVE' },
        select: { id: true },
      });
      storeId = store.id;
      createdStoreIds.push(store.id);
    }

    const staff = await prisma.staff.create({
      data: {
        storeId,
        name: `sw007-dining-staff-${suffix}`,
        role,
        status,
      },
      select: { id: true },
    });
    createdStaffIds.push(staff.id);

    const username = `sw007-dining-${suffix}`;
    await prisma.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });
    return { staffId: staff.id, storeId, username };
  }

  async function login(identity: CreatedIdentity): Promise<string> {
    const response = await api('POST', '/auth/staff/login', {
      body: { username: identity.username, password: PASSWORD },
    });
    expect(response.status).toBe(200);
    return (response.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;
  }

  async function api(
    method: string,
    path: string,
    options: { body?: unknown; token?: string } = {},
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = {};
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    return request(method, `/api/v1${path}`, { body: options.body, headers });
  }

  async function createTable(
    token: string,
    name: string,
    code: string,
    extra: Record<string, unknown> = {},
  ): Promise<DiningTableData> {
    const response = await api('POST', '/dining-tables', {
      token,
      body: { name, code, ...extra },
    });
    expect(response.status).toBe(201);
    return (response.body as ApiSuccessBody<DiningTableData>).data;
  }

  function expectTableShape(table: DiningTableData, expectedStoreId: bigint): void {
    expect(Object.keys(table).sort()).toEqual(TABLE_FIELDS);
    expect(typeof table.id).toBe('string');
    expect(table.id).toMatch(/^[1-9]\d*$/);
    expect(table.storeId).toBe(expectedStoreId.toString());
    expect(typeof table.name).toBe('string');
    expect(typeof table.code).toBe('string');
    expect(table.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(table.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(table.createdAt).toISOString()).toBe(table.createdAt);
    expect(new Date(table.updatedAt).toISOString()).toBe(table.updatedAt);
    expect(table).not.toHaveProperty('status');
    expect(table).not.toHaveProperty('capacity');
    expect(table).not.toHaveProperty('deletedAt');
  }

  it('supports the full lifecycle, trims input, isolates the store and returns the public shape', async () => {
    const actor = await createIdentity('OWNER');
    const foreignStore = await createIdentity('OWNER');
    const token = await login(actor);

    const second = await api('POST', '/dining-tables', {
      token,
      body: { name: '  二号桌  ', code: ' C02 ', storeId: foreignStore.storeId.toString() },
    });
    expect(second.status).toBe(201);
    const secondTable = (second.body as ApiSuccessBody<DiningTableData>).data;
    expectTableShape(secondTable, actor.storeId);
    expect(secondTable).toMatchObject({ name: '二号桌', code: 'C02' });

    const first = await createTable(token, '一号桌', 'C01');
    expectTableShape(first, actor.storeId);

    const list = await api('GET', `/dining-tables?storeId=${foreignStore.storeId}`, {
      token,
    });
    expect(list.status).toBe(200);
    const listed = (list.body as ApiSuccessBody<DiningTableListData>).data;
    expect(Object.keys(listed)).toEqual(['items']);
    expect(listed.items.map((table) => table.code)).toEqual(['C01', 'C02']);
    for (const table of listed.items) {
      expectTableShape(table, actor.storeId);
    }

    const getResponse = await api(
      'GET',
      `/dining-tables/${first.id}?storeId=${foreignStore.storeId}`,
      {
        token,
      },
    );
    expect(getResponse.status).toBe(200);
    expect((getResponse.body as ApiSuccessBody<DiningTableData>).data).toEqual(first);

    const update = await api('PATCH', `/dining-tables/${secondTable.id}`, {
      token,
      body: { name: '  临窗桌  ', code: ' C00 ', storeId: foreignStore.storeId.toString() },
    });
    expect(update.status).toBe(200);
    const updated = (update.body as ApiSuccessBody<DiningTableData>).data;
    expectTableShape(updated, actor.storeId);
    expect(updated).toMatchObject({
      id: secondTable.id,
      storeId: actor.storeId.toString(),
      name: '临窗桌',
      code: 'C00',
    });

    const renameOnly = await api('PATCH', `/dining-tables/${secondTable.id}`, {
      token,
      body: { name: '窗边桌' },
    });
    expect(renameOnly.status).toBe(200);
    expect((renameOnly.body as ApiSuccessBody<DiningTableData>).data).toMatchObject({
      name: '窗边桌',
      code: 'C00',
    });

    const removed = await api('DELETE', `/dining-tables/${secondTable.id}`, { token });
    expect(removed.status).toBe(200);
    const removedTable = (removed.body as ApiSuccessBody<DiningTableData>).data;
    expectTableShape(removedTable, actor.storeId);
    expect(removedTable.id).toBe(secondTable.id);
    expect(
      await prisma.diningTable.findUnique({ where: { id: BigInt(secondTable.id) } }),
    ).toBeNull();

    const afterDelete = await api('GET', `/dining-tables/${secondTable.id}`, { token });
    expect(afterDelete.status).toBe(403);
    expect((afterDelete.body as ApiErrorBody).error.code).toBe('FORBIDDEN');
  });

  it.each(['OWNER', 'MANAGER', 'STAFF'] as const)(
    'allows an ACTIVE %s to maintain tables',
    async (role) => {
      const actor = await createIdentity(role);
      const token = await login(actor);
      const table = await createTable(token, `${role}桌`, `${role}-01`);

      const list = await api('GET', '/dining-tables', { token });
      expect(list.status).toBe(200);
      expect((list.body as ApiSuccessBody<DiningTableListData>).data.items).toHaveLength(1);

      const get = await api('GET', `/dining-tables/${table.id}`, { token });
      expect(get.status).toBe(200);

      const update = await api('PATCH', `/dining-tables/${table.id}`, {
        token,
        body: { name: `${role}新桌` },
      });
      expect(update.status).toBe(200);

      const remove = await api('DELETE', `/dining-tables/${table.id}`, { token });
      expect(remove.status).toBe(200);
    },
  );

  it('rejects missing, empty, non-string and overlong fields with VALIDATION_ERROR', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const table = await createTable(token, '校验桌', 'VALID-01');
    const cases: Array<{ method: 'POST' | 'PATCH'; path: string; body: unknown }> = [
      { method: 'POST', path: '/dining-tables', body: { code: 'A' } },
      { method: 'POST', path: '/dining-tables', body: { name: 'A' } },
      { method: 'POST', path: '/dining-tables', body: { name: '   ', code: 'A' } },
      { method: 'POST', path: '/dining-tables', body: { name: 'A', code: '   ' } },
      { method: 'POST', path: '/dining-tables', body: { name: 'A'.repeat(41), code: 'A' } },
      { method: 'POST', path: '/dining-tables', body: { name: 'A', code: 'C'.repeat(41) } },
      { method: 'POST', path: '/dining-tables', body: { name: 123, code: 'A' } },
      { method: 'PATCH', path: `/dining-tables/${table.id}`, body: {} },
      { method: 'PATCH', path: `/dining-tables/${table.id}`, body: { name: '   ' } },
      { method: 'PATCH', path: `/dining-tables/${table.id}`, body: { code: ' ' } },
      { method: 'PATCH', path: `/dining-tables/${table.id}`, body: { code: 'C'.repeat(41) } },
      { method: 'PATCH', path: `/dining-tables/${table.id}`, body: { name: null } },
    ];

    for (const testCase of cases) {
      const response = await api(testCase.method, testCase.path, {
        token,
        body: testCase.body,
      });
      expect(response.status, JSON.stringify(testCase)).toBe(400);
      expect((response.body as ApiErrorBody).error.code).toBe('VALIDATION_ERROR');
    }

    const unchanged = await prisma.diningTable.findUnique({
      where: { id: BigInt(table.id) },
    });
    expect(unchanged).toMatchObject({ name: '校验桌', code: 'VALID-01' });
  });

  it('maps same-store code uniqueness to CONFLICT on create and update', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const existing = await createTable(token, '已有桌', 'DUP-01');
    const other = await createTable(token, '另一桌', 'DUP-02');

    for (const body of [
      { name: '重复桌', code: 'DUP-01' },
      { name: '重复桌', code: '  DUP-01  ' },
    ]) {
      const response = await api('POST', '/dining-tables', { token, body });
      expect(response.status).toBe(409);
      expect((response.body as ApiErrorBody).error.code).toBe('CONFLICT');
    }

    const update = await api('PATCH', `/dining-tables/${other.id}`, {
      token,
      body: { code: existing.code },
    });
    expect(update.status).toBe(409);
    expect((update.body as ApiErrorBody).error.code).toBe('CONFLICT');
    expect(await prisma.diningTable.findUnique({ where: { id: BigInt(other.id) } })).toMatchObject({
      name: '另一桌',
      code: 'DUP-02',
    });
  });

  it('returns 401 for missing, invalid and non-ACTIVE staff sessions', async () => {
    const actor = await createIdentity('STAFF');

    const missing = await api('GET', '/dining-tables');
    expect(missing.status).toBe(401);
    expect((missing.body as ApiErrorBody).error.code).toBe('UNAUTHORIZED');

    const invalid = await api('GET', '/dining-tables', { token: 'invalid-token' });
    expect(invalid.status).toBe(401);
    expect((invalid.body as ApiErrorBody).error.code).toBe('UNAUTHORIZED');

    const token = await login(actor);
    await prisma.staff.update({ where: { id: actor.staffId }, data: { status: 'DISABLED' } });
    const disabled = await api('GET', '/dining-tables', { token });
    expect(disabled.status).toBe(401);
    expect((disabled.body as ApiErrorBody).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 without leaking data for foreign, missing or malformed table ids', async () => {
    const actor = await createIdentity('OWNER');
    const foreign = await createIdentity('OWNER');
    const actorToken = await login(actor);
    const foreignToken = await login(foreign);
    const foreignTable = await createTable(foreignToken, '对方店桌', 'FOREIGN-01');

    const responses = [
      await api('GET', `/dining-tables/${foreignTable.id}`, { token: actorToken }),
      await api('PATCH', `/dining-tables/${foreignTable.id}`, {
        token: actorToken,
        body: { name: '越权修改' },
      }),
      await api('DELETE', `/dining-tables/${foreignTable.id}`, { token: actorToken }),
      await api('GET', '/dining-tables/999999999999999999', { token: actorToken }),
      await api('GET', '/dining-tables/9223372036854775808', { token: actorToken }),
      await api('GET', '/dining-tables/not-a-number', { token: actorToken }),
      await api('GET', '/dining-tables/0', { token: actorToken }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect((response.body as ApiErrorBody).error.code).toBe('FORBIDDEN');
      expect(JSON.stringify(response.body)).not.toContain(foreignTable.name);
      expect(JSON.stringify(response.body)).not.toContain(foreignTable.code);
    }

    const foreignRecord = await prisma.diningTable.findUnique({
      where: { id: BigInt(foreignTable.id) },
    });
    expect(foreignRecord).toMatchObject({ name: '对方店桌', code: 'FOREIGN-01' });
  });

  it('keeps the row and returns TABLE_REFERENCED when any dining session exists', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const table = await createTable(token, '历史桌', 'HISTORY-01');
    const closedAt = new Date();
    await prisma.diningSession.create({
      data: {
        storeId: actor.storeId,
        tableId: BigInt(table.id),
        status: 'CLOSED',
        openedAt: new Date(closedAt.getTime() - 60_000),
        closedAt,
      },
    });

    const remove = await api('DELETE', `/dining-tables/${table.id}`, { token });
    expect(remove.status).toBe(409);
    expect((remove.body as ApiErrorBody).error.code).toBe('TABLE_REFERENCED');
    expect(await prisma.diningTable.findUnique({ where: { id: BigInt(table.id) } })).not.toBeNull();

    const get = await api('GET', `/dining-tables/${table.id}`, { token });
    expect(get.status).toBe(200);
    expect((get.body as ApiSuccessBody<DiningTableData>).data).toMatchObject({
      id: table.id,
      name: '历史桌',
      code: 'HISTORY-01',
    });
  });
});
