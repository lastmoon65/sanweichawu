import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  AuthRequestError,
  INVALID_CREDENTIALS_MESSAGE,
  InvalidCredentialsError,
  LOGIN_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  NetworkError,
  SESSION_EXPIRED_MESSAGE,
  STAFF_SESSION_TOKEN_KEY,
  UnauthorizedSessionError,
  getCurrentStaff,
  loginStaff,
} from './staff-auth';
import type { Staff, StaffRole } from './staff-auth';

type AuthStatus = 'checking' | 'signed-out' | 'signed-in';

interface FieldErrors {
  username?: string;
  password?: string;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: '店主',
  MANAGER: '店长',
  STAFF: '员工',
};

function BrandHeader() {
  return (
    <header className="brand-block">
      <span className="eyebrow">SANWEI TEA HOUSE</span>
      <h1>三味茶屋</h1>
      <p>员工账号登录，管理今日茶事。</p>
    </header>
  );
}

export function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY) ? 'checking' : 'signed-out',
  );
  const [staff, setStaff] = useState<Staff | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authStatus !== 'checking') {
      return;
    }

    const accessToken = sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY);
    if (!accessToken) {
      setAuthStatus('signed-out');
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      try {
        const currentStaff = await getCurrentStaff(accessToken);
        if (!cancelled) {
          setStaff(currentStaff);
          setAuthStatus('signed-in');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        sessionStorage.removeItem(STAFF_SESSION_TOKEN_KEY);
        setStaff(null);

        if (error instanceof UnauthorizedSessionError) {
          setFormError(SESSION_EXPIRED_MESSAGE);
        } else if (error instanceof NetworkError) {
          setFormError(NETWORK_ERROR_MESSAGE);
        } else if (error instanceof AuthRequestError) {
          setFormError(LOGIN_ERROR_MESSAGE);
        }

        setAuthStatus('signed-out');
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const trimmedUsername = username.trim();
    const nextErrors: FieldErrors = {};

    if (!trimmedUsername) {
      nextErrors.username = '请输入用户名';
    }
    if (!password) {
      nextErrors.password = '请输入密码';
    }

    if (nextErrors.username || nextErrors.password) {
      setFieldErrors(nextErrors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      const session = await loginStaff(trimmedUsername, password);
      sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, session.accessToken);
      setStaff(session.staff);
      setPassword('');
      setAuthStatus('signed-in');
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        setFormError(INVALID_CREDENTIALS_MESSAGE);
      } else if (error instanceof NetworkError) {
        setFormError(NETWORK_ERROR_MESSAGE);
      } else {
        setFormError(LOGIN_ERROR_MESSAGE);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STAFF_SESSION_TOKEN_KEY);
    setStaff(null);
    setUsername('');
    setPassword('');
    setFieldErrors({});
    setFormError(null);
    setAuthStatus('signed-out');
  };

  if (authStatus === 'checking') {
    return (
      <main className="app-shell app-shell--checking">
        <section className="session-card" role="status">
          <span className="status-dot" aria-hidden="true" />
          <p>正在恢复登录状态…</p>
        </section>
      </main>
    );
  }

  if (authStatus === 'signed-in' && staff) {
    return (
      <main className="app-shell">
        <BrandHeader />

        <section className="staff-card" aria-labelledby="staff-welcome">
          <span className="eyebrow">SIGNED IN</span>
          <h2 id="staff-welcome">欢迎回来</h2>
          <dl className="staff-details">
            <div>
              <dt>姓名</dt>
              <dd>{staff.name}</dd>
            </div>
            <div>
              <dt>角色</dt>
              <dd className="role-value">
                <span>{ROLE_LABELS[staff.role]}</span>
                <span className="role-code">{staff.role}</span>
              </dd>
            </div>
            <div>
              <dt>用户名</dt>
              <dd>{staff.username}</dd>
            </div>
          </dl>
          <button className="secondary-button" type="button" onClick={handleLogout}>
            退出登录
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell app-shell--auth">
      <div className="auth-layout">
        <BrandHeader />

        <section className="auth-card" aria-labelledby="login-title">
          <div className="auth-card-heading">
            <span className="eyebrow">STAFF ACCESS</span>
            <h2 id="login-title">员工登录</h2>
            <p>请使用商家员工账号进入工作台。</p>
          </div>

          <form className="login-form" noValidate onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="username">用户名</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setFieldErrors((current) => ({ ...current, username: undefined }));
                }}
              />
              {fieldErrors.username ? (
                <p className="field-error" id="username-error" role="alert">
                  {fieldErrors.username}
                </p>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="password">密码</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                }}
              />
              {fieldErrors.password ? (
                <p className="field-error" id="password-error" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="form-error" role="alert">
                {formError}
              </p>
            ) : null}

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
