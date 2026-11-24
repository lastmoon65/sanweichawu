import type { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';

export const ORDER_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

export interface OrderItemResponse {
  readonly id: string;
  readonly orderId: string;
  readonly productId: string;
  readonly variantId: string;
  readonly productNameSnapshot: string;
  readonly variantNameSnapshot: string;
  readonly unitPriceFen: string;
  readonly quantity: number;
  readonly lineSubtotalFen: string;
  readonly remark: string | null;
  readonly createdAt: string;
}

export interface OrderResponse {
  readonly id: string;
  readonly storeId: string;
  readonly customerUserId: string;
  readonly orderNo: string;
  readonly channel: 'DINE' | 'TAKEAWAY';
  readonly sessionId: string | null;
  readonly status: OrderStatus;
  readonly subtotalFen: string;
  readonly totalAmountFen: string;
  readonly version: number;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly preparingAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly items: OrderItemResponse[];
}

export interface OrderListResponse {
  readonly items: OrderResponse[];
}

export function serializeOrder(order: OrderWithItems): OrderResponse {
  return {
    id: order.id.toString(),
    storeId: order.storeId.toString(),
    customerUserId: order.customerUserId.toString(),
    orderNo: order.orderNo,
    channel: order.channel,
    sessionId: order.sessionId?.toString() ?? null,
    status: order.status,
    subtotalFen: order.subtotalFen.toString(),
    totalAmountFen: order.totalAmountFen.toString(),
    version: order.version,
    createdAt: order.createdAt.toISOString(),
    acceptedAt: order.acceptedAt?.toISOString() ?? null,
    preparingAt: order.preparingAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    items: order.items.map((item) => ({
      id: item.id.toString(),
      orderId: item.orderId.toString(),
      productId: item.productId.toString(),
      variantId: item.variantId.toString(),
      productNameSnapshot: item.productNameSnapshot,
      variantNameSnapshot: item.variantNameSnapshot,
      unitPriceFen: item.unitPriceFen.toString(),
      quantity: item.quantity,
      lineSubtotalFen: item.lineSubtotalFen.toString(),
      remark: item.remark,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}
