import { Module } from '@nestjs/common';

import { CustomerAuthModule } from '../customer-auth/customer-auth.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { CustomerOrderController } from './customer-order.controller.js';
import { CustomerOrderService } from './customer-order.service.js';

@Module({
  imports: [CustomerAuthModule, OrdersModule],
  controllers: [CustomerOrderController],
  providers: [CustomerOrderService],
})
export class CustomerOrdersModule {}
