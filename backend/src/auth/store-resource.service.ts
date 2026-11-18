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
}
