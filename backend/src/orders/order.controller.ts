import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { authenticationRequired } from '../auth/auth-errors.js';
import type { AuthenticatedStaff } from '../auth/auth-context.js';
import { CurrentStaff } from '../auth/decorators/current-staff.decorator.js';
import { StaffJwtAuthGuard } from '../auth/guards/staff-jwt-auth.guard.js';
import { StoreResourceOwnershipGuard } from '../auth/guards/store-resource-ownership.guard.js';
import { CancelOrderDto, OrderVersionDto } from './order.dto.js';
import { OrderService } from './order.service.js';
import type { OrderAction } from './order.service.js';
import type { OrderListResponse, OrderResponse } from './order.types.js';

function requireStaff(staff: AuthenticatedStaff | undefined): AuthenticatedStaff {
  if (!staff) {
    throw authenticationRequired();
  }
  return staff;
}

@Controller('orders')
@UseGuards(StaffJwtAuthGuard, StoreResourceOwnershipGuard)
export class OrderController {
  constructor(@Inject(OrderService) private readonly orders: OrderService) {}

  @Get()
  list(
    @Query('sessionId') sessionId: string | string[] | undefined,
    @Query('status') status: string | string[] | undefined,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<OrderListResponse> {
    return this.orders.list(requireStaff(staff).storeId, sessionId, status);
  }

  @Get(':orderId')
  get(
    @Param('orderId') orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<OrderResponse> {
    return this.orders.get(requireStaff(staff).storeId, orderId);
  }

  @Post(':orderId/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Body() input: OrderVersionDto,
    @Param('orderId') orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<OrderResponse> {
    return this.runAction(requireStaff(staff).storeId, orderId, 'accept', input.version);
  }

  @Post(':orderId/start')
  @HttpCode(HttpStatus.OK)
  start(
    @Body() input: OrderVersionDto,
    @Param('orderId') orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<OrderResponse> {
    return this.runAction(requireStaff(staff).storeId, orderId, 'start', input.version);
  }

  @Post(':orderId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Body() input: OrderVersionDto,
    @Param('orderId') orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<OrderResponse> {
    return this.runAction(requireStaff(staff).storeId, orderId, 'complete', input.version);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Body() input: CancelOrderDto,
    @Param('orderId') orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<OrderResponse> {
    return this.orders.transition(
      requireStaff(staff).storeId,
      orderId,
      'cancel',
      input.version,
      input.cancelReason,
    );
  }

  private runAction(
    storeId: bigint,
    orderId: string,
    action: OrderAction,
    version: number,
  ): Promise<OrderResponse> {
    return this.orders.transition(storeId, orderId, action, version);
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [String, String, Object],
  OrderController.prototype,
  'list',
);
Reflect.defineMetadata('design:paramtypes', [String, Object], OrderController.prototype, 'get');
Reflect.defineMetadata(
  'design:paramtypes',
  [OrderVersionDto, String, Object],
  OrderController.prototype,
  'accept',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [OrderVersionDto, String, Object],
  OrderController.prototype,
  'start',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [OrderVersionDto, String, Object],
  OrderController.prototype,
  'complete',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [CancelOrderDto, String, Object],
  OrderController.prototype,
  'cancel',
);
