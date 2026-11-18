import { jsonStringify } from '../../common/serializers/json.serializer.js';

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERN =
  /(authorization|password|passwd|secret|token|openid|session[_-]?key|cookie|database[_-]?url|connection[_-]?string)/i;
const REDACTED = '[REDACTED]';

function sanitizeString(value: string): string {
  return value
    .replace(/\b(mysql2?|postgres(?:ql)?):\/\/[^\s/@]+(?::[^\s/@]*)?@/gi, `$1://${REDACTED}@`)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED);
}

export function sanitizeForLog(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    const sanitizedError: Record<string, unknown> = {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };

    if ('code' in value) {
      sanitizedError.code = sanitizeForLog(value.code, seen);
    }

    if ('cause' in value && value.cause !== undefined) {
      sanitizedError.cause = sanitizeForLog(value.cause, seen);
    }

    return sanitizedError;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, seen));
  }

  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(value)) {
      sanitizedObject[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : sanitizeForLog(childValue, seen);
    }

    return sanitizedObject;
  }

  return value;
}

export function writeStructuredLog(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  requestId = 'system',
): void {
  const record = {
    ...(sanitizeForLog(fields) as Record<string, unknown>),
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId,
  };
  const line = jsonStringify(record);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}
