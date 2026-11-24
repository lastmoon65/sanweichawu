import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import type { Order } from '../src/orders';
import { SESSION_EXPIRED_MESSAGE, STAFF_SESSION_TOKEN_KEY } from '../src/staff-auth';
import type { Staff } from '../src/staff-auth';

const STAFF: Staff = {
  staffId: 'staff-order-001',
  storeId: 'store-order-001',
  role: 'MANAGER',
  name: '林晓',
  username: 'manager.lin',
};

const TABLE: {
  id: string;
  storeId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
} = {
  id: '9007199254741001',
  storeId: STAFF.storeId,
  name: '一号桌',
  code: 'A01',
  createdAt: '2026-11-20T01:00:00.000Z',
  updatedAt: '2026-11-20T02:00:00.000Z',
};

const SESSION = {
  id: '9007199254741002',
  storeId: STAFF.storeId,
  tableId: TABLE.id,
  status: 'OPEN' as const,
  version: 1,
  openedAt: '2026-11-20T03:00:00.000Z',
  closedAt: null,
  closedByStaffId: null,
};

const PENDING_ORDER: Order = {
  id: '9007199254741100',
  storeId: STAFF.storeId,
  customerUserId: '9007199254741200',
  orderNo: 'SW20261120030405001',
  channel: 'DINE',
  sessionId: SESSION.id,
  status: 'PENDING_ACCEPTANCE',
  subtotalFen: '5800',
  totalAmountFen: '5800',
  version: 1,
  createdAt: '2026-11-20T03:04:05.678Z',
  acceptedAt: null,
  preparingAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  items: [
    {
      id: '9007199254741301',
      orderId: '9007199254741100',
      productId: '9007199254741401',
      variantId: '9007199254741501',
      productNameSnapshot: '桂花乌龙',
      variantNameSnapshot: '大杯',
      unitPriceFen: '2300',
      quantity: 2,
      lineSubtotalFen: '4600',
      remark: '少冰',
      createdAt: '2026-11-20T03:04:05.678Z',
    },
    {
      id: '9007199254741302',
      orderId: '9007199254741100',
      productId: '9007199254741402',
      variantId: '9007199254741502',
      productNameSnapshot: '茉莉绿茶',
      variantNameSnapshot: '标准',
      unitPriceFen: '1200',
      quantity: 1,
      lineSubtotalFen: '1200',
      remark: null,
      createdAt: '2026-11-20T03:04:05.678Z',
    },
  ],
};

const ACCEPTED_ORDER: Order = {
  ...PENDING_ORDER,
  status: 'ACCEPTED',
  version: 2,
  acceptedAt: '2026-11-20T03:05:00.000Z',
};

const PREPARING_ORDER: Order = {
  ...ACCEPTED_ORDER,
  status: 'PREPARING',
  version: 3,
  preparingAt: '2026-11-20T03:06:00.000Z',
};

const COMPLETED_ORDER: Order = {
  ...PREPARING_ORDER,
  status: 'COMPLETED',
  version: 4,
  completedAt: '2026-11-20T03:07:00.000Z',
};

const CANCELLED_ORDER: Order = {
  ...PENDING_ORDER,
  status: 'CANCELLED',
  version: 2,
  cancelledAt: '2026-11-20T03:08:00.000Z',
  cancelReason: '顾客取消',
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

function installFetch(routes: Record<string, Route> = {}) {
  const allRoutes: Record<string, Route> = {
    'GET /api/v1/auth/staff/me': () => successResponse(STAFF),
    'GET /api/v1/dining-tables': () => successResponse({ items: [TABLE] }),
    'GET /api/v1/dining-sessions?status=OPEN': () => successResponse({ items: [SESSION] }),
    'GET /api/v1/orders': () => successResponse({ items: [PENDING_ORDER] }),
    ...routes,
  };
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    const route = allRoutes[`${method} ${url}`];
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

async function renderOrders(routes: Record<string, Route> = {}) {
  sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'order-fake-token');
  const fetchMock = installFetch(routes);
  render(<App />);
  expect(await screen.findByText(STAFF.name)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '订单' }));
  expect(await screen.findByRole('heading', { name: '订单管理' })).toBeInTheDocument();
  expect(await screen.findByRole('table', { name: '订单列表' })).toBeInTheDocument();
  return fetchMock;
}

function orderTable() {
  return within(screen.getByRole('table', { name: '订单列表' }));
}

async function findOrderStatus(status: string): Promise<void> {
  await waitFor(() => {
    expect(orderTable().getByText(status)).toBeInTheDocument();
  });
}

describe('order management for signed-in staff', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('lists order details, Shanghai order time, yuan amount and filters by status', async () => {
    const fetchMock = await renderOrders({
      'GET /api/v1/orders?status=ACCEPTED': () => successResponse({ items: [ACCEPTED_ORDER] }),
    });

    expect(screen.getByText(PENDING_ORDER.orderNo)).toBeInTheDocument();
    expect(orderTable().getByText('待接单')).toBeInTheDocument();
    expect(screen.getByText('¥58.00')).toBeInTheDocument();
    expect(screen.getByText('2026-11-20 11:04')).toBeInTheDocument();
    expect(screen.getByText(/桂花乌龙 \/ 大杯 × 2/)).toBeInTheDocument();
    expect(screen.getByText(/少冰/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'ACCEPTED' } });

    await findOrderStatus('已接单');
    expect(callsFor(fetchMock, 'GET', '/api/v1/orders?status=ACCEPTED')).toHaveLength(1);
  });

  it('calls accept, start and complete with each current version', async () => {
    const fetchMock = await renderOrders({
      [`POST /api/v1/orders/${PENDING_ORDER.id}/accept`]: () => successResponse(ACCEPTED_ORDER),
      [`POST /api/v1/orders/${PENDING_ORDER.id}/start`]: () => successResponse(PREPARING_ORDER),
      [`POST /api/v1/orders/${PENDING_ORDER.id}/complete`]: () => successResponse(COMPLETED_ORDER),
    });

    fireEvent.click(screen.getByRole('button', { name: `接单 ${PENDING_ORDER.orderNo}` }));
    await findOrderStatus('已接单');
    fireEvent.click(screen.getByRole('button', { name: `开始制作 ${PENDING_ORDER.orderNo}` }));
    await findOrderStatus('制作中');
    fireEvent.click(screen.getByRole('button', { name: `完成 ${PENDING_ORDER.orderNo}` }));
    await findOrderStatus('已完成');

    const expected = [
      ['accept', 1],
      ['start', 2],
      ['complete', 3],
    ] as const;
    for (const [action, version] of expected) {
      const [call] = callsFor(fetchMock, 'POST', `/api/v1/orders/${PENDING_ORDER.id}/${action}`);
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ version });
    }
  });

  it('filters by an open dining session', async () => {
    const fetchMock = await renderOrders({
      [`GET /api/v1/orders?sessionId=${SESSION.id}`]: () =>
        successResponse({ items: [PENDING_ORDER] }),
    });

    expect(screen.getByRole('option', { name: '一号桌（A01）' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('桌单'), { target: { value: SESSION.id } });

    await waitFor(() => {
      expect(callsFor(fetchMock, 'GET', `/api/v1/orders?sessionId=${SESSION.id}`)).toHaveLength(1);
    });
    expect(screen.getByText(PENDING_ORDER.orderNo)).toBeInTheDocument();
  });

  it('requires a reason and confirmation before cancelling', async () => {
    const fetchMock = await renderOrders({
      [`POST /api/v1/orders/${PENDING_ORDER.id}/cancel`]: () => successResponse(CANCELLED_ORDER),
    });
    const cancelUrl = `/api/v1/orders/${PENDING_ORDER.id}/cancel`;

    fireEvent.click(screen.getByRole('button', { name: `取消订单 ${PENDING_ORDER.orderNo}` }));
    fireEvent.click(screen.getByRole('button', { name: `确认取消 ${PENDING_ORDER.orderNo}` }));
    expect(screen.getByText('请输入取消原因')).toBeInTheDocument();
    expect(callsFor(fetchMock, 'POST', cancelUrl)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('取消原因'), { target: { value: '顾客取消' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: `确认取消 ${PENDING_ORDER.orderNo}` }));
    expect(confirm).toHaveBeenCalledWith(`确认取消订单 ${PENDING_ORDER.orderNo}？`);
    expect(callsFor(fetchMock, 'POST', cancelUrl)).toHaveLength(0);

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: `确认取消 ${PENDING_ORDER.orderNo}` }));
    await findOrderStatus('已取消');

    const [cancelCall] = callsFor(fetchMock, 'POST', cancelUrl);
    expect(JSON.parse(String((cancelCall?.[1] as RequestInit).body))).toEqual({
      version: 1,
      cancelReason: '顾客取消',
    });
  });

  it('shows a Chinese conflict and reloads the list after a 409', async () => {
    let orderLoads = 0;
    const fetchMock = await renderOrders({
      'GET /api/v1/orders': () => {
        orderLoads += 1;
        return successResponse({ items: orderLoads === 1 ? [PENDING_ORDER] : [ACCEPTED_ORDER] });
      },
      [`POST /api/v1/orders/${PENDING_ORDER.id}/accept`]: () =>
        errorResponse('CONFLICT', 409, { reason: 'VERSION_MISMATCH', currentVersion: 2 }),
    });

    fireEvent.click(screen.getByRole('button', { name: `接单 ${PENDING_ORDER.orderNo}` }));

    expect(await screen.findByText('订单状态已变更，已刷新列表，请重试')).toBeInTheDocument();
    await findOrderStatus('已接单');
    expect(callsFor(fetchMock, 'GET', '/api/v1/orders')).toHaveLength(2);
  });

  it('uses the existing session-expiry flow on a 401', async () => {
    await renderOrders({
      [`POST /api/v1/orders/${PENDING_ORDER.id}/accept`]: () => errorResponse('UNAUTHORIZED', 401),
    });

    fireEvent.click(screen.getByRole('button', { name: `接单 ${PENDING_ORDER.orderNo}` }));

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();
  });
});
