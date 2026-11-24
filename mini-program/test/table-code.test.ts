import { describe, expect, it } from 'vitest';

import { parseTableCode } from '../src/utils/table-code';

describe('parseTableCode', () => {
  it('accepts a plain table code and trims surrounding whitespace', () => {
    expect(parseTableCode('  SW013-A1  ')).toBe('SW013-A1');
  });

  it('extracts tableCode, table, or code query parameters from QR URLs', () => {
    expect(parseTableCode('https://tea.example/menu?tableCode=SW013-A1')).toBe('SW013-A1');
    expect(parseTableCode('weixin://scan?table=A%32')).toBe('A2');
    expect(parseTableCode('https://tea.example/order?code=VIP-01&from=qr')).toBe('VIP-01');
  });

  it('extracts the final segment from table or tables paths', () => {
    expect(parseTableCode('https://tea.example/tables/A1')).toBe('A1');
    expect(parseTableCode('sanweichawu://table/B2?x=1')).toBe('B2');
  });

  it('rejects empty, whitespace, malformed, and overlong table codes', () => {
    expect(parseTableCode('')).toBeNull();
    expect(parseTableCode('A 1')).toBeNull();
    expect(parseTableCode('https://tea.example/tables/%E0%A4%A')).toBeNull();
    expect(parseTableCode('X'.repeat(41))).toBeNull();
  });
});
