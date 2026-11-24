import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { CustomerLoginDto } from './customer-auth.dto.js';
import { CustomerAuthService } from './customer-auth.service.js';
import type { CustomerLoginResult } from './customer-auth.service.js';

@Controller('customer/auth')
export class CustomerAuthController {
  constructor(@Inject(CustomerAuthService) private readonly auth: CustomerAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() input: CustomerLoginDto): Promise<CustomerLoginResult> {
    return this.auth.login(input);
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [CustomerLoginDto],
  CustomerAuthController.prototype,
  'login',
);
