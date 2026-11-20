import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { authenticationRequired } from '../auth/auth-errors.js';
import type { AuthenticatedStaff } from '../auth/auth-context.js';
import { CurrentStaff } from '../auth/decorators/current-staff.decorator.js';
import { StaffJwtAuthGuard } from '../auth/guards/staff-jwt-auth.guard.js';
import { StoreResourceOwnershipGuard } from '../auth/guards/store-resource-ownership.guard.js';
import { CreateCategoryDto, UpdateCategoryDto } from './menu.dto.js';
import { MenuService } from './menu.service.js';
import type { CategoryListResponse, CategoryResponse } from './menu.types.js';

function requireStaff(staff: AuthenticatedStaff | undefined): AuthenticatedStaff {
  if (!staff) {
    throw authenticationRequired();
  }
  return staff;
}

@Controller('categories')
@UseGuards(StaffJwtAuthGuard, StoreResourceOwnershipGuard)
export class CategoryController {
  constructor(@Inject(MenuService) private readonly menu: MenuService) {}

  @Get()
  list(@CurrentStaff() staff: AuthenticatedStaff | undefined): Promise<CategoryListResponse> {
    return this.menu.listCategories(requireStaff(staff).storeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() input: CreateCategoryDto,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<CategoryResponse> {
    return this.menu.createCategory(requireStaff(staff).storeId, input);
  }

  @Get(':categoryId')
  get(
    @Param('categoryId') categoryId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<CategoryResponse> {
    return this.menu.getCategory(requireStaff(staff).storeId, categoryId);
  }

  @Patch(':categoryId')
  update(
    @Body() input: UpdateCategoryDto,
    @Param('categoryId') categoryId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<CategoryResponse> {
    return this.menu.updateCategory(requireStaff(staff).storeId, categoryId, input);
  }

  @Delete(':categoryId')
  remove(
    @Param('categoryId') categoryId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<CategoryResponse> {
    return this.menu.removeCategory(requireStaff(staff).storeId, categoryId);
  }
}

Reflect.defineMetadata('design:paramtypes', [Object], CategoryController.prototype, 'list');
Reflect.defineMetadata(
  'design:paramtypes',
  [CreateCategoryDto, Object],
  CategoryController.prototype,
  'create',
);
Reflect.defineMetadata('design:paramtypes', [String, Object], CategoryController.prototype, 'get');
Reflect.defineMetadata(
  'design:paramtypes',
  [UpdateCategoryDto, String, Object],
  CategoryController.prototype,
  'update',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  CategoryController.prototype,
  'remove',
);
