export const STAFF_SESSION_TOKEN_KEY = 'sanweichawu.staff.accessToken';

export const INVALID_CREDENTIALS_MESSAGE = '用户名或密码不正确';
export const NETWORK_ERROR_MESSAGE = '网络异常，请稍后重试';
export const LOGIN_ERROR_MESSAGE = '登录失败，请稍后重试';
export const SESSION_EXPIRED_MESSAGE = '登录状态已失效，请重新登录';

export type StaffRole = 'OWNER' | 'MANAGER' | 'STAFF';

export interface Staff {
  readonly staffId: string;
  readonly storeId: string;
  readonly role: StaffRole;
  readonly name: string;
  readonly username: string;
}

export interface StaffLoginResult {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly staff: Staff;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid-credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class UnauthorizedSessionError extends Error {
  constructor() {
    super('unauthorized-session');
    this.name = 'UnauthorizedSessionError';
  }
}

export class NetworkError extends Error {
  constructor() {
    super('network-error');
    this.name = 'NetworkError';
  }
}

export class AuthRequestError extends Error {
  constructor() {
    super('auth-request-error');
    this.name = 'AuthRequestError';
  }
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredApiBaseUrl || '/api/v1').replace(/\/+$/, '');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStaffRole(value: unknown): value is StaffRole {
  return value === 'OWNER' || value === 'MANAGER' || value === 'STAFF';
}

function isStaff(value: unknown): value is Staff {
  return (
    isRecord(value) &&
    typeof value.staffId === 'string' &&
    typeof value.storeId === 'string' &&
    isStaffRole(value.role) &&
    typeof value.name === 'string' &&
    typeof value.username === 'string'
  );
}

function isStaffLoginResult(value: unknown): value is StaffLoginResult {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    value.tokenType === 'Bearer' &&
    typeof value.expiresIn === 'number' &&
    isStaff(value.staff)
  );
}

function getApiData(payload: unknown): unknown {
  return isRecord(payload) ? payload.data : undefined;
}

function getErrorCode(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }

  return typeof payload.error.code === 'string' ? payload.error.code : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function loginStaff(username: string, password: string): Promise<StaffLoginResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/staff/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new NetworkError();
  }

  const payload = await readJson(response);

  if (!response.ok) {
    if (response.status === 401 || getErrorCode(payload) === 'INVALID_CREDENTIALS') {
      throw new InvalidCredentialsError();
    }

    throw new AuthRequestError();
  }

  const data = getApiData(payload);
  if (!isStaffLoginResult(data)) {
    throw new AuthRequestError();
  }

  return data;
}

export async function getCurrentStaff(accessToken: string): Promise<Staff> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/staff/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 401) {
    throw new UnauthorizedSessionError();
  }

  if (!response.ok) {
    throw new AuthRequestError();
  }

  const payload = await readJson(response);
  const data = getApiData(payload);
  if (!isStaff(data)) {
    throw new AuthRequestError();
  }

  return data;
}
