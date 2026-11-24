import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { CustomerAuthModule } from './customer-auth/customer-auth.module.js';
import { CustomerMenuModule } from './customer-menu/customer-menu.module.js';
import { CustomerOrdersModule } from './customer-orders/customer-orders.module.js';
import { DiningSessionsModule } from './dining-sessions/dining-sessions.module.js';
import { DiningTablesModule } from './dining-tables/dining-tables.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { MenuModule } from './menu/menu.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    CustomerAuthModule,
    CustomerMenuModule,
    CustomerOrdersModule,
    DiningTablesModule,
    DiningSessionsModule,
    MenuModule,
    OrdersModule,
  ],
})
export class AppModule {}
