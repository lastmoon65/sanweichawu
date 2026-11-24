import { ApiError } from '../services/api-client';

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: '网络连接失败，请稍后重试',
  WECHAT_NOT_CONFIGURED: '微信登录尚未配置，请联系店员',
  WECHAT_LOGIN_FAILED: '微信登录失败，请重试',
  WECHAT_RATE_LIMITED: '登录请求过于频繁，请稍后重试',
  WECHAT_UNAVAILABLE: '微信登录暂时不可用，请稍后重试',
  CUSTOMER_DISABLED: '当前顾客账号已停用，请联系店员',
  TABLE_NOT_AVAILABLE: '桌码无效或该桌尚未开台，请核对后重试',
  SESSION_NOT_AVAILABLE: '桌台信息已失效，请重新扫码',
  SESSION_CLOSED: '该桌台已结台，无法继续点单',
  IDEMPOTENCY_KEY_REUSED: '订单提交冲突，请返回购物车后重新提交',
  VALIDATION_ERROR: '提交内容有误，请检查后重试',
  UNAUTHORIZED: '登录已过期，请重新扫码进入',
  FORBIDDEN: '无权操作该订单',
};

export function customerFacingError(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? '操作失败，请稍后重试';
  }
  return '操作失败，请稍后重试';
}
