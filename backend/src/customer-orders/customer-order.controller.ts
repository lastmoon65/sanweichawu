import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { authenticationRequired } from '../auth/auth-errors.js';
import type { AuthenticatedCustomer } from '../auth/auth-context.js';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator.js';
import { CustomerJwtAuthGuard } from '../customer-auth/guards/customer-jwt-auth.guard.js';
import { invalidOrderInput } from '../orders/order.errors.js';
import type { OrderListResponse, OrderResponse } from '../orders/order.types.js';
import { CustomerCancelOrderDto, CustomerCreateOrderDto } from './customer-order.dto.js';
import { CustomerOrderService } from './customer-order.service.js';

function requireCustomer(customer: AuthenticatedCustomer | undefined): AuthenticatedCustomer {
  if (!customer) {
    throw authenticationRequired();
  }
  return customer;
}

function requireIdempotencyKey(value: string | undefined): string {
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

@Controller('customer/orders')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerOrderController {
  constructor(@Inject(CustomerOrderService) private readonly orders: CustomerOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() input: CustomerCreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentCustomer() customer: AuthenticatedCustomer | undefined,
  ): Promise<OrderResponse> {
    return this.orders.create(
      requireCustomer(customer).customerUserId,
      input.sessionId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Get()
  list(
    @Query('sessionId') sessionId: string | string[] | undefined,
    @CurrentCustomer() customer: AuthenticatedCustomer | undefined,
  ): Promise<OrderListResponse> {
    return this.orders.list(requireCustomer(customer).customerUserId, sessionId);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Body() input: CustomerCancelOrderDto,
    @Param('orderId') orderId: string,
    @CurrentCustomer() customer: AuthenticatedCustomer | undefined,
  ): Promise<OrderResponse> {
    return this.orders.cancel(
      requireCustomer(customer).customerUserId,
      orderId,
      input.version,
      input.cancelReason,
    );
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [CustomerCreateOrderDto, String, Object],
  CustomerOrderController.prototype,
  'create',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  CustomerOrderController.prototype,
  'list',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [CustomerCancelOrderDto, String, Object],
  CustomerOrderController.prototype,
  'cancel',
);
