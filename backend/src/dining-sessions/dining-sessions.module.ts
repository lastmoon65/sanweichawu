import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../infrastructure/prisma/prisma.module.js';
import { DiningSessionController } from './dining-session.controller.js';
import { DiningSessionService } from './dining-session.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DiningSessionController],
  providers: [DiningSessionService],
})
export class DiningSessionsModule {}
