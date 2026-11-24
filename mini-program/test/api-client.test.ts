import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from '../src/services/api-client';
import type { ApiRequestOptions, ApiRequestResult, TokenStorage } from '../src/services/api-client';

class MemoryTokenStorage implements TokenStorage {
  constructor(private token: string | undefined) {}

  read(): string | undefined {
    return this.token;
  }

  write(token: string): void {
    this.token = token;
  }

  clear(): void {
    this.token = undefined;
  }
}

describe('ApiClient authentication recovery', () => {
  it('clears an expired token, logs in again, and retries the request once on 401', async () => {
    const storage = new MemoryTokenStorage('old-token');
    const loginCode = vi.fn(async () => 'wx-code');
    const requester = vi.fn(async (options: ApiRequestOptions): Promise<ApiRequestResult> => {
      if (options.url.endsWith('/customer/auth/login')) {
        return {
          statusCode: 200,
          data: {
            data: {
              accessToken: 'new-token',
              tokenType: 'Bearer',
              expiresIn: 3600,
              expiresAt: '2026-11-24T10:00:00.000Z',
            },
            requestId: 'login-request',
          },
        };
      }
      if (options.headers.authorization === 'Bearer old-token') {
        return {
          statusCode: 401,
          data: {
            error: { code: 'UNAUTHORIZED', message: 'expired', details: null },
            requestId: 'expired-request',
          },
        };
      }
      return {
        statusCode: 200,
        data: { data: { items: [] }, requestId: 'orders-request' },
      };
    });
    const client = new ApiClient({
      requester,
      loginCode,
      storage,
      baseUrl: 'http://127.0.0.1:3000',
    });

    await expect(client.get('/customer/orders')).resolves.toEqual({ items: [] });

    expect(loginCode).toHaveBeenCalledTimes(1);
    expect(storage.read()).toBe('new-token');
    expect(requester).toHaveBeenCalledTimes(3);
    const calls = requester.mock.calls as unknown as Array<[ApiRequestOptions]>;
    expect(calls[0]?.[0].headers.authorization).toBe('Bearer old-token');
    expect(calls[1]?.[0].url).toBe('http://127.0.0.1:3000/api/v1/customer/auth/login');
    expect(calls[1]?.[0].data).toEqual({ code: 'wx-code' });
    expect(calls[2]?.[0].headers.authorization).toBe('Bearer new-token');
  });

  it('logs in before the first request when no token is stored', async () => {
    const storage = new MemoryTokenStorage(undefined);
    const loginCode = vi.fn(async () => 'wx-code');
    const requester = vi.fn(async (options: ApiRequestOptions): Promise<ApiRequestResult> => {
      if (options.url.endsWith('/customer/auth/login')) {
        return {
          statusCode: 200,
          data: {
            data: {
              accessToken: 'fresh-token',
              tokenType: 'Bearer',
              expiresIn: 3600,
              expiresAt: '2026-11-24T10:00:00.000Z',
            },
            requestId: 'login-request',
          },
        };
      }
      return {
        statusCode: 200,
        data: { data: { categories: [] }, requestId: 'menu-request' },
      };
    });
    const client = new ApiClient({ requester, loginCode, storage });

    await expect(client.get('/customer/menu?sessionId=1')).resolves.toEqual({ categories: [] });
    expect(loginCode).toHaveBeenCalledTimes(1);
    expect(storage.read()).toBe('fresh-token');
  });
});
