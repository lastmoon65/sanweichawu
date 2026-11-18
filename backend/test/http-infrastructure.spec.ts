import 'reflect-metadata';

import { ServerResponse } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

import { Prisma } from '@prisma/client';
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { IsInt, IsString } from 'class-validator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { ApiErrorBody, ApiSuccessBody } from '../src/common/api-response.js';
import { configureApplication } from '../src/app.setup.js';
import { APP_CONFIG } from '../src/config/app-config.module.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createTestConfig } from './support/test-config.js';

class EchoPayloadDto {
  @IsString()
  name!: string;

  @IsInt()
  count!: number;
}

@Controller('test-support')
class TestSupportController {
  @Post('validate')
  validate(@Body() payload: EchoPayloadDto): EchoPayloadDto {
    return payload;
  }

  @Get('serialization')
  serialization(): Record<string, unknown> {
    return {
      storeId: 9007199254740993n,
      quantity: new Prisma.Decimal('9876543210.123'),
    };
  }

  @Get('uncaught')
  uncaught(): never {
    const error = new Error('failure at mysql://app:supersecret@127.0.0.1:3306/private_database');
    error.cause = {
      authorization: 'Bearer super-secret-token',
      openid: 'wx-openid-value',
    };
    throw error;
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [EchoPayloadDto],
  TestSupportController.prototype,
  'validate',
);

@Module({ controllers: [TestSupportController] })
class TestSupportModule {}

type ExpressApplication = (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void,
) => void;

interface TestResponse {
  status: number;
  headers: Map<string, string>;
  body: unknown;
}

interface ResponseCapture {
  response: ServerResponse;
  headers: Map<string, string>;
  readBody(): unknown;
}

function createResponse(request: IncomingMessage): ResponseCapture {
  const response = new ServerResponse(request);
  const headers = new Map<string, string>();
  const chunks: Buffer[] = [];

  const appendChunk = (chunk: unknown, encoding?: BufferEncoding): void => {
    if (chunk === undefined || chunk === null) {
      return;
    }

    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding ?? 'utf8'));
  };

  Object.assign(response, {
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name.toLowerCase(), String(value));
      return response;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    removeHeader(name: string) {
      headers.delete(name.toLowerCase());
    },
    hasHeader(name: string) {
      return headers.has(name.toLowerCase());
    },
    getHeaderNames() {
      return [...headers.keys()];
    },
    write(chunk: unknown, encoding?: BufferEncoding | (() => void), callback?: () => void) {
      appendChunk(chunk, typeof encoding === 'string' ? encoding : undefined);
      const done = typeof encoding === 'function' ? encoding : callback;
      done?.();
      return true;
    },
    end(chunk?: unknown, encoding?: BufferEncoding | (() => void), callback?: () => void) {
      appendChunk(chunk, typeof encoding === 'string' ? encoding : undefined);
      const done = typeof encoding === 'function' ? encoding : callback;
      done?.();
      response.emit('finish');
      return response;
    },
  });

  return {
    response,
    headers,
    readBody(): unknown {
      const body = Buffer.concat(chunks).toString('utf8');
      return body.length > 0 ? JSON.parse(body) : undefined;
    },
  };
}

describe('HTTP infrastructure', () => {
  const ping = vi.fn();
  let app: INestApplication;
  let expressApp: ExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, TestSupportModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(createTestConfig())
      .overrideProvider(PrismaService)
      .useValue({ ping })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    expressApp = app.getHttpAdapter().getInstance() as ExpressApplication;
  });

  afterAll(async () => {
    await app.close();
  });

  async function request(
    method: string,
    path: string,
    options: { headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<TestResponse> {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const headers: Record<string, string> = {
      host: '127.0.0.1',
      ...options.headers,
    };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(body));
    }

    const requestStream = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
    const req = requestStream as unknown as IncomingMessage;
    Object.assign(req, {
      method,
      url: path,
      originalUrl: path,
      headers,
      httpVersion: '1.1',
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      socket: {},
      connection: {},
    });

    const capture = createResponse(req);
    await new Promise<void>((resolve, reject) => {
      capture.response.once('finish', resolve);
      expressApp(req, capture.response, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    return {
      status: capture.response.statusCode,
      headers: capture.headers,
      body: capture.readBody(),
    };
  }

  it('returns the unified success envelope and strips non-whitelisted fields', async () => {
    const response = await request('POST', '/api/v1/test-support/validate', {
      headers: {
        'x-request-id': 'incoming-success',
      },
      body: { name: 'tea', count: 2, ignored: 'removed' },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toBe('incoming-success');
    expect(response.body).toEqual({
      data: { name: 'tea', count: 2 },
      requestId: 'incoming-success',
    });
  });

  it('returns the stable validation error envelope with the incoming request ID', async () => {
    const response = await request('POST', '/api/v1/test-support/validate', {
      headers: {
        'x-request-id': 'incoming-validation',
      },
      body: { name: 42, count: 'invalid' },
    });

    expect(response.status).toBe(400);
    const body = response.body as ApiErrorBody;
    expect(body.requestId).toBe('incoming-validation');
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Request validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'count' }),
      ]),
    );
  });

  it('serializes BigInt and Decimal values in HTTP responses', async () => {
    const response = await request('GET', '/api/v1/test-support/serialization');
    const body = response.body as ApiSuccessBody<Record<string, string>>;

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      storeId: '9007199254740993',
      quantity: '9876543210.123',
    });
  });

  it('returns and logs a stable envelope for uncaught exceptions without leaking secrets', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const response = await request('GET', '/api/v1/test-support/uncaught', {
        headers: { 'x-request-id': 'incoming-uncaught' },
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: null,
        },
        requestId: 'incoming-uncaught',
      });

      const logLines = errorLog.mock.calls.map(([line]) => String(line)).join('\n');
      expect(logLines).toContain('"event":"unhandled_exception"');
      expect(logLines).toContain('"requestId":"incoming-uncaught"');
      expect(logLines).not.toContain('supersecret');
      expect(logLines).not.toContain('super-secret-token');
      expect(logLines).not.toContain('wx-openid-value');
    } finally {
      errorLog.mockRestore();
    }
  });

  it('keeps liveness independent and lets readiness recover in the same process', async () => {
    ping.mockRejectedValueOnce(new Error('database is down'));

    const liveResponse = await request('GET', '/api/v1/health/live');
    expect(liveResponse.status).toBe(200);
    const liveBody = liveResponse.body as ApiSuccessBody<{ status: string }>;
    expect(liveBody.data).toEqual({ status: 'live' });
    expect(liveBody.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(liveResponse.headers.get('x-request-id')).toBe(liveBody.requestId);

    const unavailableResponse = await request('GET', '/api/v1/health/ready');
    expect(unavailableResponse.status).toBe(503);
    expect(unavailableResponse.body).toMatchObject({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
        details: null,
      },
    });

    ping.mockResolvedValueOnce(undefined);
    const readyResponse = await request('GET', '/api/v1/health/ready');
    expect(readyResponse.status).toBe(200);
    expect(readyResponse.body).toMatchObject({
      data: { status: 'ready' },
    });
  });
});
