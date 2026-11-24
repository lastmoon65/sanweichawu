import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { StaffRole, StaffStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createHttpHarness } from './support/http-harness.js';
import { createTestConfig } from './support/test-config.js';

interface StaffRow {
  id: bigint;
  storeId: bigint;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface CredentialRow {
  id: bigint;
  staffId: bigint;
  username: string;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TableRow {
  id: bigint;
  storeId: bigint;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionRow {
  id: bigint;
  storeId: bigint;
  tableId: bigint;
  status: 'OPEN' | 'CLOSED';
  version: number;
  openedAt: Date;
  closedAt: Date | null;
  closedByStaffId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionWhere {
  id?: bigint;
  storeId?: bigint;
  tableId?: bigint;
  status?: 'OPEN' | 'CLOSED';
}

class FakeSessionPrisma {
  staffRows: StaffRow[] = [];
  credentialRows: CredentialRow[] = [];
  tableRows: TableRow[] = [];
  sessionRows: SessionRow[] = [];
  orderSessionIds: bigint[] = [];
  private nextStaffId = 1n;
  private nextTableId = 1n;
  private nextSessionId = 1n;

  readonly $queryRaw = async (): Promise<Array<{ id: bigint }>> => [{ id: 1n }];
  readonly $transaction = async <T>(
    callback: (transaction: FakeSessionPrisma) => Promise<T>,
  ): Promise<T> => callback(this);
  readonly ping = async (): Promise<void> => undefined;

  readonly staff = {
    findUnique: async (args: { where: { id: bigint } }) => {
      const staff = this.staffRows.find((entry) => entry.id === args.where.id);
      if (!staff) {
        return null;
      }
      return {
        ...staff,
        credential:
          this.credentialRows.find((credential) => credential.staffId === staff.id) ?? null,
      };
    },
  };

  readonly staffCredential = {
    findUnique: async (args: { where: { username?: string; id?: bigint } }) => {
      const credential = this.credentialRows.find((entry) =>
        args.where.username !== undefined
          ? entry.username === args.where.username
          : entry.id === args.where.id,
      );
      if (!credential) {
        return null;
      }
      const staff = this.staffRows.find((entry) => entry.id === credential.staffId);
      return staff ? { ...credential, staff: { ...staff } } : null;
    },
    update: async (args: {
      where: { id: bigint };
      data: { failedAttempts: number; lockedUntil: Date | null };
    }) => {
      const credential = this.credentialRows.find((entry) => entry.id === args.where.id);
      if (!credential) {
        throw new Error('Credential not found');
      }
      credential.failedAttempts = args.data.failedAttempts;
      credential.lockedUntil = args.data.lockedUntil;
      credential.updatedAt = new Date();
      return credential;
    },
  };

  readonly diningTable = {
    findFirst: async (args: { where: { id?: bigint; storeId?: bigint } }) => {
      const table = this.tableRows.find(
        (entry) =>
          (args.where.id === undefined || entry.id === args.where.id) &&
          (args.where.storeId === undefined || entry.storeId === args.where.storeId),
      );
      return table ? { ...table } : null;
    },
  };

  readonly diningSession = {
    findFirst: async (args: { where: SessionWhere }) => {
      const session = this.sessionRows.find((entry) => this.matches(entry, args.where));
      return session ? { ...session } : null;
    },
    findMany: async (args: { where: { storeId: bigint; status?: 'OPEN' | 'CLOSED' } }) =>
      this.sessionRows
        .filter(
          (entry) =>
            entry.storeId === args.where.storeId &&
            (args.where.status === undefined || entry.status === args.where.status),
        )
        .sort((left, right) => {
          const byOpenedAt = right.openedAt.getTime() - left.openedAt.getTime();
          if (byOpenedAt !== 0) {
            return byOpenedAt;
          }
          return left.id < right.id ? 1 : left.id > right.id ? -1 : 0;
        })
        .map((entry) => ({ ...entry })),
    create: async (args: {
      data: {
        storeId: bigint;
        tableId: bigint;
        status: 'OPEN' | 'CLOSED';
        openedAt: Date;
        version: number;
      };
    }) => {
      const now = new Date();
      const session: SessionRow = {
        id: this.nextSessionId,
        storeId: args.data.storeId,
        tableId: args.data.tableId,
        status: args.data.status,
        version: args.data.version,
        openedAt: args.data.openedAt,
        closedAt: null,
        closedByStaffId: null,
        createdAt: now,
        updatedAt: now,
      };
      this.nextSessionId += 1n;
      this.sessionRows.push(session);
      return { ...session };
    },
    update: async (args: {
      where: { id: bigint };
      data: {
        status: 'OPEN' | 'CLOSED';
        closedAt: Date;
        closedByStaffId: bigint;
        version: number;
      };
    }) => {
      const session = this.sessionRows.find((entry) => entry.id === args.where.id);
      if (!session) {
        throw new Error('Session not found');
      }
      session.status = args.data.status;
      session.closedAt = args.data.closedAt;
      session.closedByStaffId = args.data.closedByStaffId;
      session.version = args.data.version;
      session.updatedAt = new Date();
      return { ...session };
    },
  };

  readonly order = {
    count: async (args: { where: { sessionId: bigint } }) =>
      this.orderSessionIds.filter((sessionId) => sessionId === args.where.sessionId).length,
  };

  private matches(session: SessionRow, where: SessionWhere): boolean {
    return (
      (where.id === undefined || session.id === where.id) &&
      (where.storeId === undefined || session.storeId === where.storeId) &&
      (where.tableId === undefined || session.tableId === where.tableId) &&
      (where.status === undefined || session.status === where.status)
    );
  }

  reset(): void {
    this.staffRows = [];
    this.credentialRows = [];
    this.tableRows = [];
    this.sessionRows = [];
    this.orderSessionIds = [];
    this.nextStaffId = 1n;
    this.nextTableId = 1n;
    this.nextSessionId = 1n;
  }

  addStaff(input: {
    username: string;
    passwordHash: string;
    role: StaffRole;
    storeId: bigint;
  }): StaffRow {
    const id = this.nextStaffId;
    this.nextStaffId += 1n;
    const now = new Date();
    const staff: StaffRow = {
      id,
      storeId: input.storeId,
      name: `Staff ${id}`,
      role: input.role,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.staffRows.push(staff);
    this.credentialRows.push({
      id: BigInt(this.credentialRows.length + 1),
      staffId: id,
      username: input.username,
      passwordHash: input.passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    });
    return staff;
  }

  addTable(storeId: bigint, name: string, code: string): TableRow {
    const now = new Date();
    const table: TableRow = {
      id: this.nextTableId,
      storeId,
      name,
      code,
      createdAt: now,
      updatedAt: now,
    };
    this.nextTableId += 1n;
    this.tableRows.push(table);
    return table;
  }

  addSession(
    storeId: bigint,
    tableId: bigint,
    status: 'OPEN' | 'CLOSED' = 'OPEN',
    version = 1,
  ): SessionRow {
    const now = new Date();
    const session: SessionRow = {
      id: this.nextSessionId,
      storeId,
      tableId,
      status,
      version,
      openedAt: new Date(now.getTime() - 60_000),
      closedAt: status === 'CLOSED' ? now : null,
      closedByStaffId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.nextSessionId += 1n;
    this.sessionRows.push(session);
    return session;
  }
}

describe('dining session HTTP contract', () => {
  const prisma = new FakeSessionPrisma();
  const passwords = new PasswordService();
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await passwords.hash('dining-session-password');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(createTestConfig())
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
  });

  beforeEach(() => {
    prisma.reset();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function api(
    method: string,
    path: string,
    options: { body?: unknown; token?: string } = {},
  ) {
    const headers: Record<string, string> = {};
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    return request(method, `/api/v1${path}`, { body: options.body, headers });
  }

  async function addActor(role: StaffRole = 'STAFF', storeId = 10n) {
    const suffix = `${storeId}-${role}-${prisma.staffRows.length + 1}`;
    const username = `dining-session-${suffix}`;
    const staff = prisma.addStaff({ username, passwordHash, role, storeId });
    const login = await api('POST', '/auth/staff/login', {
      body: { username, password: 'dining-session-password' },
    });
    expect(login.status).toBe(200);
    return {
      token: (login.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken,
      staffId: staff.id,
    };
  }

  function successData<T>(response: { body: unknown }): T {
    return (response.body as ApiSuccessBody<T>).data;
  }

  function errorCode(response: { body: unknown }): string {
    return (response.body as ApiErrorBody).error.code;
  }

  it('opens a dining session and returns the public session shape', async () => {
    const { token } = await addActor('MANAGER');
    const table = prisma.addTable(10n, '一号桌', 'A01');

    const response = await api('POST', `/dining-tables/${table.id}/sessions`, { token });

    expect(response.status).toBe(201);
    const session = successData<Record<string, unknown>>(response);
    expect(Object.keys(session).sort()).toEqual([
      'closedAt',
      'closedByStaffId',
      'id',
      'openedAt',
      'status',
      'storeId',
      'tableId',
      'version',
    ]);
    expect(session).toMatchObject({
      storeId: '10',
      tableId: table.id.toString(),
      status: 'OPEN',
      version: 1,
      closedAt: null,
      closedByStaffId: null,
    });
    expect(session.openedAt).toMatch(/Z$/);
    expect(prisma.sessionRows).toHaveLength(1);
    expect(prisma.sessionRows[0]).toMatchObject({ status: 'OPEN', version: 1 });
  });

  it('rejects a second open session on the same table', async () => {
    const { token } = await addActor();
    const table = prisma.addTable(10n, '一号桌', 'A01');

    const first = await api('POST', `/dining-tables/${table.id}/sessions`, { token });
    expect(first.status).toBe(201);
    const second = await api('POST', `/dining-tables/${table.id}/sessions`, { token });

    expect(second.status).toBe(409);
    expect(errorCode(second)).toBe('SESSION_ALREADY_OPEN');
    expect(prisma.sessionRows).toHaveLength(1);
  });

  it('closes an open session with the matching version', async () => {
    const { token, staffId } = await addActor();
    const table = prisma.addTable(10n, '一号桌', 'A01');
    const opened = successData<{ id: string }>(
      await api('POST', `/dining-tables/${table.id}/sessions`, { token }),
    );

    const response = await api('POST', `/dining-sessions/${opened.id}/close`, {
      token,
      body: { version: 1 },
    });

    expect(response.status).toBe(200);
    const closed = successData<Record<string, unknown>>(response);
    expect(closed).toMatchObject({
      id: opened.id,
      status: 'CLOSED',
      version: 2,
      closedByStaffId: staffId.toString(),
    });
    expect(closed.closedAt).toMatch(/Z$/);
    expect(prisma.sessionRows[0]).toMatchObject({
      status: 'CLOSED',
      version: 2,
      closedByStaffId: staffId,
    });
  });

  it('rejects a close request with a stale version', async () => {
    const { token } = await addActor();
    const table = prisma.addTable(10n, '一号桌', 'A01');
    const opened = successData<{ id: string }>(
      await api('POST', `/dining-tables/${table.id}/sessions`, { token }),
    );

    const response = await api('POST', `/dining-sessions/${opened.id}/close`, {
      token,
      body: { version: 2 },
    });

    expect(response.status).toBe(409);
    expect(errorCode(response)).toBe('CONFLICT');
    expect(prisma.sessionRows[0]).toMatchObject({ status: 'OPEN', version: 1 });
  });

  it('rejects closing an already closed session with SESSION_CLOSED', async () => {
    const { token } = await addActor();
    const table = prisma.addTable(10n, '一号桌', 'A01');
    const opened = successData<{ id: string }>(
      await api('POST', `/dining-tables/${table.id}/sessions`, { token }),
    );
    expect(
      (await api('POST', `/dining-sessions/${opened.id}/close`, { token, body: { version: 1 } }))
        .status,
    ).toBe(200);

    const response = await api('POST', `/dining-sessions/${opened.id}/close`, {
      token,
      body: { version: 2 },
    });

    expect(response.status).toBe(409);
    expect(errorCode(response)).toBe('SESSION_CLOSED');
  });

  it('rejects closing a session that already has orders', async () => {
    const { token } = await addActor();
    const table = prisma.addTable(10n, '一号桌', 'A01');
    const opened = successData<{ id: string }>(
      await api('POST', `/dining-tables/${table.id}/sessions`, { token }),
    );
    prisma.orderSessionIds.push(BigInt(opened.id));

    const response = await api('POST', `/dining-sessions/${opened.id}/close`, {
      token,
      body: { version: 1 },
    });

    expect(response.status).toBe(409);
    expect(errorCode(response)).toBe('CONFLICT');
    expect(response.body).toMatchObject({
      error: { details: { orderCount: 1 } },
    });
    expect(prisma.sessionRows[0]).toMatchObject({ status: 'OPEN', version: 1 });
  });

  it('lists this store sessions and validates the status filter', async () => {
    const { token } = await addActor();
    const table = prisma.addTable(10n, '一号桌', 'A01');
    prisma.addSession(10n, table.id, 'OPEN');
    prisma.addSession(20n, table.id, 'OPEN');

    const filtered = await api('GET', '/dining-sessions?status=OPEN', { token });
    expect(filtered.status).toBe(200);
    const items = successData<{ items: Array<{ storeId: string }> }>(filtered).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.storeId).toBe('10');

    for (const status of ['open', 'CLOSED,OPEN', 'PENDING']) {
      const invalid = await api('GET', `/dining-sessions?status=${status}`, { token });
      expect(invalid.status).toBe(400);
      expect(errorCode(invalid)).toBe('VALIDATION_ERROR');
    }
  });

  it('validates the close version body', async () => {
    const { token } = await addActor();
    const table = prisma.addTable(10n, '一号桌', 'A01');
    const session = prisma.addSession(10n, table.id, 'OPEN');

    for (const body of [{}, { version: 0 }, { version: -1 }, { version: 1.5 }, { version: '1' }]) {
      const response = await api('POST', `/dining-sessions/${session.id}/close`, { token, body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    }
  });

  it('returns 403 for a foreign or missing table id without leaking data', async () => {
    const { token } = await addActor();
    const foreignTable = prisma.addTable(20n, '对方店桌', 'FOREIGN-01');

    for (const tableId of [foreignTable.id.toString(), '999', 'not-a-number', '0']) {
      const response = await api('POST', `/dining-tables/${tableId}/sessions`, { token });
      expect(response.status).toBe(403);
      expect(errorCode(response)).toBe('FORBIDDEN');
      expect(JSON.stringify(response.body)).not.toContain('对方店桌');
      expect(JSON.stringify(response.body)).not.toContain('FOREIGN-01');
    }
    expect(prisma.sessionRows).toHaveLength(0);
  });

  it('returns 403 for a foreign or missing session id on read and close', async () => {
    const { token } = await addActor();
    const foreignTable = prisma.addTable(20n, '对方店桌', 'FOREIGN-01');
    const foreignSession = prisma.addSession(20n, foreignTable.id, 'OPEN');

    for (const sessionId of [foreignSession.id.toString(), '999', 'not-a-number', '0']) {
      const read = await api('GET', `/dining-sessions/${sessionId}`, { token });
      expect(read.status).toBe(403);
      expect(errorCode(read)).toBe('FORBIDDEN');

      const close = await api('POST', `/dining-sessions/${sessionId}/close`, {
        token,
        body: { version: 1 },
      });
      expect(close.status).toBe(403);
      expect(errorCode(close)).toBe('FORBIDDEN');
      expect(JSON.stringify(read.body)).not.toContain('对方店桌');
    }
  });
});
