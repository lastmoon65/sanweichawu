import { BadRequestException, ConflictException } from '@nestjs/common';

import { VALIDATION_ERROR_CODE } from '../common/pipes/api-validation.pipe.js';

export const TABLE_REFERENCED_CODE = 'TABLE_REFERENCED';

export function invalidDiningTableInput(errorCode: 'INVALID_FIELD' | 'EMPTY_UPDATE') {
  return new BadRequestException({
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details:
      errorCode === 'EMPTY_UPDATE'
        ? [{ field: 'name', messages: ['At least one of name or code must be provided'] }]
        : null,
  });
}

export function diningTableCodeConflict(): ConflictException {
  return new ConflictException({
    code: 'CONFLICT',
    message: 'Dining table code already exists',
    details: { field: 'code' },
  });
}

export function diningTableReferenced(): ConflictException {
  return new ConflictException({
    code: TABLE_REFERENCED_CODE,
    message: 'Dining table has dining sessions and cannot be deleted',
    details: null,
  });
}
