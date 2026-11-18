import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../infrastructure/prisma/prisma.module.js';
import { DiningTableController } from './dining-table.controller.js';
import { DiningTableService } from './dining-table.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DiningTableController],
  providers: [DiningTableService],
})
export class DiningTablesModule {}
