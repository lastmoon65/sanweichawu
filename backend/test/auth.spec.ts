import 'reflect-metadata';

import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { StaffRole, StaffStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { Roles } from '../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { StaffJwtAuthGuard } from '../src/auth/guards/staff-jwt-auth.guard.js';
import { TokenService, signJwt } from '../src/auth/token.service.js';
import type { ApiSuccessBody } from '../src/common/api-response.js';
import { configureApplication } from '../src/app.setup.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module.js';
import { createTestConfig, TEST_JWT_SECRET } from './support/test-config.js';
import { createHttpHarness } from './support/http-harness.js';
import type { HttpResponse } from './support/http-harness.js';

interface StaffRow {
  id: bigint;
  storeId: bigint;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface CredentialRow {
  id: bigint;
  staffId: bigint;
  username: string;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class FakePrisma {
  staffRows: StaffRow[] = [];
  credentialRows: CredentialRow[] = [];

  readonly $queryRaw = async (): Promise<Array<{ id: bigint }>> => [{ id: 1n }];

  readonly $transaction = async <T>(
    callback: (transaction: FakePrisma) => Promise<T>,
  ): Promise<T> => callback(this);

  readonly staff = {
    findUnique: async (args: { where: { id: bigint } }) => {
      const staff = this.staffRows.find((entry) => entry.id === args.where.id);
      if (!staff) {
        return null;
      }
      return {
        ...staff,
        credential:
          this.credentialRows.find((credential) => credential.staffId === staff.id) ?? null,
      };
    },
  };

  readonly staffCredential = {
    findUnique: async (args: { where: { username?: string; id?: bigint } }) => {
      const credential = this.credentialRows.find((entry) =>
        args.where.username !== undefined
          ? entry.username === args.where.username
          : entry.id === args.where.id,
      );
      if (!credential) {
        return null;
      }
      const staff = this.staffRows.find((entry) => entry.id === credential.staffId);
      return staff ? { ...credential, staff: { ...staff } } : null;
    },
    update: async (args: {
      where: { id: bigint };
      data: { failedAttempts: number; lockedUntil: Date | null };
    }) => {
      const credential = this.credentialRows.find((entry) => entry.id === args.where.id);
      if (!credential) {
        throw new Error('Credential not found');
      }
      credential.failedAttempts = args.data.failedAttempts;
      credential.lockedUntil = args.data.lockedUntil;
      credential.updatedAt = new Date();
      return credential;
    },
  };

  readonly ping = async (): Promise<void> => undefined;

  reset(): void {
    this.staffRows = [];
    this.credentialRows = [];
  }

  addStaff(input: {
    username: string;
    passwordHash: string;
    role: StaffRole;
    status?: StaffStatus;
    storeId?: bigint;
  }): StaffRow {
    const id = BigInt(this.staffRows.length + 1);
    const now = new Date();
    const staff: StaffRow = {
      id,
      storeId: input.storeId ?? 10n,
      name: `Staff ${id}`,
      role: input.role,
      status: input.status ?? 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.staffRows.push(staff);
    this.credentialRows.push({
      id: BigInt(this.credentialRows.length + 1),
      staffId: id,
      username: input.username,
      passwordHash: input.passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    });
    return staff;
  }
}

@Controller('test-support')
@UseGuards(StaffJwtAuthGuard, RolesGuard)
class OwnerOnlyTestController {
  @Get('owner-only')
  @Roles('OWNER')
  ownerOnly(): { scope: string } {
    return { scope: 'owner' };
  }
}

@Module({ imports: [AuthModule, PrismaModule], controllers: [OwnerOnlyTestController] })
class AuthTestSupportModule {}

describe('staff authentication', () => {
  const prisma = new FakePrisma();
  const passwords = new PasswordService();
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await passwords.hash('correct horse battery staple');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthTestSupportModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(createTestConfig())
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
  });

  beforeEach(() => {
    prisma.reset();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function api(
    method: string,
    path: string,
    options: {
      body?: unknown;
      token?: string;
      headers?: Record<string, string>;
      requestId?: string;
    } = {},
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    if (options.requestId) {
      headers['x-request-id'] = options.requestId;
    }
    return request(method, `/api/v1${path}`, { body: options.body, headers });
  }

  async function login(
    username: string,
    password: string,
    extra: Record<string, unknown> = {},
  ): Promise<HttpResponse> {
    return api('POST', '/auth/staff/login', {
      body: { username, password, ...extra },
    });
  }

  it('logs in with username/password and never returns password material', async () => {
    const staff = prisma.addStaff({
      username: 'owner-login',
      passwordHash,
      role: 'OWNER',
    });

    const response = await login('owner-login', 'correct horse battery staple', {
      staffId: '999999',
      storeId: '999999',
      role: 'OWNER',
    });

    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessBody<{
      accessToken: string;
      tokenType: string;
      expiresIn: number;
      staff: Record<string, string>;
    }>;
    expect(body.data.tokenType).toBe('Bearer');
    expect(body.data.expiresIn).toBe(3600);
    expect(body.data.accessToken.split('.')).toHaveLength(3);
    expect(body.data.staff).toMatchObject({
      staffId: staff.id.toString(),
      storeId: '10',
      role: 'OWNER',
      username: 'owner-login',
    });
    expect(JSON.stringify(body)).not.toContain('passwordHash');
    expect(JSON.stringify(body)).not.toContain(passwordHash);

    expect(app).toBeDefined();
    const verified = app!.get(TokenService).verifyAccessToken(body.data.accessToken);
    expect(verified.staffId).toBe(staff.id);
    expect(prisma.credentialRows[0]?.passwordHash).toBe(passwordHash);
    expect(prisma.credentialRows[0]?.passwordHash).not.toBe('correct horse battery staple');
    await expect(passwords.verify('correct horse battery staple', passwordHash)).resolves.toBe(
      true,
    );
  });

  it('validates the login payload before authentication', async () => {
    const response = await api('POST', '/auth/staff/login', {
      body: { username: 'missing-password' },
      requestId: 'invalid-login-payload',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
      },
      requestId: 'invalid-login-payload',
    });
  });

  it('returns the same stable error for an unknown username and a wrong password', async () => {
    prisma.addStaff({ username: 'known-user', passwordHash, role: 'STAFF' });

    const unknownUsername = await api('POST', '/auth/staff/login', {
      body: { username: 'missing-user', password: 'wrong password' },
      requestId: 'same-login-failure',
    });
    const wrongPassword = await api('POST', '/auth/staff/login', {
      body: { username: 'known-user', password: 'wrong password' },
      requestId: 'same-login-failure',
    });

    expect(unknownUsername.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUsername.body).toEqual(wrongPassword.body);
    expect(unknownUsername.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
        details: null,
      },
      requestId: 'same-login-failure',
    });
  });

  it('locks an account after repeated failures and rejects the correct password while locked', async () => {
    prisma.addStaff({ username: 'locked-user', passwordHash, role: 'MANAGER' });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login('locked-user', 'wrong password');
      expect(response.status).toBe(401);
    }

    const lockedResponse = await login('locked-user', 'correct horse battery staple');
    expect(lockedResponse.status).toBe(401);
    expect(lockedResponse.body).toMatchObject({
      error: { code: 'INVALID_CREDENTIALS' },
    });
    expect(prisma.credentialRows[0]?.failedAttempts).toBe(5);
    expect(prisma.credentialRows[0]?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it('invalidates an existing token immediately when Staff is disabled', async () => {
    const staff = prisma.addStaff({ username: 'disabled-user', passwordHash, role: 'MANAGER' });
    const loginResponse = await login('disabled-user', 'correct horse battery staple');
    const token = (loginResponse.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;

    expect((await api('GET', '/auth/staff/me', { token })).status).toBe(200);
    staff.status = 'DISABLED';
    const disabledResponse = await api('GET', '/auth/staff/me', { token });

    expect(disabledResponse.status).toBe(401);
    expect(disabledResponse.body).toMatchObject({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: null },
    });
  });

  it('rejects a role that is not permitted by the route guard', async () => {
    prisma.addStaff({ username: 'staff-role', passwordHash, role: 'STAFF' });
    const loginResponse = await login('staff-role', 'correct horse battery staple');
    const token = (loginResponse.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;

    const response = await api('GET', '/test-support/owner-only', { token });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions', details: null },
    });
  });

  it('ignores forged identity fields and uses the current Staff record for authorization', async () => {
    const staff = prisma.addStaff({
      username: 'forge-user',
      passwordHash,
      role: 'STAFF',
      storeId: 22n,
    });
    const loginResponse = await login('forge-user', 'correct horse battery staple');
    const token = (loginResponse.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;

    const meResponse = await api('GET', '/auth/staff/me?staffId=999999&storeId=999999&role=OWNER', {
      token,
      headers: {
        'x-staff-id': '999999',
        'x-store-id': '999999',
        'x-role': 'OWNER',
      },
    });
    expect(meResponse.status).toBe(200);
    expect((meResponse.body as ApiSuccessBody<Record<string, string>>).data).toMatchObject({
      staffId: staff.id.toString(),
      storeId: '22',
      role: 'STAFF',
      username: 'forge-user',
    });

    const now = Math.floor(Date.now() / 1000);
    const forgedRoleToken = signJwt(
      {
        sub: staff.id.toString(),
        staffId: staff.id.toString(),
        storeId: '22',
        role: 'OWNER',
        iat: now,
        exp: now + 300,
      },
      TEST_JWT_SECRET,
    );
    const ownerResponse = await api('GET', '/test-support/owner-only', {
      token: forgedRoleToken,
    });
    expect(ownerResponse.status).toBe(403);
  });

  it('rejects requests without a token and customer-only JWTs from employee endpoints', async () => {
    const noToken = await api('GET', '/auth/staff/me');
    expect(noToken.status).toBe(401);

    const now = Math.floor(Date.now() / 1000);
    const customerToken = signJwt(
      { sub: '123', role: 'STAFF', storeId: '10', iat: now, exp: now + 300 },
      TEST_JWT_SECRET,
    );
    const customerResponse = await api('GET', '/auth/staff/me', { token: customerToken });

    expect(customerResponse.status).toBe(401);
    expect(customerResponse.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        details: null,
      },
      requestId: expect.any(String),
    });

    const oversizedStaffToken = signJwt(
      {
        sub: '9223372036854775808',
        staffId: '9223372036854775808',
        role: 'STAFF',
        storeId: '10',
        iat: now,
        exp: now + 300,
      },
      TEST_JWT_SECRET,
    );
    const oversizedResponse = await api('GET', '/auth/staff/me', {
      token: oversizedStaffToken,
    });
    expect(oversizedResponse.status).toBe(401);
  });
});
