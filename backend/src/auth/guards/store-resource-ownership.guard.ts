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

    const params = request.params ?? {};

    const tableId = parseDecimalBigIntId(params.tableId);
    if (params.tableId !== undefined) {
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

    const sessionId = parseDecimalBigIntId(params.sessionId);
    if (params.sessionId !== undefined) {
      if (sessionId === null) {
        throw insufficientPermissions();
      }

      const session = await this.resources.findDiningSessionForAuthenticatedStore(
        sessionId,
        request.staffAuth.storeId,
      );
      if (!session) {
        throw insufficientPermissions();
      }

      request.storeSessionResource = session;
      return true;
    }

    const orderId = parseDecimalBigIntId(params.orderId);
    if (params.orderId !== undefined) {
      if (orderId === null) {
        throw insufficientPermissions();
      }

      const order = await this.resources.findOrderForAuthenticatedStore(
        orderId,
        request.staffAuth.storeId,
      );
      if (!order) {
        throw insufficientPermissions();
      }

      request.storeOrderResource = order;
      return true;
    }

    const staffId = parseDecimalBigIntId(params.staffId);
    if (params.staffId !== undefined) {
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

    const categoryId = parseDecimalBigIntId(params.categoryId);
    if (params.categoryId !== undefined) {
      if (categoryId === null) {
        throw insufficientPermissions();
      }

      const category = await this.resources.findCategoryForAuthenticatedStore(
        categoryId,
        request.staffAuth.storeId,
      );
      if (!category) {
        throw insufficientPermissions();
      }

      request.storeCategoryResource = category;
      return true;
    }

    const productId = parseDecimalBigIntId(params.productId);
    if (params.productId !== undefined) {
      if (productId === null) {
        throw insufficientPermissions();
      }

      const product = await this.resources.findProductForAuthenticatedStore(
        productId,
        request.staffAuth.storeId,
      );
      if (!product) {
        throw insufficientPermissions();
      }

      request.storeProductResource = product;
      if (params.variantId === undefined) {
        return true;
      }
    }

    if (params.variantId === undefined) {
      return true;
    }

    if (productId === null) {
      throw insufficientPermissions();
    }
    const variantId = parseDecimalBigIntId(params.variantId);
    if (variantId === null) {
      throw insufficientPermissions();
    }

    const variant = await this.resources.findVariantForAuthenticatedStore(
      variantId,
      productId,
      request.staffAuth.storeId,
    );
    if (!variant) {
      throw insufficientPermissions();
    }

    request.storeVariantResource = variant;
    return true;
  }
}
