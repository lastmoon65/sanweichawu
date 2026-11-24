import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { APP_CONFIG } from '../config/app-config.module.js';
import type { AppConfig } from '../config/environment.js';
import { PrismaModule } from '../infrastructure/prisma/prisma.module.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard.js';
import {
  HttpWechatCode2SessionClient,
  WECHAT_CODE2SESSION_CLIENT,
} from './wechat-code2session.client.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CustomerAuthController],
  providers: [
    CustomerAuthService,
    CustomerJwtAuthGuard,
    {
      provide: WECHAT_CODE2SESSION_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new HttpWechatCode2SessionClient(config.wechatAppId, config.wechatAppSecret),
    },
  ],
  exports: [
    AuthModule,
    PrismaModule,
    CustomerAuthService,
    CustomerJwtAuthGuard,
    WECHAT_CODE2SESSION_CLIENT,
  ],
})
export class CustomerAuthModule {}
