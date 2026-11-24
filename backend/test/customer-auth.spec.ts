import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { StaffRole, StaffStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { signJwt, TokenService } from '../src/auth/token.service.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import {
  WECHAT_CODE2SESSION_CLIENT,
  WechatCode2SessionError,
} from '../src/customer-auth/wechat-code2session.client.js';
import type { WechatCode2SessionClient } from '../src/customer-auth/wechat-code2session.client.js';
import { createHttpHarness } from './support/http-harness.js';
import type { HttpResponse } from './support/http-harness.js';
import { createTestConfig, TEST_JWT_SECRET } from './support/test-config.js';

interface UserRow {
  id: bigint;
  openid: string;
  status: UserStatus;
}

interface StaffRow {
  id: bigint;
  storeId: bigint;
  role: StaffRole;
  status: StaffStatus;
  name: string;
  credential: { username: string } | null;
}

class FakeCustomerPrisma {
  users: UserRow[] = [];
  staffRows: StaffRow[] = [];
  private nextUserId = 41n;

  readonly user = {
    upsert: async (args: {
      where: { openid: string };
      create: { openid: string; status: UserStatus };
      update: Record<string, never>;
      select: { id: true; status: true };
    }) => {
      const existing = this.users.find((user) => user.openid === args.where.openid);
      if (existing) {
        return { id: existing.id, status: existing.status };
      }
      const user: UserRow = {
        id: this.nextUserId++,
        openid: args.create.openid,
        status: args.create.status,
      };
      this.users.push(user);
      return { id: user.id, status: user.status };
    },
    findUnique: async (args: { where: { id?: bigint; openid?: string } }) =>
      this.users.find((user) =>
        args.where.id !== undefined ? user.id === args.where.id : user.openid === args.where.openid,
      ) ?? null,
  };

  readonly staff = {
    findUnique: async (args: { where: { id: bigint } }) =>
      this.staffRows.find((staff) => staff.id === args.where.id) ?? null,
  };

  readonly ping = async (): Promise<void> => undefined;

  reset(): void {
    this.users = [];
    this.staffRows = [
      {
        id: 7n,
        storeId: 9n,
        role: 'OWNER',
        status: 'ACTIVE',
        name: '测试员工',
        credential: { username: 'test-staff' },
      },
    ];
    this.nextUserId = 41n;
  }
}

interface TestContext {
  app: INestApplication;
  request: ReturnType<typeof createHttpHarness>;
  prisma: FakeCustomerPrisma;
  wechat: { exchangeCode: ReturnType<typeof vi.fn> };
  tokens: TokenService;
}

async function createContext(configured = true): Promise<TestContext> {
  const prisma = new FakeCustomerPrisma();
  prisma.reset();
  const wechat = {
    exchangeCode: vi.fn(async () => ({ openid: 'test-sw013-auth-openid' })),
  } satisfies WechatCode2SessionClient;
  const config = createTestConfig(
    configured
      ? { wechatAppId: 'test-app-id', wechatAppSecret: 'test-app-secret' }
      : { wechatAppId: undefined, wechatAppSecret: undefined },
  );
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(WECHAT_CODE2SESSION_CLIENT)
    .useValue(wechat)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApplication(app);
  await app.init();
  return {
    app,
    request: createHttpHarness(app),
    prisma,
    wechat: wechat as TestContext['wechat'],
    tokens: app.get(TokenService),
  };
}

function api(
  context: TestContext,
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<HttpResponse> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  return context.request(method, `/api/v1${path}`, { body: options.body, headers });
}

function errorCode(response: HttpResponse): string {
  return (response.body as ApiErrorBody).error.code;
}

async function login(context: TestContext): Promise<string> {
  const response = await api(context, 'POST', '/customer/auth/login', {
    body: { code: 'test-login-code' },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return (response.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;
}

describe('customer authentication and token isolation', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createContext();
  });

  beforeEach(() => {
    context.prisma.reset();
    context.wechat.exchangeCode.mockClear();
  });

  afterAll(async () => {
    await context.app.close();
  });

  it('upserts one user per openid and never returns openid or session_key', async () => {
    const first = await api(context, 'POST', '/customer/auth/login', {
      body: { code: 'test-login-code' },
    });
    const second = await api(context, 'POST', '/customer/auth/login', {
      body: { code: 'test-login-code-2' },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(context.prisma.users).toHaveLength(1);
    const serialized = JSON.stringify(first.body);
    expect(serialized).not.toContain('test-sw013-auth-openid');
    expect(serialized).not.toContain('session_key');
    expect(serialized).not.toContain('test-app-secret');

    const token = (first.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;
    expect(context.tokens.verifyCustomerAccessToken(token).customerUserId).toBe(41n);
  });

  it('returns explicit errors for invalid code, rate limiting, unavailable upstream, and missing config', async () => {
    context.wechat.exchangeCode.mockRejectedValueOnce(
      new WechatCode2SessionError('rejected', 40029),
    );
    const rejected = await api(context, 'POST', '/customer/auth/login', {
      body: { code: 'bad-code' },
    });
    expect(rejected.status).toBe(401);
    expect(errorCode(rejected)).toBe('WECHAT_LOGIN_FAILED');

    context.wechat.exchangeCode.mockRejectedValueOnce(
      new WechatCode2SessionError('rate_limited', 45011),
    );
    const limited = await api(context, 'POST', '/customer/auth/login', {
      body: { code: 'busy-code' },
    });
    expect(limited.status).toBe(429);
    expect(errorCode(limited)).toBe('WECHAT_RATE_LIMITED');

    context.wechat.exchangeCode.mockRejectedValueOnce(new WechatCode2SessionError('unavailable'));
    const unavailable = await api(context, 'POST', '/customer/auth/login', {
      body: { code: 'network-code' },
    });
    expect(unavailable.status).toBe(503);
    expect(errorCode(unavailable)).toBe('WECHAT_UNAVAILABLE');

    const unconfigured = await createContext(false);
    try {
      const response = await api(unconfigured, 'POST', '/customer/auth/login', {
        body: { code: 'any-code' },
      });
      expect(response.status).toBe(503);
      expect(errorCode(response)).toBe('WECHAT_NOT_CONFIGURED');
      expect(unconfigured.wechat.exchangeCode).not.toHaveBeenCalled();
    } finally {
      await unconfigured.app.close();
    }
  });

  it('rejects disabled customers during login and on later requests', async () => {
    context.prisma.users.push({ id: 99n, openid: 'test-sw013-auth-openid', status: 'DISABLED' });

    const disabledLogin = await api(context, 'POST', '/customer/auth/login', {
      body: { code: 'disabled-code' },
    });
    expect(disabledLogin.status).toBe(403);
    expect(errorCode(disabledLogin)).toBe('CUSTOMER_DISABLED');

    context.prisma.users[0]!.status = 'ACTIVE';
    const token = await login(context);
    context.prisma.users[0]!.status = 'DISABLED';
    const laterRequest = await api(context, 'GET', '/customer/orders', { token });
    expect(laterRequest.status).toBe(401);
    expect(errorCode(laterRequest)).toBe('UNAUTHORIZED');
  });

  it('keeps staff and customer tokens mutually incompatible', async () => {
    const customerToken = await login(context);
    const staffToken = context.tokens.signAccessToken({
      staffId: 7n,
      role: 'OWNER',
      storeId: 9n,
    });

    const customerOnStaff = await api(context, 'GET', '/auth/staff/me', {
      token: customerToken,
    });
    expect(customerOnStaff.status).toBe(401);

    const staffOnCustomer = await api(context, 'GET', '/customer/orders', {
      token: staffToken,
    });
    expect(staffOnCustomer.status).toBe(401);

    const now = Math.floor(Date.now() / 1000);
    const forgedCustomerClaim = signJwt(
      {
        sub: '7',
        staffId: '7',
        role: 'OWNER',
        storeId: '9',
        typ: 'customer',
        aud: 'customer',
        iat: now,
        exp: now + 300,
      },
      TEST_JWT_SECRET,
    );
    const forgedOnStaff = await api(context, 'GET', '/auth/staff/me', {
      token: forgedCustomerClaim,
    });
    expect(forgedOnStaff.status).toBe(401);
  });
});
