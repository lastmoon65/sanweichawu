import type { TransactionHooks, TransactionObservation } from './instrumented-prisma.js';
import type { Sw011EvidenceWriter } from './sw011-behavioral-isolation.js';

export const MIN_UNACQUIRED_WINDOW_MS = 120;
const DEFAULT_WAIT_TIMEOUT_MS = 3_000;
const DEFAULT_POLL_MS = 20;

export type LockSqlPhase = 'dispatch' | 'acquire' | 'error';

export interface LockSqlEvent {
  readonly phase: LockSqlPhase;
  readonly sql_kind: string;
  readonly connection_id: string;
  readonly at_epoch_ms: number;
  readonly transaction_started_at_epoch_ms: number;
  readonly transaction_elapsed_ms: number;
  readonly error_type?: string;
  readonly prisma_code?: string | null;
}

export interface LockSqlTracker {
  readonly hooks: TransactionHooks;
  readonly events: LockSqlEvent[];
  readonly dispatched: LockSqlEvent | null;
  readonly acquired: LockSqlEvent | null;
  readonly failed: LockSqlEvent | null;
}

export interface LockWaitSample {
  readonly at_epoch_ms: number;
  readonly elapsed_since_dispatch_ms: number;
  readonly dispatched_count: number;
  readonly acquired_count: number;
  readonly error_count: number;
  readonly holder_settled: boolean;
  readonly contender_settled: boolean;
}

export interface LockWaitProof {
  readonly dispatched: LockSqlEvent;
  readonly window_started_at_epoch_ms: number;
  readonly window_completed_at_epoch_ms: number;
  readonly observed_unacquired_window_ms: number;
  readonly samples: LockWaitSample[];
  readonly acquired: null;
  readonly unacquired_through_window: true;
}

export interface LockTimingSummary {
  readonly dispatched_at_epoch_ms: number | null;
  readonly release_at_epoch_ms: number | null;
  readonly acquired_at_epoch_ms: number | null;
  readonly dispatched_before_release: boolean;
  readonly release_before_acquired: boolean;
  readonly ordered: boolean;
}

function epochMs(): number {
  return performance.timeOrigin + performance.now();
}

function errorType(error: unknown): string {
  if (error === null || typeof error !== 'object' || !('constructor' in error))
    return 'UnknownError';
  const name = (error.constructor as { name?: unknown }).name;
  return typeof name === 'string' && /^[A-Za-z0-9_$]+$/.test(name) ? name : 'UnknownError';
}

function prismaCode(error: unknown): string | null {
  if (error === null || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : null;
}

function sqlKind(sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
  if (normalized.includes('bootstrap_locks') && normalized.includes('for update')) {
    return 'bootstrap_lock_row_for_update';
  }
  if (normalized.includes('staff_credentials') && normalized.includes('for update')) {
    return 'staff_credential_row_for_update';
  }
  if (normalized.includes('stores') && normalized.includes('for update')) {
    return 'store_row_for_update';
  }
  return 'other_sql';
}

export function createLockSqlTracker(
  predicate: (sql: string) => boolean,
  onEvent?: (event: LockSqlEvent) => void | Promise<void>,
): LockSqlTracker {
  const events: LockSqlEvent[] = [];
  return {
    hooks: {
      onQueryRaw: async (sql, phase, observation, error) => {
        if (!predicate(sql)) return;
        const at = epochMs();
        const startedAt = observation.startedAtEpochMs;
        const event: LockSqlEvent = {
          phase: phase === 'before' ? 'dispatch' : phase === 'after' ? 'acquire' : 'error',
          sql_kind: sqlKind(sql),
          connection_id: observation.connectionId,
          at_epoch_ms: at,
          transaction_started_at_epoch_ms: startedAt,
          transaction_elapsed_ms: Number((at - startedAt).toFixed(3)),
          ...(phase === 'error'
            ? { error_type: errorType(error), prisma_code: prismaCode(error) }
            : {}),
        };
        events.push(event);
        await onEvent?.(event);
      },
    },
    get events() {
      return events;
    },
    get dispatched() {
      return events.find((event) => event.phase === 'dispatch') ?? null;
    },
    get acquired() {
      return events.find((event) => event.phase === 'acquire') ?? null;
    },
    get failed() {
      return events.find((event) => event.phase === 'error') ?? null;
    },
  };
}

function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, timeoutMs));
}

async function waitForDispatch(tracker: LockSqlTracker, timeoutMs: number): Promise<LockSqlEvent> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (tracker.dispatched !== null) return tracker.dispatched;
    if (tracker.failed !== null) throw new Error('lock SQL failed before dispatch was observed');
    await delay(DEFAULT_POLL_MS);
  }
  throw new Error('lock SQL dispatch was not observed before timeout');
}

export async function proveUnacquiredWindow(options: {
  readonly tracker: LockSqlTracker;
  readonly evidence: Sw011EvidenceWriter;
  readonly caseId: string;
  readonly holderSettled: () => boolean;
  readonly contenderSettled: () => boolean;
  readonly minWindowMs?: number;
  readonly timeoutMs?: number;
  readonly extra?: Record<string, unknown>;
}): Promise<LockWaitProof> {
  const minWindowMs = options.minWindowMs ?? MIN_UNACQUIRED_WINDOW_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  try {
    const dispatched = await waitForDispatch(options.tracker, timeoutMs);
    const windowStartedAt = epochMs();
    const samples: LockWaitSample[] = [];
    while (epochMs() - windowStartedAt < minWindowMs) {
      const acquire = options.tracker.acquired;
      const failure = options.tracker.failed;
      const sample: LockWaitSample = {
        at_epoch_ms: epochMs(),
        elapsed_since_dispatch_ms: Number((epochMs() - dispatched.at_epoch_ms).toFixed(3)),
        dispatched_count: options.tracker.events.filter((event) => event.phase === 'dispatch')
          .length,
        acquired_count: options.tracker.events.filter((event) => event.phase === 'acquire').length,
        error_count: options.tracker.events.filter((event) => event.phase === 'error').length,
        holder_settled: options.holderSettled(),
        contender_settled: options.contenderSettled(),
      };
      samples.push(sample);
      if (acquire !== null || failure !== null) {
        throw new Error(
          `lock SQL settled before the unacquired window completed: ${acquire?.phase ?? failure?.phase}`,
        );
      }
      if (options.holderSettled())
        throw new Error('holder settled before the unacquired window completed');
      if (options.contenderSettled())
        throw new Error('contender settled before the unacquired window completed');
      await delay(DEFAULT_POLL_MS);
    }
    const acquire = options.tracker.acquired;
    const failure = options.tracker.failed;
    if (acquire !== null || failure !== null) {
      throw new Error(`lock SQL settled before release: ${acquire?.phase ?? failure?.phase}`);
    }
    const completedAt = epochMs();
    const proof: LockWaitProof = {
      dispatched,
      window_started_at_epoch_ms: windowStartedAt,
      window_completed_at_epoch_ms: completedAt,
      observed_unacquired_window_ms: Number((completedAt - dispatched.at_epoch_ms).toFixed(3)),
      samples,
      acquired: null,
      unacquired_through_window: true,
    };
    options.evidence.append('lock_wait_observed', 'complete', {
      case_id: options.caseId,
      ...options.extra,
      ...proof,
    });
    return proof;
  } catch (error) {
    options.evidence.append('lock_wait_observation_failed', 'complete', {
      case_id: options.caseId,
      ...options.extra,
      error_type: errorType(error),
      events: options.tracker.events,
    });
    throw error;
  }
}

export async function waitForLockAcquire(
  tracker: LockSqlTracker,
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
): Promise<LockSqlEvent> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (tracker.acquired !== null) return tracker.acquired;
    if (tracker.failed !== null) throw new Error('lock SQL failed instead of acquiring');
    await delay(DEFAULT_POLL_MS);
  }
  throw new Error('lock SQL acquisition was not observed before timeout');
}

export function lockTimingSummary(
  tracker: LockSqlTracker,
  releaseAtEpochMs: number | null,
): LockTimingSummary {
  const dispatchedAt = tracker.dispatched?.at_epoch_ms ?? null;
  const acquiredAt = tracker.acquired?.at_epoch_ms ?? null;
  const dispatchedBeforeRelease =
    dispatchedAt !== null && releaseAtEpochMs !== null ? dispatchedAt < releaseAtEpochMs : false;
  const releaseBeforeAcquired =
    releaseAtEpochMs !== null && acquiredAt !== null ? releaseAtEpochMs < acquiredAt : false;
  return {
    dispatched_at_epoch_ms: dispatchedAt,
    release_at_epoch_ms: releaseAtEpochMs,
    acquired_at_epoch_ms: acquiredAt,
    dispatched_before_release: dispatchedBeforeRelease,
    release_before_acquired: releaseBeforeAcquired,
    ordered: dispatchedBeforeRelease && releaseBeforeAcquired,
  };
}

export { epochMs };
