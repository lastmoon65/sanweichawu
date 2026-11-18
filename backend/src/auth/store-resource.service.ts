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
}
