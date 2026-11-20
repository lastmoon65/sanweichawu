import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../infrastructure/prisma/prisma.module.js';
import { CategoryController } from './category.controller.js';
import { MenuService } from './menu.service.js';
import { ProductController } from './product.controller.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CategoryController, ProductController],
  providers: [MenuService],
})
export class MenuModule {}
