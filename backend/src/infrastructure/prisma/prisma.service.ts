import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { sanitizeForLog, writeStructuredLog } from '../logging/structured-logger.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ log: [] });
  }

  onModuleInit(): void {
    void this.connectWhenAvailable();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch (error) {
      writeStructuredLog('warn', 'prisma_disconnect_failed', {
        service: 'prisma',
        error: sanitizeForLog(error),
      });
    }
  }

  async ping(): Promise<void> {
    await this.$queryRawUnsafe('SELECT 1');
  }

  private async connectWhenAvailable(): Promise<void> {
    try {
      await this.$connect();
      writeStructuredLog('info', 'prisma_connected', { service: 'prisma' });
    } catch {
      writeStructuredLog('warn', 'prisma_unavailable', {
        service: 'prisma',
      });
    }
  }
}
