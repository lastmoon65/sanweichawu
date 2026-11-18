import { describe, expect, it, vi } from 'vitest';

import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { HealthController } from '../src/health/health.controller.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createTestConfig } from './support/test-config.js';

describe('AppModule', () => {
  it('compiles with the P1-03 infrastructure providers', async () => {
    const prisma = { ping: vi.fn(), $transaction: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(createTestConfig())
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    expect(moduleRef.get(HealthController)).toBeInstanceOf(HealthController);
    expect(moduleRef.get(PrismaService)).toBe(prisma);
    await moduleRef.close();
  });
});
