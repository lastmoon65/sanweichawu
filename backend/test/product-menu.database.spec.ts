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

const PASSWORD = 'product-menu-database-password';

interface CategoryData {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

interface VariantData {
  id: string;
  productId: string;
  name: string;
  priceFen: string;
  inventoryMode: 'MANAGED' | 'UNMANAGED';
  status: 'ACTIVE' | 'DISABLED';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductData {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: 'ACTIVE' | 'DISABLED';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  variants: VariantData[];
}

interface CreatedIdentity {
  storeId: bigint;
  staffId: bigint;
  username: string;
}

function expectIsoTimestamp(value: string): void {
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(new Date(value).toISOString()).toBe(value);
}

function expectVariantShape(variant: VariantData): void {
  expect(Object.keys(variant).sort()).toEqual([
    'createdAt',
    'id',
    'inventoryMode',
    'name',
    'priceFen',
    'productId',
    'sortOrder',
    'status',
    'updatedAt',
  ]);
  expect(variant.id).toMatch(/^[1-9]\d*$/);
  expect(variant.productId).toMatch(/^[1-9]\d*$/);
  expect(variant.priceFen).toMatch(/^(0|[1-9]\d*)$/);
  expect(variant.inventoryMode).toBe('UNMANAGED');
  expectIsoTimestamp(variant.createdAt);
  expectIsoTimestamp(variant.updatedAt);
}

describe('product menu master data with a real database', () => {
  const passwords = new PasswordService();
  const createdStaffIds: bigint[] = [];
  const createdStoreIds: bigint[] = [];
  const createdProductIds: bigint[] = [];
  const createdOrderIds: bigint[] = [];
  const createdUserIds: bigint[] = [];
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
    if (createdOrderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds.splice(0) } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
    }
    if (createdProductIds.length > 0) {
      const ids = createdProductIds.splice(0);
      await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } });
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
    }
    for (const staffId of createdStaffIds.splice(0)) {
      await prisma.staffCredential.deleteMany({ where: { staffId } });
      await prisma.staff.deleteMany({ where: { id: staffId } });
    }
    for (const storeId of createdStoreIds.splice(0)) {
      await prisma.productVariant.deleteMany({
        where: { product: { storeId } },
      });
      await prisma.product.deleteMany({ where: { storeId } });
      await prisma.category.deleteMany({ where: { storeId } });
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
        data: { name: `sw003-menu-store-${suffix}`, status: 'ACTIVE' },
        select: { id: true },
      });
      storeId = store.id;
      createdStoreIds.push(store.id);
    }

    const staff = await prisma.staff.create({
      data: {
        storeId,
        name: `sw003-menu-staff-${suffix}`,
        role,
        status,
      },
      select: { id: true },
    });
    createdStaffIds.push(staff.id);

    const username = `sw003-menu-${suffix}`;
    await prisma.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });
    return { storeId, staffId: staff.id, username };
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

  async function createCategory(
    token: string,
    name: string,
    extra: Record<string, unknown> = {},
  ): Promise<CategoryData> {
    const response = await api('POST', '/categories', { token, body: { name, ...extra } });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return successData<CategoryData>(response);
  }

  async function createProduct(
    token: string,
    categoryId: string,
    name: string,
    variants: Array<Record<string, unknown>>,
    extra: Record<string, unknown> = {},
  ): Promise<ProductData> {
    const response = await api('POST', '/products', {
      token,
      body: { categoryId, name, variants, ...extra },
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const product = successData<ProductData>(response);
    createdProductIds.push(BigInt(product.id));
    return product;
  }

  function expectCategoryShape(category: CategoryData, storeId: bigint): void {
    expect(Object.keys(category).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'sortOrder',
      'status',
      'storeId',
      'updatedAt',
    ]);
    expect(category.id).toMatch(/^[1-9]\d*$/);
    expect(category.storeId).toBe(storeId.toString());
    expectIsoTimestamp(category.createdAt);
    expectIsoTimestamp(category.updatedAt);
  }

  function expectProductShape(product: ProductData, storeId: bigint): void {
    expect(Object.keys(product).sort()).toEqual([
      'categoryId',
      'createdAt',
      'description',
      'id',
      'imageUrl',
      'name',
      'sortOrder',
      'status',
      'storeId',
      'updatedAt',
      'variants',
    ]);
    expect(product.id).toMatch(/^[1-9]\d*$/);
    expect(product.categoryId).toMatch(/^[1-9]\d*$/);
    expect(product.storeId).toBe(storeId.toString());
    expectIsoTimestamp(product.createdAt);
    expectIsoTimestamp(product.updatedAt);
    for (const variant of product.variants) {
      expect(variant.productId).toBe(product.id);
      expectVariantShape(variant);
    }
  }

  async function createReferencedOrder(product: ProductData): Promise<void> {
    const variant = product.variants[0];
    if (!variant) {
      throw new Error('Product fixture needs a variant');
    }
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: { openid: `sw003-menu-user-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    const order = await prisma.order.create({
      data: {
        storeId: BigInt(product.storeId),
        customerUserId: user.id,
        orderNo: suffix,
        idempotencyKey: `sw003-order-${suffix}`,
        channel: 'TAKEAWAY',
        status: 'CANCELLED',
        subtotalFen: BigInt(variant.priceFen),
        totalAmountFen: BigInt(variant.priceFen),
      },
      select: { id: true },
    });
    createdOrderIds.push(order.id);
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: BigInt(product.id),
        variantId: BigInt(variant.id),
        productNameSnapshot: product.name,
        variantNameSnapshot: variant.name,
        unitPriceFen: BigInt(variant.priceFen),
        quantity: 1,
        lineSubtotalFen: BigInt(variant.priceFen),
      },
    });
  }

  it('supports the full lifecycle with string ids, ordered lists and transactional variant deletion', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const foreignStore = await createIdentity('OWNER');

    const secondCategory = await createCategory(token, '  冷饮  ', { sortOrder: 1 });
    expectCategoryShape(secondCategory, actor.storeId);
    expect(secondCategory).toMatchObject({ name: '冷饮', status: 'ACTIVE', sortOrder: 1 });
    const firstCategoryResponse = await api('POST', '/categories', {
      token,
      body: { name: '热茶', sortOrder: 2, storeId: foreignStore.storeId.toString() },
    });
    expect(firstCategoryResponse.status).toBe(201);
    const firstCategory = successData<CategoryData>(firstCategoryResponse);
    expectCategoryShape(firstCategory, actor.storeId);

    const listCategories = await api('GET', `/categories?storeId=${foreignStore.storeId}`, {
      token,
    });
    expect(listCategories.status).toBe(200);
    expect(
      successData<{ items: CategoryData[] }>(listCategories).items.map((row) => row.name),
    ).toEqual(['冷饮', '热茶']);

    const product = await createProduct(
      token,
      firstCategory.id,
      '  牛肉面  ',
      [
        { name: '小碗', priceFen: '1250' },
        { name: '大碗', priceFen: 0, sortOrder: 1 },
      ],
      {
        description: '  招牌汤面  ',
        imageUrl: 'https://example.com/beef-noodle.jpg',
        storeId: foreignStore.storeId.toString(),
      },
    );
    expectProductShape(product, actor.storeId);
    expect(product).toMatchObject({
      name: '牛肉面',
      description: '招牌汤面',
      imageUrl: 'https://example.com/beef-noodle.jpg',
      status: 'ACTIVE',
      sortOrder: 0,
      categoryId: firstCategory.id,
    });
    expect(product.variants.map((variant) => [variant.name, variant.priceFen])).toEqual([
      ['小碗', '1250'],
      ['大碗', '0'],
    ]);

    const getProduct = await api('GET', `/products/${product.id}`, { token });
    expect(getProduct.status).toBe(200);
    expect(successData<ProductData>(getProduct)).toEqual(product);

    const listProducts = await api('GET', `/products?categoryId=${firstCategory.id}`, { token });
    expect(listProducts.status).toBe(200);
    expect(successData<{ items: ProductData[] }>(listProducts).items.map((row) => row.id)).toEqual([
      product.id,
    ]);
    expect(successData<{ items: ProductData[] }>(listProducts).items[0]?.variants).toHaveLength(2);

    const updateProduct = await api('PATCH', `/products/${product.id}`, {
      token,
      body: {
        categoryId: secondCategory.id,
        name: '  清汤面  ',
        description: '   ',
        imageUrl: null,
        status: 'DISABLED',
        sortOrder: 5,
        storeId: foreignStore.storeId.toString(),
      },
    });
    expect(updateProduct.status).toBe(200);
    expect(successData<ProductData>(updateProduct)).toMatchObject({
      categoryId: secondCategory.id,
      name: '清汤面',
      description: null,
      imageUrl: null,
      status: 'DISABLED',
      sortOrder: 5,
    });
    const disabledProductList = await api('GET', '/products', { token });
    expect(disabledProductList.status).toBe(200);
    expect(
      successData<{ items: ProductData[] }>(disabledProductList).items.find(
        (row) => row.id === product.id,
      ),
    ).toMatchObject({ status: 'DISABLED' });

    const emptyProductUpdate = await api('PATCH', `/products/${product.id}`, {
      token,
      body: {},
    });
    expect(emptyProductUpdate.status).toBe(400);
    expect(errorCode(emptyProductUpdate)).toBe('VALIDATION_ERROR');

    const emptyCategoryUpdate = await api('PATCH', `/categories/${firstCategory.id}`, {
      token,
      body: {},
    });
    expect(emptyCategoryUpdate.status).toBe(400);
    expect(errorCode(emptyCategoryUpdate)).toBe('VALIDATION_ERROR');

    const addedVariantResponse = await api('POST', `/products/${product.id}/variants`, {
      token,
      body: { name: '加料', priceFen: '300', sortOrder: 9 },
    });
    expect(addedVariantResponse.status).toBe(201);
    const addedVariant = successData<VariantData>(addedVariantResponse);
    expectVariantShape(addedVariant);
    expect(addedVariant).toMatchObject({
      name: '加料',
      priceFen: '300',
      inventoryMode: 'UNMANAGED',
      status: 'ACTIVE',
    });

    const updateVariant = await api(
      'PATCH',
      `/products/${product.id}/variants/${addedVariant.id}`,
      { token, body: { name: '加料包', priceFen: '350', status: 'DISABLED', sortOrder: 8 } },
    );
    expect(updateVariant.status).toBe(200);
    expect(successData<VariantData>(updateVariant)).toMatchObject({
      name: '加料包',
      priceFen: '350',
      status: 'DISABLED',
      sortOrder: 8,
    });

    const emptyVariantUpdate = await api(
      'PATCH',
      `/products/${product.id}/variants/${addedVariant.id}`,
      { token, body: {} },
    );
    expect(emptyVariantUpdate.status).toBe(400);
    expect(errorCode(emptyVariantUpdate)).toBe('VALIDATION_ERROR');

    const removeVariant = await api(
      'DELETE',
      `/products/${product.id}/variants/${addedVariant.id}`,
      { token },
    );
    expect(removeVariant.status).toBe(200);
    expect(
      await prisma.productVariant.findUnique({ where: { id: BigInt(addedVariant.id) } }),
    ).toBeNull();

    const categoryReferenced = await api('DELETE', `/categories/${secondCategory.id}`, { token });
    expect(categoryReferenced.status).toBe(409);
    expect(errorCode(categoryReferenced)).toBe('CATEGORY_REFERENCED');
    expect(
      await prisma.category.findUnique({ where: { id: BigInt(secondCategory.id) } }),
    ).not.toBeNull();

    const removeProduct = await api('DELETE', `/products/${product.id}`, { token });
    expect(removeProduct.status).toBe(200);
    expect(await prisma.product.findUnique({ where: { id: BigInt(product.id) } })).toBeNull();
    expect(await prisma.productVariant.count({ where: { productId: BigInt(product.id) } })).toBe(0);

    const removeCategory = await api('DELETE', `/categories/${firstCategory.id}`, { token });
    expect(removeCategory.status).toBe(200);
    expect(
      await prisma.category.findUnique({ where: { id: BigInt(firstCategory.id) } }),
    ).toBeNull();

    const singleVariantProduct = await createProduct(token, secondCategory.id, '单规格面', [
      { name: '仅一款', priceFen: '1' },
    ]);
    const lastVariant = singleVariantProduct.variants[0];
    expect(lastVariant).toBeDefined();
    const deleteLastVariant = await api(
      'DELETE',
      `/products/${singleVariantProduct.id}/variants/${String(lastVariant?.id)}`,
      { token },
    );
    expect(deleteLastVariant.status).toBe(400);
    expect(errorCode(deleteLastVariant)).toBe('VALIDATION_ERROR');
    expect(deleteLastVariant.body).toMatchObject({
      error: { details: [{ field: 'variants' }] },
    });

    const removeSingleVariantProduct = await api('DELETE', `/products/${singleVariantProduct.id}`, {
      token,
    });
    expect(removeSingleVariantProduct.status).toBe(200);
    const removeSecondCategory = await api('DELETE', `/categories/${secondCategory.id}`, {
      token,
    });
    expect(removeSecondCategory.status).toBe(200);
  });

  it('serializes concurrent deletion of the last two variants', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const category = await createCategory(token, '并发删除分类');

    for (let round = 0; round < 10; round += 1) {
      const product = await createProduct(token, category.id, `并发删除商品-${round}`, [
        { name: '小碗', priceFen: '100' },
        { name: '大碗', priceFen: '200' },
      ]);
      expect(product.variants, `round ${round}: expected exactly two variants`).toHaveLength(2);

      const responses = await Promise.all(
        product.variants.map((variant) =>
          api('DELETE', `/products/${product.id}/variants/${variant.id}`, { token }),
        ),
      );
      expect(
        responses.map((response) => response.status).sort(),
        `round ${round}: expected one delete to succeed and one to be rejected`,
      ).toEqual([200, 400]);

      const rejected = responses.find((response) => response.status === 400);
      expect(rejected, `round ${round}: expected a rejected delete`).toBeDefined();
      expect(errorCode(rejected as HttpResponse), `round ${round}`).toBe('VALIDATION_ERROR');

      const productExists =
        (await prisma.product.findUnique({ where: { id: BigInt(product.id) } })) !== null;
      const finalVariantCount = await prisma.productVariant.count({
        where: { productId: BigInt(product.id) },
      });
      expect(productExists, `round ${round}: product should still exist`).toBe(true);
      expect(finalVariantCount, `round ${round}: exactly one variant should remain`).toBe(1);
      expect(
        productExists && finalVariantCount === 0,
        `round ${round}: product must never lose all variants`,
      ).toBe(false);
    }
  });

  it.each(['OWNER', 'MANAGER', 'STAFF'] as const)(
    'allows an ACTIVE %s to maintain categories, products and variants',
    async (role) => {
      const actor = await createIdentity(role);
      const token = await login(actor);
      const category = await createCategory(token, `${role}分类`);
      const product = await createProduct(token, category.id, `${role}商品`, [
        { name: '默认', priceFen: '88' },
      ]);
      const variant = await api('POST', `/products/${product.id}/variants`, {
        token,
        body: { name: `${role}规格`, priceFen: '99' },
      });
      expect(variant.status).toBe(201);
      expect(successData<VariantData>(variant).inventoryMode).toBe('UNMANAGED');
    },
  );

  it('returns 401 for missing, invalid and non-ACTIVE sessions', async () => {
    const actor = await createIdentity('STAFF');

    const missing = await api('GET', '/categories');
    expect(missing.status).toBe(401);
    expect(errorCode(missing)).toBe('UNAUTHORIZED');

    const invalid = await api('GET', '/products', { token: 'invalid-token' });
    expect(invalid.status).toBe(401);
    expect(errorCode(invalid)).toBe('UNAUTHORIZED');

    const token = await login(actor);
    await prisma.staff.update({ where: { id: actor.staffId }, data: { status: 'DISABLED' } });
    const disabled = await api('GET', '/categories', { token });
    expect(disabled.status).toBe(401);
    expect(errorCode(disabled)).toBe('UNAUTHORIZED');
  });

  it('returns 403 without leaking data for foreign, missing, malformed or mismatched ids', async () => {
    const actor = await createIdentity('OWNER');
    const foreign = await createIdentity('OWNER');
    const actorToken = await login(actor);
    const foreignToken = await login(foreign);

    const category = await createCategory(actorToken, '本店分类');
    const foreignCategory = await createCategory(foreignToken, '对方店分类');
    const product = await createProduct(actorToken, category.id, '本店商品', [
      { name: '本店规格', priceFen: '100' },
    ]);
    const secondProduct = await createProduct(actorToken, category.id, '第二个商品', [
      { name: '第二个规格', priceFen: '200' },
    ]);
    const foreignProduct = await createProduct(foreignToken, foreignCategory.id, '对方店商品', [
      { name: '对方店规格', priceFen: '300' },
    ]);
    const foreignVariant = foreignProduct.variants[0];
    const otherProductVariant = secondProduct.variants[0];
    expect(foreignVariant).toBeDefined();
    expect(otherProductVariant).toBeDefined();

    const responses: HttpResponse[] = [
      await api('GET', `/categories/${foreignCategory.id}`, { token: actorToken }),
      await api('PATCH', `/categories/${foreignCategory.id}`, {
        token: actorToken,
        body: { name: '越权' },
      }),
      await api('DELETE', `/categories/${foreignCategory.id}`, { token: actorToken }),
      await api('GET', `/products/${foreignProduct.id}`, { token: actorToken }),
      await api('PATCH', `/products/${foreignProduct.id}`, {
        token: actorToken,
        body: { name: '越权' },
      }),
      await api('DELETE', `/products/${foreignProduct.id}`, { token: actorToken }),
      await api('PATCH', `/products/${foreignProduct.id}/variants/${String(foreignVariant?.id)}`, {
        token: actorToken,
        body: { name: '越权' },
      }),
      await api('DELETE', `/products/${foreignProduct.id}/variants/${String(foreignVariant?.id)}`, {
        token: actorToken,
      }),
      await api('GET', '/categories/999999999999999999', { token: actorToken }),
      await api('GET', '/categories/9223372036854775808', { token: actorToken }),
      await api('GET', '/categories/not-a-number', { token: actorToken }),
      await api('GET', '/categories/0', { token: actorToken }),
      await api('PATCH', `/products/${product.id}/variants/${String(otherProductVariant?.id)}`, {
        token: actorToken,
        body: { name: '错配规格' },
      }),
      await api('DELETE', `/products/${product.id}/variants/${String(otherProductVariant?.id)}`, {
        token: actorToken,
      }),
      await api('PATCH', `/products/${product.id}/variants/${String(foreignVariant?.id)}`, {
        token: actorToken,
        body: { name: '跨店规格' },
      }),
    ];

    for (const response of responses) {
      expect(response.status, JSON.stringify(response.body)).toBe(403);
      expect(errorCode(response)).toBe('FORBIDDEN');
      expect(JSON.stringify(response.body)).not.toContain('对方店');
      expect(JSON.stringify(response.body)).not.toContain('越权');
    }

    const crossCategory = await api('POST', '/products', {
      token: actorToken,
      body: {
        categoryId: foreignCategory.id,
        name: '跨店分类商品',
        variants: [{ name: '默认', priceFen: '1' }],
      },
    });
    expect(crossCategory.status).toBe(403);
    expect(errorCode(crossCategory)).toBe('FORBIDDEN');

    const crossCategoryUpdate = await api('PATCH', `/products/${product.id}`, {
      token: actorToken,
      body: { categoryId: foreignCategory.id },
    });
    expect(crossCategoryUpdate.status).toBe(403);
    expect(errorCode(crossCategoryUpdate)).toBe('FORBIDDEN');
    expect(await prisma.product.findUnique({ where: { id: BigInt(product.id) } })).toMatchObject({
      categoryId: BigInt(category.id),
    });

    const crossCategoryFilter = await api('GET', `/products?categoryId=${foreignCategory.id}`, {
      token: actorToken,
    });
    expect(crossCategoryFilter.status).toBe(403);

    const foreignRecord = await prisma.category.findUnique({
      where: { id: BigInt(foreignCategory.id) },
    });
    expect(foreignRecord).toMatchObject({ name: '对方店分类' });
  });

  it('keeps disabled names occupied for categories, products and variants and allows reactivation', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const category = await createCategory(token, '热茶', { status: 'DISABLED' });
    const disabledCategories = await api('GET', '/categories', { token });
    expect(disabledCategories.status).toBe(200);
    expect(
      successData<{ items: CategoryData[] }>(disabledCategories).items.find(
        (row) => row.id === category.id,
      ),
    ).toMatchObject({ status: 'DISABLED' });

    const categoryConflict = await api('POST', '/categories', {
      token,
      body: { name: ' 热茶 ' },
    });
    expect(categoryConflict.status).toBe(409);
    expect(errorCode(categoryConflict)).toBe('CONFLICT');
    expect((categoryConflict.body as ApiErrorBody).error.details).toMatchObject({ field: 'name' });

    const reactivate = await api('PATCH', `/categories/${category.id}`, {
      token,
      body: { status: 'ACTIVE' },
    });
    expect(reactivate.status).toBe(200);
    expect(successData<CategoryData>(reactivate).status).toBe('ACTIVE');

    const product = await createProduct(token, category.id, '面', [
      { name: '小碗', priceFen: '100', status: 'DISABLED' },
    ]);
    const disabledVariantProduct = await api('GET', `/products/${product.id}`, { token });
    expect(disabledVariantProduct.status).toBe(200);
    expect(successData<ProductData>(disabledVariantProduct).variants[0]).toMatchObject({
      status: 'DISABLED',
      inventoryMode: 'UNMANAGED',
    });
    const productConflict = await api('POST', '/products', {
      token,
      body: {
        categoryId: category.id,
        name: '面',
        variants: [{ name: '默认', priceFen: '1' }],
      },
    });
    expect(productConflict.status).toBe(409);
    expect(errorCode(productConflict)).toBe('CONFLICT');

    const variantConflict = await api('POST', `/products/${product.id}/variants`, {
      token,
      body: { name: '小碗', priceFen: '200' },
    });
    expect(variantConflict.status).toBe(409);
    expect(errorCode(variantConflict)).toBe('CONFLICT');

    const variantId = product.variants[0]?.id;
    expect(variantId).toBeDefined();
    const reactivatedVariant = await api(
      'PATCH',
      `/products/${product.id}/variants/${String(variantId)}`,
      { token, body: { status: 'ACTIVE' } },
    );
    expect(reactivatedVariant.status).toBe(200);
    expect(successData<VariantData>(reactivatedVariant).status).toBe('ACTIVE');
  });

  it('validates priceFen strictly, requires variants and rejects inventoryMode input', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const category = await createCategory(token, '主食');

    const zeroPrice = await createProduct(token, category.id, '零元商品', [
      { name: '默认', priceFen: 0 },
    ]);
    expect(zeroPrice.variants[0]?.priceFen).toBe('0');

    for (const priceFen of ['-1', '12.5', '1e2', '1.0', -1, 12.5, '9223372036854775808']) {
      const response = await api('POST', '/products', {
        token,
        body: {
          categoryId: category.id,
          name: `非法价格-${String(priceFen)}`,
          variants: [{ name: '默认', priceFen }],
        },
      });
      expect(response.status, String(priceFen)).toBe(400);
      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    }

    const missingVariants = await api('POST', '/products', {
      token,
      body: { categoryId: category.id, name: '没有规格' },
    });
    expect(missingVariants.status).toBe(400);
    expect(errorCode(missingVariants)).toBe('VALIDATION_ERROR');

    const emptyVariants = await api('POST', '/products', {
      token,
      body: { categoryId: category.id, name: '空规格', variants: [] },
    });
    expect(emptyVariants.status).toBe(400);
    expect(errorCode(emptyVariants)).toBe('VALIDATION_ERROR');

    const inventoryOnCreate = await api('POST', '/products', {
      token,
      body: {
        categoryId: category.id,
        name: '库存模式商品',
        variants: [{ name: '默认', priceFen: '1', inventoryMode: 'MANAGED' }],
      },
    });
    expect(inventoryOnCreate.status).toBe(400);
    expect(errorCode(inventoryOnCreate)).toBe('VALIDATION_ERROR');

    const validProduct = await createProduct(token, category.id, '库存落库商品', [
      { name: '默认', priceFen: '10' },
    ]);
    const storedVariant = await prisma.productVariant.findUnique({
      where: { id: BigInt(validProduct.variants[0]?.id ?? '0') },
    });
    expect(storedVariant?.inventoryMode).toBe('UNMANAGED');

    const inventoryOnVariant = await api('POST', `/products/${validProduct.id}/variants`, {
      token,
      body: { name: '加料', priceFen: '1', inventoryMode: 'MANAGED' },
    });
    expect(inventoryOnVariant.status).toBe(400);
    expect(errorCode(inventoryOnVariant)).toBe('VALIDATION_ERROR');

    const inventoryOnUpdate = await api(
      'PATCH',
      `/products/${validProduct.id}/variants/${validProduct.variants[0]?.id}`,
      { token, body: { inventoryMode: 'MANAGED' } },
    );
    expect(inventoryOnUpdate.status).toBe(400);
    expect(errorCode(inventoryOnUpdate)).toBe('VALIDATION_ERROR');

    const invalidVariantPrice = await api(
      'PATCH',
      `/products/${validProduct.id}/variants/${validProduct.variants[0]?.id}`,
      { token, body: { priceFen: '1.5' } },
    );
    expect(invalidVariantPrice.status).toBe(400);
    expect(errorCode(invalidVariantPrice)).toBe('VALIDATION_ERROR');
  });

  it('blocks deletion of order-referenced variants and products while preserving rows', async () => {
    const actor = await createIdentity('OWNER');
    const token = await login(actor);
    const category = await createCategory(token, '主食');
    const product = await createProduct(token, category.id, '有订单的面', [
      { name: '小碗', priceFen: '100' },
      { name: '大碗', priceFen: '200' },
    ]);
    await createReferencedOrder(product);

    const referencedVariantId = product.variants[0]?.id ?? '0';
    const deleteVariant = await api(
      'DELETE',
      `/products/${product.id}/variants/${referencedVariantId}`,
      { token },
    );
    expect(deleteVariant.status).toBe(409);
    expect(errorCode(deleteVariant)).toBe('VARIANT_REFERENCED');
    expect(
      await prisma.productVariant.findUnique({ where: { id: BigInt(referencedVariantId) } }),
    ).not.toBeNull();

    const deleteProduct = await api('DELETE', `/products/${product.id}`, { token });
    expect(deleteProduct.status).toBe(409);
    expect(errorCode(deleteProduct)).toBe('PRODUCT_REFERENCED');
    expect(await prisma.product.findUnique({ where: { id: BigInt(product.id) } })).not.toBeNull();
    expect(await prisma.productVariant.count({ where: { productId: BigInt(product.id) } })).toBe(2);
  });
});
