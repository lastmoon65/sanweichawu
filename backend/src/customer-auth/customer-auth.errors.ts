import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export const WECHAT_NOT_CONFIGURED_CODE = 'WECHAT_NOT_CONFIGURED';
export const WECHAT_LOGIN_FAILED_CODE = 'WECHAT_LOGIN_FAILED';
export const WECHAT_RATE_LIMITED_CODE = 'WECHAT_RATE_LIMITED';
export const WECHAT_UNAVAILABLE_CODE = 'WECHAT_UNAVAILABLE';
export const CUSTOMER_DISABLED_CODE = 'CUSTOMER_DISABLED';

export function wechatNotConfigured(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: WECHAT_NOT_CONFIGURED_CODE,
    message: 'WeChat login is not configured',
    details: null,
  });
}

export function wechatLoginFailed(): UnauthorizedException {
  return new UnauthorizedException({
    code: WECHAT_LOGIN_FAILED_CODE,
    message: 'WeChat login failed',
    details: null,
  });
}

export function wechatRateLimited(): HttpException {
  return new HttpException(
    {
      code: WECHAT_RATE_LIMITED_CODE,
      message: 'WeChat login is temporarily rate limited',
      details: null,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export function wechatUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: WECHAT_UNAVAILABLE_CODE,
    message: 'WeChat login is temporarily unavailable',
    details: null,
  });
}

export function customerDisabled(): ForbiddenException {
  return new ForbiddenException({
    code: CUSTOMER_DISABLED_CODE,
    message: 'Customer account is disabled',
    details: null,
  });
}
