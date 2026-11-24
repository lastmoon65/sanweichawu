import { describe, expect, it } from 'vitest';

import { generateIdempotencyKey, resolvePendingIdempotency } from '../src/utils/idempotency';

describe('idempotency key reuse', () => {
  it('keeps the same key for an unchanged order signature', () => {
    const first = resolvePendingIdempotency(undefined, 'session-1|11:2', () => 'key-1');
    const retry = resolvePendingIdempotency(first, 'session-1|11:2', () => 'key-2');

    expect(retry).toEqual({ key: 'key-1', signature: 'session-1|11:2' });
  });

  it('uses a new key when the cart or session changes', () => {
    const first = resolvePendingIdempotency(undefined, 'session-1|11:2', () => 'key-1');
    expect(resolvePendingIdempotency(first, 'session-1|11:3', () => 'key-2').key).toBe('key-2');
    expect(resolvePendingIdempotency(first, 'session-2|11:2', () => 'key-3').key).toBe('key-3');
  });

  it('generates unique, bounded keys without cryptographic dependencies', () => {
    const left = generateIdempotencyKey(1_700_000_000_000, () => 0.1);
    const right = generateIdempotencyKey(1_700_000_000_000, () => 0.1);
    expect(left).not.toBe(right);
    expect(left.length).toBeLessThanOrEqual(160);
  });
});
