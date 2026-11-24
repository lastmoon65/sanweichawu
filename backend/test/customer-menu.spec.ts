import 'reflect-metadata';

import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerMenuService } from '../src/customer-menu/customer-menu.service.js';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';

type CommonStatus = 'ACTIVE' | 'DISABLED';

interface TableRow {
  id: bigint;
  storeId: bigint;
  name: string;
  code: string;
  store: { status: 'ACTIVE' | 'SUSPENDED' };
}

interface SessionRow {
  id: bigint;
  storeId: bigint;
  tableId: bigint;
  status: 'OPEN' | 'CLOSED';
  openedAt: Date;
  store: { status: 'ACTIVE' | 'SUSPENDED' };
}

interface VariantRow {
  id: bigint;
  name: string;
  priceFen: bigint;
  status: CommonStatus;
  sortOrder: number;
  costFen: bigint;
}

interface ProductRow {
  id: bigint;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: CommonStatus;
  sortOrder: number;
  variants: VariantRow[];
}

interface CategoryRow {
  id: bigint;
  storeId: bigint;
  name: string;
  status: CommonStatus;
  sortOrder: number;
  products: ProductRow[];
}

class FakeMenuPrisma {
  tables: TableRow[] = [];
  sessions: SessionRow[] = [];
  categories: CategoryRow[] = [];

  readonly diningTable = {
    findMany: async (args: { where: { code: string } }) =>
      this.tables.filter((table) => table.code === args.where.code),
  };

  readonly diningSession = {
    findFirst: async (args: {
      where: { id?: bigint; storeId?: bigint; tableId?: bigint; status?: 'OPEN' | 'CLOSED' };
    }) =>
      this.sessions
        .filter(
          (session) =>
            (args.where.id === undefined || session.id === args.where.id) &&
            (args.where.storeId === undefined || session.storeId === args.where.storeId) &&
            (args.where.tableId === undefined || session.tableId === args.where.tableId) &&
            (args.where.status === undefined || session.status === args.where.status),
        )
        .sort((left, right) => (left.id < right.id ? 1 : -1))[0] ?? null,
  };

  readonly category = {
    findMany: async (args: { where: { storeId: bigint; status: CommonStatus } }) =>
      this.categories
        .filter(
          (category) =>
            category.storeId === args.where.storeId && category.status === args.where.status,
        )
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((category) => ({
          ...category,
          products: category.products
            .filter((product) => product.status === 'ACTIVE')
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((product) => ({
              ...product,
              variants: product.variants
                .filter((variant) => variant.status === 'ACTIVE')
                .sort((left, right) => left.sortOrder - right.sortOrder),
            })),
        })),
  };

  reset(): void {
    this.tables = [];
    this.sessions = [];
    this.categories = [];
  }
}

async function expectHttpError(
  operation: Promise<unknown>,
  status: number,
  code: string,
): Promise<HttpException> {
  try {
    await operation;
    throw new Error('Expected HTTP exception');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toMatchObject({ code });
    return exception;
  }
}

describe('customer table and menu projection', () => {
  const fake = new FakeMenuPrisma();
  const menu = new CustomerMenuService(fake as unknown as PrismaService);

  beforeEach(() => {
    fake.reset();
    fake.tables.push({
      id: 10n,
      storeId: 20n,
      name: 'A1',
      code: 'A1',
      store: { status: 'ACTIVE' },
    });
    fake.sessions.push({
      id: 30n,
      storeId: 20n,
      tableId: 10n,
      status: 'OPEN',
      openedAt: new Date('2026-11-24T01:02:03.000Z'),
      store: { status: 'ACTIVE' },
    });
  });

  it('resolves an open table to the minimum customer fields', async () => {
    await expect(menu.resolveTable(' A1 ')).resolves.toEqual({
      storeId: '20',
      table: { id: '10', name: 'A1', code: 'A1' },
      session: { id: '30', openedAt: '2026-11-24T01:02:03.000Z' },
    });
  });

  it('returns the same 404 for a missing table, a closed table, and an ambiguous cross-store code', async () => {
    const missing = await expectHttpError(menu.resolveTable('NOPE'), 404, 'TABLE_NOT_AVAILABLE');
    expect(JSON.stringify(missing.getResponse())).not.toContain('A1');

    fake.sessions[0]!.status = 'CLOSED';
    const closed = await expectHttpError(menu.resolveTable('A1'), 404, 'TABLE_NOT_AVAILABLE');
    expect(JSON.stringify(closed.getResponse())).not.toContain('20');

    fake.sessions.push({
      ...fake.sessions[0]!,
      id: 31n,
      storeId: 21n,
      tableId: 11n,
      status: 'OPEN',
    });
    fake.tables.push({
      id: 11n,
      storeId: 21n,
      name: '别店 A1',
      code: 'A1',
      store: { status: 'ACTIVE' },
    });
    const ambiguous = await expectHttpError(menu.resolveTable('A1'), 404, 'TABLE_NOT_AVAILABLE');
    const serialized = JSON.stringify(ambiguous.getResponse());
    expect(serialized).not.toContain('别店');
    expect(serialized).not.toContain('21');
  });

  it('returns only active categories, products, and variants without internal fields', async () => {
    fake.categories.push(
      {
        id: 1n,
        storeId: 20n,
        name: '招牌茶',
        status: 'ACTIVE',
        sortOrder: 1,
        products: [
          {
            id: 2n,
            name: '桂花乌龙',
            description: '清香',
            imageUrl: null,
            status: 'ACTIVE',
            sortOrder: 1,
            variants: [
              {
                id: 3n,
                name: '大杯',
                priceFen: 2300n,
                status: 'ACTIVE',
                sortOrder: 1,
                costFen: 900n,
              },
              {
                id: 4n,
                name: '停用规格',
                priceFen: 1900n,
                status: 'DISABLED',
                sortOrder: 2,
                costFen: 800n,
              },
            ],
          },
          {
            id: 5n,
            name: '停用商品',
            description: null,
            imageUrl: null,
            status: 'DISABLED',
            sortOrder: 2,
            variants: [
              {
                id: 6n,
                name: '隐藏规格',
                priceFen: 1200n,
                status: 'ACTIVE',
                sortOrder: 1,
                costFen: 500n,
              },
            ],
          },
        ],
      },
      {
        id: 7n,
        storeId: 20n,
        name: '停用分类',
        status: 'DISABLED',
        sortOrder: 2,
        products: [],
      },
      {
        id: 8n,
        storeId: 21n,
        name: '别店分类',
        status: 'ACTIVE',
        sortOrder: 0,
        products: [],
      },
    );

    const result = await menu.getMenu('30');

    expect(result).toEqual({
      storeId: '20',
      sessionId: '30',
      categories: [
        {
          id: '1',
          name: '招牌茶',
          sortOrder: 1,
          products: [
            {
              id: '2',
              name: '桂花乌龙',
              description: '清香',
              imageUrl: null,
              sortOrder: 1,
              variants: [{ id: '3', name: '大杯', priceFen: '2300', sortOrder: 1 }],
            },
          ],
        },
      ],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('cost');
    expect(serialized).not.toContain('inventory');
    expect(serialized).not.toContain('DISABLED');
  });

  it('rejects malformed or unknown sessions without exposing another store', async () => {
    await expectHttpError(menu.getMenu('not-a-number'), 400, 'VALIDATION_ERROR');
    const unknown = await expectHttpError(menu.getMenu('999'), 404, 'SESSION_NOT_AVAILABLE');
    expect(JSON.stringify(unknown.getResponse())).not.toContain('20');
  });
});
