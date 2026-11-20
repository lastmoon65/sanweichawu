import { BadRequestException, ConflictException } from '@nestjs/common';

import { VALIDATION_ERROR_CODE } from '../common/pipes/api-validation.pipe.js';

export const CATEGORY_REFERENCED_CODE = 'CATEGORY_REFERENCED';
export const PRODUCT_REFERENCED_CODE = 'PRODUCT_REFERENCED';
export const VARIANT_REFERENCED_CODE = 'VARIANT_REFERENCED';

export function invalidMenuInput(details: unknown = null): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_ERROR_CODE,
    message: 'Request validation failed',
    details,
  });
}

export function emptyUpdate(fields: readonly string[]): BadRequestException {
  return invalidMenuInput([
    {
      field: 'body',
      messages: [`At least one of ${fields.join(', ')} must be provided`],
    },
  ]);
}

export function lastVariantRequired(): BadRequestException {
  return invalidMenuInput([
    {
      field: 'variants',
      messages: ['A product must keep at least one variant'],
    },
  ]);
}

export function nameConflict(): ConflictException {
  return new ConflictException({
    code: 'CONFLICT',
    message: 'Name already exists',
    details: { field: 'name' },
  });
}

export function categoryReferenced(): ConflictException {
  return new ConflictException({
    code: CATEGORY_REFERENCED_CODE,
    message: 'Category has products and cannot be deleted',
    details: null,
  });
}

export function productReferenced(): ConflictException {
  return new ConflictException({
    code: PRODUCT_REFERENCED_CODE,
    message: 'Product has order records and cannot be deleted',
    details: null,
  });
}

export function variantReferenced(): ConflictException {
  return new ConflictException({
    code: VARIANT_REFERENCED_CODE,
    message: 'Variant has order records and cannot be deleted',
    details: null,
  });
}
