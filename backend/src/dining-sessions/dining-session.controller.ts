import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { authenticationRequired } from '../auth/auth-errors.js';
import type { AuthenticatedStaff } from '../auth/auth-context.js';
import { CurrentStaff } from '../auth/decorators/current-staff.decorator.js';
import { StaffJwtAuthGuard } from '../auth/guards/staff-jwt-auth.guard.js';
import { StoreResourceOwnershipGuard } from '../auth/guards/store-resource-ownership.guard.js';
import { CloseDiningSessionDto } from './dining-session.dto.js';
import { DiningSessionService } from './dining-session.service.js';
import type { DiningSessionListResponse, DiningSessionResponse } from './dining-session.service.js';

function requireStaff(staff: AuthenticatedStaff | undefined): AuthenticatedStaff {
  if (!staff) {
    throw authenticationRequired();
  }
  return staff;
}

@Controller()
@UseGuards(StaffJwtAuthGuard, StoreResourceOwnershipGuard)
export class DiningSessionController {
  constructor(@Inject(DiningSessionService) private readonly sessions: DiningSessionService) {}

  @Post('dining-tables/:tableId/sessions')
  @HttpCode(HttpStatus.CREATED)
  open(
    @Param('tableId') tableId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningSessionResponse> {
    return this.sessions.open(requireStaff(staff).storeId, tableId);
  }

  @Get('dining-sessions')
  list(
    @Query('status') status: string | string[] | undefined,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningSessionListResponse> {
    return this.sessions.list(
      requireStaff(staff).storeId,
      DiningSessionService.parseStatusFilter(status),
    );
  }

  @Get('dining-sessions/:sessionId')
  get(
    @Param('sessionId') sessionId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningSessionResponse> {
    return this.sessions.get(requireStaff(staff).storeId, sessionId);
  }

  @Post('dining-sessions/:sessionId/close')
  @HttpCode(HttpStatus.OK)
  close(
    @Body() input: CloseDiningSessionDto,
    @Param('sessionId') sessionId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningSessionResponse> {
    const authenticated = requireStaff(staff);
    return this.sessions.close(
      authenticated.storeId,
      authenticated.staffId,
      sessionId,
      input.version,
    );
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  DiningSessionController.prototype,
  'open',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  DiningSessionController.prototype,
  'list',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  DiningSessionController.prototype,
  'get',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [CloseDiningSessionDto, String, Object],
  DiningSessionController.prototype,
  'close',
);
