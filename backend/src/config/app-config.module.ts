import { Global, Module } from '@nestjs/common';

import { loadEnvironmentConfig } from './environment.js';
import type { AppConfig } from './environment.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadEnvironmentConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
