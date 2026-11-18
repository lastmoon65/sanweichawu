import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { StaffRole, StaffStatus } from '@prisma/client';

import { BootstrapOwnerService } from '../src/auth/bootstrap-owner.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createTestConfig } from './support/test-config.js';

interface StoreRow {
  id: bigint;
  name: string;
  status: 'ACTIVE';
}

interface StaffRow {
  id: bigint;
  storeId: bigint;
  name: string;
  role: StaffRole;
  status: StaffStatus;
}

interface CredentialRow {
  id: bigint;
  staffId: bigint;
  username: string;
  passwordHash: string;
}

class FakeBootstrapPrisma {
  stores: StoreRow[] = [];
  staff: StaffRow[] = [];
  credentials: CredentialRow[] = [];
  lockRows = [{ lock_key: 'first_owner_bootstrap_v1' }];
  rawSql: string[] = [];
  executeSql: Array<{ sql: string; value: unknown }> = [];
  transactionOptions: unknown;

  readonly $transaction = async <T>(
    callback: (transaction: unknown) => Promise<T>,
    options?: unknown,
  ): Promise<T> => {
    this.transactionOptions = options;
    const transaction = {
      store: {
        create: async (args: { data: { name: string; status: 'ACTIVE' } }) => {
          const store: StoreRow = {
            id: BigInt(this.stores.length + 1),
            name: args.data.name,
            status: args.data.status,
          };
          this.stores.push(store);
          return { id: store.id, name: store.name };
        },
      },
      staff: {
        findFirst: async (args: { where: { storeId: bigint; role: StaffRole } }) =>
          this.staff.find(
            (entry) => entry.storeId === args.where.storeId && entry.role === args.where.role,
          ) ?? null,
        create: async (args: {
          data: { storeId: bigint; name: string; role: StaffRole; status: StaffStatus };
        }) => {
          const staff: StaffRow = {
            id: BigInt(this.staff.length + 1),
            ...args.data,
          };
          this.staff.push(staff);
          return { id: staff.id };
        },
      },
      staffCredential: {
        create: async (args: {
          data: { staffId: bigint; username: string; passwordHash: string };
        }) => {
          const credential: CredentialRow = {
            id: BigInt(this.credentials.length + 1),
            ...args.data,
          };
          this.credentials.push(credential);
          return credential;
        },
      },
      $queryRaw: async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        this.rawSql.push(sql);
        if (sql.includes('@@SESSION.innodb_lock_wait_timeout')) {
          return [{ innodb_lock_wait_timeout: 50 }];
        }
        if (sql.includes('bootstrap_locks')) {
          return [...this.lockRows];
        }
        return this.stores[0] ? [{ id: this.stores[0].id }] : [];
      },
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        this.executeSql.push({ sql: strings.join('?'), value: values[0] });
        return 1;
      },
    };
    return callback(transaction);
  };
}

describe('BootstrapOwnerService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the first store, OWNER Staff and hashed credential without logging the password', async () => {
    const prisma = new FakeBootstrapPrisma();
    const passwords = new PasswordService();
    const password = 'bootstrap-password-not-for-logs';
    const username = 'bootstrap-owner';
    const config = createTestConfig({
      bootstrapOwnerUsername: username,
      bootstrapOwnerPassword: password,
      bootstrapOwnerName: 'Owner Name',
      bootstrapStoreName: 'Initial Store',
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const service = new BootstrapOwnerService(
      config,
      prisma as unknown as PrismaService,
      passwords,
    );

    await service.onApplicationBootstrap();

    expect(prisma.transactionOptions).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 10_000,
      timeout: 15_000,
    });
    expect(prisma.rawSql[0]).toContain('@@SESSION.innodb_lock_wait_timeout');
    expect(prisma.rawSql[1]).toContain('bootstrap_locks');
    expect(prisma.rawSql[2]).toContain('FROM stores');
    expect(prisma.executeSql.map(({ value }) => value)).toEqual([10, 50]);
    expect(prisma.stores).toEqual([{ id: 1n, name: 'Initial Store', status: 'ACTIVE' }]);
    expect(prisma.staff).toEqual([
      {
        id: 1n,
        storeId: 1n,
        name: 'Owner Name',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    ]);
    expect(prisma.credentials).toHaveLength(1);
    const credential = prisma.credentials[0];
    expect(credential?.username).toBe(username);
    expect(credential?.passwordHash).not.toBe(password);
    expect(credential?.passwordHash.startsWith('scrypt:')).toBe(true);
    await expect(passwords.verify(password, credential?.passwordHash ?? '')).resolves.toBe(true);

    const logLines = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logLines).toContain('"event":"bootstrap_owner_created"');
    expect(logLines).not.toContain(password);
    expect(logLines).not.toContain(username);
    expect(logLines).not.toContain(credential?.passwordHash ?? '');
  });

  it('does not create another OWNER when the target store already has one', async () => {
    const prisma = new FakeBootstrapPrisma();
    prisma.stores.push({ id: 7n, name: 'Existing Store', status: 'ACTIVE' });
    prisma.staff.push({
      id: 8n,
      storeId: 7n,
      name: 'Existing Owner',
      role: 'OWNER',
      status: 'ACTIVE',
    });
    const password = 'second-bootstrap-password';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const service = new BootstrapOwnerService(
      createTestConfig({
        bootstrapOwnerUsername: 'new-owner',
        bootstrapOwnerPassword: password,
      }),
      prisma as unknown as PrismaService,
      new PasswordService(),
    );

    await service.onApplicationBootstrap();

    expect(prisma.stores).toHaveLength(1);
    expect(prisma.staff).toHaveLength(1);
    expect(prisma.credentials).toHaveLength(0);
    const logLines = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logLines).toContain('"event":"bootstrap_owner_skipped"');
    expect(logLines).not.toContain(password);
  });

  it('does nothing when one-time bootstrap variables are absent', async () => {
    const prisma = new FakeBootstrapPrisma();
    const transaction = vi.spyOn(prisma, '$transaction');
    const service = new BootstrapOwnerService(
      createTestConfig(),
      prisma as unknown as PrismaService,
      new PasswordService(),
    );

    await service.onApplicationBootstrap();

    expect(transaction).not.toHaveBeenCalled();
    expect(prisma.stores).toHaveLength(0);
    expect(prisma.staff).toHaveLength(0);
    expect(prisma.credentials).toHaveLength(0);
  });

  it('aborts startup on bootstrap failure and logs only a generic reason', async () => {
    const prisma = new FakeBootstrapPrisma();
    const password = 'bootstrap-password-must-not-leak';
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(prisma, '$transaction').mockRejectedValue(
      new Error(`database unavailable while provisioning ${password}`),
    );
    const service = new BootstrapOwnerService(
      createTestConfig({
        bootstrapOwnerUsername: 'bootstrap-owner',
        bootstrapOwnerPassword: password,
      }),
      prisma as unknown as PrismaService,
      new PasswordService(),
    );

    await expect(service.onApplicationBootstrap()).rejects.toThrow('bootstrap_owner_failed');

    const logLines = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logLines).toContain('"event":"bootstrap_owner_failed"');
    expect(logLines).not.toContain('database unavailable while provisioning');
    expect(logLines).not.toContain(password);
  });

  it('fails closed when the fixed bootstrap lock row is missing', async () => {
    const prisma = new FakeBootstrapPrisma();
    prisma.lockRows = [];
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new BootstrapOwnerService(
      createTestConfig({
        bootstrapOwnerUsername: 'bootstrap-owner',
        bootstrapOwnerPassword: 'bootstrap-password',
      }),
      prisma as unknown as PrismaService,
      new PasswordService(),
    );

    await expect(service.onApplicationBootstrap()).rejects.toThrow('bootstrap_owner_failed');
    expect(prisma.stores).toHaveLength(0);
    expect(prisma.staff).toHaveLength(0);
    expect(prisma.credentials).toHaveLength(0);
    expect(prisma.executeSql.map(({ value }) => value)).toEqual([10, 50]);
    const record = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record).toMatchObject({
      event: 'bootstrap_owner_failed',
      phase: 'acquire_bootstrap_lock',
      error_type: 'Other',
      prisma_code: null,
      db_errno: null,
      sqlstate: null,
    });
  });

  it('logs only allowlisted diagnostics and rejects malformed or unknown codes', async () => {
    const secret = 'synthetic-bootstrap-secret-value';
    const prisma = new FakeBootstrapPrisma();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const malformed = new Prisma.PrismaClientKnownRequestError(secret, {
      code: 'P9999',
      clientVersion: '6.19.0',
      meta: { query: secret, params: [secret], cause: secret },
    });
    vi.spyOn(prisma, '$transaction').mockRejectedValue(malformed);
    const service = new BootstrapOwnerService(
      createTestConfig({
        bootstrapOwnerUsername: secret,
        bootstrapOwnerPassword: secret,
      }),
      prisma as unknown as PrismaService,
      new PasswordService(),
    );

    await expect(service.onApplicationBootstrap()).rejects.toThrow('bootstrap_owner_failed');

    const record = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record).toMatchObject({
      error_type: 'PrismaKnown',
      prisma_code: null,
      db_errno: null,
      sqlstate: null,
      phase: 'transaction_start',
    });
    const output = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(output).not.toContain(secret);
    expect(output).not.toContain('P9999');
    expect(output).not.toContain('query');
    expect(output).not.toContain('params');
    expect(output).not.toContain('meta');
  });
});
