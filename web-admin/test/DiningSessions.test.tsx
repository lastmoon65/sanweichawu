import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import type { DiningTable } from '../src/dining-tables';
import type { DiningSession } from '../src/dining-sessions';
import { SESSION_EXPIRED_MESSAGE, STAFF_SESSION_TOKEN_KEY } from '../src/staff-auth';
import type { Staff } from '../src/staff-auth';

const STAFF: Staff = {
  staffId: 'staff-session-001',
  storeId: 'store-session-001',
  role: 'MANAGER',
  name: '林晓',
  username: 'manager.lin',
};

const TABLE_ONE: DiningTable = {
  id: '9007199254740993',
  storeId: 'store-session-001',
  name: '一号桌',
  code: 'A01',
  createdAt: '2026-11-20T01:02:03.456Z',
  updatedAt: '2026-11-20T02:03:04.567Z',
};

const TABLE_TWO: DiningTable = {
  ...TABLE_ONE,
  id: '9007199254740994',
  name: '二号桌',
  code: 'A02',
};

const OPEN_SESSION: DiningSession = {
  id: '9007199254741000',
  storeId: 'store-session-001',
  tableId: TABLE_ONE.id,
  status: 'OPEN',
  version: 1,
  openedAt: '2026-11-20T03:04:05.678Z',
  closedAt: null,
  closedByStaffId: null,
};

const CLOSED_SESSION: DiningSession = {
  ...OPEN_SESSION,
  status: 'CLOSED',
  version: 2,
  closedAt: '2026-11-20T04:05:06.789Z',
  closedByStaffId: STAFF.staffId,
};

type Route = () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successResponse(data: unknown): Response {
  return jsonResponse({ data, requestId: 'request-test' });
}

function errorResponse(code: string, status: number, details: unknown = null): Response {
  return jsonResponse(
    {
      error: { code, message: 'test error', details },
      requestId: 'request-test',
    },
    status,
  );
}

interface FetchOptions {
  readonly tables?: DiningTable[];
  readonly sessions?: DiningSession[];
  readonly routes?: Record<string, Route>;
}

function installFetch(options: FetchOptions = {}) {
  const routes: Record<string, Route> = {
    'GET /api/v1/auth/staff/me': () => successResponse(STAFF),
    'GET /api/v1/dining-tables': () => successResponse({ items: options.tables ?? [] }),
    'GET /api/v1/categories': () => successResponse({ items: [] }),
    'GET /api/v1/products': () => successResponse({ items: [] }),
    'GET /api/v1/dining-sessions?status=OPEN': () =>
      successResponse({ items: options.sessions ?? [] }),
    ...options.routes,
  };
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    const route = routes[`${method} ${url}`];
    if (!route) {
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }
    return route();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callsFor(fetchMock: ReturnType<typeof installFetch>, method: string, url: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const callUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return callUrl === url && ((init as RequestInit | undefined)?.method ?? 'GET') === method;
  });
}

async function renderSessions(options: FetchOptions = {}) {
  sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'session-fake-token');
  const fetchMock = installFetch(options);
  render(<App />);
  expect(await screen.findByText(STAFF.name)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '桌台' }));
  expect(await screen.findByRole('heading', { name: '桌台状态' })).toBeInTheDocument();
  expect(await screen.findByRole('table', { name: '桌台列表' })).toBeInTheDocument();
  return fetchMock;
}

describe('dining session management for signed-in staff', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('shows idle tables and open sessions with the opening time', async () => {
    await renderSessions({ tables: [TABLE_ONE, TABLE_TWO], sessions: [OPEN_SESSION] });

    expect(screen.getByText(TABLE_ONE.name)).toBeInTheDocument();
    expect(screen.getByText(TABLE_TWO.name)).toBeInTheDocument();
    expect(screen.getByText('已开台')).toBeInTheDocument();
    expect(screen.getByText(`开台时间：${OPEN_SESSION.openedAt}`)).toBeInTheDocument();
    expect(screen.getByText('空闲')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `开台 ${TABLE_TWO.name}` })).toBeInTheDocument();
  });

  it('opens a session for an idle table', async () => {
    const fetchMock = await renderSessions({
      tables: [TABLE_ONE],
      sessions: [],
      routes: {
        [`POST /api/v1/dining-tables/${TABLE_ONE.id}/sessions`]: () =>
          successResponse(OPEN_SESSION),
      },
    });
    expect(screen.getByText('空闲')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `开台 ${TABLE_ONE.name}` }));

    expect(await screen.findByText('已开台')).toBeInTheDocument();
    expect(screen.getByText(`开台时间：${OPEN_SESSION.openedAt}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` })).toBeInTheDocument();

    const [openCall] = callsFor(
      fetchMock,
      'POST',
      `/api/v1/dining-tables/${TABLE_ONE.id}/sessions`,
    );
    expect(openCall).toBeDefined();
    expect((openCall?.[1] as RequestInit).headers).toEqual({
      Authorization: 'Bearer session-fake-token',
    });
  });

  it('asks for confirmation before closing and does nothing when cancelled', async () => {
    const fetchMock = await renderSessions({
      tables: [TABLE_ONE],
      sessions: [OPEN_SESSION],
      routes: {
        [`POST /api/v1/dining-sessions/${OPEN_SESSION.id}/close`]: () =>
          successResponse(CLOSED_SESSION),
      },
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(`确认关闭「${TABLE_ONE.name}」的桌单吗？`);
    expect(screen.getByText('已开台')).toBeInTheDocument();
    expect(
      callsFor(fetchMock, 'POST', `/api/v1/dining-sessions/${OPEN_SESSION.id}/close`),
    ).toHaveLength(0);

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` }));

    expect(await screen.findByText('空闲')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `开台 ${TABLE_ONE.name}` })).toBeInTheDocument();
    const [closeCall] = callsFor(
      fetchMock,
      'POST',
      `/api/v1/dining-sessions/${OPEN_SESSION.id}/close`,
    );
    expect(closeCall).toBeDefined();
    expect(JSON.parse(String((closeCall?.[1] as RequestInit).body))).toEqual({
      version: OPEN_SESSION.version,
    });
  });

  it('refreshes the table after an already-open conflict', async () => {
    let sessionLoads = 0;
    const fetchMock = await renderSessions({
      tables: [TABLE_ONE],
      sessions: [],
      routes: {
        'GET /api/v1/dining-sessions?status=OPEN': () => {
          sessionLoads += 1;
          return successResponse({ items: sessionLoads === 1 ? [] : [OPEN_SESSION] });
        },
        [`POST /api/v1/dining-tables/${TABLE_ONE.id}/sessions`]: () =>
          errorResponse('SESSION_ALREADY_OPEN', 409),
      },
    });
    const initialTableCalls = callsFor(fetchMock, 'GET', '/api/v1/dining-tables').length;

    fireEvent.click(screen.getByRole('button', { name: `开台 ${TABLE_ONE.name}` }));

    expect(await screen.findByText('该桌已开台')).toBeInTheDocument();
    expect(await screen.findByText('已开台')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `开台 ${TABLE_ONE.name}` })).not.toBeInTheDocument();
    expect(callsFor(fetchMock, 'GET', '/api/v1/dining-tables')).toHaveLength(
      initialTableCalls + 1,
    );
    expect(callsFor(fetchMock, 'GET', '/api/v1/dining-sessions?status=OPEN')).toHaveLength(2);
  });

  it('refreshes the table after the session was already closed', async () => {
    let sessionLoads = 0;
    const fetchMock = await renderSessions({
      tables: [TABLE_ONE],
      sessions: [OPEN_SESSION],
      routes: {
        'GET /api/v1/dining-sessions?status=OPEN': () => {
          sessionLoads += 1;
          return successResponse({ items: sessionLoads === 1 ? [OPEN_SESSION] : [] });
        },
        [`POST /api/v1/dining-sessions/${OPEN_SESSION.id}/close`]: () =>
          errorResponse('SESSION_CLOSED', 409),
      },
    });
    const initialTableCalls = callsFor(fetchMock, 'GET', '/api/v1/dining-tables').length;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` }));

    expect(await screen.findByText('桌单已关台')).toBeInTheDocument();
    expect(await screen.findByText('空闲')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `开台 ${TABLE_ONE.name}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `关台 ${TABLE_ONE.name}` })).not.toBeInTheDocument();
    expect(callsFor(fetchMock, 'GET', '/api/v1/dining-tables')).toHaveLength(
      initialTableCalls + 1,
    );
    expect(callsFor(fetchMock, 'GET', '/api/v1/dining-sessions?status=OPEN')).toHaveLength(2);
  });

  it('shows the stale-version and order conflict messages', async () => {
    const refreshedSession = { ...OPEN_SESSION, version: OPEN_SESSION.version + 1 };
    let sessionLoads = 0;
    const fetchMock = await renderSessions({
      tables: [TABLE_ONE],
      sessions: [OPEN_SESSION],
      routes: {
        'GET /api/v1/dining-sessions?status=OPEN': () => {
          sessionLoads += 1;
          return successResponse({
            items: sessionLoads === 1 ? [OPEN_SESSION] : [refreshedSession],
          });
        },
        [`POST /api/v1/dining-sessions/${OPEN_SESSION.id}/close`]: () =>
          errorResponse('CONFLICT', 409, { currentVersion: 2 }),
      },
    });
    const initialTableCalls = callsFor(fetchMock, 'GET', '/api/v1/dining-tables').length;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` }));
    expect(await screen.findByText('数据已变更，请刷新后重试')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: `关台 ${TABLE_ONE.name}` })).toBeInTheDocument();
    expect(screen.getByText('已开台')).toBeInTheDocument();
    expect(callsFor(fetchMock, 'GET', '/api/v1/dining-tables')).toHaveLength(
      initialTableCalls + 1,
    );
    expect(callsFor(fetchMock, 'GET', '/api/v1/dining-sessions?status=OPEN')).toHaveLength(2);

    cleanup();
    await renderSessions({
      tables: [TABLE_ONE],
      sessions: [OPEN_SESSION],
      routes: {
        [`POST /api/v1/dining-sessions/${OPEN_SESSION.id}/close`]: () =>
          errorResponse('CONFLICT', 409, { orderCount: 1, reason: 'SESSION_HAS_ORDERS' }),
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: `关台 ${TABLE_ONE.name}` }));
    expect(await screen.findByText('该桌单已有订单，无法关台')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: `关台 ${TABLE_ONE.name}` })).toBeInTheDocument();
  });

  it('keeps the action error when refreshing after a conflict fails', async () => {
    let sessionLoads = 0;
    await renderSessions({
      tables: [TABLE_ONE],
      sessions: [],
      routes: {
        'GET /api/v1/dining-sessions?status=OPEN': () => {
          sessionLoads += 1;
          return sessionLoads === 1
            ? successResponse({ items: [] })
            : errorResponse('INTERNAL_ERROR', 500);
        },
        [`POST /api/v1/dining-tables/${TABLE_ONE.id}/sessions`]: () =>
          errorResponse('SESSION_ALREADY_OPEN', 409),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: `开台 ${TABLE_ONE.name}` }));

    expect(await screen.findByText('该桌已开台')).toBeInTheDocument();
    expect(await screen.findByText('桌台状态刷新失败，请稍后重试')).toBeInTheDocument();
    expect(screen.getByText('该桌已开台')).toBeInTheDocument();
  });

  it('uses the existing session-expired flow when the session API returns 401', async () => {
    sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'session-fake-token');
    installFetch({
      routes: {
        'GET /api/v1/auth/staff/me': () => successResponse(STAFF),
        'GET /api/v1/dining-sessions?status=OPEN': () => errorResponse('UNAUTHORIZED', 401),
      },
    });

    render(<App />);
    expect(await screen.findByText(STAFF.name)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '桌台' }));

    expect(await screen.findByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();
  });
});
