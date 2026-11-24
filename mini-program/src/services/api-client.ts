import { API_BASE_URL, API_PATH_PREFIX } from '../config';

export type HttpMethod = 'GET' | 'POST';

export interface ApiRequestOptions {
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers: Record<string, string>;
  readonly data?: unknown;
}

export interface ApiRequestResult {
  readonly statusCode: number;
  readonly data: unknown;
}

export type ApiRequester = (options: ApiRequestOptions) => Promise<ApiRequestResult>;
export type LoginCodeProvider = () => Promise<string>;

export interface TokenStorage {
  read(): string | undefined;
  write(token: string): void;
  clear(): void;
}

export interface ApiClientDependencies {
  readonly requester: ApiRequester;
  readonly loginCode: LoginCodeProvider;
  readonly storage: TokenStorage;
  readonly baseUrl?: string;
}

export interface LoginData {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly expiresAt: string;
}

interface ApiSuccessBody<T> {
  readonly data: T;
  readonly requestId: string;
}

interface ApiErrorBody {
  readonly error: {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly details?: unknown;
  };
  readonly requestId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorFromResult(result: ApiRequestResult, fallbackMessage: string): ApiError {
  const body = result.data;
  if (isRecord(body) && isRecord(body.error)) {
    const error = body.error as ApiErrorBody['error'];
    return new ApiError(
      result.statusCode,
      typeof error.code === 'string' ? error.code : 'REQUEST_FAILED',
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : fallbackMessage,
      error.details ?? null,
    );
  }
  return new ApiError(result.statusCode, 'REQUEST_FAILED', fallbackMessage);
}

function unwrapSuccess<T>(result: ApiRequestResult): T {
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw errorFromResult(result, '请求失败，请稍后重试');
  }
  if (!isRecord(result.data) || !('data' in result.data)) {
    throw new ApiError(result.statusCode, 'INVALID_RESPONSE', '服务返回数据不完整');
  }
  return (result.data as unknown as ApiSuccessBody<T>).data;
}

export class ApiClient {
  private readonly requester: ApiRequester;
  private readonly loginCode: LoginCodeProvider;
  private readonly storage: TokenStorage;
  private readonly baseUrl: string;
  private loginPromise: Promise<void> | undefined;

  constructor(dependencies: ApiClientDependencies) {
    this.requester = dependencies.requester;
    this.loginCode = dependencies.loginCode;
    this.storage = dependencies.storage;
    this.baseUrl = (dependencies.baseUrl ?? API_BASE_URL).replace(/\/+$/, '');
  }

  async login(): Promise<void> {
    if (this.loginPromise) {
      return this.loginPromise;
    }
    const promise = this.performLogin();
    this.loginPromise = promise;
    try {
      await promise;
    } finally {
      if (this.loginPromise === promise) {
        this.loginPromise = undefined;
      }
    }
  }

  get<T>(path: string): Promise<T> {
    return this.authorized<T>('GET', path);
  }

  post<T>(path: string, data: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    return this.authorized<T>('POST', path, data, extraHeaders);
  }

  private async performLogin(): Promise<void> {
    const code = await this.loginCode();
    if (!code) {
      throw new ApiError(0, 'LOGIN_FAILED', '无法获取微信登录凭证');
    }
    const result = await this.send({
      url: this.url('/customer/auth/login'),
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { code },
    });
    const data = unwrapSuccess<LoginData>(result);
    if (!data.accessToken) {
      throw new ApiError(result.statusCode, 'LOGIN_FAILED', '微信登录返回无效数据');
    }
    this.storage.write(data.accessToken);
  }

  private async authorized<T>(
    method: HttpMethod,
    path: string,
    data?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    let token = this.storage.read();
    if (!token) {
      await this.login();
      token = this.storage.read();
    }
    if (!token) {
      throw new ApiError(0, 'LOGIN_FAILED', '登录失败，请稍后重试');
    }

    const headers = {
      'content-type': 'application/json',
      ...extraHeaders,
      authorization: `Bearer ${token}`,
    };
    let result = await this.send({ url: this.url(path), method, headers, data });
    if (result.statusCode === 401) {
      this.storage.clear();
      await this.login();
      const refreshedToken = this.storage.read();
      if (!refreshedToken) {
        throw new ApiError(401, 'UNAUTHORIZED', '登录已过期，请重新登录');
      }
      result = await this.send({
        url: this.url(path),
        method,
        headers: { ...headers, authorization: `Bearer ${refreshedToken}` },
        data,
      });
    }
    return unwrapSuccess<T>(result);
  }

  private async send(options: ApiRequestOptions): Promise<ApiRequestResult> {
    try {
      return await this.requester(options);
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', '网络连接失败，请稍后重试');
    }
  }

  private url(path: string): string {
    return `${this.baseUrl}${API_PATH_PREFIX}${path}`;
  }
}
