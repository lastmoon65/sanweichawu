import { Module } from '@nestjs/common';

import { BootstrapOwnerService } from './bootstrap-owner.service.js';
import { PasswordService } from './password.service.js';
import { StaffAuthController } from './staff-auth.controller.js';
import { StaffAuthService } from './staff-auth.service.js';
import { StaffJwtAuthGuard } from './guards/staff-jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { StoreResourceOwnershipGuard } from './guards/store-resource-ownership.guard.js';
import { StoreResourceService } from './store-resource.service.js';
import { TokenService } from './token.service.js';
import { AppConfigModule } from '../config/app-config.module.js';
import { PrismaModule } from '../infrastructure/prisma/prisma.module.js';

@Module({
  imports: [AppConfigModule, PrismaModule],
  controllers: [StaffAuthController],
  providers: [
    PasswordService,
    TokenService,
    StaffAuthService,
    StaffJwtAuthGuard,
    RolesGuard,
    StoreResourceService,
    StoreResourceOwnershipGuard,
    BootstrapOwnerService,
  ],
  exports: [
    PasswordService,
    TokenService,
    StaffAuthService,
    StaffJwtAuthGuard,
    RolesGuard,
    StoreResourceService,
    StoreResourceOwnershipGuard,
  ],
})
export class AuthModule {}
