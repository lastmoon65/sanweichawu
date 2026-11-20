import { registerDecorator } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

import { parseDecimalBigIntId } from '../auth/store-resource.service.js';

const MAX_BIGINT_SIGNED = 9_223_372_036_854_775_807n;

/**
 * Parses a price expressed in integer fen. JSON integers are accepted when they
 * are safe integers; decimal strings must not contain fractions or exponents.
 */
export function parsePriceFen(value: unknown): bigint | null {
  let parsed: bigint;

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      return null;
    }
    parsed = BigInt(value);
  } else if (typeof value === 'string') {
    if (!/^(0|[1-9]\d*)$/.test(value)) {
      return null;
    }
    parsed = BigInt(value);
  } else {
    return null;
  }

  return parsed <= MAX_BIGINT_SIGNED ? parsed : null;
}

export function parseCategoryId(value: unknown): bigint | null {
  return typeof value === 'string' ? parseDecimalBigIntId(value) : null;
}

export function IsPriceFen(validationOptions?: ValidationOptions) {
  return function decoratePriceFen(object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPriceFen',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return parsePriceFen(value) !== null;
        },
        defaultMessage(): string {
          return 'priceFen must be a non-negative integer amount in fen';
        },
      },
    });
  };
}

export function IsDecimalId(validationOptions?: ValidationOptions) {
  return function decorateDecimalId(object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDecimalId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && parseDecimalBigIntId(value) !== null;
        },
        defaultMessage(): string {
          return `${propertyName} must be a decimal id string`;
        },
      },
    });
  };
}

export function ForbiddenInventoryMode(validationOptions?: ValidationOptions) {
  return function decorateForbiddenInventoryMode(object: object, propertyName: string): void {
    registerDecorator({
      name: 'forbiddenInventoryMode',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(): boolean {
          return false;
        },
        defaultMessage(): string {
          return 'inventoryMode is managed by the service and must not be provided';
        },
      },
    });
  };
}
