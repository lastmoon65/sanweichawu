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

const PASSWORD = 'dining-sessions-database-password';

interface DiningTableData {
  id: string;
  storeId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

interface DiningSessionData {
  id: string;
  storeId: string;
  tableId: string;
  status: 'OPEN' | 'CLOSED';
  version: number;
  openedAt: string;
  closedAt: string | null;
  closedByStaffId: string | null;
}

interface DiningSessionListData {
  items: DiningSessionData[];
}

interface CreatedIdentity {
  staffId: bigint;
  storeId: bigint;
  username: string;
}

function expectIsoTimestamp(value: string): void {
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(new Date(value).toISOString()).toBe(value);
}

describe('dining sessions with a real database', () => {
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
    const storeIds = createdStoreIds.splice(0);
    for (const storeId of storeIds) {
      await prisma.diningSession.deleteMany({ where: { storeId } });
      await prisma.diningTable.deleteMany({ where: { storeId } });
    }
    for (const staffId of createdStaffIds.splice(0)) {
      await prisma.staffCredential.deleteMany({ where: { staffId } });
      await prisma.staff.deleteMany({ where: { id: staffId } });
    }
    for (const storeId of storeIds) {
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
  ): Promise<CreatedIdentity> {
    const suffix = randomUUID();
    const store = await prisma.store.create({
      data: { name: `sw-session-store-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    createdStoreIds.push(store.id);

    const staff = await prisma.staff.create({
      data: {
        storeId: store.id,
        name: `sw-session-staff-${suffix}`,
        role,
        status,
      },
      select: { id: true },
    });
    createdStaffIds.push(staff.id);

    const username = `sw-session-${suffix}`;
    await prisma.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });
    return { staffId: staff.id, storeId: store.id, username };
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

  function successData<T>(response: HttpResponse): T {
    return (response.body as ApiSuccessBody<T>).data;
  }

  function errorCode(response: HttpResponse): string {
    return (response.body as ApiErrorBody).error.code;
  }

  async function createTable(token: string, name: string, code: string): Promise<DiningTableData> {
    const response = await api('POST', '/dining-tables', { token, body: { name, code } });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return successData<DiningTableData>(response);
  }

  it('serializes the public session fields and enforces open/close transitions', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const table = await createTable(token, '一号桌', 'A01');

    const open = await api('POST', `/dining-tables/${table.id}/sessions`, { token });
    expect(open.status).toBe(201);
    const opened = successData<DiningSessionData>(open);
    expect(Object.keys(opened).sort()).toEqual([
      'closedAt',
      'closedByStaffId',
      'id',
      'openedAt',
      'status',
      'storeId',
      'tableId',
      'version',
    ]);
    expect(opened).toMatchObject({
      storeId: actor.storeId.toString(),
      tableId: table.id,
      status: 'OPEN',
      version: 1,
      closedAt: null,
      closedByStaffId: null,
    });
    expectIsoTimestamp(opened.openedAt);

    const duplicate = await api('POST', `/dining-tables/${table.id}/sessions`, { token });
    expect(duplicate.status).toBe(409);
    expect(errorCode(duplicate)).toBe('SESSION_ALREADY_OPEN');

    const staleClose = await api('POST', `/dining-sessions/${opened.id}/close`, {
      token,
      body: { version: 2 },
    });
    expect(staleClose.status).toBe(409);
    expect(errorCode(staleClose)).toBe('CONFLICT');

    const close = await api('POST', `/dining-sessions/${opened.id}/close`, {
      token,
      body: { version: 1 },
    });
    expect(close.status).toBe(200);
    const closed = successData<DiningSessionData>(close);
    expect(closed).toMatchObject({
      id: opened.id,
      status: 'CLOSED',
      version: 2,
      closedByStaffId: actor.staffId.toString(),
    });
    expect(closed.closedAt).not.toBeNull();
    expectIsoTimestamp(closed.closedAt ?? '');

    const closedAgain = await api('POST', `/dining-sessions/${opened.id}/close`, {
      token,
      body: { version: 2 },
    });
    expect(closedAgain.status).toBe(409);
    expect(errorCode(closedAgain)).toBe('SESSION_CLOSED');

    const detail = await api('GET', `/dining-sessions/${opened.id}`, { token });
    expect(detail.status).toBe(200);
    expect(successData<DiningSessionData>(detail)).toMatchObject({
      id: opened.id,
      status: 'CLOSED',
    });

    const list = await api('GET', '/dining-sessions?status=CLOSED', { token });
    expect(list.status).toBe(200);
    expect(successData<DiningSessionListData>(list).items.map((item) => item.id)).toEqual([
      opened.id,
    ]);

    const invalidStatus = await api('GET', '/dining-sessions?status=PENDING', { token });
    expect(invalidStatus.status).toBe(400);
    expect(errorCode(invalidStatus)).toBe('VALIDATION_ERROR');
  });

  it('allows exactly one winner across 10 rounds of two concurrent open requests', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const table = await createTable(token, '并发桌', 'RACE-01');
    const tableId = BigInt(table.id);

    for (let round = 1; round <= 10; round += 1) {
      const responses = await Promise.all([
        api('POST', `/dining-tables/${table.id}/sessions`, { token }),
        api('POST', `/dining-tables/${table.id}/sessions`, { token }),
      ]);

      expect(
        responses.map((response) => response.status).sort((left, right) => left - right),
        `round ${round}`,
      ).toEqual([201, 409]);

      const winner = responses.find((response) => response.status === 201);
      const loser = responses.find((response) => response.status === 409);
      expect(winner).toBeDefined();
      expect(loser).toBeDefined();
      expect(errorCode(loser as HttpResponse)).toBe('SESSION_ALREADY_OPEN');

      const openSessions = await prisma.diningSession.findMany({
        where: { tableId, status: 'OPEN' },
        select: { id: true, version: true },
      });
      expect(openSessions, `open sessions after round ${round}`).toHaveLength(1);
      const openSession = openSessions[0];
      expect(openSession).toBeDefined();
      expect(openSession?.id.toString()).toBe(
        successData<DiningSessionData>(winner as HttpResponse).id,
      );

      const close = await api('POST', `/dining-sessions/${openSession?.id}/close`, {
        token,
        body: { version: openSession?.version },
      });
      expect(close.status, `close after round ${round}`).toBe(200);

      const stillOpen = await prisma.diningSession.count({
        where: { tableId, status: 'OPEN' },
      });
      expect(stillOpen, `open count after close in round ${round}`).toBe(0);
    }

    const sessions = await prisma.diningSession.findMany({
      where: { storeId: actor.storeId, tableId },
    });
    expect(sessions).toHaveLength(10);
    for (const session of sessions) {
      expect(session.closedAt).not.toBeNull();
      expect(session.closedByStaffId).toBe(actor.staffId);
    }

    const openRows = await prisma.$queryRaw<
      Array<{ id: bigint; closedAt: Date | null; closedByStaffId: bigint | null }>
    >`
      SELECT id, closed_at AS closedAt, closed_by_staff_id AS closedByStaffId
      FROM dining_sessions
      WHERE table_id = ${tableId} AND status = 'OPEN'
    `;
    expect(openRows).toHaveLength(0);

    const closedRows = await prisma.$queryRaw<
      Array<{ id: bigint; closedAt: Date | null; closedByStaffId: bigint | null }>
    >`
      SELECT id, closed_at AS closedAt, closed_by_staff_id AS closedByStaffId
      FROM dining_sessions
      WHERE table_id = ${tableId} AND status = 'CLOSED'
    `;
    expect(closedRows).toHaveLength(10);
    for (const row of closedRows) {
      expect(row.closedAt).not.toBeNull();
      expect(row.closedByStaffId).not.toBeNull();
    }
  });

  it('returns 403 for foreign session ids and keeps other stores out of the list', async () => {
    const actor = await createIdentity('OWNER');
    const foreign = await createIdentity('OWNER');
    const actorToken = await login(actor);
    const foreignToken = await login(foreign);
    const foreignTable = await createTable(foreignToken, '对方店桌', 'FOREIGN-01');
    const foreignOpen = await api('POST', `/dining-tables/${foreignTable.id}/sessions`, {
      token: foreignToken,
    });
    expect(foreignOpen.status).toBe(201);
    const foreignSession = successData<DiningSessionData>(foreignOpen);

    const openOnForeignTable = await api('POST', `/dining-tables/${foreignTable.id}/sessions`, {
      token: actorToken,
    });
    expect(openOnForeignTable.status).toBe(403);
    expect(errorCode(openOnForeignTable)).toBe('FORBIDDEN');

    for (const sessionId of [foreignSession.id, '999999999999999999', 'not-a-number', '0']) {
      const read = await api('GET', `/dining-sessions/${sessionId}`, { token: actorToken });
      expect(read.status).toBe(403);
      expect(errorCode(read)).toBe('FORBIDDEN');
      expect(JSON.stringify(read.body)).not.toContain(foreignTable.name);

      const close = await api('POST', `/dining-sessions/${sessionId}/close`, {
        token: actorToken,
        body: { version: 1 },
      });
      expect(close.status).toBe(403);
      expect(errorCode(close)).toBe('FORBIDDEN');
    }

    const list = await api('GET', '/dining-sessions', { token: actorToken });
    expect(list.status).toBe(200);
    expect(successData<DiningSessionListData>(list).items).toEqual([]);
  });

  it('returns TABLE_REFERENCED instead of 500 when deleting a table with an open session', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const table = await createTable(token, '在用桌', 'IN-USE-01');
    const open = await api('POST', `/dining-tables/${table.id}/sessions`, { token });
    expect(open.status).toBe(201);

    const remove = await api('DELETE', `/dining-tables/${table.id}`, { token });
    expect(remove.status).toBe(409);
    expect(errorCode(remove)).toBe('TABLE_REFERENCED');
    expect(await prisma.diningTable.findUnique({ where: { id: BigInt(table.id) } })).not.toBeNull();
  });
});
