import { describe, expect, it } from 'vitest';

import { formatOrderStatus, formatShanghaiDateTime } from '../src/utils/datetime';

describe('Shanghai date-time formatting', () => {
  it('formats UTC instants as Asia/Shanghai wall-clock time', () => {
    expect(formatShanghaiDateTime('2026-11-24T03:04:05.000Z')).toBe('2026-11-24 11:04');
    expect(formatShanghaiDateTime(Date.parse('2026-11-24T15:59:00.000Z'))).toBe('2026-11-24 23:59');
  });

  it('rolls over to the next calendar day correctly', () => {
    expect(formatShanghaiDateTime('2026-11-24T17:30:00.000Z')).toBe('2026-11-25 01:30');
    expect(formatShanghaiDateTime('2026-12-31T16:00:00.000Z')).toBe('2027-01-01 00:00');
  });

  it('returns an empty string for invalid timestamps and localizes statuses', () => {
    expect(formatShanghaiDateTime('not-a-date')).toBe('');
    expect(formatOrderStatus('PENDING_ACCEPTANCE')).toBe('待接单');
    expect(formatOrderStatus('PREPARING')).toBe('制作中');
    expect(formatOrderStatus('UNKNOWN')).toBe('状态未知');
  });
});
