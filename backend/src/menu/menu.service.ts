import { HttpException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { insufficientPermissions } from '../auth/auth-errors.js';
import { parseDecimalBigIntId } from '../auth/store-resource.service.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import type {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './menu.dto.js';
import {
  CATEGORY_NAME_MAX_LENGTH,
  PRODUCT_IMAGE_URL_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  VARIANT_NAME_MAX_LENGTH,
} from './menu.dto.js';
import {
  categoryReferenced,
  emptyUpdate,
  invalidMenuInput,
  lastVariantRequired,
  nameConflict,
  productReferenced,
  variantReferenced,
} from './menu.errors.js';
import {
  CATEGORY_SELECT,
  PRODUCT_SELECT,
  VARIANT_SELECT,
  serializeCategory,
  serializeProduct,
  serializeVariant,
} from './menu.types.js';
import type {
  CategoryListResponse,
  CategoryResponse,
  ProductListResponse,
  ProductResponse,
  VariantResponse,
} from './menu.types.js';
import { parsePriceFen } from './menu.validation.js';

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 10_000,
} as const;

interface NormalizedVariant {
  readonly name: string;
  readonly priceFen: bigint;
  readonly sortOrder: number;
}

function normalizeName(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function normalizeDescription(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidMenuInput([{ field: 'description', messages: ['description must be a string'] }]);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeImageUrl(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidMenuInput([{ field: 'imageUrl', messages: ['imageUrl must be a string'] }]);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > PRODUCT_IMAGE_URL_MAX_LENGTH) {
    throw invalidMenuInput([
      {
        field: 'imageUrl',
        messages: ['imageUrl must be a non-empty URL of at most 512 characters'],
      },
    ]);
  }
  return normalized;
}

function normalizeSortOrder(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value)) {
    throw invalidMenuInput([{ field, messages: [`${field} must be an integer`] }]);
  }
  return value as number;
}

function parsePathId(value: string): bigint {
  const id = parseDecimalBigIntId(value);
  if (id === null) {
    throw insufficientPermissions();
  }
  return id;
}

function parseBodyCategoryId(value: unknown): bigint {
  const id = typeof value === 'string' ? parseDecimalBigIntId(value) : null;
  if (id === null) {
    throw invalidMenuInput([
      { field: 'categoryId', messages: ['categoryId must be a decimal id string'] },
    ]);
  }
  return id;
}

function normalizeCreateVariant(input: CreateVariantDto | undefined): NormalizedVariant {
  const name = normalizeName(input?.name, VARIANT_NAME_MAX_LENGTH);
  const priceFen = parsePriceFen(input?.priceFen);
  if (name === null || priceFen === null) {
    throw invalidMenuInput(
      name === null
        ? [{ field: 'variants.name', messages: ['variant name is required'] }]
        : [{ field: 'variants.priceFen', messages: ['priceFen must be a non-negative integer'] }],
    );
  }
  return {
    name,
    priceFen,
    sortOrder:
      input?.sortOrder === undefined ? 0 : normalizeSortOrder(input.sortOrder, 'sortOrder'),
  };
}

function normalizeCreateVariants(
  input: readonly CreateVariantDto[] | undefined,
): NormalizedVariant[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw invalidMenuInput([{ field: 'variants', messages: ['At least one variant is required'] }]);
  }
  return input.map((variant) => normalizeCreateVariant(variant));
}

function rethrowWriteError(error: unknown, referenced: () => HttpException): never {
  if (error instanceof HttpException) {
    throw error;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw nameConflict();
    }
    if (error.code === 'P2003') {
      throw referenced();
    }
    if (error.code === 'P2025') {
      throw insufficientPermissions();
    }
  }
  throw error;
}

@Injectable()
export class MenuService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCategories(storeId: bigint): Promise<CategoryListResponse> {
    const categories = await this.prisma.category.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: CATEGORY_SELECT,
    });
    return { items: categories.map(serializeCategory) };
  }

  async createCategory(storeId: bigint, input: CreateCategoryDto): Promise<CategoryResponse> {
    const name = normalizeName(input?.name, CATEGORY_NAME_MAX_LENGTH);
    if (name === null) {
      throw invalidMenuInput([{ field: 'name', messages: ['name is required'] }]);
    }
    const sortOrder =
      input.sortOrder === undefined ? 0 : normalizeSortOrder(input.sortOrder, 'sortOrder');
    try {
      const category = await this.prisma.category.create({
        data: {
          storeId,
          name,
          sortOrder,
          status: input.status ?? 'ACTIVE',
        },
        select: CATEGORY_SELECT,
      });
      return serializeCategory(category);
    } catch (error) {
      rethrowWriteError(error, categoryReferenced);
    }
  }

  async getCategory(storeId: bigint, categoryIdValue: string): Promise<CategoryResponse> {
    const categoryId = parsePathId(categoryIdValue);
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
      select: CATEGORY_SELECT,
    });
    if (!category) {
      throw insufficientPermissions();
    }
    return serializeCategory(category);
  }

  async updateCategory(
    storeId: bigint,
    categoryIdValue: string,
    input: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    if (
      !input ||
      (input.name === undefined && input.sortOrder === undefined && input.status === undefined)
    ) {
      throw emptyUpdate(['name', 'sortOrder', 'status']);
    }

    const data: { name?: string; sortOrder?: number; status?: 'ACTIVE' | 'DISABLED' } = {};
    if (input.name !== undefined) {
      const name = normalizeName(input.name, CATEGORY_NAME_MAX_LENGTH);
      if (name === null) {
        throw invalidMenuInput([{ field: 'name', messages: ['name is required'] }]);
      }
      data.name = name;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = normalizeSortOrder(input.sortOrder, 'sortOrder');
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    const categoryId = parsePathId(categoryIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.category.findFirst({
          where: { id: categoryId, storeId },
          select: { id: true },
        });
        if (!existing) {
          throw insufficientPermissions();
        }
        const updated = await transaction.category.update({
          where: { id: categoryId },
          data,
          select: CATEGORY_SELECT,
        });
        return serializeCategory(updated);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, categoryReferenced);
    }
  }

  async removeCategory(storeId: bigint, categoryIdValue: string): Promise<CategoryResponse> {
    const categoryId = parsePathId(categoryIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.category.findFirst({
          where: { id: categoryId, storeId },
          select: CATEGORY_SELECT,
        });
        if (!existing) {
          throw insufficientPermissions();
        }
        const productCount = await transaction.product.count({
          where: { categoryId, storeId },
        });
        if (productCount > 0) {
          throw categoryReferenced();
        }
        await transaction.category.delete({ where: { id: categoryId } });
        return serializeCategory(existing);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, categoryReferenced);
    }
  }

  async listProducts(storeId: bigint, categoryIdValue?: string): Promise<ProductListResponse> {
    let categoryId: bigint | undefined;
    if (categoryIdValue !== undefined) {
      const parsed = parseDecimalBigIntId(categoryIdValue);
      if (parsed === null) {
        throw insufficientPermissions();
      }
      const category = await this.prisma.category.findFirst({
        where: { id: parsed, storeId },
        select: { id: true },
      });
      if (!category) {
        throw insufficientPermissions();
      }
      categoryId = parsed;
    }

    const products = await this.prisma.product.findMany({
      where: { storeId, ...(categoryId === undefined ? {} : { categoryId }) },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: PRODUCT_SELECT,
    });
    return { items: products.map(serializeProduct) };
  }

  async createProduct(storeId: bigint, input: CreateProductDto): Promise<ProductResponse> {
    const name = normalizeName(input?.name, PRODUCT_NAME_MAX_LENGTH);
    if (name === null) {
      throw invalidMenuInput([{ field: 'name', messages: ['name is required'] }]);
    }
    const categoryId = parseBodyCategoryId(input.categoryId);
    const description = normalizeDescription(input.description) ?? null;
    const imageUrl = normalizeImageUrl(input.imageUrl) ?? null;
    const sortOrder =
      input.sortOrder === undefined ? 0 : normalizeSortOrder(input.sortOrder, 'sortOrder');
    const variants = normalizeCreateVariants(input.variants);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const category = await transaction.category.findFirst({
          where: { id: categoryId, storeId },
          select: { id: true },
        });
        if (!category) {
          throw insufficientPermissions();
        }
        const product = await transaction.product.create({
          data: {
            storeId,
            categoryId,
            name,
            description,
            imageUrl,
            status: input.status ?? 'ACTIVE',
            sortOrder,
            variants: {
              create: variants.map((variant, index) => ({
                name: variant.name,
                priceFen: variant.priceFen,
                inventoryMode: 'UNMANAGED',
                status: input.variants[index]?.status ?? 'ACTIVE',
                sortOrder: variant.sortOrder,
              })),
            },
          },
          select: PRODUCT_SELECT,
        });
        return serializeProduct(product);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, productReferenced);
    }
  }

  async getProduct(storeId: bigint, productIdValue: string): Promise<ProductResponse> {
    const productId = parsePathId(productIdValue);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      select: PRODUCT_SELECT,
    });
    if (!product) {
      throw insufficientPermissions();
    }
    return serializeProduct(product);
  }

  async updateProduct(
    storeId: bigint,
    productIdValue: string,
    input: UpdateProductDto,
  ): Promise<ProductResponse> {
    if (
      !input ||
      (input.name === undefined &&
        input.categoryId === undefined &&
        input.description === undefined &&
        input.imageUrl === undefined &&
        input.sortOrder === undefined &&
        input.status === undefined)
    ) {
      throw emptyUpdate(['categoryId', 'name', 'description', 'imageUrl', 'sortOrder', 'status']);
    }

    const data: {
      name?: string;
      categoryId?: bigint;
      description?: string | null;
      imageUrl?: string | null;
      status?: 'ACTIVE' | 'DISABLED';
      sortOrder?: number;
    } = {};
    if (input.name !== undefined) {
      const name = normalizeName(input.name, PRODUCT_NAME_MAX_LENGTH);
      if (name === null) {
        throw invalidMenuInput([{ field: 'name', messages: ['name is required'] }]);
      }
      data.name = name;
    }
    const categoryId =
      input.categoryId === undefined ? undefined : parseBodyCategoryId(input.categoryId);
    const description = normalizeDescription(input.description);
    if (description !== undefined) {
      data.description = description;
    }
    const imageUrl = normalizeImageUrl(input.imageUrl);
    if (imageUrl !== undefined) {
      data.imageUrl = imageUrl;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = normalizeSortOrder(input.sortOrder, 'sortOrder');
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    const productId = parsePathId(productIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.product.findFirst({
          where: { id: productId, storeId },
          select: { id: true },
        });
        if (!existing) {
          throw insufficientPermissions();
        }
        if (categoryId !== undefined) {
          const category = await transaction.category.findFirst({
            where: { id: categoryId, storeId },
            select: { id: true },
          });
          if (!category) {
            throw insufficientPermissions();
          }
          data.categoryId = categoryId;
        }
        const updated = await transaction.product.update({
          where: { id: productId },
          data,
          select: PRODUCT_SELECT,
        });
        return serializeProduct(updated);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, productReferenced);
    }
  }

  async removeProduct(storeId: bigint, productIdValue: string): Promise<ProductResponse> {
    const productId = parsePathId(productIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId, storeId },
          select: PRODUCT_SELECT,
        });
        if (!product) {
          throw insufficientPermissions();
        }

        const productReferences = await transaction.orderItem.count({ where: { productId } });
        if (productReferences > 0) {
          throw productReferenced();
        }
        if (product.variants.length > 0) {
          const variantReferences = await transaction.orderItem.count({
            where: { variantId: { in: product.variants.map((variant) => variant.id) } },
          });
          if (variantReferences > 0) {
            throw productReferenced();
          }
          await transaction.productVariant.deleteMany({ where: { productId } });
        }
        await transaction.product.delete({ where: { id: productId } });
        return serializeProduct(product);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, productReferenced);
    }
  }

  async createVariant(
    storeId: bigint,
    productIdValue: string,
    input: CreateVariantDto,
  ): Promise<VariantResponse> {
    const productId = parsePathId(productIdValue);
    const variant = normalizeCreateVariant(input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId, storeId },
          select: { id: true },
        });
        if (!product) {
          throw insufficientPermissions();
        }
        const created = await transaction.productVariant.create({
          data: {
            productId,
            name: variant.name,
            priceFen: variant.priceFen,
            inventoryMode: 'UNMANAGED',
            status: input.status ?? 'ACTIVE',
            sortOrder: variant.sortOrder,
          },
          select: VARIANT_SELECT,
        });
        return serializeVariant(created);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, variantReferenced);
    }
  }

  async updateVariant(
    storeId: bigint,
    productIdValue: string,
    variantIdValue: string,
    input: UpdateVariantDto,
  ): Promise<VariantResponse> {
    if (
      !input ||
      (input.name === undefined &&
        input.priceFen === undefined &&
        input.sortOrder === undefined &&
        input.status === undefined)
    ) {
      throw emptyUpdate(['name', 'priceFen', 'sortOrder', 'status']);
    }

    const data: {
      name?: string;
      priceFen?: bigint;
      status?: 'ACTIVE' | 'DISABLED';
      sortOrder?: number;
    } = {};
    if (input.name !== undefined) {
      const name = normalizeName(input.name, VARIANT_NAME_MAX_LENGTH);
      if (name === null) {
        throw invalidMenuInput([{ field: 'name', messages: ['name is required'] }]);
      }
      data.name = name;
    }
    if (input.priceFen !== undefined) {
      const priceFen = parsePriceFen(input.priceFen);
      if (priceFen === null) {
        throw invalidMenuInput([
          { field: 'priceFen', messages: ['priceFen must be a non-negative integer'] },
        ]);
      }
      data.priceFen = priceFen;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = normalizeSortOrder(input.sortOrder, 'sortOrder');
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    const productId = parsePathId(productIdValue);
    const variantId = parsePathId(variantIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId, storeId },
          select: { id: true },
        });
        if (!product) {
          throw insufficientPermissions();
        }
        const variant = await transaction.productVariant.findFirst({
          where: { id: variantId, productId },
          select: { id: true },
        });
        if (!variant) {
          throw insufficientPermissions();
        }
        const updated = await transaction.productVariant.update({
          where: { id: variantId },
          data,
          select: VARIANT_SELECT,
        });
        return serializeVariant(updated);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, variantReferenced);
    }
  }

  async removeVariant(
    storeId: bigint,
    productIdValue: string,
    variantIdValue: string,
  ): Promise<VariantResponse> {
    const productId = parsePathId(productIdValue);
    const variantId = parsePathId(variantIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const lockedProducts = await transaction.$queryRaw<Array<{ id: bigint }>>(
          Prisma.sql`
            SELECT id FROM products
            WHERE id = ${productId} AND store_id = ${storeId}
            FOR UPDATE
          `,
        );
        if (lockedProducts.length !== 1) {
          throw insufficientPermissions();
        }
        const variant = await transaction.productVariant.findFirst({
          where: { id: variantId, productId },
          select: VARIANT_SELECT,
        });
        if (!variant) {
          throw insufficientPermissions();
        }

        const references = await transaction.orderItem.count({ where: { variantId } });
        if (references > 0) {
          throw variantReferenced();
        }
        const variantCount = await transaction.productVariant.count({ where: { productId } });
        if (variantCount <= 1) {
          throw lastVariantRequired();
        }
        await transaction.productVariant.delete({ where: { id: variantId } });
        return serializeVariant(variant);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error, variantReferenced);
    }
  }
}
