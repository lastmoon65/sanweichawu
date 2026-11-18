import { Prisma } from '@prisma/client';

export function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Prisma.Decimal.isDecimal(value)) {
    return value.toString();
  }

  return value;
}

export function jsonStringify(value: unknown): string {
  return JSON.stringify(value, jsonReplacer);
}
