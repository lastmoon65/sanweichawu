import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import { STAFF_SESSION_TOKEN_KEY } from '../src/staff-auth';
import type { Staff, StaffLoginResult } from '../src/staff-auth';

const STAFF: Staff = {
  staffId: 'staff-test-001',
  storeId: 'store-test-001',
  role: 'MANAGER',
  name: '林晓',
  username: 'manager.lin',
};

const LOGIN_RESULT: StaffLoginResult = {
  accessToken: 'fake-access-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  staff: STAFF,
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

function fillLoginForm(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('用户名'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: password } });
}

function submitLogin() {
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
}

describe('App staff authentication', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders the staff login form without a WeChat entry', () => {
    const fetchMock = stubFetch();

    render(<App />);

    expect(screen.getByRole('heading', { name: '三味茶屋' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '员工登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.queryByText(/微信/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs in, trims the username, preserves the password, and restores with a Bearer token', async () => {
    const fetchMock = stubFetch(successResponse(LOGIN_RESULT), successResponse(STAFF));

    render(<App />);
    fillLoginForm('  manager.lin  ', '  tea-password  ');
    submitLogin();

    expect(await screen.findByText(STAFF.name)).toBeInTheDocument();
    expect(screen.getByText('店长')).toBeInTheDocument();
    expect(screen.getByText('MANAGER')).toBeInTheDocument();
    expect(screen.getByText(STAFF.username)).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBe('fake-access-token');

    const loginCall = fetchMock.mock.calls[0];
    expect(loginCall).toBeDefined();
    const [loginUrl, loginInit] = loginCall as [string, RequestInit];
    expect(loginUrl).toBe('/api/v1/auth/staff/login');
    expect(loginInit.method).toBe('POST');
    expect(loginInit.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(loginInit.body))).toEqual({
      username: 'manager.lin',
      password: '  tea-password  ',
    });

    cleanup();
    render(<App />);

    expect(await screen.findByText(STAFF.name)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const meCall = fetchMock.mock.calls[1];
    expect(meCall).toBeDefined();
    const [meUrl, meInit] = meCall as [string, RequestInit];
    expect(meUrl).toBe('/api/v1/auth/staff/me');
    expect(meInit).toEqual({
      headers: { Authorization: 'Bearer fake-access-token' },
    });
  });

  it.each([
    { label: 'a 401 with INVALID_CREDENTIALS', status: 401, code: 'INVALID_CREDENTIALS' },
    { label: 'any other 401', status: 401, code: 'UNAUTHORIZED' },
    { label: 'INVALID_CREDENTIALS on another status', status: 400, code: 'INVALID_CREDENTIALS' },
  ])('shows one credential error for $label', async ({ status, code }) => {
    const fetchMock = stubFetch(errorResponse(code, status));

    render(<App />);
    fillLoginForm('manager.lin', 'wrong-password');
    submitLogin();

    expect(await screen.findByText('用户名或密码不正确')).toBeInTheDocument();
    expect(screen.queryByText(/账户锁定|停用/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the network error when login fetch fails', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fillLoginForm('manager.lin', 'tea-password');
    submitLogin();

    expect(await screen.findByText('网络异常，请稍后重试')).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();
  });

  it.each([
    {
      label: 'both fields empty',
      username: '',
      password: '',
      messages: ['请输入用户名', '请输入密码'],
    },
    {
      label: 'username is whitespace',
      username: '   ',
      password: 'tea-password',
      messages: ['请输入用户名'],
    },
    {
      label: 'password is empty',
      username: 'manager.lin',
      password: '',
      messages: ['请输入密码'],
    },
  ])('rejects $label without requesting the API', ({ username, password, messages }) => {
    const fetchMock = stubFetch();

    render(<App />);
    fillLoginForm(username, password);
    submitLogin();

    for (const message of messages) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears a stored token and returns to login when /me responds with 401', async () => {
    sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'expired-fake-token');
    const fetchMock = stubFetch(errorResponse('UNAUTHORIZED', 401));

    render(<App />);

    expect(await screen.findByLabelText('用户名')).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();

    const meCall = fetchMock.mock.calls[0];
    expect(meCall).toBeDefined();
    const [meUrl, meInit] = meCall as [string, RequestInit];
    expect(meUrl).toBe('/api/v1/auth/staff/me');
    expect(meInit).toEqual({
      headers: { Authorization: 'Bearer expired-fake-token' },
    });
  });

  it('restores a valid session and logs out locally without a server request', async () => {
    sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'restored-fake-token');
    const fetchMock = stubFetch(successResponse(STAFF));

    render(<App />);

    expect(await screen.findByText(STAFF.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }));

    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
