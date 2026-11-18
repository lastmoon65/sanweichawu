import { HttpException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { insufficientPermissions } from '../auth/auth-errors.js';
import { parseDecimalBigIntId } from '../auth/store-resource.service.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import { DINING_TABLE_FIELD_MAX_LENGTH } from './dining-table.dto.js';
import type { CreateDiningTableDto, UpdateDiningTableDto } from './dining-table.dto.js';
import {
  diningTableCodeConflict,
  diningTableReferenced,
  invalidDiningTableInput,
} from './dining-table.errors.js';

const TABLE_SELECT = {
  id: true,
  storeId: true,
  name: true,
  code: true,
  createdAt: true,
  updatedAt: true,
} as const;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 10_000,
} as const;

interface DiningTableRecord {
  readonly id: bigint;
  readonly storeId: bigint;
  readonly name: string;
  readonly code: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DiningTableResponse {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly code: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DiningTableListResponse {
  readonly items: DiningTableResponse[];
}

function serializeDiningTable(table: DiningTableRecord): DiningTableResponse {
  return {
    id: table.id.toString(),
    storeId: table.storeId.toString(),
    name: table.name,
    code: table.code,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  };
}

function parseTableId(value: string): bigint {
  const tableId = parseDecimalBigIntId(value);
  if (tableId === null) {
    throw insufficientPermissions();
  }
  return tableId;
}

function normalizeTextField(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= DINING_TABLE_FIELD_MAX_LENGTH
    ? normalized
    : null;
}

function rethrowWriteError(error: unknown): never {
  if (error instanceof HttpException) {
    throw error;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw diningTableCodeConflict();
    }
    if (error.code === 'P2003') {
      throw diningTableReferenced();
    }
    if (error.code === 'P2025') {
      throw insufficientPermissions();
    }
  }
  throw error;
}

@Injectable()
export class DiningTableService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(storeId: bigint): Promise<DiningTableListResponse> {
    const tables = await this.prisma.diningTable.findMany({
      where: { storeId },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      select: TABLE_SELECT,
    });
    return { items: tables.map(serializeDiningTable) };
  }

  async create(storeId: bigint, input: CreateDiningTableDto): Promise<DiningTableResponse> {
    const name = normalizeTextField(input?.name);
    const code = normalizeTextField(input?.code);
    if (name === null || code === null) {
      throw invalidDiningTableInput('INVALID_FIELD');
    }
    try {
      const table = await this.prisma.diningTable.create({
        data: {
          storeId,
          name,
          code,
        },
        select: TABLE_SELECT,
      });
      return serializeDiningTable(table);
    } catch (error) {
      rethrowWriteError(error);
    }
  }

  async get(storeId: bigint, tableIdValue: string): Promise<DiningTableResponse> {
    const tableId = parseTableId(tableIdValue);
    const table = await this.prisma.diningTable.findFirst({
      where: { id: tableId, storeId },
      select: TABLE_SELECT,
    });
    if (!table) {
      throw insufficientPermissions();
    }
    return serializeDiningTable(table);
  }

  async update(
    storeId: bigint,
    tableIdValue: string,
    input: UpdateDiningTableDto,
  ): Promise<DiningTableResponse> {
    if (!input || (input.name === undefined && input.code === undefined)) {
      throw invalidDiningTableInput('EMPTY_UPDATE');
    }

    const data: { name?: string; code?: string } = {};
    if (input.name !== undefined) {
      const name = normalizeTextField(input.name);
      if (name === null) {
        throw invalidDiningTableInput('INVALID_FIELD');
      }
      data.name = name;
    }
    if (input.code !== undefined) {
      const code = normalizeTextField(input.code);
      if (code === null) {
        throw invalidDiningTableInput('INVALID_FIELD');
      }
      data.code = code;
    }

    const tableId = parseTableId(tableIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.diningTable.findFirst({
          where: { id: tableId, storeId },
          select: { id: true },
        });
        if (!existing) {
          throw insufficientPermissions();
        }

        const updated = await transaction.diningTable.update({
          where: { id: tableId },
          data,
          select: TABLE_SELECT,
        });
        return serializeDiningTable(updated);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error);
    }
  }

  async remove(storeId: bigint, tableIdValue: string): Promise<DiningTableResponse> {
    const tableId = parseTableId(tableIdValue);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.diningTable.findFirst({
          where: { id: tableId, storeId },
          select: TABLE_SELECT,
        });
        if (!existing) {
          throw insufficientPermissions();
        }

        const sessionCount = await transaction.diningSession.count({
          where: { tableId, storeId },
        });
        if (sessionCount > 0) {
          throw diningTableReferenced();
        }

        await transaction.diningTable.delete({ where: { id: tableId } });
        return serializeDiningTable(existing);
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      rethrowWriteError(error);
    }
  }
}
