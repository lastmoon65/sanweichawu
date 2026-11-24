import { BadRequestException, NotFoundException } from '@nestjs/common';

import { VALIDATION_ERROR_CODE } from '../common/pipes/api-validation.pipe.js';

export const TABLE_NOT_AVAILABLE_CODE = 'TABLE_NOT_AVAILABLE';
export const SESSION_NOT_AVAILABLE_CODE = 'SESSION_NOT_AVAILABLE';

export function tableNotAvailable(): NotFoundException {
  return new NotFoundException({
    code: TABLE_NOT_AVAILABLE_CODE,
    message: 'Table is not available for ordering',
    details: null,
  });
}

export function sessionNotAvailable(): NotFoundException {
  return new NotFoundException({
    code: SESSION_NOT_AVAILABLE_CODE,
    message: 'Dining session is not available',
    details: null,
  });
}

export function invalidSessionId(): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details: [{ field: 'sessionId', messages: ['sessionId must be a decimal id string'] }],
  });
}
