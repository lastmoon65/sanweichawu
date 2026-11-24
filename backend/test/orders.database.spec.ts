import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { HttpException } from '@nestjs/common';
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
import { OrderService } from '../src/orders/order.service.js';
import { createHttpHarness } from './support/http-harness.js';
import type { HttpResponse } from './support/http-harness.js';
import { createTestConfig } from './support/test-config.js';
import { requireTaskTestDatabaseUrl } from './support/task-database.js';

const PASSWORD = 'orders-database-password';

function testSuffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, 16);
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
  orderNo: string;
  channel: 'DINE' | 'TAKEAWAY';
  sessionId: string | null;
  status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  subtotalFen: string;
  totalAmountFen: string;
  version: number;
  createdAt: string;
  acceptedAt: string | null;
  preparingAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: OrderItemData[];
}

interface OrderListData {
  items: OrderData[];
}

interface CreatedIdentity {
  storeId: bigint;
  staffId: bigint;
  username: string;
}

interface TestFixture extends CreatedIdentity {
  userId: bigint;
  tableId: bigint;
  categoryId: bigint;
  productId: bigint;
  variantLargeId: bigint;
  variantStandardId: bigint;
}

function expectIsoTimestamp(value: string): void {
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(new Date(value).toISOString()).toBe(value);
}

describe('orders with a real database', () => {
  const passwords = new PasswordService();
  const activeStoreIds = new Set<bigint>();
  const activeUserIds = new Set<bigint>();
  const activeStaffIds = new Set<bigint>();
  const auditStoreIds: bigint[] = [];
  const auditUserIds: bigint[] = [];
  const auditStaffIds: bigint[] = [];
  let prisma: PrismaClient;
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;
  let orders: OrderService;

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
    orders = app.get(OrderService);
  });

  afterEach(async () => {
    const storeIds = [...activeStoreIds];
    activeStoreIds.clear();
    const userIds = [...activeUserIds];
    activeUserIds.clear();
    const staffIds = [...activeStaffIds];
    activeStaffIds.clear();

    if (storeIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { order: { storeId: { in: storeIds } } } });
      await prisma.order.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.diningSession.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.productVariant.deleteMany({ where: { product: { storeId: { in: storeIds } } } });
      await prisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.diningTable.deleteMany({ where: { storeId: { in: storeIds } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (staffIds.length > 0) {
      await prisma.staffCredential.deleteMany({ where: { staffId: { in: staffIds } } });
      await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    }
    if (storeIds.length > 0) {
      await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
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
      expect(await prisma.user.count({ where: { id: { in: auditUserIds } } })).toBe(0);
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

  async function expectIdempotencyKeyReused(
    operation: Promise<unknown>,
    original: OrderData,
  ): Promise<void> {
    const exception = await expectHttpError(operation, 409, 'CONFLICT');
    expect(exception.getResponse()).toMatchObject({
      details: { reason: 'IDEMPOTENCY_KEY_REUSED' },
    });
    const serialized = JSON.stringify(exception.getResponse());
    const secrets = [
      original.id,
      original.orderNo,
      ...original.items.flatMap((item) => [item.productNameSnapshot, item.variantNameSnapshot]),
    ];
    for (const secret of secrets) {
      expect(serialized).not.toContain(secret);
    }
  }

  async function createIdentity(
    role: StaffRole = 'OWNER',
    status: StaffStatus = 'ACTIVE',
  ): Promise<CreatedIdentity> {
    const suffix = testSuffix();
    const store = await prisma.store.create({
      data: { name: `test-sw008-store-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    activeStoreIds.add(store.id);
    auditStoreIds.push(store.id);

    const staff = await prisma.staff.create({
      data: {
        storeId: store.id,
        name: `test-sw008-staff-${suffix}`,
        role,
        status,
      },
      select: { id: true },
    });
    activeStaffIds.add(staff.id);
    auditStaffIds.push(staff.id);

    const username = `test-sw008-staff-${suffix}`;
    await prisma.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });
    return { storeId: store.id, staffId: staff.id, username };
  }

  async function createUser(status: 'ACTIVE' | 'DISABLED' = 'ACTIVE'): Promise<bigint> {
    const user = await prisma.user.create({
      data: { openid: `test-sw008-${testSuffix()}`, status },
      select: { id: true },
    });
    activeUserIds.add(user.id);
    auditUserIds.push(user.id);
    return user.id;
  }

  async function createFixture(options: { userStatus?: 'ACTIVE' | 'DISABLED' } = {}) {
    const identity = await createIdentity('OWNER');
    const suffix = testSuffix();
    const userId = await createUser(options.userStatus);
    const table = await prisma.diningTable.create({
      data: {
        storeId: identity.storeId,
        name: `test-sw008-table-${suffix}`,
        code: `SW008-${suffix.slice(0, 8)}`,
      },
      select: { id: true },
    });
    const category = await prisma.category.create({
      data: { storeId: identity.storeId, name: `test-sw008-category-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    const product = await prisma.product.create({
      data: {
        storeId: identity.storeId,
        categoryId: category.id,
        name: `test-sw008-product-${suffix}`,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const large = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: `test-sw008-large-${suffix}`,
        priceFen: 2300n,
        inventoryMode: 'UNMANAGED',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const standard = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: `test-sw008-standard-${suffix}`,
        priceFen: 1200n,
        inventoryMode: 'UNMANAGED',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return {
      ...identity,
      userId,
      tableId: table.id,
      categoryId: category.id,
      productId: product.id,
      variantLargeId: large.id,
      variantStandardId: standard.id,
    } satisfies TestFixture;
  }

  async function login(identity: CreatedIdentity): Promise<string> {
    const response = await api('POST', '/auth/staff/login', {
      body: { username: identity.username, password: PASSWORD },
    });
    expect(response.status).toBe(200);
    return (response.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;
  }

  async function openSession(token: string, tableId: bigint): Promise<DiningSessionData> {
    const response = await api('POST', `/dining-tables/${tableId}/sessions`, { token });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return successData<DiningSessionData>(response);
  }

  async function createOrder(
    fixture: TestFixture,
    sessionId: string,
    idempotencyKey = `test-sw008-order-${randomUUID()}`,
  ): Promise<OrderData> {
    return orders.createOrder({
      customerUserId: fixture.userId,
      sessionId,
      idempotencyKey,
      items: [
        { variantId: fixture.variantLargeId, quantity: 2, remark: '少冰' },
        { variantId: fixture.variantStandardId, quantity: 1 },
      ],
    });
  }

  it('creates and advances an order with amount snapshots and ordered timestamps', async () => {
    const fixture = await createFixture();
    const token = await login(fixture);
    const session = await openSession(token, fixture.tableId);
    const created = await createOrder(fixture, session.id);

    expect(created).toMatchObject({
      storeId: fixture.storeId.toString(),
      customerUserId: fixture.userId.toString(),
      sessionId: session.id,
      channel: 'DINE',
      status: 'PENDING_ACCEPTANCE',
      version: 1,
      subtotalFen: '5800',
      totalAmountFen: '5800',
    });
    expect(created.orderNo.length).toBeLessThanOrEqual(40);
    expect(created.items).toHaveLength(2);
    expect(created.items[0]).toMatchObject({
      productNameSnapshot: expect.stringContaining('test-sw008-product-'),
      variantNameSnapshot: expect.stringContaining('test-sw008-large-'),
      unitPriceFen: '2300',
      quantity: 2,
      lineSubtotalFen: '4600',
      remark: '少冰',
    });
    expect(created.items[1]).toMatchObject({ unitPriceFen: '1200', lineSubtotalFen: '1200' });
    expectIsoTimestamp(created.createdAt);

    const accepted = await api('POST', `/orders/${created.id}/accept`, {
      token,
      body: { version: 1 },
    });
    expect(accepted.status).toBe(200);
    const acceptedOrder = successData<OrderData>(accepted);
    expect(acceptedOrder).toMatchObject({ status: 'ACCEPTED', version: 2, preparingAt: null });
    expectIsoTimestamp(acceptedOrder.acceptedAt ?? '');

    const preparing = await api('POST', `/orders/${created.id}/start`, {
      token,
      body: { version: 2 },
    });
    expect(preparing.status).toBe(200);
    const preparingOrder = successData<OrderData>(preparing);
    expect(preparingOrder).toMatchObject({ status: 'PREPARING', version: 3 });
    expectIsoTimestamp(preparingOrder.preparingAt ?? '');

    const completed = await api('POST', `/orders/${created.id}/complete`, {
      token,
      body: { version: 3 },
    });
    expect(completed.status).toBe(200);
    const completedOrder = successData<OrderData>(completed);
    expect(completedOrder).toMatchObject({ status: 'COMPLETED', version: 4 });
    expectIsoTimestamp(completedOrder.completedAt ?? '');

    const invalidTransition = await api('POST', `/orders/${created.id}/cancel`, {
      token,
      body: { version: 4, cancelReason: '完成后再取消' },
    });
    expect(invalidTransition.status).toBe(409);
    expect(errorCode(invalidTransition)).toBe('CONFLICT');
    expect((invalidTransition.body as ApiErrorBody).error.details).toMatchObject({
      reason: 'INVALID_TRANSITION',
      currentVersion: 4,
      currentStatus: 'COMPLETED',
    });

    const staleCancel = await api('POST', `/orders/${created.id}/cancel`, {
      token,
      body: { version: 3, cancelReason: '完成后再取消' },
    });
    expect(staleCancel.status).toBe(409);
    expect(errorCode(staleCancel)).toBe('CONFLICT');
    expect((staleCancel.body as ApiErrorBody).error.details).toMatchObject({
      reason: 'VERSION_MISMATCH',
      currentVersion: 4,
      currentStatus: 'COMPLETED',
    });
  });

  it('rejects cross-store idempotency key reuse without leaking the original order', async () => {
    const fixture = await createFixture();
    const foreign = await createFixture();
    const token = await login(fixture);
    const foreignToken = await login(foreign);
    const session = await openSession(token, fixture.tableId);
    const foreignSession = await openSession(foreignToken, foreign.tableId);
    const idempotencyKey = `test-sw010-reuse-${randomUUID()}`;
    const original = await createOrder(fixture, session.id, idempotencyKey);

    expect(foreign.storeId).not.toBe(fixture.storeId);
    await expectIdempotencyKeyReused(
      orders.createOrder({
        customerUserId: foreign.userId,
        sessionId: foreignSession.id,
        idempotencyKey,
        items: [
          { variantId: foreign.variantLargeId, quantity: 2, remark: '少冰' },
          { variantId: foreign.variantStandardId, quantity: 1 },
        ],
      }),
      original,
    );
    expect(await prisma.order.count({ where: { storeId: foreign.storeId } })).toBe(0);
  });

  it('replays a reordered request without creating another order', async () => {
    const fixture = await createFixture();
    const token = await login(fixture);
    const session = await openSession(token, fixture.tableId);
    const idempotencyKey = `test-sw010-replay-${randomUUID()}`;
    const items = [
      { variantId: fixture.variantLargeId, quantity: 2, remark: '少冰' },
      { variantId: fixture.variantStandardId, quantity: 1 },
    ];
    const original = await orders.createOrder({
      customerUserId: fixture.userId,
      sessionId: session.id,
      idempotencyKey,
      items,
    });
    const orderCountBeforeReplay = await prisma.order.count({
      where: { storeId: fixture.storeId },
    });

    const replay = await orders.createOrder({
      customerUserId: fixture.userId,
      sessionId: session.id,
      idempotencyKey,
      items: [...items].reverse(),
    });

    expect(replay.id).toBe(original.id);
    expect(replay.orderNo).toBe(original.orderNo);
    expect(orderCountBeforeReplay).toBe(1);
    expect(await prisma.order.count({ where: { storeId: fixture.storeId } })).toBe(
      orderCountBeforeReplay,
    );
  });

  it('lists and filters this store orders, including details, and hides foreign sessions', async () => {
    const fixture = await createFixture();
    const foreign = await createFixture();
    const token = await login(fixture);
    const foreignToken = await login(foreign);
    const session = await openSession(token, fixture.tableId);
    const foreignSession = await openSession(foreignToken, foreign.tableId);
    const first = await createOrder(fixture, session.id);
    const second = await createOrder(fixture, session.id);
    await api('POST', `/orders/${second.id}/accept`, { token, body: { version: 1 } });

    const all = await api('GET', '/orders', { token });
    expect(all.status).toBe(200);
    expect(successData<OrderListData>(all).items.map((order) => order.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(successData<OrderListData>(all).items[0]?.items).toHaveLength(2);

    const accepted = await api('GET', '/orders?status=ACCEPTED', { token });
    expect(accepted.status).toBe(200);
    expect(successData<OrderListData>(accepted).items.map((order) => order.id)).toEqual([
      second.id,
    ]);

    const filteredSession = await api('GET', `/orders?sessionId=${session.id}`, { token });
    expect(filteredSession.status).toBe(200);
    expect(successData<OrderListData>(filteredSession).items).toHaveLength(2);

    const foreignSessionFilter = await api('GET', `/orders?sessionId=${foreignSession.id}`, {
      token,
    });
    expect(foreignSessionFilter.status).toBe(200);
    expect(successData<OrderListData>(foreignSessionFilter).items).toEqual([]);

    for (const status of ['pending', 'PENDING', 'UNKNOWN']) {
      const invalid = await api('GET', `/orders?status=${status}`, { token });
      expect(invalid.status).toBe(400);
      expect(errorCode(invalid)).toBe('VALIDATION_ERROR');
    }
  });

  it('supports employee cancellation in each cancellable status and validates versions', async () => {
    const fixture = await createFixture();
    const token = await login(fixture);
    const session = await openSession(token, fixture.tableId);
    const pending = await createOrder(fixture, session.id);
    const accepted = await createOrder(fixture, session.id);
    const preparing = await createOrder(fixture, session.id);

    await api('POST', `/orders/${accepted.id}/accept`, { token, body: { version: 1 } });
    await api('POST', `/orders/${preparing.id}/accept`, { token, body: { version: 1 } });
    await api('POST', `/orders/${preparing.id}/start`, { token, body: { version: 2 } });

    const cancelledPending = await api('POST', `/orders/${pending.id}/cancel`, {
      token,
      body: { version: 1, cancelReason: '  顾客离店  ' },
    });
    const cancelledAccepted = await api('POST', `/orders/${accepted.id}/cancel`, {
      token,
      body: { version: 2, cancelReason: '临时售罄' },
    });
    const cancelledPreparing = await api('POST', `/orders/${preparing.id}/cancel`, {
      token,
      body: { version: 3, cancelReason: '设备故障' },
    });
    expect([cancelledPending.status, cancelledAccepted.status, cancelledPreparing.status]).toEqual([
      200, 200, 200,
    ]);
    expect(successData<OrderData>(cancelledPending)).toMatchObject({
      status: 'CANCELLED',
      version: 2,
      cancelReason: '顾客离店',
    });
    expect(successData<OrderData>(cancelledAccepted)).toMatchObject({
      status: 'CANCELLED',
      version: 3,
    });
    expect(successData<OrderData>(cancelledPreparing)).toMatchObject({
      status: 'CANCELLED',
      version: 4,
    });

    const stale = await api('POST', `/orders/${pending.id}/cancel`, {
      token,
      body: { version: 1, cancelReason: '再次取消' },
    });
    expect(stale.status).toBe(409);
    expect((stale.body as ApiErrorBody).error.details).toMatchObject({
      reason: 'VERSION_MISMATCH',
      currentVersion: 2,
      currentStatus: 'CANCELLED',
    });

    for (const body of [
      { version: 1 },
      { version: 1, cancelReason: '' },
      { version: 1, cancelReason: 'x'.repeat(501) },
    ]) {
      const invalid = await api('POST', `/orders/${pending.id}/cancel`, { token, body });
      expect(invalid.status).toBe(400);
      expect(errorCode(invalid)).toBe('VALIDATION_ERROR');
    }
  });

  it('enforces customer ownership and PENDING_ACCEPTANCE-only customer cancellation', async () => {
    const fixture = await createFixture();
    const otherUser = await createUser();
    const token = await login(fixture);
    const session = await openSession(token, fixture.tableId);
    const own = await createOrder(fixture, session.id);
    const foreign = await createOrder(fixture, session.id);
    const accepted = await createOrder(fixture, session.id);

    await expectHttpError(orders.cancelByCustomer(otherUser, own.id, 1), 403, 'FORBIDDEN');
    const cancelled = await orders.cancelByCustomer(fixture.userId, own.id, 1, '不想要了');
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      version: 2,
      cancelReason: '不想要了',
    });

    await expectHttpError(
      orders.cancelByCustomer(fixture.userId, foreign.id, 2, '版本不符'),
      409,
      'CONFLICT',
    );

    await api('POST', `/orders/${accepted.id}/accept`, { token, body: { version: 1 } });
    await expectHttpError(
      orders.cancelByCustomer(fixture.userId, accepted.id, 2, '已接单后取消'),
      409,
      'CONFLICT',
    );
  });

  it('keeps item snapshots after the product and variant change', async () => {
    const fixture = await createFixture();
    const token = await login(fixture);
    const session = await openSession(token, fixture.tableId);
    const created = await createOrder(fixture, session.id);
    const originalItem = created.items[0]!;

    await prisma.product.update({
      where: { id: fixture.productId },
      data: { name: `test-sw008-renamed-${testSuffix()}` },
    });
    await prisma.productVariant.update({
      where: { id: fixture.variantLargeId },
      data: { name: '改名超大杯', priceFen: 9900n },
    });

    const detail = await api('GET', `/orders/${created.id}`, { token });
    expect(detail.status).toBe(200);
    const reloaded = successData<OrderData>(detail);
    expect(reloaded.totalAmountFen).toBe('5800');
    expect(reloaded.items[0]).toMatchObject({
      productNameSnapshot: originalItem.productNameSnapshot,
      variantNameSnapshot: originalItem.variantNameSnapshot,
      unitPriceFen: '2300',
      lineSubtotalFen: '4600',
    });
  });

  it('closes sessions only after all orders are completed or cancelled and rejects closed sessions', async () => {
    const fixture = await createFixture();
    const token = await login(fixture);
    const completedSession = await openSession(token, fixture.tableId);
    const completedOrder = await createOrder(fixture, completedSession.id);

    const blocked = await api('POST', `/dining-sessions/${completedSession.id}/close`, {
      token,
      body: { version: 1 },
    });
    expect(blocked.status).toBe(409);
    expect(errorCode(blocked)).toBe('CONFLICT');
    expect((blocked.body as ApiErrorBody).error.details).toMatchObject({
      reason: 'SESSION_HAS_ORDERS',
      orderCount: 1,
    });

    await api('POST', `/orders/${completedOrder.id}/accept`, { token, body: { version: 1 } });
    await api('POST', `/orders/${completedOrder.id}/start`, { token, body: { version: 2 } });
    await api('POST', `/orders/${completedOrder.id}/complete`, { token, body: { version: 3 } });

    const closed = await api('POST', `/dining-sessions/${completedSession.id}/close`, {
      token,
      body: { version: 1 },
    });
    expect(closed.status).toBe(200);
    expect(successData<DiningSessionData>(closed)).toMatchObject({ status: 'CLOSED', version: 2 });

    await expectHttpError(
      orders.createOrder({
        customerUserId: fixture.userId,
        sessionId: completedSession.id,
        idempotencyKey: `test-sw008-closed-${randomUUID()}`,
        items: [{ variantId: fixture.variantLargeId, quantity: 1 }],
      }),
      409,
      'SESSION_CLOSED',
    );

    const cancelledSession = await openSession(token, fixture.tableId);
    const cancelledOrder = await createOrder(fixture, cancelledSession.id);
    await orders.cancelByCustomer(fixture.userId, cancelledOrder.id, 1, '顾客取消');
    const closedWithCancelled = await api('POST', `/dining-sessions/${cancelledSession.id}/close`, {
      token,
      body: { version: 1 },
    });
    expect(closedWithCancelled.status).toBe(200);
  });

  it('returns 403 for foreign order ids on reads and actions', async () => {
    const fixture = await createFixture();
    const foreign = await createFixture();
    const token = await login(fixture);
    const foreignToken = await login(foreign);
    const session = await openSession(token, fixture.tableId);
    const created = await createOrder(fixture, session.id);

    const own = await api('GET', `/orders/${created.id}`, { token });
    expect(own.status).toBe(200);

    for (const orderId of [created.id, '999999999999999999', 'not-a-number', '0']) {
      const read = await api('GET', `/orders/${orderId}`, { token: foreignToken });
      expect(read.status).toBe(403);
      expect(errorCode(read)).toBe('FORBIDDEN');

      const accept = await api('POST', `/orders/${orderId}/accept`, {
        token: foreignToken,
        body: { version: 1 },
      });
      expect(accept.status).toBe(403);
      expect(errorCode(accept)).toBe('FORBIDDEN');
    }
  });

  it('allows exactly one winner across 10 rounds of concurrent order creation and session close', async () => {
    const fixture = await createFixture();
    const token = await login(fixture);
    const tableId = fixture.tableId.toString();

    for (let round = 1; round <= 10; round += 1) {
      const session = await openSession(token, fixture.tableId);
      const createPromise = orders
        .createOrder({
          customerUserId: fixture.userId,
          sessionId: session.id,
          idempotencyKey: `test-sw008-race-${round}-${randomUUID()}`,
          items: [{ variantId: fixture.variantLargeId, quantity: 1 }],
        })
        .then(
          (order) => ({ ok: true as const, order }),
          (error: unknown) => ({ ok: false as const, error }),
        );
      const closePromise = api('POST', `/dining-sessions/${session.id}/close`, {
        token,
        body: { version: session.version },
      });
      const [closeResult, createResult] = await Promise.all([closePromise, createPromise]);

      expect(
        Number(createResult.ok) + Number(closeResult.status === 200),
        `round ${round} create=${JSON.stringify(createResult)} close=${closeResult.status}`,
      ).toBe(1);

      if (closeResult.status === 200) {
        expect(createResult.ok).toBe(false);
        if (!createResult.ok) {
          expect(createResult.error).toBeInstanceOf(HttpException);
          expect((createResult.error as HttpException).getStatus()).toBe(409);
          expect((createResult.error as HttpException).getResponse()).toMatchObject({
            code: 'SESSION_CLOSED',
          });
        }
        expect(await prisma.order.count({ where: { sessionId: BigInt(session.id) } })).toBe(0);
      } else {
        expect(closeResult.status).toBe(409);
        expect(errorCode(closeResult)).toBe('CONFLICT');
        expect((closeResult.body as ApiErrorBody).error.details).toMatchObject({
          reason: 'SESSION_HAS_ORDERS',
        });
        expect(createResult.ok).toBe(true);
        expect(await prisma.order.count({ where: { sessionId: BigInt(session.id) } })).toBe(1);
        const stillOpen = await prisma.diningSession.findUnique({
          where: { id: BigInt(session.id) },
          select: { status: true, version: true },
        });
        expect(stillOpen).toMatchObject({ status: 'OPEN', version: 1 });

        await prisma.orderItem.deleteMany({ where: { order: { sessionId: BigInt(session.id) } } });
        await prisma.order.deleteMany({ where: { sessionId: BigInt(session.id) } });
        const cleanupClose = await api('POST', `/dining-sessions/${session.id}/close`, {
          token,
          body: { version: 1 },
        });
        expect(cleanupClose.status, `cleanup close round ${round}`).toBe(200);
      }

      const currentSession = await prisma.diningSession.findUnique({
        where: { id: BigInt(session.id) },
      });
      expect(currentSession?.status).toBe('CLOSED');
    }

    const closedSessions = await prisma.diningSession.findMany({
      where: { storeId: fixture.storeId, tableId: BigInt(tableId), status: 'CLOSED' },
      select: { id: true },
    });
    expect(closedSessions).toHaveLength(10);
    expect(
      await prisma.order.count({
        where: { sessionId: { in: closedSessions.map((session) => session.id) } },
      }),
    ).toBe(0);
  });
});
