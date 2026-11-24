import { BadRequestException, ConflictException } from '@nestjs/common';

import { VALIDATION_ERROR_CODE } from '../common/pipes/api-validation.pipe.js';

export const SESSION_ALREADY_OPEN_CODE = 'SESSION_ALREADY_OPEN';
export const SESSION_CLOSED_CODE = 'SESSION_CLOSED';

export function invalidSessionStatus(): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details: [{ field: 'status', messages: ['status must be OPEN or CLOSED'] }],
  });
}

export function sessionAlreadyOpen(): ConflictException {
  return new ConflictException({
    code: SESSION_ALREADY_OPEN_CODE,
    message: 'Dining table already has an open session',
    details: null,
  });
}

export function sessionClosed(): ConflictException {
  return new ConflictException({
    code: SESSION_CLOSED_CODE,
    message: 'Dining session is already closed',
    details: null,
  });
}

export function sessionVersionConflict(currentVersion: number): ConflictException {
  return new ConflictException({
    code: 'CONFLICT',
    message: 'Dining session version conflict',
    details: { currentVersion },
  });
}

export function sessionHasOrders(orderCount: number): ConflictException {
  return new ConflictException({
    code: 'CONFLICT',
    message: 'Dining session has orders and cannot be closed',
    details: { orderCount, reason: 'SESSION_HAS_ORDERS' },
  });
}
