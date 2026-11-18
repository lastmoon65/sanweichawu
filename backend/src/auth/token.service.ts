import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';

import { APP_CONFIG } from '../config/app-config.module.js';
import type { AppConfig } from '../config/environment.js';

const STAFF_ROLES: readonly StaffRole[] = ['OWNER', 'MANAGER', 'STAFF'];
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;

interface StaffTokenInput {
  staffId: bigint;
  role: StaffRole;
  storeId: bigint;
}

export interface VerifiedStaffToken {
  staffId: bigint;
  role: StaffRole;
  storeId: bigint;
  issuedAt: number;
  expiresAt: number;
}

interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

interface JwtPayload {
  sub: string;
  staffId: string;
  role: StaffRole;
  storeId: string;
  iat: number;
  exp: number;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && STAFF_ROLES.includes(value as StaffRole);
}

function isPositiveBigIntString(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function parseBoundedId(value: string): bigint {
  const id = BigInt(value);
  if (id > MAX_SIGNED_BIGINT) {
    throw new Error('Invalid access token');
  }
  return id;
}

export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  getAccessTokenTtlSeconds(): number {
    return this.config.jwtAccessTtlSeconds;
  }

  signAccessToken(input: StaffTokenInput, now = Date.now()): string {
    const issuedAt = Math.floor(now / 1000);
    const payload: JwtPayload = {
      sub: input.staffId.toString(),
      staffId: input.staffId.toString(),
      role: input.role,
      storeId: input.storeId.toString(),
      iat: issuedAt,
      exp: issuedAt + this.config.jwtAccessTtlSeconds,
    };
    return signJwt(payload as unknown as Record<string, unknown>, this.config.jwtAccessSecret);
  }

  verifyAccessToken(token: string, now = Date.now()): VerifiedStaffToken {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid access token');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', this.config.jwtAccessSecret)
      .update(signingInput)
      .digest();
    let actualSignature: Buffer;
    try {
      actualSignature = Buffer.from(encodedSignature, 'base64url');
    } catch {
      throw new Error('Invalid access token');
    }
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      throw new Error('Invalid access token');
    }

    let header: unknown;
    let payload: unknown;
    try {
      header = decodeJson(encodedHeader);
      payload = decodeJson(encodedPayload);
    } catch {
      throw new Error('Invalid access token');
    }

    if (!isRecord(header) || header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new Error('Invalid access token');
    }
    if (
      !isRecord(payload) ||
      !isPositiveBigIntString(payload.staffId) ||
      !isPositiveBigIntString(payload.storeId) ||
      !isStaffRole(payload.role) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      throw new Error('Invalid access token');
    }

    const nowInSeconds = Math.floor(now / 1000);
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) {
      throw new Error('Invalid access token');
    }
    if (payload.exp <= nowInSeconds || payload.iat > nowInSeconds + 60) {
      throw new Error('Invalid access token');
    }

    return {
      staffId: parseBoundedId(payload.staffId),
      role: payload.role,
      storeId: parseBoundedId(payload.storeId),
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  }
}
