import type { INestApplication } from '@nestjs/common';

import { API_PREFIX } from './common/api-response.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor.js';
import { createApiValidationPipe } from './common/pipes/api-validation.pipe.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { jsonReplacer } from './common/serializers/json.serializer.js';

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(requestIdMiddleware);
  app.useGlobalPipes(createApiValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const expressInstance = app.getHttpAdapter().getInstance() as {
    set(setting: string, value: unknown): void;
  };
  expressInstance.set('json replacer', jsonReplacer);
}
