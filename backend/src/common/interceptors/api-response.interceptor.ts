import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { ApiSuccessBody } from '../api-response.js';
import { createRequestId } from '../request-id.middleware.js';

interface RequestWithId {
  requestId?: string;
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessBody<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessBody<T>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const requestId = request.requestId ?? createRequestId();
    request.requestId = requestId;

    return next.handle().pipe(
      map((data) => ({
        data,
        requestId,
      })),
    );
  }
}
