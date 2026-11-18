import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

interface ValidationIssue {
  field: string;
  messages: string[];
}

function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const messages = error.constraints ? Object.values(error.constraints) : [];

    if (messages.length > 0) {
      issues.push({ field, messages });
    }

    if (error.children && error.children.length > 0) {
      issues.push(...flattenValidationErrors(error.children, field));
    }
  }

  return issues;
}

export function createApiValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        code: VALIDATION_ERROR_CODE,
        message: 'Request validation failed',
        details: flattenValidationErrors(errors),
      }),
  });
}
