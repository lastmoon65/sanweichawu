import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { DiningTablesModule } from './dining-tables/dining-tables.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { MenuModule } from './menu/menu.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    DiningTablesModule,
    MenuModule,
  ],
})
export class AppModule {}
