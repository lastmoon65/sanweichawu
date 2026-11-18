import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { Controller, Get, Module, Req, UseGuards } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { AuthModule } from '../src/auth/auth.module.js';
import type { AuthenticatedRequest } from '../src/auth/auth-context.js';
import { StaffJwtAuthGuard } from '../src/auth/guards/staff-jwt-auth.guard.js';
import { StoreResourceOwnershipGuard } from '../src/auth/guards/store-resource-ownership.guard.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module.js';
import { createHttpHarness } from './support/http-harness.js';
import { createTestConfig } from './support/test-config.js';
import { requireTaskTestDatabaseUrl } from './support/task-database.js';

const PASSWORD = 'resource-ownership-database-password';

@Controller('test-support')
class StoreResourceTestController {
  @Get('store-staff/:staffId')
  @UseGuards(StaffJwtAuthGuard, StoreResourceOwnershipGuard)
  storeStaff(@Req() request: AuthenticatedRequest) {
    const resource = request.storeResource;
    return resource
      ? {
          staffId: resource.staffId.toString(),
          storeId: resource.storeId.toString(),
          role: resource.role,
        }
      : null;
  }
}

@Module({ imports: [AuthModule, PrismaModule], controllers: [StoreResourceTestController] })
class StoreResourceTestSupportModule {}

interface CreatedIdentity {
  staffId: bigint;
  storeId: bigint;
  username: string;
}

describe('store-scoped resource ownership with a real database', () => {
  const databaseUrl = requireTaskTestDatabaseUrl();
  const passwords = new PasswordService();
  const createdStaffIds: bigint[] = [];
  const createdStoreIds: bigint[] = [];
  let prisma: PrismaClient;
  let app: INestApplication | undefined;
  let request: ReturnType<typeof createHttpHarness>;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, StoreResourceTestSupportModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(createTestConfig({ databaseUrl }))
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    request = createHttpHarness(app);
  });

  afterEach(async () => {
    for (const staffId of createdStaffIds.splice(0)) {
      await prisma.staffCredential.deleteMany({ where: { staffId } });
      await prisma.staff.deleteMany({ where: { id: staffId } });
    }
    for (const storeId of createdStoreIds.splice(0)) {
      await prisma.store.deleteMany({ where: { id: storeId } });
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  async function createIdentity(storeId?: bigint): Promise<CreatedIdentity> {
    const suffix = randomUUID();
    let targetStoreId = storeId;
    if (targetStoreId === undefined) {
      const store = await prisma.store.create({
        data: { name: `sw006-resource-store-${suffix}`, status: 'ACTIVE' },
        select: { id: true },
      });
      targetStoreId = store.id;
      createdStoreIds.push(store.id);
    }
    const staff = await prisma.staff.create({
      data: {
        storeId: targetStoreId,
        name: `sw006-resource-staff-${suffix}`,
        role: 'STAFF',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    createdStaffIds.push(staff.id);
    const username = `sw006-resource-${suffix}`;
    await prisma.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });
    return { staffId: staff.id, storeId: targetStoreId, username };
  }

  async function login(identity: CreatedIdentity): Promise<string> {
    const response = await request('POST', '/api/v1/auth/staff/login', {
      body: { username: identity.username, password: PASSWORD },
    });
    expect(response.status).toBe(200);
    return (response.body as ApiSuccessBody<{ accessToken: string }>).data.accessToken;
  }

  it('uses the authenticated store in the query and ignores forged body/query storeId', async () => {
    const actor = await createIdentity();
    const sameStoreTarget = await createIdentity(actor.storeId);
    const otherStoreTarget = await createIdentity();
    const token = await login(actor);

    const sameStore = await request(
      'GET',
      `/api/v1/test-support/store-staff/${sameStoreTarget.staffId}?storeId=${otherStoreTarget.storeId}`,
      {
        headers: { authorization: `Bearer ${token}` },
        body: { storeId: otherStoreTarget.storeId.toString() },
      },
    );
    expect(sameStore.status).toBe(200);
    expect((sameStore.body as ApiSuccessBody<Record<string, string>>).data).toMatchObject({
      staffId: sameStoreTarget.staffId.toString(),
      storeId: actor.storeId.toString(),
    });

    const otherStore = await request(
      'GET',
      `/api/v1/test-support/store-staff/${otherStoreTarget.staffId}?storeId=${actor.storeId}`,
      {
        headers: { authorization: `Bearer ${token}` },
        body: { storeId: actor.storeId.toString() },
      },
    );
    expect(otherStore.status).toBe(403);
    expect((otherStore.body as ApiErrorBody).error.code).toBe('FORBIDDEN');
  });
});
