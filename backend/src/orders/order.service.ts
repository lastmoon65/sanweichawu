import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';

import { insufficientPermissions } from '../auth/auth-errors.js';
import { parseDecimalBigIntId } from '../auth/store-resource.service.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import { sessionClosed } from '../dining-sessions/dining-session.errors.js';
import {
  invalidOrderFilter,
  invalidOrderInput,
  invalidOrderStatus,
  invalidOrderTransition,
  orderIdempotencyKeyReused,
  orderVersionConflict,
  productUnavailable,
} from './order.errors.js';
import { ORDER_INCLUDE, serializeOrder } from './order.types.js';
import type { OrderListResponse, OrderResponse, OrderWithItems } from './order.types.js';

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 10_000,
} as const;

const ORDER_STATUSES = [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'PREPARING',
  'COMPLETED',
  'CANCELLED',
] as const satisfies readonly OrderStatus[];

export type OrderAction = 'accept' | 'start' | 'complete' | 'cancel';

export interface CreateOrderItemInput {
  readonly variantId: bigint | string;
  readonly quantity: number;
  readonly remark?: string | null;
}

export interface CreateOrderInput {
  readonly customerUserId: bigint | string;
  readonly sessionId: bigint | string;
  readonly idempotencyKey: string;
  readonly items: readonly CreateOrderItemInput[];
}

interface NormalizedOrderItem {
  readonly variantId: bigint;
  readonly quantity: number;
  readonly remark: string | null;
}

interface NormalizedCreateOrderInput {
  readonly customerUserId: bigint;
  readonly sessionId: bigint;
  readonly idempotencyKey: string;
  readonly items: readonly NormalizedOrderItem[];
}

interface LockedSessionRow {
  readonly id: bigint;
  readonly store_id: bigint;
  readonly status: 'OPEN' | 'CLOSED';
}

function parseId(value: bigint | string): bigint | null {
  if (typeof value === 'bigint') {
    return value > 0n && BigInt.asIntN(64, value) === value ? value : null;
  }
  return parseDecimalBigIntId(value);
}

function parsePathId(value: string): bigint {
  const id = parseDecimalBigIntId(value);
  if (id === null) {
    throw insufficientPermissions();
  }
  return id;
}

function normalizeIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidOrderInput('idempotencyKey', 'idempotencyKey is required');
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 160) {
    throw invalidOrderInput(
      'idempotencyKey',
      'idempotencyKey must contain between 1 and 160 characters',
    );
  }
  return normalized;
}

function normalizeOrderItems(items: readonly CreateOrderItemInput[]): NormalizedOrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw invalidOrderInput('items', 'items must contain at least one order item');
  }

  return items.map((item, index) => {
    const variantId = parseId(item.variantId);
    if (variantId === null) {
      throw invalidOrderInput(`items.${index}.variantId`, 'variantId must be a decimal id');
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw invalidOrderInput(
        `items.${index}.quantity`,
        'quantity must be an integer between 1 and 99',
      );
    }
    if (item.remark !== undefined && item.remark !== null) {
      if (typeof item.remark !== 'string' || item.remark.trim().length > 500) {
        throw invalidOrderInput(
          `items.${index}.remark`,
          'remark must be a string of at most 500 characters',
        );
      }
    }
    const remark = typeof item.remark === 'string' ? item.remark.trim() : '';
    return {
      variantId,
      quantity: item.quantity,
      remark: remark.length > 0 ? remark : null,
    };
  });
}

function normalizedItemTuples(
  items: readonly { readonly variantId: bigint; readonly quantity: number }[],
): Array<readonly [bigint, number]> {
  return items
    .map((item) => [item.variantId, item.quantity] as const)
    .sort((left, right) => {
      if (left[0] !== right[0]) {
        return left[0] < right[0] ? -1 : 1;
      }
      return left[1] - right[1];
    });
}

function hasSameNormalizedItems(
  existingItems: readonly { readonly variantId: bigint; readonly quantity: number }[],
  expectedItems: readonly NormalizedOrderItem[],
): boolean {
  const existingTuples = normalizedItemTuples(existingItems);
  const expectedTuples = normalizedItemTuples(expectedItems);
  return (
    existingTuples.length === expectedTuples.length &&
    existingTuples.every(
      (item, index) =>
        item[0] === expectedTuples[index]?.[0] && item[1] === expectedTuples[index]?.[1],
    )
  );
}

function normalizeCancelReason(value: string | undefined, required: boolean): string | null {
  if (value === undefined || value === null) {
    if (required) {
      throw invalidOrderInput('cancelReason', 'cancelReason is required');
    }
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidOrderInput('cancelReason', 'cancelReason must be a string');
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 500) {
    throw invalidOrderInput(
      'cancelReason',
      'cancelReason must contain between 1 and 500 characters',
    );
  }
  return normalized;
}

function generateOrderNo(): string {
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 17);
  const randomPart = randomBytes(5).toString('hex').toUpperCase();
  return `SW${timestamp}${randomPart}`;
}

function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return `${targetText} ${error.message}`.toLowerCase();
}

const ACTION_TARGET_STATUS: Readonly<Record<OrderAction, OrderStatus>> = {
  accept: 'ACCEPTED',
  start: 'PREPARING',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
};

const ACTION_ALLOWED_FROM: Readonly<Record<OrderAction, readonly OrderStatus[]>> = {
  accept: ['PENDING_ACCEPTANCE'],
  start: ['ACCEPTED'],
  complete: ['PREPARING'],
  cancel: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'PREPARING'],
};

@Injectable()
export class OrderService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOrder(input: CreateOrderInput): Promise<OrderResponse> {
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    const customerUserId = parseId(input.customerUserId);
    if (customerUserId === null) {
      throw invalidOrderInput('customerUserId', 'customerUserId must be a decimal id');
    }
    const sessionId = parseId(input.sessionId);
    if (sessionId === null) {
      throw invalidOrderInput('sessionId', 'sessionId must be a decimal id');
    }
    const items = normalizeOrderItems(input.items);
    const normalizedInput: NormalizedCreateOrderInput = {
      customerUserId,
      sessionId,
      idempotencyKey,
      items,
    };

    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: ORDER_INCLUDE,
    });
    if (existing) {
      return this.replayExistingOrder(existing, normalizedInput);
    }

    for (let orderNoAttempt = 0; orderNoAttempt < 2; orderNoAttempt += 1) {
      try {
        return await this.prisma.$transaction(
          (transaction) => this.createOrderInTransaction(transaction, normalizedInput),
          TRANSACTION_OPTIONS,
        );
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          const target = uniqueTarget(error);
          if (target.includes('idempotency')) {
            return this.findOrderByIdempotencyKey(normalizedInput);
          }
          if (target.includes('order_no') || target.includes('orderno')) {
            if (orderNoAttempt === 0) {
              continue;
            }
          }
        }
        throw error;
      }
    }

    throw new Error('Unable to allocate a unique order number');
  }

  async cancelByCustomer(
    customerUserIdValue: bigint | string,
    orderIdValue: bigint | string,
    version: number,
    cancelReason?: string,
  ): Promise<OrderResponse> {
    const customerUserId = parseId(customerUserIdValue);
    if (customerUserId === null) {
      throw insufficientPermissions();
    }
    const orderId = parseId(orderIdValue);
    if (orderId === null) {
      throw insufficientPermissions();
    }
    const reason = normalizeCancelReason(cancelReason, false);

    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
        SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE
      `);
      if (locked.length !== 1) {
        throw insufficientPermissions();
      }

      const order = await transaction.order.findFirst({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
      if (!order) {
        throw insufficientPermissions();
      }
      if (order.customerUserId !== customerUserId) {
        throw insufficientPermissions();
      }
      if (order.version !== version) {
        throw orderVersionConflict(order.version, order.status);
      }
      if (order.status !== 'PENDING_ACCEPTANCE') {
        throw invalidOrderTransition(order.version, order.status);
      }

      const updated = await transaction.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
          version: order.version + 1,
        },
        include: ORDER_INCLUDE,
      });
      return serializeOrder(updated);
    }, TRANSACTION_OPTIONS);
  }

  async list(
    storeId: bigint,
    sessionIdValue: string | string[] | undefined,
    statusValue: string | string[] | undefined,
  ): Promise<OrderListResponse> {
    const sessionId = this.parseSessionFilter(sessionIdValue);
    const status = OrderService.parseStatusFilter(statusValue);
    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(status === undefined ? {} : { status }),
      },
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { items: orders.map(serializeOrder) };
  }

  async listByCustomer(
    customerUserIdValue: bigint | string,
    sessionIdValue: string | string[] | undefined,
  ): Promise<OrderListResponse> {
    const customerUserId = parseId(customerUserIdValue);
    if (customerUserId === null) {
      throw insufficientPermissions();
    }
    const sessionId = this.parseSessionFilter(sessionIdValue);
    const orders = await this.prisma.order.findMany({
      where: {
        customerUserId,
        ...(sessionId === undefined ? {} : { sessionId }),
      },
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { items: orders.map(serializeOrder) };
  }

  async get(storeId: bigint, orderIdValue: string): Promise<OrderResponse> {
    const orderId = parsePathId(orderIdValue);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw insufficientPermissions();
    }
    return serializeOrder(order);
  }

  async transition(
    storeId: bigint,
    orderIdValue: string,
    action: OrderAction,
    version: number,
    cancelReason?: string,
  ): Promise<OrderResponse> {
    const orderId = parsePathId(orderIdValue);
    const reason = action === 'cancel' ? normalizeCancelReason(cancelReason, true) : null;

    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
        SELECT id FROM orders WHERE id = ${orderId} AND store_id = ${storeId} FOR UPDATE
      `);
      if (locked.length !== 1) {
        throw insufficientPermissions();
      }

      const order = await transaction.order.findFirst({
        where: { id: orderId, storeId },
        include: ORDER_INCLUDE,
      });
      if (!order) {
        throw insufficientPermissions();
      }
      this.assertTransition(order, version, action);

      const now = new Date();
      const timestampData =
        action === 'accept'
          ? { acceptedAt: now }
          : action === 'start'
            ? { preparingAt: now }
            : action === 'complete'
              ? { completedAt: now }
              : { cancelledAt: now, cancelReason: reason };

      const updated = await transaction.order.update({
        where: { id: order.id },
        data: {
          status: ACTION_TARGET_STATUS[action],
          version: order.version + 1,
          ...timestampData,
        },
        include: ORDER_INCLUDE,
      });
      return serializeOrder(updated);
    }, TRANSACTION_OPTIONS);
  }

  static parseStatusFilter(value: string | string[] | undefined): OrderStatus | undefined {
    const status = Array.isArray(value) ? value[0] : value;
    if (status === undefined) {
      return undefined;
    }
    if (ORDER_STATUSES.includes(status as OrderStatus)) {
      return status as OrderStatus;
    }
    throw invalidOrderStatus();
  }

  private parseSessionFilter(value: string | string[] | undefined): bigint | undefined {
    const sessionIdValue = Array.isArray(value) ? value[0] : value;
    if (sessionIdValue === undefined) {
      return undefined;
    }
    const sessionId = parseDecimalBigIntId(sessionIdValue);
    if (sessionId === null) {
      throw invalidOrderFilter('sessionId', 'sessionId must be a decimal id string');
    }
    return sessionId;
  }

  private async createOrderInTransaction(
    transaction: Prisma.TransactionClient,
    input: NormalizedCreateOrderInput,
  ): Promise<OrderResponse> {
    const lockedSessions = await transaction.$queryRaw<LockedSessionRow[]>(Prisma.sql`
      SELECT id, store_id, status FROM dining_sessions
      WHERE id = ${input.sessionId}
      FOR UPDATE
    `);
    const session = lockedSessions[0];
    if (!session) {
      throw insufficientPermissions();
    }
    if (session.status !== 'OPEN') {
      throw sessionClosed();
    }

    const existing = await transaction.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: ORDER_INCLUDE,
    });
    if (existing) {
      return this.replayExistingOrder(existing, input);
    }

    const customer = await transaction.user.findFirst({
      where: { id: input.customerUserId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!customer) {
      throw insufficientPermissions();
    }

    const uniqueVariantIds = [...new Set(input.items.map((item) => item.variantId))];
    const variants = await transaction.productVariant.findMany({
      where: { id: { in: uniqueVariantIds } },
      select: {
        id: true,
        name: true,
        priceFen: true,
        status: true,
        product: {
          select: { id: true, storeId: true, name: true, status: true },
        },
      },
    });
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    let subtotalFen = 0n;
    const itemCreates = input.items.map((item) => {
      const variant = variantsById.get(item.variantId);
      if (
        !variant ||
        variant.status !== 'ACTIVE' ||
        variant.product.status !== 'ACTIVE' ||
        variant.product.storeId !== session.store_id
      ) {
        throw productUnavailable(item.variantId);
      }
      const lineSubtotalFen = variant.priceFen * BigInt(item.quantity);
      subtotalFen += lineSubtotalFen;
      return {
        productId: variant.product.id,
        variantId: variant.id,
        productNameSnapshot: variant.product.name,
        variantNameSnapshot: variant.name,
        unitPriceFen: variant.priceFen,
        quantity: item.quantity,
        lineSubtotalFen,
        remark: item.remark,
      };
    });

    const order = await transaction.order.create({
      data: {
        storeId: session.store_id,
        customerUserId: input.customerUserId,
        orderNo: generateOrderNo(),
        idempotencyKey: input.idempotencyKey,
        channel: 'DINE',
        sessionId: session.id,
        status: 'PENDING_ACCEPTANCE',
        subtotalFen,
        totalAmountFen: subtotalFen,
        version: 1,
        items: { create: itemCreates },
      },
      include: ORDER_INCLUDE,
    });
    return serializeOrder(order);
  }

  private replayExistingOrder(
    existing: OrderWithItems,
    input: NormalizedCreateOrderInput,
  ): OrderResponse {
    if (
      existing.customerUserId !== input.customerUserId ||
      existing.sessionId !== input.sessionId ||
      !hasSameNormalizedItems(existing.items, input.items)
    ) {
      throw orderIdempotencyKeyReused();
    }
    return serializeOrder(existing);
  }

  private assertTransition(order: OrderWithItems, version: number, action: OrderAction): void {
    if (order.version !== version) {
      throw orderVersionConflict(order.version, order.status);
    }
    if (!ACTION_ALLOWED_FROM[action].includes(order.status)) {
      throw invalidOrderTransition(order.version, order.status);
    }
  }

  private async findOrderByIdempotencyKey(
    input: NormalizedCreateOrderInput,
  ): Promise<OrderResponse> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const order = await this.prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: ORDER_INCLUDE,
      });
      if (order) {
        return this.replayExistingOrder(order, input);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Idempotent order was not visible after a unique-key conflict');
  }
}
