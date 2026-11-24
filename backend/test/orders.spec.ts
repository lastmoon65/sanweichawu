import 'reflect-metadata';

import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OrderStatus, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { DiningSessionService } from '../src/dining-sessions/dining-session.service.js';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { OrderService } from '../src/orders/order.service.js';
import type { CreateOrderInput } from '../src/orders/order.service.js';
import type { OrderResponse } from '../src/orders/order.types.js';

type CommonStatus = 'ACTIVE' | 'DISABLED';
type SessionStatus = 'OPEN' | 'CLOSED';

interface UserRow {
  id: bigint;
  status: UserStatus;
}

interface ProductRow {
  id: bigint;
  storeId: bigint;
  name: string;
  status: CommonStatus;
}

interface VariantRow {
  id: bigint;
  name: string;
  priceFen: bigint;
  status: CommonStatus;
  product: ProductRow;
}

interface SessionRow {
  id: bigint;
  storeId: bigint;
  tableId: bigint;
  status: SessionStatus;
  version: number;
  openedAt: Date;
  closedAt: Date | null;
  closedByStaffId: bigint | null;
}

interface OrderItemRow {
  id: bigint;
  orderId: bigint;
  productId: bigint;
  variantId: bigint;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceFen: bigint;
  quantity: number;
  lineSubtotalFen: bigint;
  remark: string | null;
  createdAt: Date;
}

interface OrderRow {
  id: bigint;
  storeId: bigint;
  customerUserId: bigint;
  orderNo: string;
  idempotencyKey: string;
  channel: 'DINE' | 'TAKEAWAY';
  sessionId: bigint | null;
  status: OrderStatus;
  subtotalFen: bigint;
  totalAmountFen: bigint;
  version: number;
  createdAt: Date;
  acceptedAt: Date | null;
  preparingAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  items: OrderItemRow[];
}

interface OrderWhere {
  id?: bigint;
  storeId?: bigint;
  sessionId?: bigint;
  status?: OrderStatus | { notIn: readonly OrderStatus[] };
}

interface OrderCreateItemData {
  productId: bigint;
  variantId: bigint;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceFen: bigint;
  quantity: number;
  lineSubtotalFen: bigint;
  remark: string | null;
}

class FakeOrderPrisma {
  users: UserRow[] = [];
  variants: VariantRow[] = [];
  sessions: SessionRow[] = [];
  orders: OrderRow[] = [];
  idempotencyLookupCount = 0;
  skipIdempotencyLookups = 0;
  forceNextIdempotencyConflict = false;
  private nextOrderId = 1n;
  private nextItemId = 1n;

  readonly $transaction = async <T>(callback: (transaction: FakeOrderPrisma) => Promise<T>) =>
    callback(this);

  readonly $queryRaw = async <T>(query: Prisma.Sql): Promise<T> => {
    const values = query.values;
    if (query.sql.includes('dining_sessions')) {
      const sessionId = values[0] as bigint;
      const session = this.sessions.find((entry) => entry.id === sessionId);
      return (
        session
          ? [
              {
                id: session.id,
                store_id: session.storeId,
                status: session.status,
              },
            ]
          : []
      ) as T;
    }

    const orderId = values[0] as bigint;
    const storeId = query.sql.includes('store_id') ? (values[1] as bigint) : undefined;
    const order = this.orders.find(
      (entry) => entry.id === orderId && (storeId === undefined || entry.storeId === storeId),
    );
    return (order ? [{ id: order.id }] : []) as T;
  };

  readonly user = {
    findFirst: async (args: { where: { id: bigint; status: UserStatus } }) =>
      this.users.find(
        (entry) => entry.id === args.where.id && entry.status === args.where.status,
      ) ?? null,
  };

  readonly productVariant = {
    findMany: async (args: { where: { id: { in: bigint[] } } }) =>
      this.variants
        .filter((entry) => args.where.id.in.includes(entry.id))
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          priceFen: entry.priceFen,
          status: entry.status,
          product: { ...entry.product },
        })),
  };

  readonly diningSession = {
    findFirst: async (args: { where?: { id?: bigint; storeId?: bigint } }) => {
      const session = this.sessions.find(
        (entry) =>
          (args.where?.id === undefined || entry.id === args.where.id) &&
          (args.where?.storeId === undefined || entry.storeId === args.where.storeId),
      );
      return session ? { ...session } : null;
    },
    update: async (args: {
      where: { id: bigint };
      data: {
        status: SessionStatus;
        closedAt: Date;
        closedByStaffId: bigint;
        version: number;
      };
    }) => {
      const session = this.sessions.find((entry) => entry.id === args.where.id);
      if (!session) {
        throw new Error('Session not found');
      }
      Object.assign(session, args.data);
      return { ...session };
    },
  };

  readonly order = {
    findUnique: async (args: { where: { idempotencyKey: string } }) => {
      this.idempotencyLookupCount += 1;
      if (this.skipIdempotencyLookups > 0) {
        this.skipIdempotencyLookups -= 1;
        return null;
      }
      const order = this.orders.find((entry) => entry.idempotencyKey === args.where.idempotencyKey);
      return order ? this.withItems(order) : null;
    },
    findFirst: async (args: { where: OrderWhere }) => {
      const order = this.orders.find((entry) => this.matches(entry, args.where));
      return order ? this.withItems(order) : null;
    },
    findMany: async (args: { where: OrderWhere }) =>
      this.orders
        .filter((entry) => this.matches(entry, args.where))
        .sort((left, right) => {
          const byCreatedAt = right.createdAt.getTime() - left.createdAt.getTime();
          return byCreatedAt !== 0 ? byCreatedAt : left.id < right.id ? 1 : -1;
        })
        .map((entry) => this.withItems(entry)),
    create: async (args: {
      data: {
        storeId: bigint;
        customerUserId: bigint;
        orderNo: string;
        idempotencyKey: string;
        channel: 'DINE' | 'TAKEAWAY';
        sessionId: bigint | null;
        status: OrderStatus;
        subtotalFen: bigint;
        totalAmountFen: bigint;
        version: number;
        items: { create: OrderCreateItemData[] };
      };
    }) => {
      if (this.forceNextIdempotencyConflict) {
        this.forceNextIdempotencyConflict = false;
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['idempotency_key'] },
        });
      }
      const id = this.nextOrderId;
      this.nextOrderId += 1n;
      const createdAt = new Date();
      const order: OrderRow = {
        id,
        storeId: args.data.storeId,
        customerUserId: args.data.customerUserId,
        orderNo: args.data.orderNo,
        idempotencyKey: args.data.idempotencyKey,
        channel: args.data.channel,
        sessionId: args.data.sessionId,
        status: args.data.status,
        subtotalFen: args.data.subtotalFen,
        totalAmountFen: args.data.totalAmountFen,
        version: args.data.version,
        createdAt,
        acceptedAt: null,
        preparingAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
        items: args.data.items.create.map((item) => {
          const itemId = this.nextItemId;
          this.nextItemId += 1n;
          return { id: itemId, orderId: id, createdAt, ...item };
        }),
      };
      this.orders.push(order);
      return this.withItems(order);
    },
    update: async (args: {
      where: { id: bigint };
      data: Partial<
        Pick<
          OrderRow,
          | 'status'
          | 'version'
          | 'acceptedAt'
          | 'preparingAt'
          | 'completedAt'
          | 'cancelledAt'
          | 'cancelReason'
        >
      >;
    }) => {
      const order = this.orders.find((entry) => entry.id === args.where.id);
      if (!order) {
        throw new Error('Order not found');
      }
      Object.assign(order, args.data);
      return this.withItems(order);
    },
    count: async (args: { where: OrderWhere }) =>
      this.orders.filter((entry) => this.matches(entry, args.where)).length,
  };

  reset(): void {
    this.users = [];
    this.variants = [];
    this.sessions = [];
    this.orders = [];
    this.idempotencyLookupCount = 0;
    this.skipIdempotencyLookups = 0;
    this.forceNextIdempotencyConflict = false;
    this.nextOrderId = 1n;
    this.nextItemId = 1n;
  }

  addFixture(
    options: {
      sessionStatus?: SessionStatus;
      productStatus?: CommonStatus;
      variantStatus?: CommonStatus;
      userStatus?: UserStatus;
    } = {},
  ): void {
    this.users.push({ id: 1n, status: options.userStatus ?? 'ACTIVE' });
    this.users.push({ id: 2n, status: 'ACTIVE' });
    this.sessions.push({
      id: 10n,
      storeId: 100n,
      tableId: 1000n,
      status: options.sessionStatus ?? 'OPEN',
      version: 1,
      openedAt: new Date('2026-11-20T01:00:00.000Z'),
      closedAt: null,
      closedByStaffId: null,
    });
    this.variants.push({
      id: 1001n,
      name: '大杯',
      priceFen: 2300n,
      status: options.variantStatus ?? 'ACTIVE',
      product: {
        id: 2001n,
        storeId: 100n,
        name: '桂花乌龙',
        status: options.productStatus ?? 'ACTIVE',
      },
    });
    this.variants.push({
      id: 1002n,
      name: '标准',
      priceFen: 1200n,
      status: 'ACTIVE',
      product: {
        id: 2002n,
        storeId: 100n,
        name: '茉莉绿茶',
        status: 'ACTIVE',
      },
    });
  }

  private withItems(order: OrderRow) {
    return { ...order, items: order.items.map((item) => ({ ...item })) };
  }

  private matches(order: OrderRow, where: OrderWhere): boolean {
    const statusMatches =
      where.status === undefined ||
      (typeof where.status === 'string'
        ? order.status === where.status
        : !where.status.notIn.includes(order.status));
    return (
      (where.id === undefined || order.id === where.id) &&
      (where.storeId === undefined || order.storeId === where.storeId) &&
      (where.sessionId === undefined || order.sessionId === where.sessionId) &&
      statusMatches
    );
  }
}

function createOrderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    customerUserId: 1n,
    sessionId: 10n,
    idempotencyKey: `order-key-${Math.random()}`,
    items: [
      { variantId: 1001n, quantity: 2 },
      { variantId: 1002n, quantity: 1 },
    ],
    ...overrides,
  };
}

async function expectHttpError(
  operation: Promise<unknown>,
  status: number,
  code: string,
  details?: unknown,
): Promise<HttpException> {
  try {
    await operation;
    throw new Error('Expected HTTP error');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toMatchObject({ code });
    if (details !== undefined) {
      expect(exception.getResponse()).toMatchObject({ details });
    }
    return exception;
  }
}

async function expectIdempotencyKeyReused(
  operation: Promise<unknown>,
  original: OrderResponse,
): Promise<void> {
  const exception = await expectHttpError(operation, 409, 'CONFLICT', {
    reason: 'IDEMPOTENCY_KEY_REUSED',
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

describe('order domain service', () => {
  const fake = new FakeOrderPrisma();
  const prisma = fake as unknown as PrismaService;
  const orders = new OrderService(prisma);
  const sessions = new DiningSessionService(prisma);

  beforeEach(() => {
    fake.reset();
    fake.addFixture();
  });

  it('calculates amount snapshots with integer fen and keeps ids and amounts as strings', async () => {
    const created = await orders.createOrder(createOrderInput());

    expect(created).toMatchObject({
      storeId: '100',
      customerUserId: '1',
      sessionId: '10',
      channel: 'DINE',
      status: 'PENDING_ACCEPTANCE',
      version: 1,
      subtotalFen: '5800',
      totalAmountFen: '5800',
    });
    expect(created.items).toHaveLength(2);
    expect(created.items[0]).toMatchObject({
      productNameSnapshot: '桂花乌龙',
      variantNameSnapshot: '大杯',
      unitPriceFen: '2300',
      quantity: 2,
      lineSubtotalFen: '4600',
    });
    expect(created.items[1]).toMatchObject({
      unitPriceFen: '1200',
      lineSubtotalFen: '1200',
    });
    expect(created.id).toMatch(/^[1-9]\d*$/);
    expect(created.createdAt).toMatch(/Z$/);
  });

  it('returns the existing order for a repeated idempotency key', async () => {
    const input = createOrderInput({ idempotencyKey: 'repeat-key' });
    const first = await orders.createOrder(input);
    const second = await orders.createOrder({
      ...input,
      items: [
        { variantId: 1002n, quantity: 1, remark: '去冰' },
        { variantId: 1001n, quantity: 2 },
      ],
    });

    expect(second.id).toBe(first.id);
    expect(second.orderNo).toBe(first.orderNo);
    expect(fake.orders).toHaveLength(1);
    expect(fake.orders[0]?.items).toHaveLength(2);
  });

  it('rejects idempotency key reuse for another customer, session, or item set', async () => {
    const input = createOrderInput({ idempotencyKey: 'reuse-conflict-key' });
    const original = await orders.createOrder(input);
    fake.sessions.push({ ...fake.sessions[0]!, id: 11n, tableId: 1001n });

    await expectIdempotencyKeyReused(
      orders.createOrder({ ...input, customerUserId: 2n }),
      original,
    );
    await expectIdempotencyKeyReused(orders.createOrder({ ...input, sessionId: 11n }), original);
    await expectIdempotencyKeyReused(
      orders.createOrder({
        ...input,
        items: [
          { variantId: 1001n, quantity: 2 },
          { variantId: 1001n, quantity: 1 },
        ],
      }),
      original,
    );
    await expectIdempotencyKeyReused(
      orders.createOrder({
        ...input,
        items: [
          { variantId: 1001n, quantity: 3 },
          { variantId: 1002n, quantity: 1 },
        ],
      }),
      original,
    );
    expect(fake.orders).toHaveLength(1);
  });

  it('validates malformed input before querying an existing idempotency key', async () => {
    const input = createOrderInput({ idempotencyKey: 'invalid-before-lookup' });
    await orders.createOrder(input);
    const lookups = fake.idempotencyLookupCount;

    await expectHttpError(
      orders.createOrder({
        ...input,
        items: [{ variantId: 1001n, quantity: 0 }],
      }),
      400,
      'VALIDATION_ERROR',
    );
    expect(fake.idempotencyLookupCount).toBe(lookups);

    await expectHttpError(
      orders.createOrder({ ...input, customerUserId: 'not-an-id' }),
      400,
      'VALIDATION_ERROR',
    );
    expect(fake.idempotencyLookupCount).toBe(lookups);
  });

  it('applies replay checks when the order is found in the transaction or after P2002', async () => {
    const input = createOrderInput({ idempotencyKey: 'transaction-and-p2002-key' });
    const original = await orders.createOrder(input);
    const reorderedItems = [...input.items].reverse();

    fake.skipIdempotencyLookups = 1;
    const transactionReplay = await orders.createOrder({ ...input, items: reorderedItems });
    expect(transactionReplay.id).toBe(original.id);

    fake.skipIdempotencyLookups = 1;
    await expectIdempotencyKeyReused(
      orders.createOrder({ ...input, customerUserId: 2n, items: reorderedItems }),
      original,
    );

    fake.skipIdempotencyLookups = 2;
    fake.forceNextIdempotencyConflict = true;
    const conflictReadReplay = await orders.createOrder({ ...input, items: reorderedItems });
    expect(conflictReadReplay.id).toBe(original.id);

    fake.skipIdempotencyLookups = 2;
    fake.forceNextIdempotencyConflict = true;
    await expectIdempotencyKeyReused(
      orders.createOrder({
        ...input,
        items: [{ variantId: 1001n, quantity: 4 }],
      }),
      original,
    );
    expect(fake.orders).toHaveLength(1);
  });

  it('accepts quantity boundaries 1 and 99 and rejects 0, 100 and non-integers', async () => {
    for (const quantity of [1, 99]) {
      const created = await orders.createOrder(
        createOrderInput({
          idempotencyKey: `quantity-${quantity}`,
          items: [{ variantId: 1001n, quantity }],
        }),
      );
      expect(created.items[0]?.quantity).toBe(quantity);
    }

    for (const quantity of [0, 100, 1.5, Number.NaN]) {
      await expectHttpError(
        orders.createOrder(
          createOrderInput({
            idempotencyKey: `invalid-quantity-${quantity}`,
            items: [{ variantId: 1001n, quantity }],
          }),
        ),
        400,
        'VALIDATION_ERROR',
      );
    }
  });

  it('rejects invalid lifecycle inputs before creating an order', async () => {
    await expectHttpError(
      orders.createOrder(createOrderInput({ items: [] })),
      400,
      'VALIDATION_ERROR',
    );
    await expectHttpError(
      orders.createOrder(createOrderInput({ idempotencyKey: ' ' })),
      400,
      'VALIDATION_ERROR',
    );

    fake.users[0] = { id: 1n, status: 'DISABLED' };
    await expectHttpError(orders.createOrder(createOrderInput()), 403, 'FORBIDDEN');
  });

  it('rejects unavailable products, unavailable variants, missing sessions and closed sessions', async () => {
    fake.variants[0] = { ...fake.variants[0], status: 'DISABLED' } as VariantRow;
    await expectHttpError(orders.createOrder(createOrderInput()), 409, 'CONFLICT', {
      reason: 'PRODUCT_UNAVAILABLE',
      variantId: '1001',
    });

    fake.reset();
    fake.addFixture({ productStatus: 'DISABLED' });
    await expectHttpError(orders.createOrder(createOrderInput()), 409, 'CONFLICT', {
      reason: 'PRODUCT_UNAVAILABLE',
      variantId: '1001',
    });

    fake.reset();
    fake.addFixture({ sessionStatus: 'CLOSED' });
    await expectHttpError(orders.createOrder(createOrderInput()), 409, 'SESSION_CLOSED');

    fake.sessions = [];
    await expectHttpError(orders.createOrder(createOrderInput()), 403, 'FORBIDDEN');
  });

  it('applies the employee status machine and writes timestamps in order', async () => {
    const created = await orders.createOrder(createOrderInput());
    const accepted = await orders.transition(100n, created.id, 'accept', 1);
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.version).toBe(2);
    expect(accepted.acceptedAt).toMatch(/Z$/);
    expect(accepted.preparingAt).toBeNull();

    const preparing = await orders.transition(100n, created.id, 'start', 2);
    expect(preparing.status).toBe('PREPARING');
    expect(preparing.version).toBe(3);
    expect(preparing.preparingAt).toMatch(/Z$/);

    const completed = await orders.transition(100n, created.id, 'complete', 3);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.version).toBe(4);
    expect(completed.completedAt).toMatch(/Z$/);
  });

  it('rejects invalid transitions and stale versions with conflict details', async () => {
    const created = await orders.createOrder(createOrderInput());

    await expectHttpError(orders.transition(100n, created.id, 'start', 1), 409, 'CONFLICT', {
      reason: 'INVALID_TRANSITION',
      currentVersion: 1,
      currentStatus: 'PENDING_ACCEPTANCE',
    });
    await expectHttpError(orders.transition(100n, created.id, 'accept', 2), 409, 'CONFLICT', {
      reason: 'VERSION_MISMATCH',
      currentVersion: 1,
      currentStatus: 'PENDING_ACCEPTANCE',
    });
  });

  it('allows employee cancellation from every cancellable status but not after completion', async () => {
    const pending = await orders.createOrder(
      createOrderInput({ idempotencyKey: 'cancel-pending' }),
    );
    const acceptedOrder = await orders.createOrder(
      createOrderInput({ idempotencyKey: 'cancel-accepted' }),
    );
    const preparingOrder = await orders.createOrder(
      createOrderInput({ idempotencyKey: 'cancel-preparing' }),
    );
    const completedOrder = await orders.createOrder(
      createOrderInput({ idempotencyKey: 'cancel-completed' }),
    );

    await orders.transition(100n, acceptedOrder.id, 'accept', 1);
    await orders.transition(100n, preparingOrder.id, 'accept', 1);
    await orders.transition(100n, preparingOrder.id, 'start', 2);
    await orders.transition(100n, completedOrder.id, 'accept', 1);
    await orders.transition(100n, completedOrder.id, 'start', 2);
    await orders.transition(100n, completedOrder.id, 'complete', 3);

    const cancelledPending = await orders.transition(100n, pending.id, 'cancel', 1, '顾客离店');
    const cancelledAccepted = await orders.transition(
      100n,
      acceptedOrder.id,
      'cancel',
      2,
      '临时售罄',
    );
    const cancelledPreparing = await orders.transition(
      100n,
      preparingOrder.id,
      'cancel',
      3,
      '设备故障',
    );
    expect(cancelledPending).toMatchObject({
      status: 'CANCELLED',
      version: 2,
      cancelReason: '顾客离店',
    });
    expect(cancelledAccepted.status).toBe('CANCELLED');
    expect(cancelledPreparing.status).toBe('CANCELLED');
    expect(cancelledPending.cancelledAt).toMatch(/Z$/);

    await expectHttpError(
      orders.transition(100n, completedOrder.id, 'cancel', 4, '完成后再取消'),
      409,
      'CONFLICT',
      { reason: 'INVALID_TRANSITION', currentStatus: 'COMPLETED' },
    );
  });

  it('enforces customer ownership and PENDING_ACCEPTANCE-only cancellation', async () => {
    const own = await orders.createOrder(createOrderInput({ idempotencyKey: 'customer-own' }));
    const other = await orders.createOrder(createOrderInput({ idempotencyKey: 'customer-other' }));

    await expectHttpError(orders.cancelByCustomer(2n, own.id, 1), 403, 'FORBIDDEN');

    const cancelled = await orders.cancelByCustomer(1n, own.id, 1, '不想要了');
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      version: 2,
      cancelReason: '不想要了',
    });

    await orders.transition(100n, other.id, 'accept', 1);
    await expectHttpError(
      orders.cancelByCustomer(1n, other.id, 2, '已接单后取消'),
      409,
      'CONFLICT',
      { reason: 'INVALID_TRANSITION', currentStatus: 'ACCEPTED' },
    );
  });

  it('filters lists by store, session and status and hides foreign orders', async () => {
    const first = await orders.createOrder(createOrderInput({ idempotencyKey: 'list-first' }));
    const second = await orders.createOrder(createOrderInput({ idempotencyKey: 'list-second' }));
    await orders.transition(100n, second.id, 'accept', 1);
    fake.orders.push({
      ...fake.orders[0]!,
      id: 99n,
      storeId: 200n,
      orderNo: 'FOREIGN',
      idempotencyKey: 'foreign',
      items: [],
    });

    expect((await orders.list(100n, '10', undefined)).items).toHaveLength(2);
    expect((await orders.list(100n, '10', 'ACCEPTED')).items.map((item) => item.id)).toEqual([
      second.id,
    ]);
    expect((await orders.list(100n, undefined, undefined)).items.map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ]);
    await expectHttpError(orders.get(100n, '99'), 403, 'FORBIDDEN');
    await expectHttpError(orders.transition(100n, '99', 'accept', 1), 403, 'FORBIDDEN');
    expect(() => OrderService.parseStatusFilter('PENDING')).toThrowError(HttpException);
    await expectHttpError(orders.list(100n, 'not-an-id', undefined), 400, 'VALIDATION_ERROR');
  });

  it('allows closing only after all orders are completed or cancelled', async () => {
    const first = await orders.createOrder(createOrderInput({ idempotencyKey: 'close-first' }));
    const second = await orders.createOrder(createOrderInput({ idempotencyKey: 'close-second' }));

    await expectHttpError(sessions.close(100n, 1n, '10', 1), 409, 'CONFLICT', {
      reason: 'SESSION_HAS_ORDERS',
      orderCount: 2,
    });

    await orders.transition(100n, first.id, 'accept', 1);
    await orders.transition(100n, first.id, 'start', 2);
    await orders.transition(100n, first.id, 'complete', 3);
    await orders.transition(100n, second.id, 'cancel', 1, '顾客取消');

    const closed = await sessions.close(100n, 1n, '10', 1);
    expect(closed).toMatchObject({ status: 'CLOSED', version: 2 });
  });
});
