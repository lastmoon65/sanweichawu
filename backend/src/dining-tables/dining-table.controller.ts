import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { authenticationRequired } from '../auth/auth-errors.js';
import type { AuthenticatedStaff } from '../auth/auth-context.js';
import { CurrentStaff } from '../auth/decorators/current-staff.decorator.js';
import { StaffJwtAuthGuard } from '../auth/guards/staff-jwt-auth.guard.js';
import { StoreResourceOwnershipGuard } from '../auth/guards/store-resource-ownership.guard.js';
import { CreateDiningTableDto, UpdateDiningTableDto } from './dining-table.dto.js';
import { invalidDiningTableInput } from './dining-table.errors.js';
import { DiningTableService } from './dining-table.service.js';
import type { DiningTableListResponse, DiningTableResponse } from './dining-table.service.js';

function requireStaff(staff: AuthenticatedStaff | undefined): AuthenticatedStaff {
  if (!staff) {
    throw authenticationRequired();
  }
  return staff;
}

@Controller('dining-tables')
@UseGuards(StaffJwtAuthGuard, StoreResourceOwnershipGuard)
export class DiningTableController {
  constructor(@Inject(DiningTableService) private readonly tables: DiningTableService) {}

  @Get()
  list(@CurrentStaff() staff: AuthenticatedStaff | undefined): Promise<DiningTableListResponse> {
    return this.tables.list(requireStaff(staff).storeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() input: CreateDiningTableDto,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningTableResponse> {
    if (!input) {
      throw invalidDiningTableInput('INVALID_FIELD');
    }
    return this.tables.create(requireStaff(staff).storeId, input);
  }

  @Get(':tableId')
  get(
    @Param('tableId') tableId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningTableResponse> {
    return this.tables.get(requireStaff(staff).storeId, tableId);
  }

  @Patch(':tableId')
  update(
    @Body() input: UpdateDiningTableDto,
    @Param('tableId') tableId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningTableResponse> {
    if (!input) {
      throw invalidDiningTableInput('INVALID_FIELD');
    }
    return this.tables.update(requireStaff(staff).storeId, tableId, input);
  }

  @Delete(':tableId')
  remove(
    @Param('tableId') tableId: string,
    @CurrentStaff() staff: AuthenticatedStaff | undefined,
  ): Promise<DiningTableResponse> {
    return this.tables.remove(requireStaff(staff).storeId, tableId);
  }
}

Reflect.defineMetadata('design:paramtypes', [Object], DiningTableController.prototype, 'list');
Reflect.defineMetadata(
  'design:paramtypes',
  [CreateDiningTableDto, Object],
  DiningTableController.prototype,
  'create',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  DiningTableController.prototype,
  'get',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [UpdateDiningTableDto, String, Object],
  DiningTableController.prototype,
  'update',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [String, Object],
  DiningTableController.prototype,
  'remove',
);
