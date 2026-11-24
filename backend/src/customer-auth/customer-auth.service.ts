import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { APP_CONFIG } from '../config/app-config.module.js';
import type { AppConfig } from '../config/environment.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';
import {
  customerDisabled,
  wechatLoginFailed,
  wechatNotConfigured,
  wechatRateLimited,
  wechatUnavailable,
} from './customer-auth.errors.js';
import type { CustomerLoginDto } from './customer-auth.dto.js';
import {
  WECHAT_CODE2SESSION_CLIENT,
  WechatCode2SessionError,
} from './wechat-code2session.client.js';
import type { WechatCode2SessionClient } from './wechat-code2session.client.js';

export interface CustomerLoginResult {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly expiresAt: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class CustomerAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(WECHAT_CODE2SESSION_CLIENT)
    private readonly wechat: WechatCode2SessionClient,
  ) {}

  async login(input: CustomerLoginDto, now = new Date()): Promise<CustomerLoginResult> {
    if (!this.config.wechatAppId || !this.config.wechatAppSecret) {
      throw wechatNotConfigured();
    }

    let openid: string;
    try {
      const session = await this.wechat.exchangeCode(input.code);
      openid = session.openid;
    } catch (error) {
      if (error instanceof WechatCode2SessionError) {
        if (error.kind === 'rate_limited') {
          throw wechatRateLimited();
        }
        if (error.kind === 'unavailable') {
          throw wechatUnavailable();
        }
        throw wechatLoginFailed();
      }
      throw wechatUnavailable();
    }

    const user = await this.upsertCustomer(openid);
    if (user.status !== 'ACTIVE') {
      throw customerDisabled();
    }

    const expiresIn = this.tokens.getAccessTokenTtlSeconds();
    return {
      accessToken: this.tokens.signCustomerAccessToken({ customerUserId: user.id }, now.getTime()),
      tokenType: 'Bearer',
      expiresIn,
      expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString(),
    };
  }

  private async upsertCustomer(
    openid: string,
  ): Promise<{ id: bigint; status: 'ACTIVE' | 'DISABLED' }> {
    try {
      return await this.prisma.user.upsert({
        where: { openid },
        create: { openid, status: 'ACTIVE' },
        update: {},
        select: { id: true, status: true },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const existing = await this.prisma.user.findUnique({
        where: { openid },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw error;
      }
      return existing;
    }
  }
}
