import { API_BASE_URL, NetworkError, UnauthorizedSessionError } from './staff-auth';

export type OrderStatus =
  'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';

export type OrderAction = 'accept' | 'start' | 'complete' | 'cancel';

export interface OrderItem {
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

export interface Order {
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
  readonly items: OrderItem[];
}

export interface OrderFilters {
  readonly sessionId?: string;
  readonly status?: OrderStatus;
}

export class OrderRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, code?: string, details?: unknown) {
    super('order-request-error');
    this.name = 'OrderRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === 'PENDING_ACCEPTANCE' ||
    value === 'ACCEPTED' ||
    value === 'PREPARING' ||
    value === 'COMPLETED' ||
    value === 'CANCELLED'
  );
}

function isOrderItem(value: unknown): value is OrderItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.orderId === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.variantId === 'string' &&
    typeof value.productNameSnapshot === 'string' &&
    typeof value.variantNameSnapshot === 'string' &&
    typeof value.unitPriceFen === 'string' &&
    typeof value.quantity === 'number' &&
    typeof value.lineSubtotalFen === 'string' &&
    (value.remark === null || typeof value.remark === 'string') &&
    typeof value.createdAt === 'string'
  );
}

function isOrder(value: unknown): value is Order {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.storeId === 'string' &&
    typeof value.customerUserId === 'string' &&
    typeof value.orderNo === 'string' &&
    (value.channel === 'DINE' || value.channel === 'TAKEAWAY') &&
    (value.sessionId === null || typeof value.sessionId === 'string') &&
    isOrderStatus(value.status) &&
    typeof value.subtotalFen === 'string' &&
    typeof value.totalAmountFen === 'string' &&
    typeof value.version === 'number' &&
    typeof value.createdAt === 'string' &&
    (value.acceptedAt === null || typeof value.acceptedAt === 'string') &&
    (value.preparingAt === null || typeof value.preparingAt === 'string') &&
    (value.completedAt === null || typeof value.completedAt === 'string') &&
    (value.cancelledAt === null || typeof value.cancelledAt === 'string') &&
    (value.cancelReason === null || typeof value.cancelReason === 'string') &&
    Array.isArray(value.items) &&
    value.items.every(isOrderItem)
  );
}

function getApiData(payload: unknown): unknown {
  return isRecord(payload) ? payload.data : undefined;
}

function getErrorCode(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }
  return typeof payload.error.code === 'string' ? payload.error.code : undefined;
}

function getErrorDetails(payload: unknown): unknown {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }
  return payload.error.details;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function requestOrderData(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
  } catch {
    throw new NetworkError();
  }

  const payload = await readJson(response);
  if (response.status === 401) {
    throw new UnauthorizedSessionError();
  }
  if (!response.ok) {
    throw new OrderRequestError(response.status, getErrorCode(payload), getErrorDetails(payload));
  }
  return getApiData(payload);
}

function expectOrder(value: unknown): Order {
  if (!isOrder(value)) {
    throw new OrderRequestError(200);
  }
  return value;
}

export async function listOrders(
  accessToken: string,
  filters: OrderFilters = {},
): Promise<Order[]> {
  const query = new URLSearchParams();
  if (filters.sessionId) {
    query.set('sessionId', filters.sessionId);
  }
  if (filters.status) {
    query.set('status', filters.status);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const data = await requestOrderData(accessToken, `/orders${suffix}`);
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isOrder)) {
    throw new OrderRequestError(200);
  }
  return data.items;
}

export async function getOrder(accessToken: string, orderId: string): Promise<Order> {
  const data = await requestOrderData(accessToken, `/orders/${encodeURIComponent(orderId)}`);
  return expectOrder(data);
}

export async function actOnOrder(
  accessToken: string,
  orderId: string,
  action: OrderAction,
  version: number,
  cancelReason?: string,
): Promise<Order> {
  const body = action === 'cancel' ? { version, cancelReason } : { version };
  const data = await requestOrderData(
    accessToken,
    `/orders/${encodeURIComponent(orderId)}/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return expectOrder(data);
}
