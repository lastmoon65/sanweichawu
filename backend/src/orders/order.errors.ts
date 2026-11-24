import { BadRequestException, ConflictException } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';

import { VALIDATION_ERROR_CODE } from '../common/pipes/api-validation.pipe.js';

export const ORDER_CONFLICT_CODE = 'CONFLICT';

export function invalidOrderInput(field: string, message: string): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details: [{ field, messages: [message] }],
  });
}

export function invalidOrderStatus(): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details: [{ field: 'status', messages: ['status must be a valid order status'] }],
  });
}

export function invalidOrderFilter(field: string, message: string): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details: [{ field, messages: [message] }],
  });
}

export function orderIdempotencyKeyReused(): ConflictException {
  return new ConflictException({
    code: ORDER_CONFLICT_CODE,
    message: 'Idempotency key has already been used for a different order',
    details: { reason: 'IDEMPOTENCY_KEY_REUSED' },
  });
}

export function productUnavailable(
  variantId: bigint | string,
  reason = 'PRODUCT_UNAVAILABLE',
): ConflictException {
  return new ConflictException({
    code: ORDER_CONFLICT_CODE,
    message: 'One or more order items are unavailable',
    details: { reason, variantId: variantId.toString() },
  });
}

export function orderVersionConflict(
  currentVersion: number,
  currentStatus: OrderStatus,
): ConflictException {
  return new ConflictException({
    code: ORDER_CONFLICT_CODE,
    message: 'Order version conflict',
    details: { reason: 'VERSION_MISMATCH', currentVersion, currentStatus },
  });
}

export function invalidOrderTransition(
  currentVersion: number,
  currentStatus: OrderStatus,
): ConflictException {
  return new ConflictException({
    code: ORDER_CONFLICT_CODE,
    message: 'Order status transition is not allowed',
    details: { reason: 'INVALID_TRANSITION', currentVersion, currentStatus },
  });
}
