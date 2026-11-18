import { describe, expect, it } from 'vitest';

import { ConfigurationError, loadEnvironmentConfig } from '../src/config/environment.js';
import { createTestConfig } from './support/test-config.js';

const DUMMY_DATABASE_URL = createTestConfig().databaseUrl;
const DUMMY_JWT_SECRET = createTestConfig().jwtAccessSecret;

describe('loadEnvironmentConfig', () => {
  it('loads required process environment values and optional skeleton values', () => {
    expect(
      loadEnvironmentConfig({
        NODE_ENV: 'test',
        PORT: '0',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '3600',
        WECHAT_APP_ID: 'optional-app-id',
        WECHAT_APP_SECRET: 'optional-app-secret',
      }),
    ).toEqual({
      nodeEnv: 'test',
      port: 0,
      databaseUrl: DUMMY_DATABASE_URL,
      jwtAccessSecret: DUMMY_JWT_SECRET,
      jwtAccessTtlSeconds: 3600,
      wechatAppId: 'optional-app-id',
      wechatAppSecret: 'optional-app-secret',
      bootstrapOwnerUsername: undefined,
      bootstrapOwnerPassword: undefined,
      bootstrapOwnerName: undefined,
      bootstrapStoreName: undefined,
    });
  });

  it('does not require WeChat variables or one-time bootstrap credentials', () => {
    expect(
      loadEnvironmentConfig({
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '60',
      }),
    ).toMatchObject({
      wechatAppId: undefined,
      wechatAppSecret: undefined,
      bootstrapOwnerUsername: undefined,
      bootstrapOwnerPassword: undefined,
    });
  });

  it('reports every missing required key without exposing values', () => {
    try {
      loadEnvironmentConfig({});
      throw new Error('Expected configuration validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).failedKeys).toEqual([
        'DATABASE_URL',
        'JWT_ACCESS_SECRET',
        'JWT_ACCESS_TTL',
        'NODE_ENV',
        'PORT',
      ]);
      expect((error as Error).message).not.toContain(DUMMY_DATABASE_URL);
      expect((error as Error).message).not.toContain(DUMMY_JWT_SECRET);
    }
  });

  it.each([
    [
      {
        NODE_ENV: 'staging',
        PORT: '3000',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '3600',
      },
      'NODE_ENV',
    ],
    [
      {
        NODE_ENV: 'test',
        PORT: 'not-a-port',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '3600',
      },
      'PORT',
    ],
    [
      {
        NODE_ENV: 'test',
        PORT: '70000',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '3600',
      },
      'PORT',
    ],
    [
      {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'postgresql://example/test',
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '3600',
      },
      'DATABASE_URL',
    ],
    [
      {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'not-a-url',
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '3600',
      },
      'DATABASE_URL',
    ],
    [
      {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: '',
        JWT_ACCESS_TTL: '3600',
      },
      'JWT_ACCESS_SECRET',
    ],
    [
      {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '0',
      },
      'JWT_ACCESS_TTL',
    ],
    [
      {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: DUMMY_DATABASE_URL,
        JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
        JWT_ACCESS_TTL: '1.5',
      },
      'JWT_ACCESS_TTL',
    ],
  ])('rejects invalid configuration for %s', (environment, failedKey) => {
    expect(() => loadEnvironmentConfig(environment)).toThrowError(ConfigurationError);

    try {
      loadEnvironmentConfig(environment);
    } catch (error) {
      expect((error as ConfigurationError).failedKeys).toEqual([failedKey]);
      expect((error as Error).message).not.toContain(environment.DATABASE_URL);
      if (environment.JWT_ACCESS_SECRET) {
        expect((error as Error).message).not.toContain(environment.JWT_ACCESS_SECRET);
      }
    }
  });

  it('rejects an incomplete one-time bootstrap credential pair without exposing values', () => {
    const environment = {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: DUMMY_DATABASE_URL,
      JWT_ACCESS_SECRET: DUMMY_JWT_SECRET,
      JWT_ACCESS_TTL: '3600',
      BOOTSTRAP_OWNER_USERNAME: 'bootstrap-owner',
    };

    try {
      loadEnvironmentConfig(environment);
      throw new Error('Expected configuration validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).failedKeys).toEqual(['BOOTSTRAP_OWNER_PASSWORD']);
      expect((error as Error).message).not.toContain('bootstrap-owner');
    }
  });
});
