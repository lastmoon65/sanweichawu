import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentStaff } from './decorators/current-staff.decorator.js';
import { StaffLoginDto } from './dto/staff-login.dto.js';
import { StaffJwtAuthGuard } from './guards/staff-jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { StaffAuthService } from './staff-auth.service.js';
import type { StaffLoginResult } from './staff-auth.service.js';
import type { AuthenticatedStaff } from './auth-context.js';

export interface CurrentStaffResponse {
  staffId: string;
  storeId: string;
  role: AuthenticatedStaff['role'];
  name: string;
  username: string;
}

@Controller('auth/staff')
export class StaffAuthController {
  constructor(@Inject(StaffAuthService) private readonly auth: StaffAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() input: StaffLoginDto): Promise<StaffLoginResult> {
    return this.auth.login(input);
  }

  @Get('me')
  @UseGuards(StaffJwtAuthGuard, RolesGuard)
  me(@CurrentStaff() staff: AuthenticatedStaff): CurrentStaffResponse {
    return {
      staffId: staff.staffId.toString(),
      storeId: staff.storeId.toString(),
      role: staff.role,
      name: staff.name,
      username: staff.username,
    };
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [StaffLoginDto],
  StaffAuthController.prototype,
  'login',
);
