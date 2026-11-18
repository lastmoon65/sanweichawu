import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import { SESSION_EXPIRED_MESSAGE, STAFF_SESSION_TOKEN_KEY } from '../src/staff-auth';
import type { Staff } from '../src/staff-auth';
import type { DiningTable } from '../src/dining-tables';

const STAFF: Staff = {
  staffId: 'staff-dining-001',
  storeId: 'store-dining-001',
  role: 'MANAGER',
  name: '林晓',
  username: 'manager.lin',
};

const TABLE_ONE: DiningTable = {
  id: '9007199254740993',
  storeId: 'store-dining-001',
  name: '一号桌',
  code: 'A01',
  createdAt: '2026-11-18T01:02:03.456Z',
  updatedAt: '2026-11-18T02:03:04.567Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successResponse(data: unknown): Response {
  return jsonResponse({ data, requestId: 'request-test' });
}

function errorResponse(code: string, status: number): Response {
  return jsonResponse(
    {
      error: { code, message: 'test error', details: null },
      requestId: 'request-test',
    },
    status,
  );
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderSignedIn(...tableResponses: Response[]) {
  sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'dining-fake-token');
  const fetchMock = stubFetch(successResponse(STAFF), ...tableResponses);
  render(<App />);
  expect(await screen.findByText(STAFF.name)).toBeInTheDocument();
  return fetchMock;
}

function fillTableForm(name: string, code: string) {
  fireEvent.change(screen.getByLabelText('桌名'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('桌码'), { target: { value: code } });
}

describe('dining table management for signed-in staff', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('loads and displays this store tables with string ids and API timestamps', async () => {
    const fetchMock = await renderSignedIn(successResponse({ items: [TABLE_ONE] }));

    expect(await screen.findByText(TABLE_ONE.name)).toBeInTheDocument();
    expect(screen.getByText(TABLE_ONE.code)).toBeInTheDocument();
    expect(screen.getByText(TABLE_ONE.updatedAt)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();

    const [tablesUrl, tablesInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(tablesUrl).toBe('/api/v1/dining-tables');
    expect(tablesInit).toEqual({
      headers: { Authorization: 'Bearer dining-fake-token' },
    });
  });

  it('creates a table after trimming both fields', async () => {
    const created: DiningTable = {
      ...TABLE_ONE,
      id: '9007199254740995',
      name: '三号桌',
      code: 'A03',
    };
    const fetchMock = await renderSignedIn(
      successResponse({ items: [] }),
      successResponse(created),
    );
    expect(await screen.findByText('暂无桌位，请新建第一张桌位。')).toBeInTheDocument();

    fillTableForm('  三号桌  ', '  A03  ');
    fireEvent.click(screen.getByRole('button', { name: '新建桌位' }));

    expect(await screen.findByText('三号桌')).toBeInTheDocument();
    expect(screen.getByText('A03')).toBeInTheDocument();
    expect(screen.getByLabelText('桌名')).toHaveValue('');
    expect(screen.getByLabelText('桌码')).toHaveValue('');

    const [createUrl, createInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(createUrl).toBe('/api/v1/dining-tables');
    expect(createInit.method).toBe('POST');
    expect(createInit.headers).toEqual({
      Authorization: 'Bearer dining-fake-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(createInit.body))).toEqual({ name: '三号桌', code: 'A03' });
  });

  it('rejects empty and overlong fields before requesting the API', async () => {
    const fetchMock = await renderSignedIn(successResponse({ items: [] }));
    expect(await screen.findByText('暂无桌位，请新建第一张桌位。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新建桌位' }));
    expect(screen.getByText('请输入桌名')).toBeInTheDocument();
    expect(screen.getByText('请输入桌码')).toBeInTheDocument();

    fillTableForm('桌'.repeat(41), '码'.repeat(41));
    fireEvent.click(screen.getByRole('button', { name: '新建桌位' }));
    expect(screen.getByText('桌名不能超过40个字符')).toBeInTheDocument();
    expect(screen.getByText('桌码不能超过40个字符')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows the code conflict message from a create response', async () => {
    const fetchMock = await renderSignedIn(
      successResponse({ items: [] }),
      errorResponse('CONFLICT', 409),
    );
    expect(await screen.findByText('暂无桌位，请新建第一张桌位。')).toBeInTheDocument();

    fillTableForm('重复桌', 'A01');
    fireEvent.click(screen.getByRole('button', { name: '新建桌位' }));

    expect(await screen.findByText('该桌码已被使用')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('edits and deletes an existing table without converting its id to a number', async () => {
    const updated: DiningTable = {
      ...TABLE_ONE,
      name: '新一号桌',
      code: 'A02',
      updatedAt: '2026-11-18T03:04:05.678Z',
    };
    const fetchMock = await renderSignedIn(
      successResponse({ items: [TABLE_ONE] }),
      successResponse(updated),
      successResponse(updated),
    );
    expect(await screen.findByText(TABLE_ONE.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `编辑 ${TABLE_ONE.name}` }));
    expect(screen.getByLabelText('桌名')).toHaveValue(TABLE_ONE.name);
    expect(screen.getByLabelText('桌码')).toHaveValue(TABLE_ONE.code);
    fillTableForm('  新一号桌  ', '  A02  ');
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText('新一号桌')).toBeInTheDocument();
    expect(screen.getByText('A02')).toBeInTheDocument();
    const [updateUrl, updateInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(updateUrl).toBe(`/api/v1/dining-tables/${TABLE_ONE.id}`);
    expect(updateInit.method).toBe('PATCH');
    expect(JSON.parse(String(updateInit.body))).toEqual({ name: '新一号桌', code: 'A02' });

    fireEvent.click(screen.getByRole('button', { name: '删除 新一号桌' }));
    expect(await screen.findByText('暂无桌位，请新建第一张桌位。')).toBeInTheDocument();
    expect(screen.queryByText('新一号桌')).not.toBeInTheDocument();

    const [deleteUrl, deleteInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(deleteUrl).toBe(`/api/v1/dining-tables/${TABLE_ONE.id}`);
    expect(deleteInit.method).toBe('DELETE');
  });

  it('keeps the row and explains a referenced table delete conflict', async () => {
    await renderSignedIn(
      successResponse({ items: [TABLE_ONE] }),
      errorResponse('TABLE_REFERENCED', 409),
    );
    expect(await screen.findByText(TABLE_ONE.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `删除 ${TABLE_ONE.name}` }));

    expect(await screen.findByText('该桌位已有开台记录，无法删除')).toBeInTheDocument();
    expect(screen.getByText(TABLE_ONE.name)).toBeInTheDocument();
  });

  it('shows the shared network message when a table request fails', async () => {
    sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'dining-fake-token');
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(successResponse(STAFF))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('网络异常，请稍后重试')).toBeInTheDocument();
  });

  it('uses the existing session-expired flow when the table API returns 401', async () => {
    sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'dining-fake-token');
    stubFetch(successResponse(STAFF), errorResponse('UNAUTHORIZED', 401));

    render(<App />);

    expect(await screen.findByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();
  });
});
