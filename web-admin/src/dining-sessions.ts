import { API_BASE_URL, NetworkError, UnauthorizedSessionError } from './staff-auth';

export type DiningSessionStatus = 'OPEN' | 'CLOSED';

export interface DiningSession {
  readonly id: string;
  readonly storeId: string;
  readonly tableId: string;
  readonly status: DiningSessionStatus;
  readonly version: number;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly closedByStaffId: string | null;
}

export class DiningSessionRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, code?: string, details?: unknown) {
    super('dining-session-request-error');
    this.name = 'DiningSessionRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDiningSession(value: unknown): value is DiningSession {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.storeId === 'string' &&
    typeof value.tableId === 'string' &&
    (value.status === 'OPEN' || value.status === 'CLOSED') &&
    typeof value.version === 'number' &&
    typeof value.openedAt === 'string' &&
    (value.closedAt === null || typeof value.closedAt === 'string') &&
    (value.closedByStaffId === null || typeof value.closedByStaffId === 'string')
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

function getErrorDetails(payload: unknown): unknown {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }
  return payload.error.details;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function requestDiningSessionData(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
  } catch {
    throw new NetworkError();
  }

  const payload = await readJson(response);
  if (response.status === 401) {
    throw new UnauthorizedSessionError();
  }
  if (!response.ok) {
    throw new DiningSessionRequestError(
      response.status,
      getErrorCode(payload),
      getErrorDetails(payload),
    );
  }

  return getApiData(payload);
}

function expectDiningSession(value: unknown): DiningSession {
  if (!isDiningSession(value)) {
    throw new DiningSessionRequestError(200);
  }
  return value;
}

export async function listDiningSessions(
  accessToken: string,
  status?: DiningSessionStatus,
): Promise<DiningSession[]> {
  const query = status === undefined ? '' : `?status=${status}`;
  const data = await requestDiningSessionData(accessToken, `/dining-sessions${query}`);
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isDiningSession)) {
    throw new DiningSessionRequestError(200);
  }
  return data.items;
}

export async function openDiningSession(
  accessToken: string,
  tableId: string,
): Promise<DiningSession> {
  const data = await requestDiningSessionData(
    accessToken,
    `/dining-tables/${encodeURIComponent(tableId)}/sessions`,
    { method: 'POST' },
  );
  return expectDiningSession(data);
}

export async function closeDiningSession(
  accessToken: string,
  sessionId: string,
  version: number,
): Promise<DiningSession> {
  const data = await requestDiningSessionData(
    accessToken,
    `/dining-sessions/${encodeURIComponent(sessionId)}/close`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    },
  );
  return expectDiningSession(data);
}
