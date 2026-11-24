import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { authenticationRequired } from '../../auth/auth-errors.js';
import type { AuthenticatedRequest } from '../../auth/auth-context.js';
import { TokenService } from '../../auth/token.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { VerifiedCustomerToken } from '../../auth/token.service.js';

function extractBearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return undefined;
  }
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1];
}

@Injectable()
export class CustomerJwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw authenticationRequired();
    }

    let verified: VerifiedCustomerToken;
    try {
      verified = this.tokens.verifyCustomerAccessToken(token);
    } catch {
      throw authenticationRequired();
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: verified.customerUserId },
      select: { id: true, status: true },
    });
    if (!customer || customer.status !== 'ACTIVE') {
      throw authenticationRequired();
    }

    request.customerAuth = {
      customerUserId: customer.id,
      issuedAt: verified.issuedAt,
      expiresAt: verified.expiresAt,
    };
    return true;
  }
}
