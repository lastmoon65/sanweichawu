import { Inject, Injectable } from '@nestjs/common';

import { OrderService } from '../orders/order.service.js';
import type { OrderListResponse, OrderResponse } from '../orders/order.types.js';
import type { CustomerCreateOrderDto } from './customer-order.dto.js';

@Injectable()
export class CustomerOrderService {
  constructor(@Inject(OrderService) private readonly orders: OrderService) {}

  create(
    customerUserId: bigint,
    sessionId: string,
    idempotencyKey: string,
    input: CustomerCreateOrderDto,
  ): Promise<OrderResponse> {
    return this.orders.createOrder({
      customerUserId,
      sessionId,
      idempotencyKey,
      items: input.items,
    });
  }

  list(
    customerUserId: bigint,
    sessionId: string | string[] | undefined,
  ): Promise<OrderListResponse> {
    return this.orders.listByCustomer(customerUserId, sessionId);
  }

  cancel(
    customerUserId: bigint,
    orderId: string,
    version: number,
    cancelReason: string | null | undefined,
  ): Promise<OrderResponse> {
    return this.orders.cancelByCustomer(
      customerUserId,
      orderId,
      version,
      cancelReason ?? undefined,
    );
  }
}
