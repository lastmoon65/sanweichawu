import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { authenticationRequired, insufficientPermissions } from '../auth-errors.js';
import type { AuthenticatedRequest } from '../auth-context.js';
import { StoreResourceService, parseDecimalBigIntId } from '../store-resource.service.js';

@Injectable()
export class StoreResourceOwnershipGuard implements CanActivate {
  constructor(@Inject(StoreResourceService) private readonly resources: StoreResourceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.staffAuth) {
      throw authenticationRequired();
    }

    const tableId = parseDecimalBigIntId(request.params?.tableId);
    if (request.params?.tableId !== undefined) {
      if (tableId === null) {
        throw insufficientPermissions();
      }

      const table = await this.resources.findDiningTableForAuthenticatedStore(
        tableId,
        request.staffAuth.storeId,
      );
      if (!table) {
        throw insufficientPermissions();
      }

      request.storeTableResource = table;
      return true;
    }

    const staffId = parseDecimalBigIntId(request.params?.staffId);
    if (request.params?.staffId === undefined) {
      return true;
    }

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
