import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';

import { authenticationRequired } from '../auth/auth-errors.js';
import type { AuthenticatedCustomer } from '../auth/auth-context.js';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator.js';
import { CustomerJwtAuthGuard } from '../customer-auth/guards/customer-jwt-auth.guard.js';
import { CustomerMenuService } from './customer-menu.service.js';
import type { CustomerMenuResponse, CustomerTableResponse } from './customer-menu.types.js';

function requireCustomer(customer: AuthenticatedCustomer | undefined): AuthenticatedCustomer {
  if (!customer) {
    throw authenticationRequired();
  }
  return customer;
}

@Controller('customer')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerMenuController {
  constructor(@Inject(CustomerMenuService) private readonly menu: CustomerMenuService) {}

  @Get('tables/:code')
  table(
    @Param('code') code: string,
    @CurrentCustomer() customer: AuthenticatedCustomer | undefined,
  ): Promise<CustomerTableResponse> {
    requireCustomer(customer);
    return this.menu.resolveTable(code);
  }

  @Get('menu')
  menuForSession(
    @Query('sessionId') sessionId: string | string[] | undefined,
    @CurrentCustomer() customer: AuthenticatedCustomer | undefined,
  ): Promise<CustomerMenuResponse> {
    requireCustomer(customer);
    return this.menu.getMenu(sessionId);
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  CustomerMenuController.prototype,
  'table',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  CustomerMenuController.prototype,
  'menuForSession',
);
