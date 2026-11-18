import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

import type { ApiErrorBody } from '../api-response.js';
import { createRequestId } from '../request-id.middleware.js';
import {
  sanitizeForLog,
  writeStructuredLog,
} from '../../infrastructure/logging/structured-logger.js';

interface RequestLike {
  method?: string;
  path?: string;
  originalUrl?: string;
  requestId?: string;
}

interface ResponseLike {
  headersSent?: boolean;
  status(statusCode: number): ResponseLike;
  json(body: ApiErrorBody): void;
}

interface NormalizedException {
  status: number;
  code: string;
  message: string;
  details: unknown;
}

const STATUS_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeException(exception: unknown): NormalizedException {
  if (!(exception instanceof HttpException)) {
    return {
      status: 500,
      code: STATUS_CODES[500] ?? 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
    };
  }

  const status = exception.getStatus();
  const body = exception.getResponse();

  if (typeof body === 'string') {
    return {
      status,
      code: STATUS_CODES[status] ?? `HTTP_${status}`,
      message: body,
      details: null,
    };
  }

  if (isRecord(body)) {
    const code =
      typeof body.code === 'string' ? body.code : (STATUS_CODES[status] ?? `HTTP_${status}`);
    const responseMessage = body.message;
    const message =
      typeof responseMessage === 'string' && responseMessage.length > 0
        ? responseMessage
        : (STATUS_CODES[status] ?? 'Request failed');

    return {
      status,
      code,
      message,
      details: body.details ?? (Array.isArray(responseMessage) ? responseMessage : null),
    };
  }

  return {
    status,
    code: STATUS_CODES[status] ?? `HTTP_${status}`,
    message: exception.message || (STATUS_CODES[status] ?? 'Request failed'),
    details: null,
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestLike>();
    const response = context.getResponse<ResponseLike>();

    if (response.headersSent) {
      return;
    }

    const requestId = request.requestId ?? createRequestId();
    const normalized = normalizeException(exception);
    const path = request.path ?? request.originalUrl?.split('?')[0] ?? '';

    if (normalized.status >= 500) {
      writeStructuredLog(
        'error',
        'unhandled_exception',
        {
          method: request.method ?? '',
          path,
          statusCode: normalized.status,
          code: normalized.code,
          error: sanitizeForLog(exception),
        },
        requestId,
      );
    } else {
      writeStructuredLog(
        'warn',
        'request_rejected',
        {
          method: request.method ?? '',
          path,
          statusCode: normalized.status,
          code: normalized.code,
        },
        requestId,
      );
    }

    response.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
      },
      requestId,
    });
  }
}
