import 'reflect-metadata';

import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequest, AuthenticatedStaff } from '../src/auth/auth-context.js';
import { StoreResourceOwnershipGuard } from '../src/auth/guards/store-resource-ownership.guard.js';
import type {
  StoreResourceService,
  StoreScopedCategoryResource,
  StoreScopedDiningTableResource,
  StoreScopedOrderResource,
  StoreScopedProductResource,
  StoreScopedStaffResource,
  StoreScopedVariantResource,
} from '../src/auth/store-resource.service.js';

const STAFF_AUTH: AuthenticatedStaff = {
  staffId: 1n,
  storeId: 10n,
  role: 'STAFF',
  name: '员工',
  username: 'staff',
};

function context(
  params: Record<string, string | undefined>,
  staffAuth: AuthenticatedStaff | null = STAFF_AUTH,
): { request: AuthenticatedRequest; executionContext: ExecutionContext } {
  const request: AuthenticatedRequest = {
    headers: {},
    params,
    staffAuth: staffAuth ?? undefined,
  };
  const executionContext = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { request, executionContext };
}

interface FakeResources {
  findStaffForAuthenticatedStore: (
    staffId: bigint,
    storeId: bigint,
  ) => Promise<StoreScopedStaffResource | null>;
  findDiningTableForAuthenticatedStore: (
    tableId: bigint,
    storeId: bigint,
  ) => Promise<StoreScopedDiningTableResource | null>;
  findCategoryForAuthenticatedStore: (
    categoryId: bigint,
    storeId: bigint,
  ) => Promise<StoreScopedCategoryResource | null>;
  findProductForAuthenticatedStore: (
    productId: bigint,
    storeId: bigint,
  ) => Promise<StoreScopedProductResource | null>;
  findVariantForAuthenticatedStore: (
    variantId: bigint,
    productId: bigint,
    storeId: bigint,
  ) => Promise<StoreScopedVariantResource | null>;
  findOrderForAuthenticatedStore: (
    orderId: bigint,
    storeId: bigint,
  ) => Promise<StoreScopedOrderResource | null>;
}

function createGuard(overrides: Partial<FakeResources> = {}) {
  const resources: FakeResources = {
    findStaffForAuthenticatedStore: async (staffId, storeId) => ({
      staffId,
      storeId,
      name: 'same-store-staff',
      role: 'STAFF',
      status: 'ACTIVE',
    }),
    findDiningTableForAuthenticatedStore: async (tableId, storeId) => ({
      tableId,
      storeId,
      name: '本店桌',
      code: 'A01',
    }),
    findCategoryForAuthenticatedStore: async (categoryId, storeId) => ({
      categoryId,
      storeId,
      name: '本店分类',
      sortOrder: 0,
      status: 'ACTIVE',
    }),
    findProductForAuthenticatedStore: async (productId, storeId) => ({
      productId,
      storeId,
      categoryId: 100n,
      name: '本店商品',
    }),
    findVariantForAuthenticatedStore: async (variantId, productId, storeId) => ({
      variantId,
      productId,
      storeId,
      name: '本店规格',
      priceFen: 100n,
      status: 'ACTIVE',
    }),
    findOrderForAuthenticatedStore: async (orderId, storeId) => ({
      orderId,
      storeId,
      sessionId: 50n,
      status: 'PENDING_ACCEPTANCE',
    }),
    ...overrides,
  };
  return new StoreResourceOwnershipGuard(resources as unknown as StoreResourceService);
}

async function expectHttpError(
  operation: Promise<boolean>,
  status: number,
  code: string,
): Promise<void> {
  try {
    await operation;
    throw new Error('Expected guard to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toMatchObject({ code });
  }
}

describe('StoreResourceOwnershipGuard path resolution', () => {
  it('requires a logged-in staff context even when no resource id is present', async () => {
    const guard = createGuard();
    const { executionContext } = context({}, null);
    await expectHttpError(guard.canActivate(executionContext), 401, 'UNAUTHORIZED');
  });

  it('allows list and create paths without a resource id', async () => {
    const guard = createGuard();
    const { executionContext } = context({});
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('keeps the existing table and staff path behavior', async () => {
    const guard = createGuard();
    const table = context({ tableId: '42' });
    await expect(guard.canActivate(table.executionContext)).resolves.toBe(true);
    expect(table.request.storeTableResource).toMatchObject({ tableId: 42n, storeId: 10n });

    const staff = context({ staffId: '7' });
    await expect(guard.canActivate(staff.executionContext)).resolves.toBe(true);
    expect(staff.request.storeResource).toMatchObject({ staffId: 7n, storeId: 10n });
  });

  it('resolves category and product resources for the authenticated store', async () => {
    const guard = createGuard();
    const category = context({ categoryId: '100' });
    await expect(guard.canActivate(category.executionContext)).resolves.toBe(true);
    expect(category.request.storeCategoryResource).toMatchObject({
      categoryId: 100n,
      storeId: 10n,
    });

    const product = context({ productId: '200' });
    await expect(guard.canActivate(product.executionContext)).resolves.toBe(true);
    expect(product.request.storeProductResource).toMatchObject({
      productId: 200n,
      storeId: 10n,
    });
  });

  it('requires the variant to belong to the path product in the authenticated store', async () => {
    const guard = createGuard({
      findVariantForAuthenticatedStore: async (variantId, productId, storeId) =>
        variantId === 300n && productId === 200n
          ? {
              variantId,
              productId,
              storeId,
              name: '本店规格',
              priceFen: 100n,
              status: 'ACTIVE',
            }
          : null,
    });

    const valid = context({ productId: '200', variantId: '300' });
    await expect(guard.canActivate(valid.executionContext)).resolves.toBe(true);
    expect(valid.request.storeVariantResource).toMatchObject({
      variantId: 300n,
      productId: 200n,
      storeId: 10n,
    });

    await expectHttpError(
      guard.canActivate(context({ productId: '200', variantId: '301' }).executionContext),
      403,
      'FORBIDDEN',
    );
    await expectHttpError(
      guard.canActivate(context({ variantId: '300' }).executionContext),
      403,
      'FORBIDDEN',
    );
  });

  it('resolves order ids only for the authenticated store', async () => {
    const guard = createGuard();
    const order = context({ orderId: '600' });
    await expect(guard.canActivate(order.executionContext)).resolves.toBe(true);
    expect(order.request.storeOrderResource).toMatchObject({
      orderId: 600n,
      storeId: 10n,
      status: 'PENDING_ACCEPTANCE',
    });

    const foreignGuard = createGuard({
      findOrderForAuthenticatedStore: async () => null,
    });
    for (const params of [{ orderId: '999' }, { orderId: '0' }, { orderId: 'invalid' }]) {
      await expectHttpError(
        foreignGuard.canActivate(context(params).executionContext),
        403,
        'FORBIDDEN',
      );
    }
  });

  it('returns 403 for malformed, missing or foreign ids', async () => {
    const guard = createGuard({
      findCategoryForAuthenticatedStore: async () => null,
      findProductForAuthenticatedStore: async () => null,
      findDiningTableForAuthenticatedStore: async () => null,
      findStaffForAuthenticatedStore: async () => null,
    });

    for (const params of [
      { tableId: 'not-a-number' },
      { tableId: '999' },
      { staffId: '0' },
      { categoryId: '999' },
      { categoryId: '9223372036854775808' },
      { productId: '999' },
      { productId: '200', variantId: 'not-a-number' },
    ]) {
      await expectHttpError(guard.canActivate(context(params).executionContext), 403, 'FORBIDDEN');
    }
  });
});
