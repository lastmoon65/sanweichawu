import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { StaffRole, StaffStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { TokenService } from '../src/auth/token.service.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import type { AppConfig } from '../src/config/environment.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createHttpHarness } from './support/http-harness.js';
import { createTestConfig } from './support/test-config.js';

interface StaffRow {
  id: bigint;
  storeId: bigint;
  name: string;
  role: StaffRole;
  status: StaffStatus;
}

interface CategoryRow {
  id: bigint;
  storeId: bigint;
  name: string;
  sortOrder: number;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
  updatedAt: Date;
}

interface ProductRow {
  id: bigint;
  storeId: bigint;
  categoryId: bigint;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: 'ACTIVE' | 'DISABLED';
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface VariantRow {
  id: bigint;
  productId: bigint;
  name: string;
  priceFen: bigint;
  inventoryMode: 'MANAGED' | 'UNMANAGED';
  status: 'ACTIVE' | 'DISABLED';
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItemRow {
  productId: bigint;
  variantId: bigint;
}

function cloneRow<T extends object>(row: T): T {
  return { ...row };
}

class FakeMenuPrisma {
  staffRows: StaffRow[] = [];
  categoryRows: CategoryRow[] = [];
  productRows: ProductRow[] = [];
  variantRows: VariantRow[] = [];
  orderItemRows: OrderItemRow[] = [];
  private nextCategoryId = 100n;
  private nextProductId = 200n;
  private nextVariantId = 300n;

  readonly $transaction = async <T>(
    callback: (transaction: FakeMenuPrisma) => Promise<T>,
  ): Promise<T> => callback(this);
  readonly ping = async (): Promise<void> => undefined;
  readonly $queryRaw = async (query: Prisma.Sql): Promise<Array<{ id: bigint }>> => {
    const normalizedSql = query.sql.replace(/\s+/g, ' ').trim();
    if (!normalizedSql.includes('FROM products') || !normalizedSql.includes('FOR UPDATE')) {
      return [];
    }
    const [productId, storeId] = query.values as [bigint, bigint];
    const product = this.productRows.find(
      (row) => row.id === productId && row.storeId === storeId,
    );
    return product ? [{ id: product.id }] : [];
  };

  readonly staff = {
    findUnique: async (args: { where: { id: bigint } }) => {
      const staff = this.staffRows.find((row) => row.id === args.where.id);
      return staff ? { ...staff, credential: { id: 1n, staffId: staff.id } } : null;
    },
  };

  readonly category = {
    findMany: async (args: { where: { storeId: bigint } }) =>
      this.categoryRows
        .filter((row) => row.storeId === args.where.storeId)
        .sort((left, right) => left.sortOrder - right.sortOrder || compareIds(left.id, right.id))
        .map(cloneRow),
    findFirst: async (args: { where: { id?: bigint; storeId?: bigint } }) => {
      const row = this.categoryRows.find(
        (entry) =>
          (args.where.id === undefined || entry.id === args.where.id) &&
          (args.where.storeId === undefined || entry.storeId === args.where.storeId),
      );
      return row ? cloneRow(row) : null;
    },
    create: async (args: {
      data: {
        storeId: bigint;
        name: string;
        sortOrder: number;
        status: 'ACTIVE' | 'DISABLED';
      };
    }) => {
      if (
        this.categoryRows.some(
          (row) => row.storeId === args.data.storeId && row.name === args.data.name,
        )
      ) {
        throw knownError('P2002');
      }
      const now = new Date();
      const row: CategoryRow = {
        id: this.nextCategoryId++,
        storeId: args.data.storeId,
        name: args.data.name,
        sortOrder: args.data.sortOrder,
        status: args.data.status,
        createdAt: now,
        updatedAt: now,
      };
      this.categoryRows.push(row);
      return cloneRow(row);
    },
    update: async (args: {
      where: { id: bigint };
      data: Partial<Omit<CategoryRow, 'id' | 'storeId' | 'createdAt'>>;
    }) => {
      const row = this.categoryRows.find((entry) => entry.id === args.where.id);
      if (!row) {
        throw knownError('P2025');
      }
      Object.assign(row, args.data, { updatedAt: new Date() });
      return cloneRow(row);
    },
    delete: async (args: { where: { id: bigint } }) => {
      const index = this.categoryRows.findIndex((entry) => entry.id === args.where.id);
      if (index < 0) {
        throw knownError('P2025');
      }
      const [row] = this.categoryRows.splice(index, 1);
      return cloneRow(row as CategoryRow);
    },
  };

  readonly product = {
    findMany: async (args: { where: { storeId: bigint; categoryId?: bigint } }) =>
      this.productRows
        .filter(
          (row) =>
            row.storeId === args.where.storeId &&
            (args.where.categoryId === undefined || row.categoryId === args.where.categoryId),
        )
        .sort((left, right) => left.sortOrder - right.sortOrder || compareIds(left.id, right.id))
        .map((row) => this.withVariants(row)),
    findFirst: async (args: { where: { id?: bigint; storeId?: bigint } }) => {
      const row = this.productRows.find(
        (entry) =>
          (args.where.id === undefined || entry.id === args.where.id) &&
          (args.where.storeId === undefined || entry.storeId === args.where.storeId),
      );
      return row ? this.withVariants(row) : null;
    },
    count: async (args: { where: { categoryId?: bigint; storeId?: bigint } }) =>
      this.productRows.filter(
        (row) =>
          (args.where.categoryId === undefined || row.categoryId === args.where.categoryId) &&
          (args.where.storeId === undefined || row.storeId === args.where.storeId),
      ).length,
    create: async (args: {
      data: {
        storeId: bigint;
        categoryId: bigint;
        name: string;
        description: string | null;
        imageUrl: string | null;
        status: 'ACTIVE' | 'DISABLED';
        sortOrder: number;
        variants: {
          create: Array<{
            name: string;
            priceFen: bigint;
            inventoryMode: 'UNMANAGED';
            status: 'ACTIVE' | 'DISABLED';
            sortOrder: number;
          }>;
        };
      };
    }) => {
      if (
        this.productRows.some(
          (row) => row.storeId === args.data.storeId && row.name === args.data.name,
        )
      ) {
        throw knownError('P2002');
      }
      const now = new Date();
      const row: ProductRow = {
        id: this.nextProductId++,
        storeId: args.data.storeId,
        categoryId: args.data.categoryId,
        name: args.data.name,
        description: args.data.description,
        imageUrl: args.data.imageUrl,
        status: args.data.status,
        sortOrder: args.data.sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      this.productRows.push(row);
      for (const variant of args.data.variants.create) {
        if (
          this.variantRows.some(
            (entry) => entry.productId === row.id && entry.name === variant.name,
          )
        ) {
          throw knownError('P2002');
        }
        this.variantRows.push({
          id: this.nextVariantId++,
          productId: row.id,
          name: variant.name,
          priceFen: variant.priceFen,
          inventoryMode: 'UNMANAGED',
          status: variant.status,
          sortOrder: variant.sortOrder,
          createdAt: now,
          updatedAt: now,
        });
      }
      return this.withVariants(row);
    },
    update: async (args: {
      where: { id: bigint };
      data: Partial<Omit<ProductRow, 'id' | 'storeId' | 'createdAt'>>;
    }) => {
      const row = this.productRows.find((entry) => entry.id === args.where.id);
      if (!row) {
        throw knownError('P2025');
      }
      Object.assign(row, args.data, { updatedAt: new Date() });
      return this.withVariants(row);
    },
    delete: async (args: { where: { id: bigint } }) => {
      const index = this.productRows.findIndex((entry) => entry.id === args.where.id);
      if (index < 0) {
        throw knownError('P2025');
      }
      const [row] = this.productRows.splice(index, 1);
      return this.withVariants(row as ProductRow);
    },
  };

  readonly productVariant = {
    findFirst: async (args: { where: { id?: bigint; productId?: bigint } }) => {
      const row = this.variantRows.find(
        (entry) =>
          (args.where.id === undefined || entry.id === args.where.id) &&
          (args.where.productId === undefined || entry.productId === args.where.productId),
      );
      if (!row) {
        return null;
      }
      const product = this.productRows.find((entry) => entry.id === row.productId);
      return { ...cloneRow(row), product: { storeId: product?.storeId ?? 0n } };
    },
    create: async (args: {
      data: {
        productId: bigint;
        name: string;
        priceFen: bigint;
        inventoryMode: 'UNMANAGED';
        status: 'ACTIVE' | 'DISABLED';
        sortOrder: number;
      };
    }) => {
      if (
        this.variantRows.some(
          (row) => row.productId === args.data.productId && row.name === args.data.name,
        )
      ) {
        throw knownError('P2002');
      }
      const now = new Date();
      const row: VariantRow = {
        id: this.nextVariantId++,
        productId: args.data.productId,
        name: args.data.name,
        priceFen: args.data.priceFen,
        inventoryMode: 'UNMANAGED',
        status: args.data.status,
        sortOrder: args.data.sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      this.variantRows.push(row);
      return cloneRow(row);
    },
    update: async (args: {
      where: { id: bigint };
      data: Partial<Omit<VariantRow, 'id' | 'productId' | 'createdAt'>>;
    }) => {
      const row = this.variantRows.find((entry) => entry.id === args.where.id);
      if (!row) {
        throw knownError('P2025');
      }
      Object.assign(row, args.data, { updatedAt: new Date() });
      return cloneRow(row);
    },
    delete: async (args: { where: { id: bigint } }) => {
      const index = this.variantRows.findIndex((entry) => entry.id === args.where.id);
      if (index < 0) {
        throw knownError('P2025');
      }
      const [row] = this.variantRows.splice(index, 1);
      return cloneRow(row as VariantRow);
    },
    deleteMany: async (args: { where: { productId: bigint } }) => {
      const before = this.variantRows.length;
      this.variantRows = this.variantRows.filter((row) => row.productId !== args.where.productId);
      return { count: before - this.variantRows.length };
    },
    count: async (args: { where: { productId: bigint } }) =>
      this.variantRows.filter((row) => row.productId === args.where.productId).length,
  };

  readonly orderItem = {
    count: async (args: {
      where: { productId?: bigint; variantId?: bigint | { in: bigint[] } };
    }) => {
      return this.orderItemRows.filter((row) => {
        if (args.where.productId !== undefined && row.productId !== args.where.productId) {
          return false;
        }
        if (args.where.variantId !== undefined) {
          if (typeof args.where.variantId === 'bigint') {
            return row.variantId === args.where.variantId;
          }
          return args.where.variantId.in.includes(row.variantId);
        }
        return true;
      }).length;
    },
  };

  addStaff(storeId: bigint, role: StaffRole = 'OWNER'): StaffRow {
    const row: StaffRow = {
      id: BigInt(this.staffRows.length + 1),
      storeId,
      name: `staff-${this.staffRows.length + 1}`,
      role,
      status: 'ACTIVE',
    };
    this.staffRows.push(row);
    return row;
  }

  addCategory(
    storeId: bigint,
    name: string,
    status: 'ACTIVE' | 'DISABLED' = 'ACTIVE',
  ): CategoryRow {
    const now = new Date();
    const row: CategoryRow = {
      id: this.nextCategoryId++,
      storeId,
      name,
      sortOrder: 0,
      status,
      createdAt: now,
      updatedAt: now,
    };
    this.categoryRows.push(row);
    return row;
  }

  addProduct(
    storeId: bigint,
    categoryId: bigint,
    name: string,
    status: 'ACTIVE' | 'DISABLED' = 'ACTIVE',
  ): ProductRow {
    const now = new Date();
    const row: ProductRow = {
      id: this.nextProductId++,
      storeId,
      categoryId,
      name,
      description: null,
      imageUrl: null,
      status,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.productRows.push(row);
    return row;
  }

  addVariant(
    productId: bigint,
    name: string,
    priceFen = 100n,
    status: 'ACTIVE' | 'DISABLED' = 'ACTIVE',
  ): VariantRow {
    const now = new Date();
    const row: VariantRow = {
      id: this.nextVariantId++,
      productId,
      name,
      priceFen,
      inventoryMode: 'UNMANAGED',
      status,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.variantRows.push(row);
    return row;
  }

  private withVariants(product: ProductRow) {
    return {
      ...cloneRow(product),
      variants: this.variantRows
        .filter((row) => row.productId === product.id)
        .sort((left, right) => left.sortOrder - right.sortOrder || compareIds(left.id, right.id))
        .map(cloneRow),
    };
  }
}

function compareIds(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function knownError(code: 'P2002' | 'P2025'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('fake constraint', {
    code,
    clientVersion: '6.19.0',
  });
}

describe('product menu API without a database', () => {
  const prisma = new FakeMenuPrisma();
  const config: AppConfig = createTestConfig();
  const tokens = new TokenService(config);
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    prisma.staffRows = [];
    prisma.categoryRows = [];
    prisma.productRows = [];
    prisma.variantRows = [];
    prisma.orderItemRows = [];
  });

  function tokenFor(storeId = 10n, role: StaffRole = 'OWNER'): string {
    const staff = prisma.addStaff(storeId, role);
    return tokens.signAccessToken({ staffId: staff.id, role, storeId });
  }

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

  function data<T>(response: { body: unknown }): T {
    return (response.body as ApiSuccessBody<T>).data;
  }

  function errorCode(response: { body: unknown }): string {
    return (response.body as ApiErrorBody).error.code;
  }

  it('creates, lists, updates and deletes categories with string ids and Z timestamps', async () => {
    const token = tokenFor();
    const create = await api('POST', '/categories?storeId=999', {
      token,
      body: { name: '  热茶  ', storeId: '999', sortOrder: 2 },
    });

    expect(create.status).toBe(201);
    const category = data<Record<string, unknown>>(create);
    expect(Object.keys(category).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'sortOrder',
      'status',
      'storeId',
      'updatedAt',
    ]);
    expect(category).toMatchObject({
      id: expect.any(String),
      storeId: '10',
      name: '热茶',
      sortOrder: 2,
      status: 'ACTIVE',
    });
    expect(String(category.createdAt)).toMatch(/Z$/);

    const second = await api('POST', '/categories', {
      token,
      body: { name: '冷饮', sortOrder: 1 },
    });
    expect(second.status).toBe(201);

    const list = await api('GET', '/categories', { token });
    expect(list.status).toBe(200);
    expect(data<{ items: Array<{ name: string }> }>(list).items.map((item) => item.name)).toEqual([
      '冷饮',
      '热茶',
    ]);

    const get = await api('GET', `/categories/${String(category.id)}`, { token });
    expect(get.status).toBe(200);
    expect(data<{ name: string }>(get).name).toBe('热茶');

    const empty = await api('PATCH', `/categories/${String(category.id)}`, {
      token,
      body: {},
    });
    expect(empty.status).toBe(400);
    expect(errorCode(empty)).toBe('VALIDATION_ERROR');

    const updated = await api('PATCH', `/categories/${String(category.id)}`, {
      token,
      body: { name: ' 热饮 ', sortOrder: 3, status: 'DISABLED' },
    });
    expect(updated.status).toBe(200);
    expect(data<Record<string, unknown>>(updated)).toMatchObject({
      name: '热饮',
      sortOrder: 3,
      status: 'DISABLED',
    });

    const remove = await api('DELETE', `/categories/${String(category.id)}`, { token });
    expect(remove.status).toBe(200);
    expect(prisma.categoryRows.some((row) => row.id === BigInt(String(category.id)))).toBe(false);
  });

  it('rejects unauthenticated calls and malformed item ids with 401/403', async () => {
    const unauthorized = await api('GET', '/categories');
    expect(unauthorized.status).toBe(401);
    expect(errorCode(unauthorized)).toBe('UNAUTHORIZED');

    const token = tokenFor();
    for (const id of ['0', 'not-a-number', '9223372036854775808', '999']) {
      const response = await api('GET', `/categories/${id}`, { token });
      expect(response.status).toBe(403);
      expect(errorCode(response)).toBe('FORBIDDEN');
    }
  });

  it('creates a product with variants in one call and forces UNMANAGED inventory', async () => {
    const token = tokenFor();
    const category = prisma.addCategory(10n, '主食');
    const create = await api('POST', '/products', {
      token,
      body: {
        categoryId: category.id.toString(),
        name: '  牛肉面 ',
        description: '  招牌  ',
        imageUrl: 'https://example.com/noodle.png',
        storeId: '999',
        variants: [
          { name: '小碗', priceFen: '1250' },
          { name: '大碗', priceFen: 0 },
        ],
      },
    });

    expect(create.status).toBe(201);
    const product = data<Record<string, unknown>>(create);
    expect(product).toMatchObject({
      name: '牛肉面',
      description: '招牌',
      storeId: '10',
      categoryId: category.id.toString(),
      status: 'ACTIVE',
      sortOrder: 0,
    });
    expect(String(product.createdAt)).toMatch(/Z$/);
    const variants = product.variants as Array<Record<string, unknown>>;
    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      name: '小碗',
      priceFen: '1250',
      inventoryMode: 'UNMANAGED',
      status: 'ACTIVE',
    });
    expect(typeof variants[0]?.id).toBe('string');
    expect(typeof variants[0]?.productId).toBe('string');
    expect(variants[1]?.priceFen).toBe('0');

    const productId = String(product.id);
    const get = await api('GET', `/products/${productId}`, { token });
    expect(get.status).toBe(200);
    expect((data<Record<string, unknown>>(get).variants as unknown[]).length).toBe(2);

    const list = await api('GET', `/products?categoryId=${category.id.toString()}`, { token });
    expect(list.status).toBe(200);
    expect(data<{ items: unknown[] }>(list).items).toHaveLength(1);

    const variant = await api('POST', `/products/${productId}/variants`, {
      token,
      body: { name: '加料', priceFen: '300', sortOrder: 9 },
    });
    expect(variant.status).toBe(201);
    expect(data<Record<string, unknown>>(variant)).toMatchObject({
      name: '加料',
      priceFen: '300',
      inventoryMode: 'UNMANAGED',
    });

    const updatedVariant = await api(
      'PATCH',
      `/products/${productId}/variants/${String(data<Record<string, unknown>>(variant).id)}`,
      { token, body: { name: '加料包', priceFen: '350', status: 'DISABLED' } },
    );
    expect(updatedVariant.status).toBe(200);
    expect(data<Record<string, unknown>>(updatedVariant)).toMatchObject({
      name: '加料包',
      priceFen: '350',
      status: 'DISABLED',
    });
  });

  it('rejects empty names, invalid prices, missing variants and inventoryMode', async () => {
    const token = tokenFor();
    const category = prisma.addCategory(10n, '主食');
    const validBase = {
      categoryId: category.id.toString(),
      name: '  ',
      variants: [{ name: '默认', priceFen: '1' }],
    };

    for (const body of [
      validBase,
      { ...validBase, name: '面', variants: [] },
      { ...validBase, name: '面', variants: [{ name: '默认', priceFen: '12.5' }] },
      { ...validBase, name: '面', variants: [{ name: '默认', priceFen: '1e2' }] },
      { ...validBase, name: '面', variants: [{ name: '默认', priceFen: '1.0' }] },
      { ...validBase, name: '面', variants: [{ name: '默认', priceFen: -1 }] },
      { ...validBase, name: '面', variants: [{ name: '默认', priceFen: 12.5 }] },
      {
        ...validBase,
        name: '面',
        variants: [{ name: '默认', priceFen: '1', inventoryMode: 'MANAGED' }],
      },
    ]) {
      const response = await api('POST', '/products', { token, body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    }
    expect(prisma.productRows).toHaveLength(0);
  });

  it('validates category names and optional image URLs before writing', async () => {
    const token = tokenFor();

    for (const body of [{ name: '   ' }, { name: '类'.repeat(81) }]) {
      const response = await api('POST', '/categories', { token, body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    }
    expect(prisma.categoryRows).toHaveLength(0);

    const category = prisma.addCategory(10n, '主食');
    const base = {
      categoryId: category.id.toString(),
      name: '面',
      variants: [{ name: '默认', priceFen: '1' }],
    };
    for (const body of [
      { ...base, name: '面'.repeat(121) },
      { ...base, variants: [{ name: '   ', priceFen: '1' }] },
      { ...base, variants: [{ name: '规'.repeat(81), priceFen: '1' }] },
      { ...base, imageUrl: '' },
      { ...base, imageUrl: `https://example.com/${'a'.repeat(500)}` },
    ]) {
      const response = await api('POST', '/products', { token, body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    }
    expect(prisma.productRows).toHaveLength(0);
  });

  it('keeps disabled names occupied and allows re-enabling the original record', async () => {
    const token = tokenFor();
    const category = prisma.addCategory(10n, '热茶', 'DISABLED');

    const conflict = await api('POST', '/categories', { token, body: { name: '热茶' } });
    expect(conflict.status).toBe(409);
    expect(errorCode(conflict)).toBe('CONFLICT');
    expect((conflict.body as ApiErrorBody).error.details).toMatchObject({ field: 'name' });

    const restored = await api('PATCH', `/categories/${category.id}`, {
      token,
      body: { status: 'ACTIVE' },
    });
    expect(restored.status).toBe(200);
    expect(data<Record<string, unknown>>(restored).status).toBe('ACTIVE');

    const product = prisma.addProduct(10n, category.id, '面', 'DISABLED');
    const productConflict = await api('POST', '/products', {
      token,
      body: {
        categoryId: category.id.toString(),
        name: '面',
        variants: [{ name: '默认', priceFen: '1' }],
      },
    });
    expect(productConflict.status).toBe(409);

    const variant = prisma.addVariant(product.id, '大碗', 100n, 'DISABLED');
    const variantConflict = await api('POST', `/products/${product.id}/variants`, {
      token,
      body: { name: '大碗', priceFen: '1' },
    });
    expect(variantConflict.status).toBe(409);
    expect(variant.status).toBe('DISABLED');
  });

  it('isolates stores for item paths, body storeId and categoryId', async () => {
    const token = tokenFor(10n);
    const foreignCategory = prisma.addCategory(20n, '外店分类');
    const foreignProduct = prisma.addProduct(20n, foreignCategory.id, '外店商品');
    const foreignVariant = prisma.addVariant(foreignProduct.id, '外店规格');
    const ownCategory = prisma.addCategory(10n, '本店分类');

    for (const [method, path, body] of [
      ['GET', `/categories/${foreignCategory.id}`, undefined],
      ['PATCH', `/categories/${foreignCategory.id}`, { name: '越权' }],
      ['DELETE', `/categories/${foreignCategory.id}`, undefined],
      ['GET', `/products/${foreignProduct.id}`, undefined],
      ['PATCH', `/products/${foreignProduct.id}`, { name: '越权' }],
      ['DELETE', `/products/${foreignProduct.id}`, undefined],
      ['PATCH', `/products/${foreignProduct.id}/variants/${foreignVariant.id}`, { name: '越权' }],
      ['DELETE', `/products/${foreignProduct.id}/variants/${foreignVariant.id}`, undefined],
    ] as const) {
      const response = await api(method, path, { token, body });
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(errorCode(response)).toBe('FORBIDDEN');
      expect(JSON.stringify(response.body)).not.toContain('外店');
    }

    const crossCategory = await api('POST', '/products', {
      token,
      body: {
        categoryId: foreignCategory.id.toString(),
        name: '越权商品',
        variants: [{ name: '默认', priceFen: '1' }],
      },
    });
    expect(crossCategory.status).toBe(403);

    const crossFilter = await api('GET', `/products?categoryId=${foreignCategory.id}`, { token });
    expect(crossFilter.status).toBe(403);

    const ownProduct = prisma.addProduct(10n, ownCategory.id, '本店商品');
    const ownVariant = prisma.addVariant(ownProduct.id, '本店规格');
    const foreignVariantUnderOwnProduct = await api(
      'PATCH',
      `/products/${ownProduct.id}/variants/${ownVariant.id}`,
      { token, body: { name: '改名' } },
    );
    expect(foreignVariantUnderOwnProduct.status).toBe(200);
  });

  it('protects referenced categories, products and variants and deletes unreferenced data', async () => {
    const token = tokenFor();
    const category = prisma.addCategory(10n, '主食');
    const product = prisma.addProduct(10n, category.id, '面');
    const variantA = prisma.addVariant(product.id, '小碗');
    const variantB = prisma.addVariant(product.id, '大碗');

    const categoryConflict = await api('DELETE', `/categories/${category.id}`, { token });
    expect(categoryConflict.status).toBe(409);
    expect(errorCode(categoryConflict)).toBe('CATEGORY_REFERENCED');

    const lastVariantAttempt = await api(
      'DELETE',
      `/products/${product.id}/variants/${variantB.id}`,
      { token },
    );
    expect(lastVariantAttempt.status).toBe(200);

    const removeLast = await api('DELETE', `/products/${product.id}/variants/${variantA.id}`, {
      token,
    });
    expect(removeLast.status).toBe(400);
    expect(errorCode(removeLast)).toBe('VALIDATION_ERROR');

    const another = prisma.addVariant(product.id, '中碗');
    prisma.orderItemRows.push({ productId: product.id, variantId: another.id });
    const variantRef = await api('DELETE', `/products/${product.id}/variants/${another.id}`, {
      token,
    });
    expect(variantRef.status).toBe(409);
    expect(errorCode(variantRef)).toBe('VARIANT_REFERENCED');

    const productRef = await api('DELETE', `/products/${product.id}`, { token });
    expect(productRef.status).toBe(409);
    expect(errorCode(productRef)).toBe('PRODUCT_REFERENCED');

    prisma.orderItemRows = [];
    const removeProduct = await api('DELETE', `/products/${product.id}`, { token });
    expect(removeProduct.status).toBe(200);
    expect(prisma.productRows).toHaveLength(0);
    expect(prisma.variantRows).toHaveLength(0);

    const removeCategory = await api('DELETE', `/categories/${category.id}`, { token });
    expect(removeCategory.status).toBe(200);
  });

  it('allows OWNER, MANAGER and STAFF to maintain the menu', async () => {
    for (const role of ['OWNER', 'MANAGER', 'STAFF'] as const) {
      const token = tokenFor(10n, role);
      const response = await api('POST', '/categories', {
        token,
        body: { name: `${role}分类` },
      });
      expect(response.status, role).toBe(201);
    }
  });
});
