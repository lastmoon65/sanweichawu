import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Prisma, PrismaClient } from '@prisma/client';

const MONOTONIC_ORIGIN = process.hrtime.bigint();
const EVIDENCE_FILE = 'behavioral-isolation.jsonl';
const EXPERIMENT_DEADLINE_MS = 4_000;
const POLL_INTERVAL_MS = 10;
const BACKEND_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export type IsolationPhase =
  | 'preflight'
  | 'sentinel_setup'
  | 'transaction_start'
  | 'bootstrap_lock_acquired'
  | 'leader_first_read'
  | 'writer_u_start'
  | 'writer_u_uncommitted_read'
  | 'writer_c_start'
  | 'writer_c_commit'
  | 'third_party_read'
  | 'leader_second_read'
  | 'leader_cleanup'
  | 'final_counts'
  | 'sentinel_drop'
  | 'complete';

export interface ProbeRead {
  readonly connectionId: string | null;
  readonly sessionIsolation: string | null;
  readonly dirtyProbe: number | null;
  readonly committedProbe: number | null;
  readonly complete: boolean;
  readonly missing: string[];
}

export interface BehavioralIsolationSummary {
  readonly leaderWorkerIndex: number | null;
  readonly leaderTransactionConnectionId: string | null;
  readonly leaderSessionIsolation: string | null;
  readonly firstRead: ProbeRead | null;
  readonly writerURead: ProbeRead | null;
  readonly writerUUpdatedRows: number | null;
  readonly writerUUncommittedAtSecondRead: boolean | null;
  readonly writerCConnectionId: string | null;
  readonly writerCUpdatedRows: number | null;
  readonly writerCState: 'idle' | 'committed' | 'failed';
  readonly writerCCommittedAtSecondRead: boolean | null;
  readonly thirdPartyRead: ProbeRead | null;
  readonly secondRead: ProbeRead | null;
}

interface SourceBinding {
  readonly hash: string;
  readonly files: Array<{ path: string; bytes: number; sha256: string }>;
  readonly buildHash: string | null;
  readonly buildMissingReason: string | null;
}

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

type SqlClient = PrismaClient | Prisma.TransactionClient;

type WriterUState =
  | { readonly status: 'idle' }
  | { readonly status: 'ready'; readonly observation: ProbeRead; readonly updatedRows: number }
  | { readonly status: 'failed'; readonly error: unknown }
  | { readonly status: 'rolled_back' };

class ExpectedWriterRollback extends Error {}

class ObservationIncompleteError extends Error {
  constructor(readonly phase: IsolationPhase) {
    super(`observation incomplete at ${phase}`);
  }
}

class ObservationTimeoutError extends Error {
  constructor(readonly phase: IsolationPhase) {
    super(`observation timeout at ${phase}`);
  }
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function monotonicMs(): number {
  return Number(process.hrtime.bigint() - MONOTONIC_ORIGIN) / 1_000_000;
}

function isoTimestamp(): string {
  return new Date().toISOString();
}

function asiaShanghaiTimestamp(): string {
  return `${new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(new Date())} Asia/Shanghai`;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function walkFiles(root: string, current = root): string[] {
  if (!existsSync(current)) return [];
  return readdirSync(current, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(current, entry.name);
      if (entry.isDirectory()) return walkFiles(root, path);
      return entry.isFile() ? [relative(root, path)] : [];
    });
}

function hashFiles(root: string, files: string[]): SourceBinding['files'] {
  return files.map((path) => {
    const bytes = readFileSync(join(root, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

function sourceBinding(): SourceBinding {
  const sourceFiles = [
    ...walkFiles(join(BACKEND_ROOT, 'src')).map((path) => join('src', path)),
    ...walkFiles(join(BACKEND_ROOT, 'prisma', 'migrations')).map((path) =>
      join('prisma', 'migrations', path),
    ),
    'prisma/schema.prisma',
    'package.json',
    'test/auth.database.concurrency.spec.ts',
    'test/bootstrap-owner.database.spec.ts',
    'test/support/f02-holder.worker.ts',
    'test/support/f03-bootstrap.worker.ts',
    'test/support/f03-lock-holder.worker.ts',
    'test/support/instrumented-prisma.ts',
    'test/support/lock-wait-observer.ts',
    'test/support/sw011-behavioral-isolation.ts',
    'test/support/task-database.ts',
  ].sort();
  const files = hashFiles(BACKEND_ROOT, sourceFiles);
  const buildFiles = walkFiles(join(BACKEND_ROOT, 'dist')).map((path) => join('dist', path));
  return {
    hash: sha256(JSON.stringify(files)),
    files,
    buildHash:
      buildFiles.length === 0 ? null : sha256(JSON.stringify(hashFiles(BACKEND_ROOT, buildFiles))),
    buildMissingReason: buildFiles.length === 0 ? 'dist_missing' : null,
  };
}

function safeEvidenceDirectory(environment: NodeJS.ProcessEnv): string {
  const value = environment.SW015_EVIDENCE_DIR?.trim();
  if (!value) throw new Error('SW015_EVIDENCE_DIR is required');
  if (!isAbsolute(value) || value.split(sep).includes('..') || value.includes('\0')) {
    throw new Error('SW015_EVIDENCE_DIR must be a safe absolute path');
  }
  const resolved = resolve(value);
  if (resolved === dirname(resolved)) {
    throw new Error('SW015_EVIDENCE_DIR must not be the filesystem root');
  }
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error('SW015_EVIDENCE_DIR must be an existing directory');
  }
  if (lstatSync(resolved).isSymbolicLink()) {
    throw new Error('SW015_EVIDENCE_DIR must not be a symbolic link');
  }
  return resolved;
}

function normalizeScalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return String(value);
}

function normalizeProbeValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function allowedErrorType(error: unknown): string {
  const name =
    error !== null && typeof error === 'object' && 'constructor' in error
      ? (error.constructor as { name?: unknown }).name
      : undefined;
  return new Set([
    'Error',
    'ObservationIncompleteError',
    'ObservationTimeoutError',
    'PrismaClientKnownRequestError',
    'PrismaClientUnknownRequestError',
    'PrismaClientRustPanicError',
    'PrismaClientInitializationError',
    'PrismaClientValidationError',
    'TimeoutError',
  ]).has(String(name))
    ? String(name)
    : 'UnknownError';
}

function prismaCode(error: unknown): string | null {
  if (error === null || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : null;
}

export function safeErrorObservation(
  error: unknown,
  phase: IsolationPhase | string,
): Record<string, unknown> {
  return {
    phase,
    error_type: allowedErrorType(error),
    prisma_code: prismaCode(error),
    message: null,
    stack: null,
    query: null,
    meta: null,
  };
}

export class Sw011EvidenceWriter {
  readonly runId = randomUUID();
  readonly evidenceFile: string;
  private readonly binding = sourceBinding();

  constructor(environment: NodeJS.ProcessEnv = process.env, evidenceFile = EVIDENCE_FILE) {
    const directory = safeEvidenceDirectory(environment);
    this.evidenceFile = join(directory, evidenceFile);
    if (existsSync(this.evidenceFile) && lstatSync(this.evidenceFile).isSymbolicLink()) {
      throw new Error('SW015 evidence file must not be a symbolic link');
    }
  }

  append(
    event: string,
    phase: IsolationPhase | string,
    payload: Record<string, unknown> = {},
  ): void {
    appendFileSync(
      this.evidenceFile,
      `${JSON.stringify({
        schema_version: 1,
        event,
        phase,
        run_id: this.runId,
        at: isoTimestamp(),
        asia_shanghai_at: asiaShanghaiTimestamp(),
        monotonic_ms: monotonicMs(),
        source_hash: this.binding.hash,
        build_hash: this.binding.buildHash,
        build_missing_reason: this.binding.buildMissingReason,
        node_version: process.version,
        pid: process.pid,
        command: process.argv.slice(1),
        ...payload,
      })}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
  }

  appendRunBinding(testFile = 'test/bootstrap-owner.database.spec.ts'): void {
    this.append('run_binding', 'preflight', {
      source_files: this.binding.files,
      test_file: testFile,
      evidence_file: this.evidenceFile,
    });
  }
}

function probeSql(tableName: string): string {
  return `SELECT CONNECTION_ID() AS connection_id,
                 @@SESSION.transaction_isolation AS session_isolation,
                 MAX(CASE WHEN probe_key = 'dirty_probe' THEN probe_value END) AS dirty_probe,
                 MAX(CASE WHEN probe_key = 'committed_probe' THEN probe_value END) AS committed_probe
            FROM \`${tableName}\``;
}

export async function readProbe(client: SqlClient, tableName: string): Promise<ProbeRead> {
  const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(probeSql(tableName));
  const row = rows[0];
  const connectionId = normalizeScalar(row?.connection_id);
  const sessionIsolation = normalizeScalar(row?.session_isolation);
  const dirtyProbe = normalizeProbeValue(row?.dirty_probe);
  const committedProbe = normalizeProbeValue(row?.committed_probe);
  const missing = [
    connectionId === null ? 'connection_id' : null,
    sessionIsolation === null ? 'session_isolation' : null,
    dirtyProbe === null ? 'dirty_probe' : null,
    committedProbe === null ? 'committed_probe' : null,
  ].filter((entry): entry is string => entry !== null);
  return {
    connectionId,
    sessionIsolation,
    dirtyProbe,
    committedProbe,
    complete: missing.length === 0,
    missing,
  };
}

export function requireCompleteProbe(probe: ProbeRead, phase: IsolationPhase): void {
  if (!probe.complete) throw new ObservationIncompleteError(phase);
}

function assertTableName(tableName: string): void {
  if (!/^sw011_iso_sentinel_[a-f0-9]{12}$/.test(tableName)) {
    throw new Error('invalid SW011 sentinel table name');
  }
}

export function sentinelTableName(): string {
  return `sw011_iso_sentinel_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export async function createSentinel(
  admin: PrismaClient,
  tableName: string,
  evidence: Sw011EvidenceWriter,
): Promise<void> {
  assertTableName(tableName);
  await admin.$executeRawUnsafe(
    `CREATE TABLE \`${tableName}\` (
       probe_key VARCHAR(32) NOT NULL PRIMARY KEY,
       probe_value INT NOT NULL
     ) ENGINE=InnoDB`,
  );
  const inserted = await admin.$executeRawUnsafe(
    `INSERT INTO \`${tableName}\` (probe_key, probe_value) VALUES
       ('dirty_probe', 0),
       ('committed_probe', 0)`,
  );
  const initial = await readProbe(admin, tableName);
  evidence.append('sentinel_initialized', 'sentinel_setup', {
    table_name: tableName,
    inserted_rows: inserted,
    ...initial,
  });
  if (inserted !== 2) throw new Error('sentinel insert incomplete');
  requireCompleteProbe(initial, 'sentinel_setup');
}

export async function dropSentinel(
  admin: PrismaClient,
  tableName: string,
  evidence: Sw011EvidenceWriter,
): Promise<void> {
  assertTableName(tableName);
  await admin.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${tableName}\``);
  const remaining = await admin.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SHOW TABLES LIKE '${tableName}'`,
  );
  evidence.append('sentinel_dropped', 'sentinel_drop', {
    table_name: tableName,
    remaining_table_count: remaining.length,
  });
  if (remaining.length !== 0) throw new Error('sentinel table remained after drop');
}

async function waitUntil(
  predicate: () => boolean,
  deadline: number,
  phase: IsolationPhase,
): Promise<void> {
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, POLL_INTERVAL_MS));
  }
  throw new ObservationTimeoutError(phase);
}

export class BehavioralIsolationCoordinator {
  private leaderClaimed = false;
  private leaderWorkerIndex: number | null = null;
  private phase: IsolationPhase = 'preflight';
  private writerUPromise: Promise<void> | null = null;
  private writerCPromise: Promise<void> | null = null;
  private writerUState: WriterUState = { status: 'idle' };
  private writerCState: 'idle' | 'committed' | 'failed' = 'idle';
  private writerCError: unknown;
  private readonly releaseWriterU = deferred();
  private readonly observations: {
    leaderWorkerIndex: number | null;
    leaderTransactionConnectionId: string | null;
    leaderSessionIsolation: string | null;
    firstRead: ProbeRead | null;
    writerURead: ProbeRead | null;
    writerUUpdatedRows: number | null;
    writerUUncommittedAtSecondRead: boolean | null;
    writerCConnectionId: string | null;
    writerCUpdatedRows: number | null;
    writerCCommittedAtSecondRead: boolean | null;
    thirdPartyRead: ProbeRead | null;
    secondRead: ProbeRead | null;
  } = {
    leaderWorkerIndex: null,
    leaderTransactionConnectionId: null,
    leaderSessionIsolation: null,
    firstRead: null,
    writerURead: null,
    writerUUpdatedRows: null,
    writerUUncommittedAtSecondRead: null,
    writerCConnectionId: null,
    writerCUpdatedRows: null,
    writerCCommittedAtSecondRead: null,
    thirdPartyRead: null,
    secondRead: null,
  };

  constructor(
    private readonly evidence: Sw011EvidenceWriter,
    private readonly writerU: PrismaClient,
    private readonly writerC: PrismaClient,
    private readonly committedReader: PrismaClient,
    private readonly tableName: string,
  ) {
    assertTableName(tableName);
  }

  get summary(): BehavioralIsolationSummary {
    return { ...this.observations, writerCState: this.writerCState };
  }

  async onBootstrapLockAcquired(
    workerIndex: number,
    observation: {
      readonly connectionId: string;
      readonly isolationLevel: string;
      readonly requestedIsolationLevel: string | null;
      readonly transaction: unknown;
    },
  ): Promise<void> {
    const role = this.leaderClaimed ? 'follower' : 'leader';
    this.evidence.append('bootstrap_lock_acquired', 'bootstrap_lock_acquired', {
      worker_index: workerIndex,
      role,
      connection_id: observation.connectionId,
      session_isolation: observation.isolationLevel,
      requested_isolation_level: observation.requestedIsolationLevel,
    });
    if (this.leaderClaimed) {
      this.evidence.append('follower_released_immediately', 'bootstrap_lock_acquired', {
        worker_index: workerIndex,
        connection_id: observation.connectionId,
        role: 'follower',
      });
      return;
    }

    this.leaderClaimed = true;
    this.leaderWorkerIndex = workerIndex;
    this.observations.leaderWorkerIndex = workerIndex;
    this.observations.leaderTransactionConnectionId = observation.connectionId;
    this.observations.leaderSessionIsolation = observation.isolationLevel;
    await this.runLeaderExperiment(observation);
  }

  private async runLeaderExperiment(observation: {
    readonly connectionId: string;
    readonly isolationLevel: string;
    readonly requestedIsolationLevel: string | null;
    readonly transaction: unknown;
  }): Promise<void> {
    const deadline = Date.now() + EXPERIMENT_DEADLINE_MS;
    const transaction = observation.transaction as Prisma.TransactionClient;
    try {
      this.phase = 'leader_first_read';
      const first = await readProbe(transaction, this.tableName);
      this.observations.firstRead = first;
      this.evidence.append('leader_first_read', this.phase, {
        worker_index: this.leaderWorkerIndex,
        transaction_connection_id: observation.connectionId,
        session_isolation: observation.isolationLevel,
        requested_isolation_level: observation.requestedIsolationLevel,
        ...first,
      });
      requireCompleteProbe(first, this.phase);

      this.phase = 'writer_u_start';
      this.startWriterU();
      await waitUntil(
        () => this.writerUState.status !== 'idle',
        deadline,
        'writer_u_uncommitted_read',
      );
      if (this.writerUState.status === 'failed') throw this.writerUState.error;
      if (this.writerUState.status !== 'ready') {
        throw new ObservationIncompleteError('writer_u_uncommitted_read');
      }
      this.phase = 'writer_u_uncommitted_read';
      this.observations.writerURead = this.writerUState.observation;
      this.observations.writerUUpdatedRows = this.writerUState.updatedRows;
      this.evidence.append('writer_u_uncommitted_read', this.phase, {
        writer_connection_id: this.writerUState.observation.connectionId,
        session_isolation: this.writerUState.observation.sessionIsolation,
        updated_rows: this.writerUState.updatedRows,
        transaction_state: 'uncommitted',
        ...this.writerUState.observation,
      });
      requireCompleteProbe(this.writerUState.observation, this.phase);

      this.phase = 'writer_c_start';
      this.startWriterC();
      await waitUntil(() => this.writerCState !== 'idle', deadline, 'writer_c_commit');
      if (this.writerCState === 'failed') throw this.writerCError;
      if (this.writerCState !== 'committed') {
        throw new ObservationIncompleteError('writer_c_commit');
      }

      this.phase = 'third_party_read';
      const thirdParty = await readProbe(this.committedReader, this.tableName);
      this.observations.thirdPartyRead = thirdParty;
      this.evidence.append('third_party_committed_read', this.phase, {
        reader_connection_id: thirdParty.connectionId,
        session_isolation: thirdParty.sessionIsolation,
        ...thirdParty,
      });
      requireCompleteProbe(thirdParty, this.phase);

      this.phase = 'leader_second_read';
      const writerUUncommittedBeforeSecondRead = this.writerUState.status === 'ready';
      this.observations.writerCCommittedAtSecondRead = this.writerCState === 'committed';
      const second = await readProbe(transaction, this.tableName);
      this.observations.writerUUncommittedAtSecondRead =
        writerUUncommittedBeforeSecondRead && this.writerUState.status === 'ready';
      this.observations.secondRead = second;
      this.evidence.append('leader_second_read', this.phase, {
        worker_index: this.leaderWorkerIndex,
        transaction_connection_id: observation.connectionId,
        same_as_transaction_connection: second.connectionId === observation.connectionId,
        session_isolation: second.sessionIsolation,
        ...second,
      });
      requireCompleteProbe(second, this.phase);
      this.phase = 'leader_cleanup';
    } catch (error) {
      this.evidence.append('experiment_failed', this.phase, {
        worker_index: this.leaderWorkerIndex,
        ...safeErrorObservation(error, this.phase),
      });
      throw error;
    } finally {
      this.releaseWriterU.resolve();
      const settled = await Promise.allSettled(
        [this.writerUPromise, this.writerCPromise].filter(
          (entry): entry is Promise<void> => entry !== null,
        ),
      );
      this.evidence.append('leader_barrier_released', 'leader_cleanup', {
        writer_u_state: this.writerUState.status,
        writer_c_state: this.writerCState,
        writer_settlements: settled.map((entry) => entry.status),
      });
    }
  }

  private startWriterU(): void {
    if (this.writerUPromise !== null) return;
    this.writerUPromise = this.writerU
      .$transaction(async (transaction) => {
        const identity = await readProbe(transaction, this.tableName);
        this.evidence.append('writer_u_transaction_opened', 'writer_u_uncommitted_read', {
          ...identity,
        });
        requireCompleteProbe(identity, 'writer_u_uncommitted_read');
        const updatedRows = await transaction.$executeRawUnsafe(
          `UPDATE \`${this.tableName}\` SET probe_value = 1 WHERE probe_key = 'dirty_probe'`,
        );
        const probe = await readProbe(transaction, this.tableName);
        this.writerUState = { status: 'ready', observation: probe, updatedRows };
        this.evidence.append('writer_u_updated_uncommitted', 'writer_u_uncommitted_read', {
          writer_connection_id: identity.connectionId,
          session_isolation: identity.sessionIsolation,
          updated_rows: updatedRows,
          transaction_state: 'uncommitted',
          ...probe,
        });
        requireCompleteProbe(probe, 'writer_u_uncommitted_read');
        await this.releaseWriterU.promise;
        throw new ExpectedWriterRollback();
      })
      .then(
        () => {
          this.writerUState = { status: 'failed', error: new Error('writer_u_committed') };
        },
        (error: unknown) => {
          if (error instanceof ExpectedWriterRollback) {
            this.writerUState = { status: 'rolled_back' };
            this.evidence.append('writer_u_rolled_back', 'leader_cleanup', {
              transaction_state: 'rolled_back',
            });
            return;
          }
          this.writerUState = { status: 'failed', error };
          this.evidence.append('writer_u_failed', 'leader_cleanup', {
            ...safeErrorObservation(error, 'writer_u_uncommitted_read'),
          });
        },
      );
  }

  private startWriterC(): void {
    if (this.writerCPromise !== null) return;
    this.writerCPromise = this.writerC
      .$transaction(async (transaction) => {
        const identity = await readProbe(transaction, this.tableName);
        this.evidence.append('writer_c_transaction_opened', 'writer_c_commit', {
          ...identity,
        });
        requireCompleteProbe(identity, 'writer_c_commit');
        this.observations.writerCConnectionId = identity.connectionId;
        const updatedRows = await transaction.$executeRawUnsafe(
          `UPDATE \`${this.tableName}\` SET probe_value = 1 WHERE probe_key = 'committed_probe'`,
        );
        this.observations.writerCUpdatedRows = updatedRows;
        const probe = await readProbe(transaction, this.tableName);
        this.evidence.append('writer_c_updated_before_commit', 'writer_c_commit', {
          writer_connection_id: identity.connectionId,
          session_isolation: identity.sessionIsolation,
          updated_rows: updatedRows,
          transaction_state: 'committing',
          ...probe,
        });
        requireCompleteProbe(probe, 'writer_c_commit');
      })
      .then(
        () => {
          this.writerCState = 'committed';
          this.evidence.append('writer_c_committed', 'writer_c_commit', {
            transaction_state: 'committed',
          });
        },
        (error: unknown) => {
          this.writerCState = 'failed';
          this.writerCError = error;
          this.evidence.append('writer_c_failed', 'writer_c_commit', {
            ...safeErrorObservation(error, 'writer_c_commit'),
          });
        },
      );
  }
}

export const SW011_EXPERIMENT_BUDGET_MS = EXPERIMENT_DEADLINE_MS;
