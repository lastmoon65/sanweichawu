import { Module } from '@nestjs/common';

import { CustomerAuthModule } from '../customer-auth/customer-auth.module.js';
import { PrismaModule } from '../infrastructure/prisma/prisma.module.js';
import { CustomerMenuController } from './customer-menu.controller.js';
import { CustomerMenuService } from './customer-menu.service.js';

@Module({
  imports: [CustomerAuthModule, PrismaModule],
  controllers: [CustomerMenuController],
  providers: [CustomerMenuService],
})
export class CustomerMenuModule {}
