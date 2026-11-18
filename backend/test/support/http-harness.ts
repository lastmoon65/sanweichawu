import { ServerResponse } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

import type { INestApplication } from '@nestjs/common';

type ExpressApplication = (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void,
) => void;

export interface HttpResponse {
  status: number;
  headers: Map<string, string>;
  body: unknown;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
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

export function createHttpHarness(app: INestApplication) {
  const expressApp = app.getHttpAdapter().getInstance() as ExpressApplication;

  return async function request(
    method: string,
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse> {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const headers: Record<string, string> = { host: '127.0.0.1', ...options.headers };
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
  };
}
