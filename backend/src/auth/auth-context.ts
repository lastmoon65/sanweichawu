import type { StaffRole } from '@prisma/client';

import type { StoreScopedStaffResource } from './store-resource.service.js';

export interface AuthenticatedStaff {
  readonly staffId: bigint;
  readonly storeId: bigint;
  readonly role: StaffRole;
  readonly name: string;
  readonly username: string;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string | string[] | undefined>;
  staffAuth?: AuthenticatedStaff;
  storeResource?: StoreScopedStaffResource;
}
