import { describe, expect, it, vi } from 'vitest';

import {
  HttpWechatCode2SessionClient,
  WechatCode2SessionError,
} from '../src/customer-auth/wechat-code2session.client.js';

const APP_ID = 'test-app-id';
const APP_SECRET = 'test-app-secret';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function expectFailure(
  operation: Promise<unknown>,
  kind: WechatCode2SessionError['kind'],
): Promise<WechatCode2SessionError> {
  try {
    await operation;
    throw new Error('Expected WeChat client failure');
  } catch (error) {
    expect(error).toBeInstanceOf(WechatCode2SessionError);
    const failure = error as WechatCode2SessionError;
    expect(failure.kind).toBe(kind);
    return failure;
  }
}

describe('WeChat code2Session client', () => {
  it('calls the official endpoint with the configured AppID and returns only openid', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ openid: 'test-openid-001', session_key: 'test-session-key' }),
    );
    const client = new HttpWechatCode2SessionClient(APP_ID, APP_SECRET, fetchMock);

    const result = await client.exchangeCode('test-js-code');

    expect(result).toEqual({ openid: 'test-openid-001' });
    expect(JSON.stringify(result)).not.toContain('session_key');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.weixin.qq.com/sns/jscode2session');
    expect(parsed.searchParams.get('appid')).toBe(APP_ID);
    expect(parsed.searchParams.get('secret')).toBe(APP_SECRET);
    expect(parsed.searchParams.get('js_code')).toBe('test-js-code');
    expect(parsed.searchParams.get('grant_type')).toBe('authorization_code');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([40029, 40163])('maps WeChat errcode %s to a rejected login', async (errcode) => {
    const client = new HttpWechatCode2SessionClient(
      APP_ID,
      APP_SECRET,
      vi.fn(async () => jsonResponse({ errcode, errmsg: 'provider detail' })),
    );

    const failure = await expectFailure(client.exchangeCode('bad-code'), 'rejected');
    expect(failure.errcode).toBe(errcode);
    expect(failure.message).not.toContain('provider detail');
  });

  it('maps WeChat rate limiting separately from invalid codes', async () => {
    const client = new HttpWechatCode2SessionClient(
      APP_ID,
      APP_SECRET,
      vi.fn(async () => jsonResponse({ errcode: 45011, errmsg: 'frequent' })),
    );

    await expectFailure(client.exchangeCode('busy-code'), 'rate_limited');
  });

  it('maps network failures and timeouts to unavailable without leaking provider data', async () => {
    const networkClient = new HttpWechatCode2SessionClient(
      APP_ID,
      APP_SECRET,
      vi.fn(async () => {
        throw new Error('socket failed with test-app-secret');
      }),
    );
    const timeoutClient = new HttpWechatCode2SessionClient(
      APP_ID,
      APP_SECRET,
      vi.fn(async () => {
        throw Object.assign(new Error('timeout'), { name: 'AbortError' });
      }),
    );

    const networkFailure = await expectFailure(
      networkClient.exchangeCode('network-code'),
      'unavailable',
    );
    const timeoutFailure = await expectFailure(
      timeoutClient.exchangeCode('timeout-code'),
      'unavailable',
    );
    expect(networkFailure.message).not.toContain(APP_SECRET);
    expect(timeoutFailure.message).not.toContain(APP_SECRET);
  });

  it('rejects malformed or incomplete provider responses', async () => {
    const malformed = new HttpWechatCode2SessionClient(
      APP_ID,
      APP_SECRET,
      vi.fn(async () => new Response('not-json', { status: 200 })),
    );
    const missingOpenid = new HttpWechatCode2SessionClient(
      APP_ID,
      APP_SECRET,
      vi.fn(async () => jsonResponse({ session_key: 'only-session-key' })),
    );

    await expectFailure(malformed.exchangeCode('malformed'), 'unavailable');
    await expectFailure(missingOpenid.exchangeCode('missing'), 'rejected');
  });
});
