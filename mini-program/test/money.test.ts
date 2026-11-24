import { describe, expect, it } from 'vitest';

import { addFen, formatFen, multiplyFen, normalizeFen } from '../src/utils/money';

describe('integer fen money helpers', () => {
  it('formats fen to yuan with exactly two decimals using string arithmetic', () => {
    expect(formatFen('0')).toBe('0.00');
    expect(formatFen('5')).toBe('0.05');
    expect(formatFen('2300')).toBe('23.00');
    expect(formatFen('123456789')).toBe('1234567.89');
  });

  it('adds and multiplies large integer fen values without floating point loss', () => {
    expect(addFen('9007199254740991', '2')).toBe('9007199254740993');
    expect(multiplyFen('2300', 2)).toBe('4600');
    expect(multiplyFen('999999999999999999', 99)).toBe('98999999999999999901');
  });

  it('rejects negative, decimal, and malformed amounts', () => {
    expect(() => normalizeFen('-1')).toThrow(RangeError);
    expect(() => normalizeFen('1.2')).toThrow(RangeError);
    expect(() => normalizeFen('abc')).toThrow(RangeError);
  });
});
