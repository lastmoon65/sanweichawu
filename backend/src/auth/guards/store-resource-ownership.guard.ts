import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { authenticationRequired, insufficientPermissions } from '../auth-errors.js';
import type { AuthenticatedRequest } from '../auth-context.js';
import { StoreResourceService } from '../store-resource.service.js';

function parseStaffId(value: string | string[] | undefined): bigint | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text || !/^[1-9]\d*$/.test(text)) {
    return null;
  }

  const staffId = BigInt(text);
  return BigInt.asIntN(64, staffId) === staffId ? staffId : null;
}

@Injectable()
export class StoreResourceOwnershipGuard implements CanActivate {
  constructor(@Inject(StoreResourceService) private readonly resources: StoreResourceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.staffAuth) {
      throw authenticationRequired();
    }

    const staffId = parseStaffId(request.params?.staffId);
    if (staffId === null) {
      throw insufficientPermissions();
    }

    const resource = await this.resources.findStaffForAuthenticatedStore(
      staffId,
      request.staffAuth.storeId,
    );
    if (!resource) {
      throw insufficientPermissions();
    }

    request.storeResource = resource;
    return true;
  }
}
