import { randomUUID } from 'node:crypto';

import { REQUEST_ID_HEADER } from './api-response.js';
import { writeStructuredLog } from '../infrastructure/logging/structured-logger.js';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  path?: string;
  originalUrl?: string;
  requestId?: string;
}

interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
}

type NextFunction = () => void;

export function createRequestId(): string {
  return randomUUID();
}

export function resolveRequestId(value: string | string[] | undefined): string {
  const incoming = Array.isArray(value) ? value[0] : value;
  const normalized = incoming?.trim();
  return normalized ? normalized : createRequestId();
}

export function requestIdMiddleware(
  request: RequestLike,
  response: ResponseLike,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);
  const startedAt = Date.now();
  const path = request.path ?? request.originalUrl?.split('?')[0] ?? '';

  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.on('finish', () => {
    writeStructuredLog(
      'info',
      'http_request',
      {
        method: request.method ?? '',
        path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      },
      requestId,
    );
  });

  next();
}
