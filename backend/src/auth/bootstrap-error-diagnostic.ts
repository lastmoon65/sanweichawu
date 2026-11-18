import { Prisma } from '@prisma/client';

export const FIRST_OWNER_BOOTSTRAP_LOCK_KEY = 'first_owner_bootstrap_v1';

export const BOOTSTRAP_PHASES = [
  'hash',
  'transaction_start',
  'acquire_bootstrap_lock',
  'select_store',
  'create_store',
  'check_owner',
  'create_staff',
  'create_credential',
  'commit',
  'rollback_or_cleanup',
  'unknown',
] as const;

export type BootstrapPhase = (typeof BOOTSTRAP_PHASES)[number];

const ALLOWED_PRISMA_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1008',
  'P1012',
  'P1017',
  'P2002',
  'P2024',
  'P2028',
  'P2034',
]);

const ALLOWED_DB_ERRNOS = new Set([1040, 1045, 1205, 1213, 2002, 2003, 2006, 2013]);
const ALLOWED_SQLSTATES = new Set([
  '08000',
  '08001',
  '08006',
  '40001',
  'HY000',
  'HYT00',
  'HYT01',
  '42000',
]);

export interface SafeBootstrapDiagnostic {
  readonly error_type:
    | 'PrismaKnown'
    | 'PrismaUnknown'
    | 'PrismaInitialization'
    | 'PrismaRustPanic'
    | 'Timeout'
    | 'Other';
  readonly prisma_code: string | null;
  readonly db_errno: number | null;
  readonly sqlstate: string | null;
  readonly phase: BootstrapPhase;
}

function knownPrismaCode(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  const value: unknown = error.code;
  return typeof value === 'string' && ALLOWED_PRISMA_CODES.has(value) ? value : null;
}

function initializationPrismaCode(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientInitializationError)) {
    return null;
  }
  const value: unknown = error.errorCode;
  return typeof value === 'string' && ALLOWED_PRISMA_CODES.has(value) ? value : null;
}

function errorType(error: unknown): SafeBootstrapDiagnostic['error_type'] {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return 'PrismaKnown';
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return 'PrismaUnknown';
  if (error instanceof Prisma.PrismaClientInitializationError) return 'PrismaInitialization';
  if (error instanceof Prisma.PrismaClientRustPanicError) return 'PrismaRustPanic';
  if (error instanceof Error && error.name === 'TimeoutError') return 'Timeout';
  return 'Other';
}

export function toSafeBootstrapDiagnostic(
  error: unknown,
  phase: BootstrapPhase,
): SafeBootstrapDiagnostic {
  const safePhase = BOOTSTRAP_PHASES.includes(phase) ? phase : 'unknown';
  const prismaCode = knownPrismaCode(error) ?? initializationPrismaCode(error);

  // The installed Prisma/MySQL error surface has not been proven to expose a
  // scalar DB errno or SQLSTATE without inspecting unsafe message/meta/cause.
  // Keep both null rather than guessing from a Prisma code or message text.
  const dbErrno: number | null = null;
  const sqlstate: string | null = null;
  const safeDbErrno = dbErrno !== null && ALLOWED_DB_ERRNOS.has(dbErrno) ? dbErrno : null;
  const safeSqlstate =
    sqlstate !== null && ALLOWED_SQLSTATES.has(sqlstate) ? sqlstate : null;

  return {
    error_type: prismaCode === 'P2024' ? 'Timeout' : errorType(error),
    prisma_code: prismaCode,
    db_errno: safeDbErrno,
    sqlstate: safeSqlstate,
    phase: safePhase,
  };
}
