import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApplication } from './app.setup.js';
import { ConfigurationError, loadEnvironmentConfig } from './config/environment.js';
import { writeStructuredLog } from './infrastructure/logging/structured-logger.js';

export const LOOPBACK_ADDRESS = '127.0.0.1';

async function bootstrap(): Promise<void> {
  let app: INestApplication | undefined;

  try {
    const config = loadEnvironmentConfig();

    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    app.enableShutdownHooks();
    await app.listen(config.port, LOOPBACK_ADDRESS);

    writeStructuredLog('info', 'server_started', {
      address: LOOPBACK_ADDRESS,
      port: config.port,
      nodeEnv: config.nodeEnv,
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      writeStructuredLog('error', 'startup_configuration_invalid', {
        failedKeys: error.failedKeys,
      });
    } else {
      writeStructuredLog('error', 'startup_failed', { reason: 'startup_failed' });
    }

    if (app) {
      try {
        await app.close();
      } catch {
        writeStructuredLog('error', 'startup_cleanup_failed', { reason: 'cleanup_failed' });
      }
    }
    process.exitCode = 1;
  }
}

void bootstrap().catch(() => {
  writeStructuredLog('error', 'startup_failed', { reason: 'startup_failed' });
  process.exitCode = 1;
});
