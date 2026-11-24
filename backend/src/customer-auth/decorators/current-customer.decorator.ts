import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { AuthenticatedCustomer, AuthenticatedRequest } from '../../auth/auth-context.js';

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedCustomer | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().customerAuth,
);
