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
  Query,
  UseGuards,
} from '@nestjs/common';

import { authenticationRequired } from '../auth/auth-errors.js';
import type { AuthenticatedStaff } from '../auth/auth-context.js';
import { CurrentStaff } from '../auth/decorators/current-staff.decorator.js';
import { StaffJwtAuthGuard } from '../auth/guards/staff-jwt-auth.guard.js';
import { StoreResourceOwnershipGuard } from '../auth/guards/store-resource-ownership.guard.js';
import {
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './menu.dto.js';
import { MenuService } from './menu.service.js';
import type { ProductListResponse, ProductResponse, VariantResponse } from './menu.types.js';

function requireStaff(staff: AuthenticatedStaff | undefined): AuthenticatedStaff {
  if (!staff) {
    throw authenticationRequired();
  }
  return staff;
}

@Controller('products')
@UseGuards(StaffJwtAuthGuard, StoreResourceOwnershipGuard)
export class ProductController {
  constructor(@Inject(MenuService) private readonly menu: MenuService) {}

  @Get()
  list(
    @Query('categoryId') categoryId: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<ProductListResponse> {
    return this.menu.listProducts(requireStaff(staff).storeId, categoryId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() input: CreateProductDto,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<ProductResponse> {
    return this.menu.createProduct(requireStaff(staff).storeId, input);
  }

  @Get(':productId')
  get(
    @Param('productId') productId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<ProductResponse> {
    return this.menu.getProduct(requireStaff(staff).storeId, productId);
  }

  @Patch(':productId')
  update(
    @Body() input: UpdateProductDto,
    @Param('productId') productId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<ProductResponse> {
    return this.menu.updateProduct(requireStaff(staff).storeId, productId, input);
  }

  @Delete(':productId')
  remove(
    @Param('productId') productId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<ProductResponse> {
    return this.menu.removeProduct(requireStaff(staff).storeId, productId);
  }

  @Post(':productId/variants')
  @HttpCode(HttpStatus.CREATED)
  createVariant(
    @Body() input: CreateVariantDto,
    @Param('productId') productId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<VariantResponse> {
    return this.menu.createVariant(requireStaff(staff).storeId, productId, input);
  }

  @Patch(':productId/variants/:variantId')
  updateVariant(
    @Body() input: UpdateVariantDto,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<VariantResponse> {
    return this.menu.updateVariant(requireStaff(staff).storeId, productId, variantId, input);
  }

  @Delete(':productId/variants/:variantId')
  removeVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<VariantResponse> {
    return this.menu.removeVariant(requireStaff(staff).storeId, productId, variantId);
  }
}

Reflect.defineMetadata('design:paramtypes', [String, Object], ProductController.prototype, 'list');
Reflect.defineMetadata(
  'design:paramtypes',
  [CreateProductDto, Object],
  ProductController.prototype,
  'create',
);
Reflect.defineMetadata('design:paramtypes', [String, Object], ProductController.prototype, 'get');
Reflect.defineMetadata(
  'design:paramtypes',
  [UpdateProductDto, String, Object],
  ProductController.prototype,
  'update',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  ProductController.prototype,
  'remove',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [CreateVariantDto, String, Object],
  ProductController.prototype,
  'createVariant',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [UpdateVariantDto, String, String, Object],
  ProductController.prototype,
  'updateVariant',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, String, Object],
  ProductController.prototype,
  'removeVariant',
);
