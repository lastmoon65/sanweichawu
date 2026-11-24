import { Inject, Injectable } from '@nestjs/common';
import type { StaffRole, StaffStatus } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service.js';

export interface StoreScopedStaffResource {
  readonly staffId: bigint;
  readonly storeId: bigint;
  readonly name: string;
  readonly role: StaffRole;
  readonly status: StaffStatus;
}

export interface StoreScopedDiningTableResource {
  readonly tableId: bigint;
  readonly storeId: bigint;
  readonly name: string;
  readonly code: string;
}

export interface StoreScopedDiningSessionResource {
  readonly sessionId: bigint;
  readonly storeId: bigint;
  readonly tableId: bigint;
  readonly status: 'OPEN' | 'CLOSED';
}

export interface StoreScopedCategoryResource {
  readonly categoryId: bigint;
  readonly storeId: bigint;
  readonly name: string;
  readonly sortOrder: number;
  readonly status: 'ACTIVE' | 'DISABLED';
}

export interface StoreScopedProductResource {
  readonly productId: bigint;
  readonly storeId: bigint;
  readonly categoryId: bigint;
  readonly name: string;
}

export interface StoreScopedVariantResource {
  readonly variantId: bigint;
  readonly productId: bigint;
  readonly storeId: bigint;
  readonly name: string;
  readonly priceFen: bigint;
  readonly status: 'ACTIVE' | 'DISABLED';
}

export interface StoreScopedOrderResource {
  readonly orderId: bigint;
  readonly storeId: bigint;
  readonly sessionId: bigint | null;
  readonly status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
}

export function parseDecimalBigIntId(value: string | string[] | undefined): bigint | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text || !/^[1-9]\d*$/.test(text)) {
    return null;
  }

  const id = BigInt(text);
  return BigInt.asIntN(64, id) === id ? id : null;
}

@Injectable()
export class StoreResourceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findStaffForAuthenticatedStore(
    staffId: bigint,
    authenticatedStoreId: bigint,
  ): Promise<StoreScopedStaffResource | null> {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id: staffId,
        storeId: authenticatedStoreId,
      },
      select: {
        id: true,
        storeId: true,
        name: true,
        role: true,
        status: true,
      },
    });
    return staff
      ? {
          staffId: staff.id,
          storeId: staff.storeId,
          name: staff.name,
          role: staff.role,
          status: staff.status,
        }
      : null;
  }

  async findDiningTableForAuthenticatedStore(
    tableId: bigint,
    authenticatedStoreId: bigint,
  ): Promise<StoreScopedDiningTableResource | null> {
    const table = await this.prisma.diningTable.findFirst({
      where: {
        id: tableId,
        storeId: authenticatedStoreId,
      },
      select: {
        id: true,
        storeId: true,
        name: true,
        code: true,
      },
    });
    return table
      ? {
          tableId: table.id,
          storeId: table.storeId,
          name: table.name,
          code: table.code,
        }
      : null;
  }

  async findDiningSessionForAuthenticatedStore(
    sessionId: bigint,
    authenticatedStoreId: bigint,
  ): Promise<StoreScopedDiningSessionResource | null> {
    const session = await this.prisma.diningSession.findFirst({
      where: {
        id: sessionId,
        storeId: authenticatedStoreId,
      },
      select: {
        id: true,
        storeId: true,
        tableId: true,
        status: true,
      },
    });
    return session
      ? {
          sessionId: session.id,
          storeId: session.storeId,
          tableId: session.tableId,
          status: session.status,
        }
      : null;
  }

  async findCategoryForAuthenticatedStore(
    categoryId: bigint,
    authenticatedStoreId: bigint,
  ): Promise<StoreScopedCategoryResource | null> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        storeId: authenticatedStoreId,
      },
      select: {
        id: true,
        storeId: true,
        name: true,
        sortOrder: true,
        status: true,
      },
    });
    return category
      ? {
          categoryId: category.id,
          storeId: category.storeId,
          name: category.name,
          sortOrder: category.sortOrder,
          status: category.status,
        }
      : null;
  }

  async findProductForAuthenticatedStore(
    productId: bigint,
    authenticatedStoreId: bigint,
  ): Promise<StoreScopedProductResource | null> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        storeId: authenticatedStoreId,
      },
      select: {
        id: true,
        storeId: true,
        categoryId: true,
        name: true,
      },
    });
    return product
      ? {
          productId: product.id,
          storeId: product.storeId,
          categoryId: product.categoryId,
          name: product.name,
        }
      : null;
  }

  async findVariantForAuthenticatedStore(
    variantId: bigint,
    productId: bigint,
    authenticatedStoreId: bigint,
  ): Promise<StoreScopedVariantResource | null> {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        product: { storeId: authenticatedStoreId },
      },
      select: {
        id: true,
        productId: true,
        name: true,
        priceFen: true,
        status: true,
        product: { select: { storeId: true } },
      },
    });
    return variant
      ? {
          variantId: variant.id,
          productId: variant.productId,
          storeId: variant.product.storeId,
          name: variant.name,
          priceFen: variant.priceFen,
          status: variant.status,
        }
      : null;
  }

  async findOrderForAuthenticatedStore(
    orderId: bigint,
    authenticatedStoreId: bigint,
  ): Promise<StoreScopedOrderResource | null> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: authenticatedStoreId,
      },
      select: {
        id: true,
        storeId: true,
        sessionId: true,
        status: true,
      },
    });
    return order
      ? {
          orderId: order.id,
          storeId: order.storeId,
          sessionId: order.sessionId,
          status: order.status,
        }
      : null;
  }
}
