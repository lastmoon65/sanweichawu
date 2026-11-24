import { useEffect, useState } from 'react';

import { listDiningTables } from './dining-tables';
import type { DiningTable } from './dining-tables';
import {
  DiningSessionRequestError,
  closeDiningSession,
  listDiningSessions,
  openDiningSession,
} from './dining-sessions';
import type { DiningSession } from './dining-sessions';
import { formatDateTime } from './format-time';
import { NETWORK_ERROR_MESSAGE, NetworkError, UnauthorizedSessionError } from './staff-auth';

interface DiningSessionsPanelProps {
  readonly accessToken: string;
  readonly onSessionExpired: () => void;
}

interface BusyState {
  readonly tableId: string;
  readonly action: 'open' | 'close';
}

const SESSION_ALREADY_OPEN_MESSAGE = '该桌已开台';
const SESSION_CLOSED_MESSAGE = '桌单已关台';
const SESSION_CONFLICT_MESSAGE = '数据已变更，请刷新后重试';
const SESSION_HAS_ORDERS_MESSAGE = '该桌单已有订单，无法关台';
const SESSION_FORBIDDEN_MESSAGE = '无权操作该桌位';
const SESSION_VALIDATION_MESSAGE = '请求参数有误';
const SESSION_LOAD_ERROR_MESSAGE = '桌台状态加载失败，请稍后重试';
const SESSION_REFRESH_ERROR_MESSAGE = '桌台状态刷新失败，请稍后重试';
const SESSION_ACTION_ERROR_MESSAGE = '操作失败，请稍后重试';

interface DiningSessionViewState {
  readonly tables: DiningTable[];
  readonly sessions: DiningSession[];
}

function sortTables(tables: DiningTable[]): DiningTable[] {
  return [...tables].sort((left, right) => {
    const codeComparison = left.code.localeCompare(right.code);
    if (codeComparison !== 0) {
      return codeComparison;
    }
    if (left.id.length !== right.id.length) {
      return left.id.length - right.id.length;
    }
    return left.id.localeCompare(right.id);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSessionHasOrdersError(error: DiningSessionRequestError): boolean {
  return isRecord(error.details) && error.details.reason === 'SESSION_HAS_ORDERS';
}

function actionErrorMessage(error: unknown, action: 'open' | 'close'): string {
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (error instanceof DiningSessionRequestError) {
    if (error.code === 'SESSION_ALREADY_OPEN') {
      return SESSION_ALREADY_OPEN_MESSAGE;
    }
    if (error.code === 'SESSION_CLOSED') {
      return SESSION_CLOSED_MESSAGE;
    }
    if (error.code === 'CONFLICT') {
      if (action === 'close' && isSessionHasOrdersError(error)) {
        return SESSION_HAS_ORDERS_MESSAGE;
      }
      return SESSION_CONFLICT_MESSAGE;
    }
    if (error.code === 'FORBIDDEN') {
      return SESSION_FORBIDDEN_MESSAGE;
    }
    if (error.code === 'VALIDATION_ERROR') {
      return SESSION_VALIDATION_MESSAGE;
    }
  }
  return SESSION_ACTION_ERROR_MESSAGE;
}

async function loadDiningSessionViewState(accessToken: string): Promise<DiningSessionViewState> {
  const [tableItems, sessionItems] = await Promise.all([
    listDiningTables(accessToken),
    listDiningSessions(accessToken, 'OPEN'),
  ]);
  return {
    tables: sortTables(tableItems),
    sessions: sessionItems.filter((session) => session.status === 'OPEN'),
  };
}

export function DiningSessionsPanel({ accessToken, onSessionExpired }: DiningSessionsPanelProps) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [sessions, setSessions] = useState<DiningSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState | null>(null);

  const refreshDiningSessionView = async () => {
    try {
      const state = await loadDiningSessionViewState(accessToken);
      setTables(state.tables);
      setSessions(state.sessions);
      setLoadError(null);
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
        return;
      }
      setLoadError(
        error instanceof NetworkError ? NETWORK_ERROR_MESSAGE : SESSION_REFRESH_ERROR_MESSAGE,
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    loadDiningSessionViewState(accessToken)
      .then((state) => {
        if (!cancelled) {
          setTables(state.tables);
          setSessions(state.sessions);
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
          error instanceof NetworkError ? NETWORK_ERROR_MESSAGE : SESSION_LOAD_ERROR_MESSAGE,
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
  }, [accessToken, onSessionExpired]);

  const handleOpen = async (table: DiningTable) => {
    if (busy !== null) {
      return;
    }
    setBusy({ tableId: table.id, action: 'open' });
    setActionError(null);
    try {
      const session = await openDiningSession(accessToken, table.id);
      setSessions((current) => [
        ...current.filter((item) => item.tableId !== session.tableId && item.id !== session.id),
        session,
      ]);
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setActionError(actionErrorMessage(error, 'open'));
        if (error instanceof DiningSessionRequestError && error.status === 409) {
          await refreshDiningSessionView();
        }
      }
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async (table: DiningTable, session: DiningSession) => {
    if (busy !== null) {
      return;
    }
    if (!window.confirm(`确认关闭「${table.name}」的桌单吗？`)) {
      return;
    }

    setBusy({ tableId: table.id, action: 'close' });
    setActionError(null);
    try {
      const closed = await closeDiningSession(accessToken, session.id, session.version);
      setSessions((current) => current.filter((item) => item.id !== closed.id));
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setActionError(actionErrorMessage(error, 'close'));
        if (error instanceof DiningSessionRequestError && error.status === 409) {
          await refreshDiningSessionView();
        }
      }
    } finally {
      setBusy(null);
    }
  };

  const openSessions = new Map(sessions.map((session) => [session.tableId, session]));

  return (
    <section className="tables-card" aria-labelledby="dining-sessions-title">
      <div className="tables-heading">
        <div>
          <span className="eyebrow">DINING SESSIONS</span>
          <h2 id="dining-sessions-title">桌台状态</h2>
        </div>
        <p>{loading ? '正在加载…' : `共 ${tables.length} 张桌位`}</p>
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

      {!loading && !loadError && tables.length === 0 ? (
        <p className="empty-state">暂无桌位，请先在桌位管理中添加桌位。</p>
      ) : null}

      {tables.length > 0 ? (
        <div className="table-scroll">
          <table className="tables-list" aria-label="桌台列表">
            <thead>
              <tr>
                <th scope="col">名称</th>
                <th scope="col">桌码</th>
                <th scope="col">当前桌单</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const session = openSessions.get(table.id);
                const isBusy = busy?.tableId === table.id;
                return (
                  <tr key={table.id}>
                    <td>{table.name}</td>
                    <td>
                      <span className="table-code">{table.code}</span>
                    </td>
                    <td>
                      {session ? (
                        <>
                          <span className="session-status">已开台</span>
                          <span className="table-time">
                            开台时间：{formatDateTime(session.openedAt)}
                          </span>
                        </>
                      ) : (
                        <span className="session-status">空闲</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {session ? (
                          <button
                            className="text-button text-button--danger"
                            type="button"
                            aria-label={`关台 ${table.name}`}
                            disabled={busy !== null}
                            onClick={() => void handleClose(table, session)}
                          >
                            {isBusy && busy?.action === 'close' ? '关台中…' : '关台'}
                          </button>
                        ) : (
                          <button
                            className="text-button"
                            type="button"
                            aria-label={`开台 ${table.name}`}
                            disabled={busy !== null}
                            onClick={() => void handleOpen(table)}
                          >
                            {isBusy && busy?.action === 'open' ? '开台中…' : '开台'}
                          </button>
                        )}
                      </div>
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
