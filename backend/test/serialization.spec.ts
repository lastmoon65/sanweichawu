import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { jsonReplacer, jsonStringify } from '../src/common/serializers/json.serializer.js';

describe('JSON serialization', () => {
  it('serializes BigInt identifiers and integer-fen money as decimal strings', () => {
    const payload = {
      storeId: 9007199254740993n,
      totalAmountFen: 9007199254740993n,
    };

    const serialized = JSON.parse(jsonStringify(payload)) as Record<string, string>;

    expect(serialized).toEqual({
      storeId: '9007199254740993',
      totalAmountFen: '9007199254740993',
    });
    expect(typeof serialized.storeId).toBe('string');
    expect(typeof serialized.totalAmountFen).toBe('string');
  });

  it('serializes Prisma Decimal quantities and costs as exact strings', () => {
    const payload = {
      quantity: new Prisma.Decimal('1234567890.123'),
      averageCostPerUnit: new Prisma.Decimal('0.123456789012345678'),
    };

    const serialized = JSON.parse(jsonStringify(payload)) as Record<string, string>;

    expect(serialized).toEqual({
      quantity: '1234567890.123',
      averageCostPerUnit: '0.123456789012345678',
    });
    expect(typeof serialized.quantity).toBe('string');
    expect(typeof serialized.averageCostPerUnit).toBe('string');
  });

  it('handles BigInt and Decimal values passed directly to the replacer', () => {
    expect(jsonReplacer('id', 42n)).toBe('42');
    expect(jsonReplacer('quantity', new Prisma.Decimal('0.300'))).toBe('0.3');
  });
});
