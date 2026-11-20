import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { CommonStatus } from '@prisma/client';

import { ForbiddenInventoryMode, IsDecimalId, IsPriceFen } from './menu.validation.js';

export const CATEGORY_NAME_MAX_LENGTH = 80;
export const PRODUCT_NAME_MAX_LENGTH = 120;
export const VARIANT_NAME_MAX_LENGTH = 80;
export const PRODUCT_IMAGE_URL_MAX_LENGTH = 512;

export const MENU_STATUSES = ['ACTIVE', 'DISABLED'] as const;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function isDefined(_object: unknown, value: unknown): boolean {
  return value !== undefined;
}

export class CreateCategoryDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name!: string;

  @ValidateIf(isDefined)
  @IsInt()
  sortOrder?: number;

  @ValidateIf(isDefined)
  @IsIn(MENU_STATUSES)
  status?: CommonStatus;
}

export class UpdateCategoryDto {
  @ValidateIf(isDefined)
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name?: string;

  @ValidateIf(isDefined)
  @IsInt()
  sortOrder?: number;

  @ValidateIf(isDefined)
  @IsIn(MENU_STATUSES)
  status?: CommonStatus;
}

export class CreateVariantDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(VARIANT_NAME_MAX_LENGTH)
  name!: string;

  @IsPriceFen()
  priceFen!: string | number;

  @ValidateIf(isDefined)
  @IsInt()
  sortOrder?: number;

  @ValidateIf(isDefined)
  @IsIn(MENU_STATUSES)
  status?: CommonStatus;

  @ValidateIf(isDefined)
  @ForbiddenInventoryMode()
  inventoryMode?: unknown;
}

export class UpdateVariantDto {
  @ValidateIf(isDefined)
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(VARIANT_NAME_MAX_LENGTH)
  name?: string;

  @ValidateIf(isDefined)
  @IsPriceFen()
  priceFen?: string | number;

  @ValidateIf(isDefined)
  @IsInt()
  sortOrder?: number;

  @ValidateIf(isDefined)
  @IsIn(MENU_STATUSES)
  status?: CommonStatus;

  @ValidateIf(isDefined)
  @ForbiddenInventoryMode()
  inventoryMode?: unknown;
}

export class CreateProductDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(PRODUCT_NAME_MAX_LENGTH)
  name!: string;

  @IsDecimalId()
  categoryId!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(PRODUCT_IMAGE_URL_MAX_LENGTH)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'], require_tld: false })
  imageUrl?: string | null;

  @ValidateIf(isDefined)
  @IsInt()
  sortOrder?: number;

  @ValidateIf(isDefined)
  @IsIn(MENU_STATUSES)
  status?: CommonStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}

export class UpdateProductDto {
  @ValidateIf(isDefined)
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(PRODUCT_NAME_MAX_LENGTH)
  name?: string;

  @ValidateIf(isDefined)
  @IsDecimalId()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(PRODUCT_IMAGE_URL_MAX_LENGTH)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'], require_tld: false })
  imageUrl?: string | null;

  @ValidateIf(isDefined)
  @IsInt()
  sortOrder?: number;

  @ValidateIf(isDefined)
  @IsIn(MENU_STATUSES)
  status?: CommonStatus;
}
