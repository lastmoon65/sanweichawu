import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { StaffRole, StaffStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/app.setup.js';
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
  openedAt: Date;
  closedAt: Date | null;
}

interface TableWhere {
  id?: bigint;
  storeId?: bigint;
}

function knownPrismaError(code: 'P2002' | 'P2003'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('test database constraint', {
    code,
    clientVersion: '6.19.0',
  });
}

class FakeDiningPrisma {
  staffRows: StaffRow[] = [];
  credentialRows: CredentialRow[] = [];
  tableRows: TableRow[] = [];
  sessionRows: SessionRow[] = [];
  private nextTableId = 1n;

  readonly $queryRaw = async (): Promise<Array<{ id: bigint }>> => [{ id: 1n }];
  readonly $transaction = async <T>(
    callback: (transaction: FakeDiningPrisma) => Promise<T>,
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
    findMany: async (args: { where: { storeId: bigint } }) =>
      this.tableRows
        .filter((entry) => entry.storeId === args.where.storeId)
        .sort((left, right) =>
          left.code === right.code
            ? left.id < right.id
              ? -1
              : left.id > right.id
                ? 1
                : 0
            : left.code.localeCompare(right.code),
        )
        .map((entry) => ({ ...entry })),
    findFirst: async (args: { where: TableWhere; select?: unknown }) => {
      const table = this.tableRows.find(
        (entry) =>
          (args.where.id === undefined || entry.id === args.where.id) &&
          (args.where.storeId === undefined || entry.storeId === args.where.storeId),
      );
      return table ? { ...table } : null;
    },
    create: async (args: { data: { storeId: bigint; name: string; code: string } }) => {
      this.assertCodeAvailable(args.data.storeId, args.data.code);
      const now = new Date();
      const table: TableRow = {
        id: this.nextTableId,
        storeId: args.data.storeId,
        name: args.data.name,
        code: args.data.code,
        createdAt: now,
        updatedAt: now,
      };
      this.nextTableId += 1n;
      this.tableRows.push(table);
      return { ...table };
    },
    update: async (args: { where: { id: bigint }; data: { name?: string; code?: string } }) => {
      const table = this.tableRows.find((entry) => entry.id === args.where.id);
      if (!table) {
        throw knownPrismaError('P2003');
      }
      if (args.data.code !== undefined) {
        this.assertCodeAvailable(table.storeId, args.data.code, table.id);
        table.code = args.data.code;
      }
      if (args.data.name !== undefined) {
        table.name = args.data.name;
      }
      table.updatedAt = new Date();
      return { ...table };
    },
    delete: async (args: { where: { id: bigint } }) => {
      if (this.sessionRows.some((session) => session.tableId === args.where.id)) {
        throw knownPrismaError('P2003');
      }
      const index = this.tableRows.findIndex((entry) => entry.id === args.where.id);
      if (index < 0) {
        throw knownPrismaError('P2003');
      }
      const [table] = this.tableRows.splice(index, 1);
      return { ...table };
    },
  };

  readonly diningSession = {
    count: async (args: { where: { tableId: bigint; storeId?: bigint } }) =>
      this.sessionRows.filter(
        (session) =>
          session.tableId === args.where.tableId &&
          (args.where.storeId === undefined || session.storeId === args.where.storeId),
      ).length,
  };

  reset(): void {
    this.staffRows = [];
    this.credentialRows = [];
    this.tableRows = [];
    this.sessionRows = [];
    this.nextTableId = 1n;
  }

  addStaff(input: {
    username: string;
    passwordHash: string;
    role: StaffRole;
    storeId: bigint;
  }): StaffRow {
    const id = BigInt(this.staffRows.length + 1);
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

  private assertCodeAvailable(storeId: bigint, code: string, exceptId?: bigint): void {
    if (
      this.tableRows.some(
        (entry) => entry.storeId === storeId && entry.code === code && entry.id !== exceptId,
      )
    ) {
      throw knownPrismaError('P2002');
    }
  }
}

describe('dining table HTTP contract', () => {
  const prisma = new FakeDiningPrisma();
  const passwords = new PasswordService();
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await passwords.hash('dining-table-password');
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
    const username = `dining-unit-${suffix}`;
    prisma.addStaff({ username, passwordHash, role, storeId });
    const login = await api('POST', '/auth/staff/login', {
      body: { username, password: 'dining-table-password' },
    });
    expect(login.status).toBe(200);
    return (login.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;
  }

  it('allows list and create without a resource id and keeps ids/timestamps public-safe', async () => {
    const token = await addActor('OWNER');
    const create = await api('POST', '/dining-tables?storeId=999', {
      token,
      body: { name: '  一号桌  ', code: ' A01 ', storeId: '999' },
    });

    expect(create.status).toBe(201);
    const created = (create.body as ApiSuccessBody<Record<string, unknown>>).data;
    expect(Object.keys(created).sort()).toEqual([
      'code',
      'createdAt',
      'id',
      'name',
      'storeId',
      'updatedAt',
    ]);
    expect(created).toMatchObject({ storeId: '10', name: '一号桌', code: 'A01' });
    expect(typeof created.id).toBe('string');
    expect(created.createdAt).toMatch(/Z$/);
    expect(created.updatedAt).toMatch(/Z$/);

    const list = await api('GET', '/dining-tables', { token });
    expect(list.status).toBe(200);
    expect((list.body as ApiSuccessBody<{ items: unknown[] }>).data.items).toHaveLength(1);
  });

  it('rejects missing and empty fields before touching storage', async () => {
    const token = await addActor();
    const missingBody = await api('POST', '/dining-tables', { token });
    expect(missingBody.status).toBe(400);
    expect((missingBody.body as ApiErrorBody).error.code).toBe('VALIDATION_ERROR');

    const empty = await api('POST', '/dining-tables', {
      token,
      body: { name: '   ', code: '   ' },
    });
    expect(empty.status).toBe(400);
    expect((empty.body as ApiErrorBody).error.code).toBe('VALIDATION_ERROR');

    const malformed = await api('POST', '/dining-tables', { token, body: [] });
    expect(malformed.status).toBe(400);
    expect((malformed.body as ApiErrorBody).error.code).toBe('VALIDATION_ERROR');
    expect(prisma.tableRows).toHaveLength(0);
  });

  it('returns 401 without a token and 403 for foreign, missing or malformed ids', async () => {
    const token = await addActor('MANAGER');
    prisma.addTable(20n, 'foreign', 'F-01');

    const unauthorized = await api('GET', '/dining-tables');
    expect(unauthorized.status).toBe(401);
    expect((unauthorized.body as ApiErrorBody).error.code).toBe('UNAUTHORIZED');

    for (const tableId of ['1', '999', 'not-a-number', '0', '9223372036854775808']) {
      const response = await api('GET', `/dining-tables/${tableId}`, { token });
      expect(response.status).toBe(403);
      expect((response.body as ApiErrorBody).error.code).toBe('FORBIDDEN');
      expect(JSON.stringify(response.body)).not.toContain('foreign');
    }
  });

  it('maps duplicate codes to CONFLICT and keeps updates atomic', async () => {
    const token = await addActor('MANAGER');
    const first = prisma.addTable(10n, '一号桌', 'A01');
    const second = prisma.addTable(10n, '二号桌', 'A02');

    const conflict = await api('POST', '/dining-tables', {
      token,
      body: { name: '重复桌', code: 'A01' },
    });
    expect(conflict.status).toBe(409);
    expect((conflict.body as ApiErrorBody).error.code).toBe('CONFLICT');

    const updateConflict = await api('PATCH', `/dining-tables/${second.id}`, {
      token,
      body: { name: '改名但冲突', code: first.code },
    });
    expect(updateConflict.status).toBe(409);
    expect(prisma.tableRows.find((table) => table.id === second.id)).toMatchObject({
      name: '二号桌',
      code: 'A02',
    });
  });

  it('returns TABLE_REFERENCED and preserves the row when a closed session exists', async () => {
    const token = await addActor();
    const table = prisma.addTable(10n, '历史桌', 'H-01');
    const closedAt = new Date();
    prisma.sessionRows.push({
      id: 1n,
      storeId: 10n,
      tableId: table.id,
      status: 'CLOSED',
      openedAt: new Date(closedAt.getTime() - 60_000),
      closedAt,
    });

    const remove = await api('DELETE', `/dining-tables/${table.id}`, { token });
    expect(remove.status).toBe(409);
    expect((remove.body as ApiErrorBody).error.code).toBe('TABLE_REFERENCED');
    expect(prisma.tableRows.some((entry) => entry.id === table.id)).toBe(true);
  });
});
