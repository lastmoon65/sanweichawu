import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  DiningTableRequestError,
  createDiningTable,
  deleteDiningTable,
  listDiningTables,
  updateDiningTable,
} from './dining-tables';
import type { DiningTable } from './dining-tables';
import { formatDateTime } from './format-time';
import { NETWORK_ERROR_MESSAGE, NetworkError, UnauthorizedSessionError } from './staff-auth';

interface DiningTablesPanelProps {
  readonly accessToken: string;
  readonly onSessionExpired: () => void;
}

interface TableFieldErrors {
  name?: string;
  code?: string;
}

const TABLE_CODE_CONFLICT_MESSAGE = '该桌码已被使用';
const TABLE_REFERENCED_MESSAGE = '该桌位已有开台记录，无法删除';
const TABLE_LOAD_ERROR_MESSAGE = '桌位加载失败，请稍后重试';
const TABLE_ACTION_ERROR_MESSAGE = '操作失败，请稍后重试';
const TABLE_VALIDATION_MESSAGE = '桌名或桌码不符合要求';

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

function requestErrorMessage(error: unknown): string | null {
  if (error instanceof UnauthorizedSessionError) {
    return null;
  }
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (error instanceof DiningTableRequestError) {
    if (error.code === 'CONFLICT') {
      return TABLE_CODE_CONFLICT_MESSAGE;
    }
    if (error.code === 'TABLE_REFERENCED') {
      return TABLE_REFERENCED_MESSAGE;
    }
    if (error.code === 'VALIDATION_ERROR') {
      return TABLE_VALIDATION_MESSAGE;
    }
  }
  return TABLE_ACTION_ERROR_MESSAGE;
}

export function DiningTablesPanel({ accessToken, onSessionExpired }: DiningTablesPanelProps) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<TableFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listDiningTables(accessToken)
      .then((items) => {
        if (!cancelled) {
          setTables(sortTables(items));
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
          error instanceof NetworkError ? NETWORK_ERROR_MESSAGE : TABLE_LOAD_ERROR_MESSAGE,
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

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setFieldErrors({});
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    const nextErrors: TableFieldErrors = {};
    if (!trimmedName) {
      nextErrors.name = '请输入桌名';
    } else if (trimmedName.length > 40) {
      nextErrors.name = '桌名不能超过40个字符';
    }
    if (!trimmedCode) {
      nextErrors.code = '请输入桌码';
    } else if (trimmedCode.length > 40) {
      nextErrors.code = '桌码不能超过40个字符';
    }
    if (nextErrors.name || nextErrors.code) {
      setFieldErrors(nextErrors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const saved = editingId
        ? await updateDiningTable(accessToken, editingId, trimmedName, trimmedCode)
        : await createDiningTable(accessToken, trimmedName, trimmedCode);
      setTables((current) =>
        sortTables(
          editingId
            ? current.map((table) => (table.id === editingId ? saved : table))
            : [...current, saved],
        ),
      );
      resetForm();
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setFormError(requestErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (table: DiningTable) => {
    setEditingId(table.id);
    setName(table.name);
    setCode(table.code);
    setFieldErrors({});
    setFormError(null);
  };

  const handleDelete = async (table: DiningTable) => {
    if (deletingId !== null) {
      return;
    }

    setDeletingId(table.id);
    setFormError(null);
    try {
      await deleteDiningTable(accessToken, table.id);
      setTables((current) => current.filter((item) => item.id !== table.id));
      if (editingId === table.id) {
        resetForm();
      }
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setFormError(requestErrorMessage(error));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="tables-card" aria-labelledby="tables-title">
      <div className="tables-heading">
        <div>
          <span className="eyebrow">DINING TABLES</span>
          <h2 id="tables-title">桌位管理</h2>
        </div>
        <p>{loading ? '正在加载…' : `共 ${tables.length} 张桌位`}</p>
      </div>

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && tables.length === 0 ? (
        <p className="empty-state">暂无桌位，请新建第一张桌位。</p>
      ) : null}

      {tables.length > 0 ? (
        <div className="table-scroll">
          <table className="tables-list" aria-label="桌位列表">
            <thead>
              <tr>
                <th scope="col">名称</th>
                <th scope="col">桌码</th>
                <th scope="col">更新时间</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id}>
                  <td>{table.name}</td>
                  <td>
                    <span className="table-code">{table.code}</span>
                  </td>
                  <td className="table-time">{formatDateTime(table.updatedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        type="button"
                        aria-label={`编辑 ${table.name}`}
                        onClick={() => handleEdit(table)}
                      >
                        编辑
                      </button>
                      <button
                        className="text-button text-button--danger"
                        type="button"
                        aria-label={`删除 ${table.name}`}
                        disabled={deletingId !== null}
                        onClick={() => void handleDelete(table)}
                      >
                        {deletingId === table.id ? '删除中…' : '删除'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form
        className="table-form"
        aria-label={editingId ? '编辑桌位' : '新建桌位'}
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="table-form-heading">
          <h3>{editingId ? '编辑桌位' : '新建桌位'}</h3>
          {editingId ? (
            <button className="text-button" type="button" onClick={resetForm}>
              取消编辑
            </button>
          ) : null}
        </div>

        <div className="table-form-fields">
          <div className="form-field">
            <label htmlFor="table-name">桌名</label>
            <input
              id="table-name"
              name="tableName"
              type="text"
              maxLength={40}
              value={name}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'table-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
            />
            {fieldErrors.name ? (
              <p className="field-error" id="table-name-error" role="alert">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor="table-code">桌码</label>
            <input
              id="table-code"
              name="tableCode"
              type="text"
              maxLength={40}
              value={code}
              aria-invalid={Boolean(fieldErrors.code)}
              aria-describedby={fieldErrors.code ? 'table-code-error' : undefined}
              onChange={(event) => {
                setCode(event.target.value);
                setFieldErrors((current) => ({ ...current, code: undefined }));
              }}
            />
            {fieldErrors.code ? (
              <p className="field-error" id="table-code-error" role="alert">
                {fieldErrors.code}
              </p>
            ) : null}
          </div>
        </div>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button className="primary-button table-submit" type="submit" disabled={submitting}>
          {submitting ? '保存中…' : editingId ? '保存修改' : '新建桌位'}
        </button>
      </form>
    </section>
  );
}
