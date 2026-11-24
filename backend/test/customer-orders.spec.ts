import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { TokenService } from '../src/auth/token.service.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { CustomerOrderService } from '../src/customer-orders/customer-order.service.js';
import { WECHAT_CODE2SESSION_CLIENT } from '../src/customer-auth/wechat-code2session.client.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createHttpHarness } from './support/http-harness.js';
import type { HttpResponse } from './support/http-harness.js';
import { createTestConfig } from './support/test-config.js';

class FakeOrderPrisma {
  readonly user = {
    findUnique: async (args: { where: { id: bigint } }) =>
      args.where.id === 55n ? { id: 55n, status: 'ACTIVE' } : null,
  };
  readonly staff = { findUnique: async () => null };
  readonly ping = async (): Promise<void> => undefined;
}

interface FakeCustomerOrders {
  create: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
}

describe('customer order HTTP identity and validation', () => {
  const prisma = new FakeOrderPrisma();
  const customerOrders: FakeCustomerOrders = {
    create: vi.fn(),
    list: vi.fn(),
    cancel: vi.fn(),
  };
  let app: INestApplication;
  let request: ReturnType<typeof createHttpHarness>;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        createTestConfig({
          wechatAppId: 'test-app-id',
          wechatAppSecret: 'test-app-secret',
        }),
      )
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(WECHAT_CODE2SESSION_CLIENT)
      .useValue({ exchangeCode: vi.fn() })
      .overrideProvider(CustomerOrderService)
      .useValue(customerOrders as unknown as CustomerOrderService)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
    token = app.get(TokenService).signCustomerAccessToken({ customerUserId: 55n });
  });

  beforeEach(() => {
    customerOrders.create.mockReset();
    customerOrders.list.mockReset();
    customerOrders.cancel.mockReset();
    customerOrders.create.mockResolvedValue({ id: '900' });
    customerOrders.list.mockResolvedValue({ items: [] });
    customerOrders.cancel.mockResolvedValue({ id: '900', status: 'CANCELLED' });
  });

  afterAll(async () => {
    await app.close();
  });

  function api(
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<HttpResponse> {
    return request(method, `/api/v1${path}`, {
      body: options.body,
      headers: { authorization: `Bearer ${token}`, ...options.headers },
    });
  }

  it('takes customerUserId only from the token and ignores a body-supplied id', async () => {
    const response = await api('POST', '/customer/orders', {
      headers: { 'idempotency-key': 'test-sw013-idempotency' },
      body: {
        customerUserId: '999999',
        sessionId: '30',
        items: [{ variantId: '44', quantity: 2, remark: '少冰' }],
      },
    });

    expect(response.status).toBe(201);
    expect(customerOrders.create).toHaveBeenCalledWith(55n, '30', 'test-sw013-idempotency', {
      sessionId: '30',
      items: [{ variantId: '44', quantity: 2, remark: '少冰' }],
    });
    expect((response.body as ApiSuccessBody<{ id: string }>).data.id).toBe('900');
  });

  it('requires a non-empty Idempotency-Key of at most 160 characters', async () => {
    const missing = await api('POST', '/customer/orders', {
      body: { sessionId: '30', items: [{ variantId: '44', quantity: 1 }] },
    });
    expect(missing.status).toBe(400);
    expect((missing.body as ApiErrorBody).error.code).toBe('VALIDATION_ERROR');

    const tooLong = await api('POST', '/customer/orders', {
      headers: { 'idempotency-key': 'x'.repeat(161) },
      body: { sessionId: '30', items: [{ variantId: '44', quantity: 1 }] },
    });
    expect(tooLong.status).toBe(400);
    expect(customerOrders.create).not.toHaveBeenCalled();
  });

  it('lists only the authenticated customer orders with an optional session filter', async () => {
    const response = await api('GET', '/customer/orders?sessionId=30');

    expect(response.status).toBe(200);
    expect(customerOrders.list).toHaveBeenCalledWith(55n, '30');
  });

  it('cancels through the customer cancellation rule with the token user id', async () => {
    const response = await api('POST', '/customer/orders/900/cancel', {
      body: { version: 1, cancelReason: '临时有事' },
    });

    expect(response.status).toBe(200);
    expect(customerOrders.cancel).toHaveBeenCalledWith(55n, '900', 1, '临时有事');
  });
});
