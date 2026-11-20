import type { CommonStatus, InventoryMode } from '@prisma/client';

export interface CategoryRecord {
  readonly id: bigint;
  readonly storeId: bigint;
  readonly name: string;
  readonly sortOrder: number;
  readonly status: CommonStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface VariantRecord {
  readonly id: bigint;
  readonly productId: bigint;
  readonly name: string;
  readonly priceFen: bigint;
  readonly inventoryMode: InventoryMode;
  readonly status: CommonStatus;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductRecord {
  readonly id: bigint;
  readonly storeId: bigint;
  readonly categoryId: bigint;
  readonly name: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly status: CommonStatus;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly variants: VariantRecord[];
}

export interface CategoryResponse {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly status: CommonStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VariantResponse {
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  readonly priceFen: string;
  readonly inventoryMode: InventoryMode;
  readonly status: CommonStatus;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductResponse {
  readonly id: string;
  readonly storeId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly status: CommonStatus;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly variants: VariantResponse[];
}

export interface CategoryListResponse {
  readonly items: CategoryResponse[];
}

export interface ProductListResponse {
  readonly items: ProductResponse[];
}

export const CATEGORY_SELECT = {
  id: true,
  storeId: true,
  name: true,
  sortOrder: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const VARIANT_SELECT = {
  id: true,
  productId: true,
  name: true,
  priceFen: true,
  inventoryMode: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const PRODUCT_SELECT = {
  id: true,
  storeId: true,
  categoryId: true,
  name: true,
  description: true,
  imageUrl: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  variants: {
    select: VARIANT_SELECT,
  },
} as const;

export function serializeCategory(category: CategoryRecord): CategoryResponse {
  return {
    id: category.id.toString(),
    storeId: category.storeId.toString(),
    name: category.name,
    sortOrder: category.sortOrder,
    status: category.status,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function serializeVariant(variant: VariantRecord): VariantResponse {
  return {
    id: variant.id.toString(),
    productId: variant.productId.toString(),
    name: variant.name,
    priceFen: variant.priceFen.toString(),
    inventoryMode: variant.inventoryMode,
    status: variant.status,
    sortOrder: variant.sortOrder,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

export function serializeProduct(product: ProductRecord): ProductResponse {
  const variants = [...product.variants].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    if (left.id === right.id) {
      return 0;
    }
    return left.id < right.id ? -1 : 1;
  });

  return {
    id: product.id.toString(),
    storeId: product.storeId.toString(),
    categoryId: product.categoryId.toString(),
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    status: product.status,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: variants.map(serializeVariant),
  };
}
