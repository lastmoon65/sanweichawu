import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Staff, StaffCredential } from '@prisma/client';

import { authenticationRequired } from '../auth-errors.js';
import { TokenService } from '../token.service.js';
import type { AuthenticatedRequest } from '../auth-context.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

type CurrentStaff = Staff & { credential: StaffCredential | null };

function extractBearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return undefined;
  }
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1];
}

@Injectable()
export class StaffJwtAuthGuard implements CanActivate {
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

    let verifiedStaffId: bigint;
    try {
      verifiedStaffId = this.tokens.verifyAccessToken(token).staffId;
    } catch {
      throw authenticationRequired();
    }

    const staff = (await this.prisma.staff.findUnique({
      where: { id: verifiedStaffId },
      include: { credential: true },
    })) as CurrentStaff | null;

    if (!staff || !staff.credential || staff.status !== 'ACTIVE') {
      throw authenticationRequired();
    }

    request.staffAuth = {
      staffId: staff.id,
      storeId: staff.storeId,
      role: staff.role,
      name: staff.name,
      username: staff.credential.username,
    };
    return true;
  }
}
