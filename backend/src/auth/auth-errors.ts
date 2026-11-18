import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export const INVALID_CREDENTIALS_CODE = 'INVALID_CREDENTIALS';
export const AUTHENTICATION_REQUIRED_CODE = 'UNAUTHORIZED';
export const FORBIDDEN_CODE = 'FORBIDDEN';

export function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: INVALID_CREDENTIALS_CODE,
    message: 'Invalid username or password',
    details: null,
  });
}

export function authenticationRequired(): UnauthorizedException {
  return new UnauthorizedException({
    code: AUTHENTICATION_REQUIRED_CODE,
    message: 'Authentication required',
    details: null,
  });
}

export function insufficientPermissions(): ForbiddenException {
  return new ForbiddenException({
    code: FORBIDDEN_CODE,
    message: 'Insufficient permissions',
    details: null,
  });
}
