import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import {
  WECHAT_CODE2SESSION_CLIENT,
  WechatCode2SessionError,
} from '../src/customer-auth/wechat-code2session.client.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createHttpHarness } from './support/http-harness.js';
import type { HttpResponse } from './support/http-harness.js';
import { createTestConfig } from './support/test-config.js';
import { requireTaskTestDatabaseUrl } from './support/task-database.js';

const PASSWORD = 'customer-ordering-database-password';

function testSuffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, 16);
}

interface Fixture {
  storeId: bigint;
  staffId: bigint;
  username: string;
  tableId: bigint;
  tableCode: string;
  categoryId: bigint;
  productId: bigint;
  variantLargeId: bigint;
  variantStandardId: bigint;
}

interface CustomerLogin {
  openid: string;
  userId: bigint;
  token: string;
}

interface DiningSessionData {
  id: string;
  storeId: string;
  tableId: string;
  status: 'OPEN' | 'CLOSED';
  version: number;
  openedAt: string;
}

interface OrderItemData {
  id: string;
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceFen: string;
  quantity: number;
  lineSubtotalFen: string;
  remark: string | null;
}

interface OrderData {
  id: string;
  storeId: string;
  customerUserId: string;
  sessionId: string | null;
  status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  subtotalFen: string;
  totalAmountFen: string;
  version: number;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: OrderItemData[];
}

interface CustomerOrderListData {
  items: OrderData[];
}

interface CustomerTableData {
  storeId: string;
  table: { id: string; name: string; code: string };
  session: { id: string; openedAt: string };
}

interface CustomerMenuData {
  storeId: string;
  sessionId: string;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    products: Array<{
      id: string;
      name: string;
      variants: Array<{ id: string; name: string; priceFen: string }>;
    }>;
  }>;
}

describe('customer ordering with a real database', () => {
  const passwords = new PasswordService();
  const wechatCodes = new Map<string, string>();
  const activeStoreIds = new Set<bigint>();
  const activeStaffIds = new Set<bigint>();
  const activeOpenids = new Set<string>();
  const auditStoreIds: bigint[] = [];
  const auditStaffIds: bigint[] = [];
  const auditOpenids: string[] = [];
  let prisma: PrismaClient;
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;

  beforeAll(async () => {
    const databaseUrl = requireTaskTestDatabaseUrl();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const wechat = {
      exchangeCode: async (code: string) => {
        const openid = wechatCodes.get(code);
        if (!openid) {
          throw new WechatCode2SessionError('rejected', 40029);
        }
        return { openid };
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        createTestConfig({
          databaseUrl,
          wechatAppId: 'test-app-id',
          wechatAppSecret: 'test-app-secret',
        }),
      )
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(WECHAT_CODE2SESSION_CLIENT)
      .useValue(wechat)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
  });

  afterEach(async () => {
    const storeIds = [...activeStoreIds];
    activeStoreIds.clear();
    const staffIds = [...activeStaffIds];
    activeStaffIds.clear();
    const openids = [...activeOpenids];
    activeOpenids.clear();

    if (storeIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { order: { storeId: { in: storeIds } } } });
      await prisma.order.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.diningSession.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.productVariant.deleteMany({
        where: { product: { storeId: { in: storeIds } } },
      });
      await prisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.diningTable.deleteMany({ where: { storeId: { in: storeIds } } });
    }
    if (openids.length > 0) {
      await prisma.user.deleteMany({ where: { openid: { in: openids } } });
    }
    if (staffIds.length > 0) {
      await prisma.staffCredential.deleteMany({ where: { staffId: { in: staffIds } } });
      await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    }
    if (storeIds.length > 0) {
      await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
    wechatCodes.clear();
  });

  afterAll(async () => {
    try {
      if (auditStoreIds.length > 0) {
        expect(
          await prisma.orderItem.count({ where: { order: { storeId: { in: auditStoreIds } } } }),
        ).toBe(0);
        expect(await prisma.order.count({ where: { storeId: { in: auditStoreIds } } })).toBe(0);
        expect(
          await prisma.diningSession.count({ where: { storeId: { in: auditStoreIds } } }),
        ).toBe(0);
        expect(
          await prisma.productVariant.count({
            where: { product: { storeId: { in: auditStoreIds } } },
          }),
        ).toBe(0);
        expect(await prisma.product.count({ where: { storeId: { in: auditStoreIds } } })).toBe(0);
        expect(await prisma.category.count({ where: { storeId: { in: auditStoreIds } } })).toBe(0);
        expect(await prisma.diningTable.count({ where: { storeId: { in: auditStoreIds } } })).toBe(
          0,
        );
        expect(await prisma.store.count({ where: { id: { in: auditStoreIds } } })).toBe(0);
      }
      expect(await prisma.user.count({ where: { openid: { in: auditOpenids } } })).toBe(0);
      expect(
        await prisma.staffCredential.count({ where: { staffId: { in: auditStaffIds } } }),
      ).toBe(0);
      expect(await prisma.staff.count({ where: { id: { in: auditStaffIds } } })).toBe(0);
    } finally {
      await app?.close();
      await prisma.$disconnect();
    }
  });

  async function api(
    method: string,
    path: string,
    options: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = { ...options.headers };
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

  function newOpenid(): string {
    return `test-sw013-${testSuffix()}`;
  }

  function registerWechatCode(openid: string): string {
    const code = randomUUID();
    wechatCodes.set(code, openid);
    if (!activeOpenids.has(openid)) {
      activeOpenids.add(openid);
      auditOpenids.push(openid);
    }
    return code;
  }

  async function loginCustomer(openid = newOpenid()): Promise<CustomerLogin> {
    const code = registerWechatCode(openid);
    const response = await api('POST', '/customer/auth/login', { body: { code } });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const token = successData<{ accessToken: string }>(response).accessToken;
    const user = await prisma.user.findUnique({ where: { openid }, select: { id: true } });
    expect(user).not.toBeNull();
    return { openid, userId: user!.id, token };
  }

  async function createFixture(): Promise<Fixture> {
    const suffix = testSuffix();
    const store = await prisma.store.create({
      data: { name: `test-sw013-store-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    activeStoreIds.add(store.id);
    auditStoreIds.push(store.id);

    const staff = await prisma.staff.create({
      data: {
        storeId: store.id,
        name: `test-sw013-staff-${suffix}`,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    activeStaffIds.add(staff.id);
    auditStaffIds.push(staff.id);
    const username = `test-sw013-staff-${suffix}`;
    await prisma.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });

    const tableCode = `SW013-${suffix.slice(0, 8)}`;
    const table = await prisma.diningTable.create({
      data: { storeId: store.id, name: `test-sw013-table-${suffix}`, code: tableCode },
      select: { id: true },
    });
    const category = await prisma.category.create({
      data: { storeId: store.id, name: `test-sw013-category-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: category.id,
        name: `test-sw013-product-${suffix}`,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const large = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: `test-sw013-large-${suffix}`,
        priceFen: 2300n,
        inventoryMode: 'UNMANAGED',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const standard = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: `test-sw013-standard-${suffix}`,
        priceFen: 1200n,
        inventoryMode: 'UNMANAGED',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return {
      storeId: store.id,
      staffId: staff.id,
      username,
      tableId: table.id,
      tableCode,
      categoryId: category.id,
      productId: product.id,
      variantLargeId: large.id,
      variantStandardId: standard.id,
    };
  }

  async function loginStaff(fixture: Fixture): Promise<string> {
    const response = await api('POST', '/auth/staff/login', {
      body: { username: fixture.username, password: PASSWORD },
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return successData<{ accessToken: string }>(response).accessToken;
  }

  async function openSession(staffToken: string, tableId: bigint): Promise<DiningSessionData> {
    const response = await api('POST', `/dining-tables/${tableId}/sessions`, {
      token: staffToken,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return successData<DiningSessionData>(response);
  }

  function orderBody(fixture: Fixture, sessionId: string): Record<string, unknown> {
    return {
      customerUserId: '999999999999999999',
      sessionId,
      items: [
        { variantId: fixture.variantLargeId.toString(), quantity: 2, remark: '少冰' },
        { variantId: fixture.variantStandardId.toString(), quantity: 1 },
      ],
    };
  }

  async function createCustomerOrder(
    fixture: Fixture,
    customer: CustomerLogin,
    sessionId: string,
    idempotencyKey = `test-sw013-order-${randomUUID()}`,
  ): Promise<OrderData> {
    const response = await api('POST', '/customer/orders', {
      token: customer.token,
      headers: { 'idempotency-key': idempotencyKey },
      body: orderBody(fixture, sessionId),
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return successData<OrderData>(response);
  }

  it('upserts one user for repeated and concurrent logins with the same openid', async () => {
    const openid = newOpenid();
    const firstCode = registerWechatCode(openid);
    const secondCode = registerWechatCode(openid);

    const responses = await Promise.all([
      api('POST', '/customer/auth/login', { body: { code: firstCode } }),
      api('POST', '/customer/auth/login', { body: { code: secondCode } }),
    ]);
    for (const response of responses) {
      expect(response.status, JSON.stringify(response.body)).toBe(200);
    }
    expect(await prisma.user.count({ where: { openid } })).toBe(1);

    const repeat = await api('POST', '/customer/auth/login', { body: { code: firstCode } });
    expect(repeat.status).toBe(200);
    expect(await prisma.user.count({ where: { openid } })).toBe(1);
    expect(JSON.stringify(responses[0]!.body)).not.toContain(openid);
    expect(JSON.stringify(responses[0]!.body)).not.toContain('session_key');
  });

  it('creates a customer order and lets staff advance it through completion', async () => {
    const fixture = await createFixture();
    const staffToken = await loginStaff(fixture);
    const customer = await loginCustomer();
    const session = await openSession(staffToken, fixture.tableId);

    const table = await api('GET', `/customer/tables/${fixture.tableCode}`, {
      token: customer.token,
    });
    expect(table.status).toBe(200);
    expect(successData<CustomerTableData>(table)).toEqual({
      storeId: fixture.storeId.toString(),
      table: { id: fixture.tableId.toString(), name: expect.any(String), code: fixture.tableCode },
      session: { id: session.id, openedAt: expect.any(String) },
    });

    const menu = await api('GET', `/customer/menu?sessionId=${session.id}`, {
      token: customer.token,
    });
    expect(menu.status).toBe(200);
    const menuData = successData<CustomerMenuData>(menu);
    expect(menuData.categories).toHaveLength(1);
    expect(
      menuData.categories[0]?.products[0]?.variants.map((variant) => variant.priceFen),
    ).toEqual(['2300', '1200']);

    const idempotencyKey = `test-sw013-replay-${randomUUID()}`;
    const created = await createCustomerOrder(fixture, customer, session.id, idempotencyKey);
    const replay = await createCustomerOrder(fixture, customer, session.id, idempotencyKey);
    expect(replay.id).toBe(created.id);
    expect(await prisma.order.count({ where: { storeId: fixture.storeId } })).toBe(1);
    expect(created).toMatchObject({
      storeId: fixture.storeId.toString(),
      customerUserId: customer.userId.toString(),
      sessionId: session.id,
      status: 'PENDING_ACCEPTANCE',
      version: 1,
      subtotalFen: '5800',
      totalAmountFen: '5800',
    });
    expect(created.items).toHaveLength(2);

    const accepted = await api('POST', `/orders/${created.id}/accept`, {
      token: staffToken,
      body: { version: 1 },
    });
    expect(accepted.status).toBe(200);
    expect(successData<OrderData>(accepted)).toMatchObject({ status: 'ACCEPTED', version: 2 });

    const preparing = await api('POST', `/orders/${created.id}/start`, {
      token: staffToken,
      body: { version: 2 },
    });
    expect(preparing.status).toBe(200);
    expect(successData<OrderData>(preparing)).toMatchObject({ status: 'PREPARING', version: 3 });

    const completed = await api('POST', `/orders/${created.id}/complete`, {
      token: staffToken,
      body: { version: 3 },
    });
    expect(completed.status).toBe(200);
    expect(successData<OrderData>(completed)).toMatchObject({ status: 'COMPLETED', version: 4 });
  });

  it('shows and cancels only the authenticated customer own orders', async () => {
    const fixture = await createFixture();
    const staffToken = await loginStaff(fixture);
    const firstCustomer = await loginCustomer();
    const secondCustomer = await loginCustomer();
    const session = await openSession(staffToken, fixture.tableId);
    const firstOrder = await createCustomerOrder(fixture, firstCustomer, session.id);
    const secondOrder = await createCustomerOrder(fixture, secondCustomer, session.id);

    const firstList = await api('GET', `/customer/orders?sessionId=${session.id}`, {
      token: firstCustomer.token,
    });
    expect(firstList.status).toBe(200);
    expect(successData<CustomerOrderListData>(firstList).items.map((order) => order.id)).toEqual([
      firstOrder.id,
    ]);

    const secondList = await api('GET', `/customer/orders?sessionId=${session.id}`, {
      token: secondCustomer.token,
    });
    expect(successData<CustomerOrderListData>(secondList).items.map((order) => order.id)).toEqual([
      secondOrder.id,
    ]);

    const foreignCancel = await api('POST', `/customer/orders/${secondOrder.id}/cancel`, {
      token: firstCustomer.token,
      body: { version: 1 },
    });
    expect(foreignCancel.status).toBe(403);
    expect(errorCode(foreignCancel)).toBe('FORBIDDEN');

    const ownCancel = await api('POST', `/customer/orders/${firstOrder.id}/cancel`, {
      token: firstCustomer.token,
      body: { version: 1 },
    });
    expect(ownCancel.status).toBe(200);
    expect(successData<OrderData>(ownCancel)).toMatchObject({
      status: 'CANCELLED',
      version: 2,
    });
    expect(
      await prisma.order.findUnique({
        where: { id: BigInt(secondOrder.id) },
        select: { status: true },
      }),
    ).toEqual({ status: 'PENDING_ACCEPTANCE' });
  });

  it('rejects customer cancellation after acceptance and for a stale version', async () => {
    const fixture = await createFixture();
    const staffToken = await loginStaff(fixture);
    const customer = await loginCustomer();
    const session = await openSession(staffToken, fixture.tableId);
    const pendingOrder = await createCustomerOrder(fixture, customer, session.id);

    const stale = await api('POST', `/customer/orders/${pendingOrder.id}/cancel`, {
      token: customer.token,
      body: { version: 2 },
    });
    expect(stale.status).toBe(409);
    expect(errorCode(stale)).toBe('CONFLICT');
    expect((stale.body as ApiErrorBody).error.details).toMatchObject({
      reason: 'VERSION_MISMATCH',
      currentVersion: 1,
    });

    const accepted = await api('POST', `/orders/${pendingOrder.id}/accept`, {
      token: staffToken,
      body: { version: 1 },
    });
    expect(accepted.status).toBe(200);

    const notPending = await api('POST', `/customer/orders/${pendingOrder.id}/cancel`, {
      token: customer.token,
      body: { version: 2, cancelReason: '想取消' },
    });
    expect(notPending.status).toBe(409);
    expect(errorCode(notPending)).toBe('CONFLICT');
    expect((notPending.body as ApiErrorBody).error.details).toMatchObject({
      reason: 'INVALID_TRANSITION',
      currentStatus: 'ACCEPTED',
    });
  });

  it('rejects ordering after table closure and makes table resolution return 404', async () => {
    const fixture = await createFixture();
    const staffToken = await loginStaff(fixture);
    const customer = await loginCustomer();
    const session = await openSession(staffToken, fixture.tableId);
    const order = await createCustomerOrder(fixture, customer, session.id);

    const cancelled = await api('POST', `/customer/orders/${order.id}/cancel`, {
      token: customer.token,
      body: { version: 1 },
    });
    expect(cancelled.status).toBe(200);

    const closed = await api('POST', `/dining-sessions/${session.id}/close`, {
      token: staffToken,
      body: { version: 1 },
    });
    expect(closed.status).toBe(200);
    expect(successData<DiningSessionData>(closed)).toMatchObject({ status: 'CLOSED', version: 2 });

    const closedOrderAttempt = await api('POST', '/customer/orders', {
      token: customer.token,
      headers: { 'idempotency-key': `test-sw013-closed-${randomUUID()}` },
      body: orderBody(fixture, session.id),
    });
    expect(closedOrderAttempt.status).toBe(409);
    expect(errorCode(closedOrderAttempt)).toBe('SESSION_CLOSED');

    const closedTable = await api('GET', `/customer/tables/${fixture.tableCode}`, {
      token: customer.token,
    });
    expect(closedTable.status).toBe(404);
    expect(errorCode(closedTable)).toBe('TABLE_NOT_AVAILABLE');
  });
});
