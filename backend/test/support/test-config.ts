import { randomBytes } from 'node:crypto';

import type { AppConfig } from '../../src/config/environment.js';

export const TEST_DATABASE_URL = 'mysql://app:app@127.0.0.1:65535/unit_test';
export const TEST_JWT_SECRET = randomBytes(32).toString('base64url');

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: TEST_DATABASE_URL,
    jwtAccessSecret: TEST_JWT_SECRET,
    jwtAccessTtlSeconds: 3600,
    ...overrides,
  };
}
