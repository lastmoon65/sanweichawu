import { describe, expect, it } from 'vitest';

import { formatDateTime } from '../src/format-time';

describe('formatDateTime', () => {
  it('formats UTC timestamps in Asia/Shanghai to minute precision', () => {
    expect(formatDateTime('2026-11-20T03:04:05.678Z')).toBe('2026-11-20 11:04');
  });

  it('rolls over the calendar date when Shanghai time crosses midnight', () => {
    expect(formatDateTime('2026-11-20T17:30:00.000Z')).toBe('2026-11-21 01:30');
  });

  it('returns invalid input unchanged and uses a dash for empty input', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('')).toBe('—');
  });
});
