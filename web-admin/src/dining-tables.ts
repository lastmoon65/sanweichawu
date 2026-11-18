import { API_BASE_URL, NetworkError, UnauthorizedSessionError } from './staff-auth';

export interface DiningTable {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly code: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class DiningTableRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super('dining-table-request-error');
    this.name = 'DiningTableRequestError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDiningTable(value: unknown): value is DiningTable {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.storeId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.code === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
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

async function requestDiningTableData(
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
    throw new DiningTableRequestError(response.status, getErrorCode(payload));
  }

  return getApiData(payload);
}

function expectDiningTable(value: unknown): DiningTable {
  if (!isDiningTable(value)) {
    throw new DiningTableRequestError(200);
  }
  return value;
}

export async function listDiningTables(accessToken: string): Promise<DiningTable[]> {
  const data = await requestDiningTableData(accessToken, '/dining-tables');
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isDiningTable)) {
    throw new DiningTableRequestError(200);
  }
  return data.items;
}

export async function createDiningTable(
  accessToken: string,
  name: string,
  code: string,
): Promise<DiningTable> {
  const data = await requestDiningTableData(accessToken, '/dining-tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, code }),
  });
  return expectDiningTable(data);
}

export async function updateDiningTable(
  accessToken: string,
  tableId: string,
  name: string,
  code: string,
): Promise<DiningTable> {
  const data = await requestDiningTableData(
    accessToken,
    `/dining-tables/${encodeURIComponent(tableId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code }),
    },
  );
  return expectDiningTable(data);
}

export async function deleteDiningTable(
  accessToken: string,
  tableId: string,
): Promise<DiningTable> {
  const data = await requestDiningTableData(
    accessToken,
    `/dining-tables/${encodeURIComponent(tableId)}`,
    { method: 'DELETE' },
  );
  return expectDiningTable(data);
}
