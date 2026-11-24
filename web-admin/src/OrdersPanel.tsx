import { useEffect, useState } from 'react';

import { listDiningSessions } from './dining-sessions';
import type { DiningSession } from './dining-sessions';
import { listDiningTables } from './dining-tables';
import type { DiningTable } from './dining-tables';
import { formatDateTime } from './format-time';
import { OrderRequestError, actOnOrder, listOrders } from './orders';
import type { Order, OrderStatus } from './orders';
import { formatFenAsYuan } from './product-menu';
import { NETWORK_ERROR_MESSAGE, NetworkError, UnauthorizedSessionError } from './staff-auth';

interface OrdersPanelProps {
  readonly accessToken: string;
  readonly onSessionExpired: () => void;
}

const ORDER_LOAD_ERROR_MESSAGE = '订单加载失败，请稍后重试';
const ORDER_ACTION_ERROR_MESSAGE = '订单操作失败，请稍后重试';
const ORDER_CONFLICT_MESSAGE = '订单状态已变更，已刷新列表，请重试';
const ORDER_FORBIDDEN_MESSAGE = '无权操作该订单';
const ORDER_VALIDATION_MESSAGE = '请求参数有误';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_ACCEPTANCE: '待接单',
  ACCEPTED: '已接单',
  PREPARING: '制作中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const FILTER_STATUSES: OrderStatus[] = [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'PREPARING',
  'COMPLETED',
  'CANCELLED',
];

function actionErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (error instanceof OrderRequestError) {
    if (error.status === 409) {
      return ORDER_CONFLICT_MESSAGE;
    }
    if (error.code === 'FORBIDDEN') {
      return ORDER_FORBIDDEN_MESSAGE;
    }
    if (error.code === 'VALIDATION_ERROR') {
      return ORDER_VALIDATION_MESSAGE;
    }
  }
  return ORDER_ACTION_ERROR_MESSAGE;
}

export function OrdersPanel({ accessToken, onSessionExpired }: OrdersPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [sessions, setSessions] = useState<DiningSession[]>([]);
  const [sessionFilter, setSessionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDiningSessions(accessToken, 'OPEN'), listDiningTables(accessToken)])
      .then(([sessionItems, tableItems]) => {
        if (!cancelled) {
          setSessions(sessionItems.filter((session) => session.status === 'OPEN'));
          setTables(tableItems);
        }
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof UnauthorizedSessionError) {
          if (!cancelled) {
            onSessionExpired();
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, onSessionExpired]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listOrders(accessToken, {
      ...(sessionFilter ? { sessionId: sessionFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    })
      .then((items) => {
        if (!cancelled) {
          setOrders(items);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof UnauthorizedSessionError) {
          onSessionExpired();
          return;
        }
        setLoadError(
          error instanceof NetworkError ? NETWORK_ERROR_MESSAGE : ORDER_LOAD_ERROR_MESSAGE,
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, onSessionExpired, sessionFilter, statusFilter]);

  const refreshOrders = async (): Promise<void> => {
    const items = await listOrders(accessToken, {
      ...(sessionFilter ? { sessionId: sessionFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    setOrders(items);
  };

  const handleAction = async (
    order: Order,
    action: 'accept' | 'start' | 'complete',
  ): Promise<void> => {
    if (busyOrderId !== null) {
      return;
    }
    setBusyOrderId(order.id);
    setActionError(null);
    try {
      const updated = await actOnOrder(accessToken, order.id, action, order.version);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
        return;
      }
      setActionError(actionErrorMessage(error));
      if (error instanceof OrderRequestError && error.status === 409) {
        try {
          await refreshOrders();
        } catch (refreshError) {
          if (refreshError instanceof UnauthorizedSessionError) {
            onSessionExpired();
          }
        }
      }
    } finally {
      setBusyOrderId(null);
    }
  };

  const beginCancel = (order: Order): void => {
    setCancellingOrderId(order.id);
    setCancelReason('');
    setCancelReasonError(null);
    setActionError(null);
  };

  const submitCancel = async (order: Order): Promise<void> => {
    if (busyOrderId !== null) {
      return;
    }
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelReasonError('请输入取消原因');
      return;
    }
    if (reason.length > 500) {
      setCancelReasonError('取消原因不能超过500个字符');
      return;
    }
    if (!window.confirm(`确认取消订单 ${order.orderNo}？`)) {
      return;
    }

    setCancelReasonError(null);
    setBusyOrderId(order.id);
    setActionError(null);
    try {
      const updated = await actOnOrder(accessToken, order.id, 'cancel', order.version, reason);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setCancellingOrderId(null);
      setCancelReason('');
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
        return;
      }
      setActionError(actionErrorMessage(error));
      if (error instanceof OrderRequestError && error.status === 409) {
        setCancellingOrderId(null);
        try {
          await refreshOrders();
        } catch (refreshError) {
          if (refreshError instanceof UnauthorizedSessionError) {
            onSessionExpired();
          }
        }
      }
    } finally {
      setBusyOrderId(null);
    }
  };

  const tableById = new Map(tables.map((table) => [table.id, table]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  return (
    <section className="tables-card" aria-labelledby="orders-title">
      <div className="tables-heading">
        <div>
          <span className="eyebrow">ORDERS</span>
          <h2 id="orders-title">订单管理</h2>
        </div>
        <p>{loading ? '正在加载…' : `共 ${orders.length} 笔订单`}</p>
      </div>

      <div className="order-filters">
        <div className="form-field">
          <label htmlFor="order-session-filter">桌单</label>
          <select
            id="order-session-filter"
            value={sessionFilter}
            onChange={(event) => setSessionFilter(event.target.value)}
          >
            <option value="">全部桌单</option>
            {sessions.map((session) => {
              const table = tableById.get(session.tableId);
              return (
                <option key={session.id} value={session.id}>
                  {table ? `${table.name}（${table.code}）` : `桌单 ${session.id}`}
                </option>
              );
            })}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="order-status-filter">状态</label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as OrderStatus | '')}
          >
            <option value="">全部状态</option>
            {FILTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {!loading && !loadError && orders.length === 0 ? (
        <p className="empty-state">暂无符合条件的订单。</p>
      ) : null}

      {orders.length > 0 ? (
        <div className="table-scroll">
          <table className="tables-list" aria-label="订单列表">
            <thead>
              <tr>
                <th scope="col">订单号</th>
                <th scope="col">桌位 / 桌单</th>
                <th scope="col">状态</th>
                <th scope="col">金额</th>
                <th scope="col">下单时间</th>
                <th scope="col">明细</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const session = order.sessionId ? sessionById.get(order.sessionId) : undefined;
                const table = session ? tableById.get(session.tableId) : undefined;
                return (
                  <tr key={order.id}>
                    <td>{order.orderNo}</td>
                    <td>
                      {table ? `${table.name}（${table.code}）` : '桌单'}
                      {order.sessionId ? (
                        <span className="order-session-id"> #{order.sessionId}</span>
                      ) : null}
                    </td>
                    <td>{STATUS_LABELS[order.status]}</td>
                    <td>¥{formatFenAsYuan(order.totalAmountFen)}</td>
                    <td className="table-time">{formatDateTime(order.createdAt)}</td>
                    <td>
                      <ul className="order-detail-list">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            {item.productNameSnapshot} / {item.variantNameSnapshot} ×{' '}
                            {item.quantity}
                            <span className="order-session-id">
                              {' '}
                              ¥{formatFenAsYuan(item.lineSubtotalFen)}
                            </span>
                            {item.remark ? <span>（{item.remark}）</span> : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <div className="row-actions">
                        {order.status === 'PENDING_ACCEPTANCE' ? (
                          <button
                            className="text-button"
                            type="button"
                            aria-label={`接单 ${order.orderNo}`}
                            disabled={busyOrderId !== null}
                            onClick={() => void handleAction(order, 'accept')}
                          >
                            接单
                          </button>
                        ) : null}
                        {order.status === 'ACCEPTED' ? (
                          <button
                            className="text-button"
                            type="button"
                            aria-label={`开始制作 ${order.orderNo}`}
                            disabled={busyOrderId !== null}
                            onClick={() => void handleAction(order, 'start')}
                          >
                            开始制作
                          </button>
                        ) : null}
                        {order.status === 'PREPARING' ? (
                          <button
                            className="text-button"
                            type="button"
                            aria-label={`完成 ${order.orderNo}`}
                            disabled={busyOrderId !== null}
                            onClick={() => void handleAction(order, 'complete')}
                          >
                            完成
                          </button>
                        ) : null}
                        {order.status === 'PENDING_ACCEPTANCE' ||
                        order.status === 'ACCEPTED' ||
                        order.status === 'PREPARING' ? (
                          <button
                            className="text-button text-button--danger"
                            type="button"
                            aria-label={`取消订单 ${order.orderNo}`}
                            disabled={busyOrderId !== null}
                            onClick={() => beginCancel(order)}
                          >
                            取消
                          </button>
                        ) : null}
                      </div>
                      {cancellingOrderId === order.id ? (
                        <div className="order-cancel-form">
                          <label htmlFor={`cancel-reason-${order.id}`}>取消原因</label>
                          <input
                            id={`cancel-reason-${order.id}`}
                            type="text"
                            maxLength={500}
                            value={cancelReason}
                            aria-invalid={Boolean(cancelReasonError)}
                            onChange={(event) => {
                              setCancelReason(event.target.value);
                              setCancelReasonError(null);
                            }}
                          />
                          {cancelReasonError ? (
                            <p className="field-error" role="alert">
                              {cancelReasonError}
                            </p>
                          ) : null}
                          <div className="row-actions">
                            <button
                              className="text-button text-button--danger"
                              type="button"
                              aria-label={`确认取消 ${order.orderNo}`}
                              disabled={busyOrderId !== null}
                              onClick={() => void submitCancel(order)}
                            >
                              确认取消
                            </button>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => setCancellingOrderId(null)}
                            >
                              放弃
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
