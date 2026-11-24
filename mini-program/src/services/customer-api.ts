import type { ApiClient } from './api-client';

export interface CustomerTable {
  readonly storeId: string;
  readonly table: {
    readonly id: string;
    readonly name: string;
    readonly code: string;
  };
  readonly session: {
    readonly id: string;
    readonly openedAt: string;
  };
}

export interface MenuVariant {
  readonly id: string;
  readonly name: string;
  readonly priceFen: string;
  readonly sortOrder: number;
}

export interface MenuProduct {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
  readonly variants: MenuVariant[];
}

export interface MenuCategory {
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly products: MenuProduct[];
}

export interface CustomerMenu {
  readonly storeId: string;
  readonly sessionId: string;
  readonly categories: MenuCategory[];
}

export interface OrderItemInput {
  readonly variantId: string;
  readonly quantity: number;
  readonly remark?: string;
}

export interface CustomerOrderItem {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly productNameSnapshot: string;
  readonly variantNameSnapshot: string;
  readonly unitPriceFen: string;
  readonly quantity: number;
  readonly lineSubtotalFen: string;
  readonly remark: string | null;
}

export interface CustomerOrder {
  readonly id: string;
  readonly storeId: string;
  readonly customerUserId: string;
  readonly orderNo: string;
  readonly channel: 'DINE' | 'TAKEAWAY';
  readonly sessionId: string | null;
  readonly status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  readonly subtotalFen: string;
  readonly totalAmountFen: string;
  readonly version: number;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly preparingAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly items: CustomerOrderItem[];
}

export interface CustomerOrderList {
  readonly items: CustomerOrder[];
}

export class CustomerApi {
  constructor(private readonly client: ApiClient) {}

  login(): Promise<void> {
    return this.client.login();
  }

  resolveTable(code: string): Promise<CustomerTable> {
    return this.client.get<CustomerTable>(`/customer/tables/${encodeURIComponent(code)}`);
  }

  getMenu(sessionId: string): Promise<CustomerMenu> {
    return this.client.get<CustomerMenu>(
      `/customer/menu?sessionId=${encodeURIComponent(sessionId)}`,
    );
  }

  createOrder(
    sessionId: string,
    items: readonly OrderItemInput[],
    idempotencyKey: string,
  ): Promise<CustomerOrder> {
    return this.client.post<CustomerOrder>(
      '/customer/orders',
      { sessionId, items },
      { 'Idempotency-Key': idempotencyKey },
    );
  }

  listOrders(sessionId?: string): Promise<CustomerOrderList> {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return this.client.get<CustomerOrderList>(`/customer/orders${query}`);
  }

  cancelOrder(orderId: string, version: number, cancelReason?: string): Promise<CustomerOrder> {
    return this.client.post<CustomerOrder>(`/customer/orders/${orderId}/cancel`, {
      version,
      ...(cancelReason ? { cancelReason } : {}),
    });
  }
}
