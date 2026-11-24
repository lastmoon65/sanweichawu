export const WECHAT_CODE2SESSION_CLIENT = Symbol('WECHAT_CODE2SESSION_CLIENT');

const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';
const WECHAT_REQUEST_TIMEOUT_MS = 5_000;
const MAX_OPENID_LENGTH = 128;

type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

export type WechatCode2SessionFailureKind = 'rejected' | 'rate_limited' | 'unavailable';

export class WechatCode2SessionError extends Error {
  constructor(
    readonly kind: WechatCode2SessionFailureKind,
    readonly errcode?: number,
  ) {
    super('WeChat code2Session request failed');
    this.name = 'WechatCode2SessionError';
  }
}

export interface WechatCode2SessionResult {
  readonly openid: string;
}

export interface WechatCode2SessionClient {
  exchangeCode(code: string): Promise<WechatCode2SessionResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseErrcode(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number(value);
  }
  return undefined;
}

function failureForErrcode(errcode: number): WechatCode2SessionError {
  if (errcode === 45011) {
    return new WechatCode2SessionError('rate_limited', errcode);
  }
  if (errcode < 0) {
    return new WechatCode2SessionError('unavailable', errcode);
  }
  return new WechatCode2SessionError('rejected', errcode);
}

export class HttpWechatCode2SessionClient implements WechatCode2SessionClient {
  constructor(
    private readonly appId: string | undefined,
    private readonly appSecret: string | undefined,
    private readonly fetchImpl: FetchImplementation = (input, init) => fetch(input, init),
  ) {}

  async exchangeCode(code: string): Promise<WechatCode2SessionResult> {
    if (!this.appId || !this.appSecret) {
      throw new WechatCode2SessionError('unavailable');
    }

    const url = new URL(WECHAT_CODE2SESSION_URL);
    url.searchParams.set('appid', this.appId);
    url.searchParams.set('secret', this.appSecret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(WECHAT_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new WechatCode2SessionError('unavailable');
    }

    if (!response.ok) {
      throw new WechatCode2SessionError('unavailable');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new WechatCode2SessionError('unavailable');
    }
    if (!isRecord(body)) {
      throw new WechatCode2SessionError('unavailable');
    }

    const errcode = parseErrcode(body.errcode);
    if (errcode !== undefined && errcode !== 0) {
      throw failureForErrcode(errcode);
    }

    const openid = typeof body.openid === 'string' ? body.openid.trim() : '';
    if (openid.length === 0 || openid.length > MAX_OPENID_LENGTH) {
      throw new WechatCode2SessionError('rejected');
    }

    return { openid };
  }
}
