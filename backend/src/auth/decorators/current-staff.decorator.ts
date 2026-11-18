import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest, AuthenticatedStaff } from '../auth-context.js';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedStaff | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().staffAuth,
);
