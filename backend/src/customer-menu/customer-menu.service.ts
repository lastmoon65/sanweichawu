import { Inject, Injectable } from '@nestjs/common';

import { parseDecimalBigIntId } from '../auth/store-resource.service.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import {
  invalidSessionId,
  sessionNotAvailable,
  tableNotAvailable,
} from './customer-menu.errors.js';
import type { CustomerMenuResponse, CustomerTableResponse } from './customer-menu.types.js';

const MAX_TABLE_CODE_LENGTH = 40;

@Injectable()
export class CustomerMenuService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveTable(codeValue: string): Promise<CustomerTableResponse> {
    const code = codeValue.trim();
    if (code.length === 0 || code.length > MAX_TABLE_CODE_LENGTH) {
      throw tableNotAvailable();
    }

    const tables = await this.prisma.diningTable.findMany({
      where: { code },
      select: {
        id: true,
        storeId: true,
        name: true,
        code: true,
        store: { select: { status: true } },
      },
    });
    if (tables.length !== 1) {
      throw tableNotAvailable();
    }
    const table = tables[0]!;
    if (table.store.status !== 'ACTIVE') {
      throw tableNotAvailable();
    }

    const session = await this.prisma.diningSession.findFirst({
      where: { storeId: table.storeId, tableId: table.id, status: 'OPEN' },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, openedAt: true },
    });
    if (!session) {
      throw tableNotAvailable();
    }

    return {
      storeId: table.storeId.toString(),
      table: {
        id: table.id.toString(),
        name: table.name,
        code: table.code,
      },
      session: {
        id: session.id.toString(),
        openedAt: session.openedAt.toISOString(),
      },
    };
  }

  async getMenu(sessionIdValue: string | string[] | undefined): Promise<CustomerMenuResponse> {
    const text = Array.isArray(sessionIdValue) ? sessionIdValue[0] : sessionIdValue;
    const sessionId = parseDecimalBigIntId(text);
    if (sessionId === null) {
      throw invalidSessionId();
    }

    const session = await this.prisma.diningSession.findFirst({
      where: { id: sessionId },
      select: { id: true, storeId: true, store: { select: { status: true } } },
    });
    if (!session || session.store.status !== 'ACTIVE') {
      throw sessionNotAvailable();
    }

    const categories = await this.prisma.category.findMany({
      where: { storeId: session.storeId, status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        products: {
          where: { status: 'ACTIVE' },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            sortOrder: true,
            variants: {
              where: { status: 'ACTIVE' },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                name: true,
                priceFen: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    const serializedCategories = categories
      .map((category) => ({
        id: category.id.toString(),
        name: category.name,
        sortOrder: category.sortOrder,
        products: category.products
          .map((product) => ({
            id: product.id.toString(),
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            sortOrder: product.sortOrder,
            variants: product.variants.map((variant) => ({
              id: variant.id.toString(),
              name: variant.name,
              priceFen: variant.priceFen.toString(),
              sortOrder: variant.sortOrder,
            })),
          }))
          .filter((product) => product.variants.length > 0),
      }))
      .filter((category) => category.products.length > 0);

    return {
      storeId: session.storeId.toString(),
      sessionId: session.id.toString(),
      categories: serializedCategories,
    };
  }
}
