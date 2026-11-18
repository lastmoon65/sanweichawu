import 'reflect-metadata';

import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFailed, vi } from 'vitest';

import { FIRST_OWNER_BOOTSTRAP_LOCK_KEY } from '../src/auth/bootstrap-error-diagnostic.js';
import { BootstrapOwnerService } from '../src/auth/bootstrap-owner.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { AppConfig } from '../src/config/environment.js';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { createTestConfig } from './support/test-config.js';
import { instrumentPrismaClient } from './support/instrumented-prisma.js';
import type {
  BootstrapLockObservation,
  TransactionObservation,
} from './support/instrumented-prisma.js';
import {
  createLockSqlTracker,
  epochMs,
  lockTimingSummary,
  proveUnacquiredWindow,
  waitForLockAcquire,
} from './support/lock-wait-observer.js';
import type { LockSqlTracker } from './support/lock-wait-observer.js';
import {
  BehavioralIsolationCoordinator,
  createSentinel,
  dropSentinel,
  safeErrorObservation,
  sentinelTableName,
  SW011_EXPERIMENT_BUDGET_MS,
  Sw011EvidenceWriter,
} from './support/sw011-behavioral-isolation.js';
import type { IsolationPhase } from './support/sw011-behavioral-isolation.js';
import { requireTaskTestDatabaseUrl } from './support/task-database.js';

const SYNTHETIC_PREFIX = 'sw008-';
const TEST_PROCESS_WAIT_MS = 20_000;

interface BootstrapCounts {
  stores: number;
  owners: number;
  credentials: number;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function connectionId(client: PrismaClient): Promise<string> {
  const rows = await client.$queryRawUnsafe<Array<{ connection_id: bigint | string }>>(
    'SELECT CONNECTION_ID() AS connection_id',
  );
  return String(rows[0]?.connection_id);
}

function sessionTimeoutValue(value: unknown): number | null {
  if (typeof value === 'bigint') {
    return value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function sessionTimeoutFromRows(rows: unknown): number | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row: unknown = rows[0];
  if (row === null || typeof row !== 'object') return null;
  return sessionTimeoutValue((row as Record<string, unknown>).innodb_lock_wait_timeout);
}

function testEvidence(caseId: string): Sw011EvidenceWriter {
  const evidence = new Sw011EvidenceWriter();
  evidence.appendRunBinding();
  onTestFailed(() => {
    evidence.append('case_failed', 'complete', {
      case_id: caseId,
      error_count: null,
      error_types: null,
      message: null,
      stack: null,
    });
  });
  return evidence;
}

function trackBootstrapLock(
  evidence: Sw011EvidenceWriter,
  caseId: string,
  role: string,
): LockSqlTracker {
  return createLockSqlTracker(
    (sql) => {
      const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
      return normalized.includes('bootstrap_locks') && normalized.includes('for update');
    },
    (event) =>
      evidence.append('lock_sql_timing', role, {
        case_id: caseId,
        role,
        ...event,
      }),
  );
}

async function tryAcquireBootstrapLockWithin(
  client: PrismaClient,
  deadlineMs = 2_000,
): Promise<Record<string, unknown>> {
  const startedAt = epochMs();
  try {
    const lockedConnectionId = await client.$transaction(
      async (transaction) => {
        const rows = await transaction.$queryRawUnsafe<Array<{ connection_id: bigint | string }>>(
          'SELECT CONNECTION_ID() AS connection_id',
        );
        await transaction.$queryRawUnsafe(
          'SELECT lock_key FROM bootstrap_locks WHERE lock_key = ? FOR UPDATE',
          FIRST_OWNER_BOOTSTRAP_LOCK_KEY,
        );
        return String(rows[0]?.connection_id ?? '');
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: deadlineMs,
        timeout: deadlineMs,
      },
    );
    return {
      status: 'fulfilled',
      deadline_ms: deadlineMs,
      connection_id: lockedConnectionId,
      elapsed_ms: Number((epochMs() - startedAt).toFixed(3)),
    };
  } catch (error) {
    return {
      status: 'rejected',
      deadline_ms: deadlineMs,
      elapsed_ms: Number((epochMs() - startedAt).toFixed(3)),
      ...safeErrorObservation(error, 'complete'),
    };
  }
}

function waitForMessage(
  child: ChildProcess,
  type: string,
  timeoutMs = TEST_PROCESS_WAIT_MS,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off('message', onMessage);
      reject(new Error(`worker message timeout: ${type}`));
    }, timeoutMs);
    const onMessage = (message: unknown): void => {
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === type
      ) {
        clearTimeout(timer);
        child.off('message', onMessage);
        resolve(message as Record<string, unknown>);
      }
    };
    child.on('message', onMessage);
  });
}

function waitForExit(child: ChildProcess, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      reject(new Error('worker did not exit after termination'));
    }, timeoutMs);
    const onExit = (): void => {
      clearTimeout(timer);
      resolve();
    };
    child.once('exit', onExit);
  });
}

async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  try {
    await waitForExit(child);
  } catch {
    child.kill('SIGKILL');
    await waitForExit(child);
  }
}

describe('first OWNER bootstrap concurrency with a real MySQL database', () => {
  const databaseUrl = requireTaskTestDatabaseUrl();
  const clients: PrismaClient[] = [];
  const children: ChildProcess[] = [];
  let admin: PrismaClient;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await admin.$connect();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(children.splice(0).map((child) => terminateChild(child)));
    await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
    await cleanupKnownSyntheticRows();
  });

  afterAll(async () => {
    await cleanupKnownSyntheticRows();
    await admin.$disconnect();
  });

  function newClient(): PrismaClient {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    clients.push(client);
    return client;
  }

  function bootstrapConfig(index: number): AppConfig {
    return createTestConfig({
      bootstrapOwnerUsername: `sw008-owner-${index}-${randomUUID()}`,
      bootstrapOwnerPassword: randomBytes(24).toString('base64url'),
      bootstrapOwnerName: `sw008-owner-${index}`,
      bootstrapStoreName: `sw008-bootstrap-store-${randomUUID()}`,
    });
  }

  function bootstrapService(client: PrismaClient, config: AppConfig): BootstrapOwnerService {
    return new BootstrapOwnerService(
      config,
      client as unknown as PrismaService,
      new PasswordService(),
    );
  }

  async function counts(): Promise<BootstrapCounts> {
    const [stores, owners, credentials] = await Promise.all([
      admin.store.count(),
      admin.staff.count({ where: { role: 'OWNER' } }),
      admin.staffCredential.count(),
    ]);
    return { stores, owners, credentials };
  }

  function bootstrapEvents(lines: string[]): Array<Record<string, unknown>> {
    return lines
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(
        (entry): entry is Record<string, unknown> =>
          entry !== null &&
          (entry.event === 'bootstrap_owner_created' || entry.event === 'bootstrap_owner_skipped'),
      );
  }

  async function cleanupKnownSyntheticRows(): Promise<void> {
    const stores = await admin.store.findMany({
      where: { name: { startsWith: SYNTHETIC_PREFIX } },
      select: { id: true },
    });
    const storeIds = stores.map((store) => store.id);
    if (storeIds.length === 0) return;
    const staff = await admin.staff.findMany({
      where: { storeId: { in: storeIds } },
      select: { id: true },
    });
    const staffIds = staff.map((entry) => entry.id);
    await admin.staffCredential.deleteMany({ where: { staffId: { in: staffIds } } });
    await admin.staff.deleteMany({ where: { id: { in: staffIds } } });
    await admin.store.deleteMany({ where: { id: { in: storeIds } } });
  }

  it('creates exactly one first OWNER with three independent in-transaction connections', async () => {
    const caseId = 'three-in-transaction-connections';
    const evidence = testEvidence(caseId);
    const sentinelTable = sentinelTableName();
    const writerU = newClient();
    const writerC = newClient();
    const committedReader = newClient();
    const experiment = new BehavioralIsolationCoordinator(
      evidence,
      writerU,
      writerC,
      committedReader,
      sentinelTable,
    );
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    const observationByWorker: Array<TransactionObservation | undefined> = [];
    const configs = [0, 1, 2].map(bootstrapConfig);
    const lockTrackers = configs.map((_, workerIndex) =>
      trackBootstrapLock(evidence, caseId, `worker_${workerIndex}`),
    );
    let initialStoreCount: number | null = null;
    let results: PromiseSettledResult<void>[] | undefined;
    let finalCounts: BootstrapCounts | undefined;
    let perWorker: Array<Record<string, unknown>> = [];
    let bootstrapEventObservations: Array<Record<string, unknown>> = [];
    let failure: unknown;
    let cleanupFailure: unknown;
    let phase: IsolationPhase = 'preflight';
    let sentinelAttempted = false;
    try {
      await cleanupKnownSyntheticRows();
      initialStoreCount = await admin.store.count();
      evidence.append('preflight_counts', 'preflight', {
        initial_store_count: initialStoreCount,
      });
      phase = 'sentinel_setup';
      sentinelAttempted = true;
      await createSentinel(admin, sentinelTable, evidence);
      phase = 'bootstrap_lock_acquired';
      results = await Promise.allSettled(
        configs.map((config, workerIndex) => {
          const lockTracker = lockTrackers[workerIndex];
          if (lockTracker === undefined) throw new Error('missing bootstrap lock tracker');
          const client = instrumentPrismaClient(newClient(), {
            ...lockTracker.hooks,
            onTransactionStart: (observation) => {
              observationByWorker[workerIndex] = observation;
              evidence.append('bootstrap_transaction_started', 'transaction_start', {
                worker_index: workerIndex,
                connection_id: observation.connectionId,
                session_isolation: observation.isolationLevel,
                requested_isolation_level: observation.requestedIsolationLevel,
              });
            },
            onBootstrapLockAcquired: (observation: BootstrapLockObservation) =>
              experiment.onBootstrapLockAcquired(workerIndex, observation),
          });
          return bootstrapService(client, config).onApplicationBootstrap();
        }),
      );
      evidence.append('all_worker_promises_settled', 'complete', {
        settlement_statuses: results.map((result) => result.status),
      });
    } catch (error) {
      failure = error;
      evidence.append('case_failed', 'complete', safeErrorObservation(error, phase));
    } finally {
      try {
        finalCounts = await counts();
        evidence.append('final_counts', 'final_counts', { ...finalCounts });
      } catch (error) {
        cleanupFailure ??= error;
        evidence.append('final_counts_failed', 'final_counts', safeErrorObservation(error, phase));
      }

      try {
        const credentials = await Promise.all(
          configs.map((config) =>
            admin.staffCredential.findUnique({
              where: { username: config.bootstrapOwnerUsername },
              select: { id: true },
            }),
          ),
        );
        perWorker = configs.map((_, workerIndex) => {
          const result = results?.[workerIndex];
          const credential = credentials[workerIndex];
          const observation = observationByWorker[workerIndex];
          const outcome =
            result === undefined
              ? null
              : result.status === 'rejected'
                ? 'failed'
                : credential === null || credential === undefined
                  ? 'skipped'
                  : 'created';
          return {
            worker_index: workerIndex,
            settlement_status: result?.status ?? null,
            outcome,
            created: outcome === 'created' ? true : outcome === 'skipped' ? false : null,
            skipped: outcome === 'skipped' ? true : outcome === 'created' ? false : null,
            credential_present: credential === undefined ? null : credential !== null,
            connection_id: observation?.connectionId ?? null,
            session_isolation: observation?.isolationLevel ?? null,
            requested_isolation_level: observation?.requestedIsolationLevel ?? null,
            ...(result?.status === 'rejected'
              ? { error: safeErrorObservation(result.reason, 'final_counts') }
              : {}),
          };
        });
        evidence.append('worker_outcomes', 'final_counts', { per_worker: perWorker });
      } catch (error) {
        cleanupFailure ??= error;
        evidence.append(
          'worker_outcomes_failed',
          'final_counts',
          safeErrorObservation(error, phase),
        );
      }

      bootstrapEventObservations = bootstrapEvents(logs);
      evidence.append('bootstrap_log_events', 'final_counts', {
        created_count: bootstrapEventObservations.filter(
          (entry) => entry.event === 'bootstrap_owner_created',
        ).length,
        skipped_count: bootstrapEventObservations.filter(
          (entry) => entry.event === 'bootstrap_owner_skipped',
        ).length,
      });

      try {
        const disconnected = clients.splice(0);
        const settlement = await Promise.allSettled(
          disconnected.map((client) => client.$disconnect()),
        );
        evidence.append('clients_disconnected', 'leader_cleanup', {
          client_count: disconnected.length,
          settlement_statuses: settlement.map((entry) => entry.status),
        });
        const rejected = settlement.find(
          (entry): entry is PromiseRejectedResult => entry.status === 'rejected',
        );
        if (rejected !== undefined) {
          cleanupFailure ??= rejected.reason;
          evidence.append(
            'client_disconnect_failed',
            'leader_cleanup',
            safeErrorObservation(rejected.reason, 'leader_cleanup'),
          );
        }
      } catch (error) {
        cleanupFailure ??= error;
        evidence.append(
          'client_disconnect_failed',
          'leader_cleanup',
          safeErrorObservation(error, 'leader_cleanup'),
        );
      }

      try {
        if (sentinelAttempted) await dropSentinel(admin, sentinelTable, evidence);
      } catch (error) {
        cleanupFailure ??= error;
        evidence.append(
          'sentinel_drop_failed',
          'sentinel_drop',
          safeErrorObservation(error, 'sentinel_drop'),
        );
      }

      try {
        await cleanupKnownSyntheticRows();
        evidence.append('fixture_cleanup', 'complete', { status: 'completed' });
      } catch (error) {
        cleanupFailure ??= error;
        evidence.append(
          'fixture_cleanup_failed',
          'complete',
          safeErrorObservation(error, 'complete'),
        );
      }
    }

    const observations = observationByWorker.filter(
      (entry): entry is TransactionObservation => entry !== undefined,
    );
    const behavior = experiment.summary;
    const behaviorConnectionIds = [
      behavior.leaderTransactionConnectionId,
      behavior.writerURead?.connectionId ?? null,
      behavior.writerCConnectionId,
      behavior.thirdPartyRead?.connectionId ?? null,
    ];
    const behavioralChecks = {
      leader_present: behavior.leaderWorkerIndex !== null,
      leader_connection_present: behavior.leaderTransactionConnectionId !== null,
      first_read_complete: behavior.firstRead?.complete === true,
      first_dirty_zero: behavior.firstRead?.dirtyProbe === 0,
      first_committed_zero: behavior.firstRead?.committedProbe === 0,
      writer_u_read_complete: behavior.writerURead?.complete === true,
      writer_u_read_dirty_one: behavior.writerURead?.dirtyProbe === 1,
      writer_u_updated_one: behavior.writerUUpdatedRows === 1,
      writer_u_connection_present: (behavior.writerURead?.connectionId ?? null) !== null,
      writer_u_was_uncommitted_at_second_read: behavior.writerUUncommittedAtSecondRead === true,
      writer_c_connection_present: behavior.writerCConnectionId !== null,
      writer_c_updated_one: behavior.writerCUpdatedRows === 1,
      writer_c_committed_at_second_read: behavior.writerCCommittedAtSecondRead === true,
      third_party_read_complete: behavior.thirdPartyRead?.complete === true,
      third_party_committed_one: behavior.thirdPartyRead?.committedProbe === 1,
      third_party_connection_present: (behavior.thirdPartyRead?.connectionId ?? null) !== null,
      behavior_connections_are_distinct:
        new Set(
          behaviorConnectionIds.filter(
            (connectionId): connectionId is string =>
              connectionId !== null && connectionId.length > 0,
          ),
        ).size === behaviorConnectionIds.length,
      second_read_complete: behavior.secondRead?.complete === true,
      second_dirty_zero: behavior.secondRead?.dirtyProbe === 0,
      second_committed_one: behavior.secondRead?.committedProbe === 1,
      first_and_second_same_connection:
        behavior.firstRead?.connectionId !== null &&
        behavior.firstRead?.connectionId === behavior.secondRead?.connectionId,
      second_matches_bootstrap_connection:
        behavior.secondRead?.connectionId === behavior.leaderTransactionConnectionId,
    };
    evidence.append('final_run_observation', 'complete', {
      initial_store_count: initialStoreCount,
      settlement_statuses: results?.map((result) => result.status) ?? null,
      final_counts: finalCounts ?? null,
      per_worker: perWorker,
      bootstrap_events: bootstrapEventObservations,
      behavior,
      behavioral_checks: behavioralChecks,
      experiment_budget_ms: SW011_EXPERIMENT_BUDGET_MS,
    });
    evidence.append('behavioral_verdict', 'complete', {
      verdict: Object.values(behavioralChecks).every(Boolean) ? 'READ_COMMITTED' : 'NOT_PROVEN',
      behavioral_checks: behavioralChecks,
    });

    if (failure !== undefined) throw failure;
    if (cleanupFailure !== undefined) throw cleanupFailure;
    if (results === undefined) throw new Error('worker results missing');

    expect(initialStoreCount).toBe(0);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
    const events = bootstrapEvents(logs);
    expect(events.filter((entry) => entry.event === 'bootstrap_owner_created')).toHaveLength(1);
    expect(events.filter((entry) => entry.event === 'bootstrap_owner_skipped')).toHaveLength(2);
    expect(new Set(observations.map((entry) => entry.connectionId)).size).toBe(3);
    expect(behavioralChecks).toEqual({
      leader_present: true,
      leader_connection_present: true,
      first_read_complete: true,
      first_dirty_zero: true,
      first_committed_zero: true,
      writer_u_read_complete: true,
      writer_u_read_dirty_one: true,
      writer_u_updated_one: true,
      writer_u_connection_present: true,
      writer_u_was_uncommitted_at_second_read: true,
      writer_c_connection_present: true,
      writer_c_updated_one: true,
      writer_c_committed_at_second_read: true,
      third_party_read_complete: true,
      third_party_committed_one: true,
      third_party_connection_present: true,
      behavior_connections_are_distinct: true,
      second_read_complete: true,
      second_dirty_zero: true,
      second_committed_one: true,
      first_and_second_same_connection: true,
      second_matches_bootstrap_connection: true,
    });
    expect(behavior.writerURead?.connectionId).not.toBe(behavior.leaderTransactionConnectionId);
    expect(behavior.writerCConnectionId).not.toBe(behavior.leaderTransactionConnectionId);
    expect(behavior.thirdPartyRead?.connectionId).not.toBe(behavior.leaderTransactionConnectionId);
  }, 30_000);

  it('serializes four different usernames on an existing no-OWNER store', async () => {
    const caseId = 'four-usernames-existing-no-owner';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const store = await admin.store.create({
      data: { name: `sw008-bootstrap-existing-${randomUUID()}`, status: 'ACTIVE' },
      select: { id: true },
    });
    await admin.staff.create({
      data: { storeId: store.id, name: 'sw008-existing-staff', role: 'STAFF', status: 'ACTIVE' },
    });
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    const observations: string[] = [];
    const configs = [0, 1, 2, 3].map(bootstrapConfig);
    let results: PromiseSettledResult<void>[] = [];
    let finalCounts: BootstrapCounts | undefined;
    try {
      results = await Promise.allSettled(
        configs.map((config) => {
          const client = instrumentPrismaClient(newClient(), {
            onTransactionStart: (observation) => {
              observations.push(observation.connectionId);
              evidence.append('bootstrap_transaction_started', 'transaction_start', {
                case_id: caseId,
                connection_id: observation.connectionId,
                session_isolation: observation.isolationLevel,
                requested_isolation_level: observation.requestedIsolationLevel,
              });
            },
          });
          return bootstrapService(client, config).onApplicationBootstrap();
        }),
      );
    } finally {
      finalCounts = await counts();
    }

    const events = bootstrapEvents(logs);
    const observedFinal = {
      case_id: caseId,
      settlement_statuses: results.map((result) => result.status),
      final_counts: finalCounts ?? null,
      store_staff_count: await admin.staff.count({ where: { storeId: store.id } }),
      connection_ids: observations,
      distinct_connection_count: new Set(observations).size,
      created_count: events.filter((entry) => entry.event === 'bootstrap_owner_created').length,
      skipped_count: events.filter((entry) => entry.event === 'bootstrap_owner_skipped').length,
    };
    evidence.append('four_usernames_final', 'complete', observedFinal);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
    expect(observedFinal.store_staff_count).toBe(2);
    expect(observedFinal.distinct_connection_count).toBe(4);
    expect(observedFinal.created_count).toBe(1);
    expect(observedFinal.skipped_count).toBe(3);
  });

  it('skips every bootstrap when an OWNER exists, preserves credentials, and allows another OWNER', async () => {
    const caseId = 'existing-owner-all-skips';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const store = await admin.store.create({
      data: { name: `sw008-bootstrap-owner-${randomUUID()}`, status: 'ACTIVE' },
      select: { id: true },
    });
    const owner = await admin.staff.create({
      data: { storeId: store.id, name: 'sw008-existing-owner', role: 'OWNER', status: 'ACTIVE' },
      select: { id: true },
    });
    const originalUsername = `sw008-existing-${randomUUID()}`;
    const originalHash = await new PasswordService().hash(randomBytes(24).toString('base64url'));
    await admin.staffCredential.create({
      data: { staffId: owner.id, username: originalUsername, passwordHash: originalHash },
    });
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    let results: PromiseSettledResult<void>[] = [];
    let finalCounts: BootstrapCounts | undefined;
    try {
      results = await Promise.allSettled(
        [0, 1, 2].map((index) =>
          bootstrapService(newClient(), bootstrapConfig(index)).onApplicationBootstrap(),
        ),
      );
    } finally {
      finalCounts = await counts();
    }

    const credential = await admin.staffCredential.findUnique({ where: { staffId: owner.id } });
    const skipEvents = bootstrapEvents(logs);
    const observedFinal = {
      case_id: caseId,
      settlement_statuses: results.map((result) => result.status),
      final_counts: finalCounts ?? null,
      all_events_are_skips: skipEvents.every((entry) => entry.event === 'bootstrap_owner_skipped'),
      skipped_count: skipEvents.filter((entry) => entry.event === 'bootstrap_owner_skipped').length,
      original_username: originalUsername,
      credential_username: credential?.username ?? null,
      credential_username_unchanged: credential?.username === originalUsername,
      credential_hash_unchanged: credential?.passwordHash === originalHash,
    };
    evidence.append('existing_owner_final', 'complete', observedFinal);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
    expect(observedFinal.all_events_are_skips).toBe(true);
    expect(observedFinal.credential_username).toBe(originalUsername);
    expect(observedFinal.credential_hash_unchanged).toBe(true);

    await admin.staff.create({
      data: { storeId: store.id, name: 'sw008-second-owner', role: 'OWNER', status: 'ACTIVE' },
    });
    const ownerCount = await admin.staff.count({ where: { storeId: store.id, role: 'OWNER' } });
    const credentialCount = await admin.staffCredential.count();
    evidence.append('existing_owner_second_owner_probe', 'complete', {
      case_id: caseId,
      owner_count: ownerCount,
      credential_count: credentialCount,
    });
    expect(ownerCount).toBe(2);
    expect(credentialCount).toBe(1);
  });

  it('fails closed when the fixed lock row is absent and restores the migration fixture', async () => {
    const caseId = 'missing-fixed-lock-row';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const errorLines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
      errorLines.push(String(line));
    });
    await admin.$executeRawUnsafe(
      'DELETE FROM bootstrap_locks WHERE lock_key = ?',
      FIRST_OWNER_BOOTSTRAP_LOCK_KEY,
    );
    let outcome: PromiseSettledResult<void> | undefined;
    let finalCounts: BootstrapCounts | undefined;
    try {
      outcome = await Promise.allSettled([
        bootstrapService(newClient(), bootstrapConfig(99)).onApplicationBootstrap(),
      ]).then(([result]) => result as PromiseSettledResult<void>);
      finalCounts = await counts();
    } finally {
      await admin.$executeRawUnsafe(
        'INSERT IGNORE INTO bootstrap_locks (lock_key) VALUES (?)',
        FIRST_OWNER_BOOTSTRAP_LOCK_KEY,
      );
    }
    const diagnostic = JSON.parse(errorLines[0] ?? '{}') as Record<string, unknown>;
    const fixtureRestored = await admin.$queryRawUnsafe<Array<{ lock_key: string }>>(
      'SELECT lock_key FROM bootstrap_locks WHERE lock_key = ?',
      FIRST_OWNER_BOOTSTRAP_LOCK_KEY,
    );
    evidence.append('missing_lock_row_final', 'complete', {
      case_id: caseId,
      outcome_status: outcome?.status ?? null,
      final_counts: finalCounts ?? null,
      diagnostic,
      fixture_restored_count: fixtureRestored.length,
    });
    expect(outcome?.status).toBe('rejected');
    expect(finalCounts).toEqual({ stores: 0, owners: 0, credentials: 0 });
    expect(diagnostic).toMatchObject({
      event: 'bootstrap_owner_failed',
      phase: 'acquire_bootstrap_lock',
      prisma_code: null,
      db_errno: null,
      sqlstate: null,
    });
    expect(fixtureRestored).toHaveLength(1);
  });

  it('rolls back a mid-creation failure without partial store, OWNER, or credential rows', async () => {
    const caseId = 'mid-creation-rollback';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const client = instrumentPrismaClient(newClient(), {
      onMutation: (model, operation) => {
        if (model === 'staffCredential' && operation === 'create') {
          throw new Error('synthetic bootstrap rollback');
        }
      },
    });
    let outcome: PromiseSettledResult<void> | undefined;
    let finalCounts: BootstrapCounts | undefined;
    try {
      outcome = await Promise.allSettled([
        bootstrapService(client, bootstrapConfig(0)).onApplicationBootstrap(),
      ]).then(([result]) => result as PromiseSettledResult<void>);
    } finally {
      finalCounts = await counts();
    }
    evidence.append('mid_creation_rollback_final', 'complete', {
      case_id: caseId,
      outcome_status: outcome?.status ?? null,
      final_counts: finalCounts ?? null,
    });
    expect(outcome?.status).toBe('rejected');
    expect(finalCounts).toEqual({ stores: 0, owners: 0, credentials: 0 });
  });

  it('bounds a real lock wait, releases on timeout, and leaves no pool-visible transaction lock', async () => {
    const caseId = 'bounded-lock-wait-timeout-release';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const holderRaw = newClient();
    const holderLocked = deferred<void>();
    const releaseHolder = deferred<void>();
    let holderSettled = false;
    let holderConnectionId = '';
    const holderTracker = trackBootstrapLock(evidence, caseId, 'holder');
    const holder = instrumentPrismaClient(holderRaw, {
      ...holderTracker.hooks,
      onTransactionStart: (observation) => {
        holderConnectionId = observation.connectionId;
      },
    });
    const holderOutcome = holder
      .$transaction(
        async (transaction) => {
          await transaction.$queryRawUnsafe(
            'SELECT lock_key FROM bootstrap_locks WHERE lock_key = ? FOR UPDATE',
            FIRST_OWNER_BOOTSTRAP_LOCK_KEY,
          );
          holderLocked.resolve();
          await releaseHolder.promise;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10_000,
          timeout: 30_000,
        },
      )
      .then(
        () => ({ status: 'fulfilled' as const }),
        (reason: unknown) => ({ status: 'rejected' as const, reason }),
      )
      .finally(() => {
        holderSettled = true;
      });

    const contenderTransaction = deferred<{ connectionId: string; isolationLevel: string }>();
    const contenderRaw = newClient();
    const contenderTracker = trackBootstrapLock(evidence, caseId, 'contender');
    const sessionLockWaitTimeout = {
      previous: null as number | null,
      set: null as number | null,
      restored: null as number | null,
      operations: [] as Array<Record<string, unknown>>,
    };
    let sessionSetCount = 0;
    const service = bootstrapService(
      instrumentPrismaClient(contenderRaw, {
        ...contenderTracker.hooks,
        onTransactionStart: (observation) => contenderTransaction.resolve(observation),
        onQueryRaw: async (sql, queryPhase, observation, error, result) => {
          await contenderTracker.hooks.onQueryRaw?.(sql, queryPhase, observation, error, result);
          if (
            queryPhase === 'after' &&
            sql.includes('@@SESSION.innodb_lock_wait_timeout')
          ) {
            const value = sessionTimeoutFromRows(result);
            sessionLockWaitTimeout.previous = value;
            sessionLockWaitTimeout.operations.push({
              operation: 'previous',
              value,
              connection_id: observation.connectionId,
              at_epoch_ms: epochMs(),
            });
          }
        },
        onExecuteRaw: async (sql, queryPhase, observation, parameters) => {
          if (
            queryPhase === 'after' &&
            /set\s+session\s+innodb_lock_wait_timeout/i.test(sql)
          ) {
            const value = sessionTimeoutValue(parameters[0]);
            if (sessionSetCount === 0) {
              sessionLockWaitTimeout.set = value;
            } else {
              sessionLockWaitTimeout.restored = value;
            }
            sessionSetCount += 1;
            sessionLockWaitTimeout.operations.push({
              operation: sessionSetCount === 1 ? 'set' : 'restored',
              value,
              connection_id: observation.connectionId,
              at_epoch_ms: epochMs(),
            });
          }
        },
      }),
      bootstrapConfig(0),
    );
    let contenderOutcome:
      { status: 'fulfilled' } | { status: 'rejected'; reason: unknown } | undefined;
    let contenderSettled = false;
    let finalCounts: BootstrapCounts | undefined;
    let waitProof: Awaited<ReturnType<typeof proveUnacquiredWindow>> | undefined;
    let sameClientLock: Record<string, unknown> | undefined;
    let freshClientLock: Record<string, unknown> | undefined;
    try {
      await holderLocked.promise;
      evidence.append('timeout_holder_locked', 'bootstrap_lock_acquired', {
        case_id: caseId,
        holder_connection_id: holderConnectionId,
        holder_tracker_events: holderTracker.events,
        holder_settled: holderSettled,
      });
      expect(holderConnectionId).not.toBe('');
      const startedAt = epochMs();
      const contenderPromise = service
        .onApplicationBootstrap()
        .then(
          () => ({ status: 'fulfilled' as const }),
          (reason: unknown) => ({ status: 'rejected' as const, reason }),
        )
        .finally(() => {
          contenderSettled = true;
        });
      const observation = await contenderTransaction.promise;
      waitProof = await proveUnacquiredWindow({
        tracker: contenderTracker,
        evidence,
        caseId,
        holderSettled: () => holderSettled,
        contenderSettled: () => contenderSettled,
        extra: {
          holder_connection_id: holderConnectionId,
          contender_connection_id: observation.connectionId,
        },
      });
      expect(contenderSettled).toBe(false);
      contenderOutcome = await contenderPromise;
      const elapsedMs = Number((epochMs() - startedAt).toFixed(3));
      evidence.append('timeout_contender_result', 'complete', {
        case_id: caseId,
        holder_connection_id: holderConnectionId,
        contender_connection_id: observation.connectionId,
        contender_status: contenderOutcome.status,
        contender_error:
          contenderOutcome.status === 'rejected'
            ? safeErrorObservation(contenderOutcome.reason, 'complete')
            : null,
        elapsed_ms: elapsedMs,
        session_lock_wait_timeout: sessionLockWaitTimeout,
        tracker_events: contenderTracker.events,
        wait_proof: waitProof,
        contender_settled: contenderSettled,
      });
      expect(sessionLockWaitTimeout.previous).not.toBeNull();
      expect(sessionLockWaitTimeout.set).toBe(10);
      expect(sessionLockWaitTimeout.restored).toBe(sessionLockWaitTimeout.previous);
      expect(observation.connectionId).not.toBe(holderConnectionId);
      expect(elapsedMs).toBeLessThanOrEqual(20_000);
      expect(contenderOutcome.status).toBe('rejected');
      expect(String((contenderOutcome as { reason: unknown }).reason)).toContain(
        'bootstrap_owner_failed',
      );

      const releaseAtEpochMs = epochMs();
      releaseHolder.resolve();
      const holderResult = await holderOutcome;
      evidence.append('timeout_holder_released', 'complete', {
        case_id: caseId,
        release_at_epoch_ms: releaseAtEpochMs,
        holder_status: holderResult.status,
        holder_connection_id: holderConnectionId,
        contender_tracker_events: contenderTracker.events,
        timing_without_acquire: lockTimingSummary(contenderTracker, releaseAtEpochMs),
      });

      const sameClientProbe = await tryAcquireBootstrapLockWithin(contenderRaw);
      sameClientLock = sameClientProbe;
      const freshClient = newClient();
      const freshClientProbe = await tryAcquireBootstrapLockWithin(freshClient);
      freshClientLock = freshClientProbe;
      evidence.append('timeout_pool_residue_probe', 'complete', {
        case_id: caseId,
        contender_connection_id: observation.connectionId,
        same_client_new_transaction: sameClientLock,
        fresh_client_new_transaction: freshClientLock,
      });
      expect(holderResult.status).toBe('fulfilled');
      expect(sameClientProbe.status).toBe('fulfilled');
      expect(freshClientProbe.status).toBe('fulfilled');
      expect(Number(sameClientProbe.elapsed_ms)).toBeLessThanOrEqual(3_000);
      expect(Number(freshClientProbe.elapsed_ms)).toBeLessThanOrEqual(3_000);

      await service.onApplicationBootstrap();
      finalCounts = await counts();
      evidence.append('timeout_final', 'complete', {
        case_id: caseId,
        final_counts: finalCounts,
        contender_connection_id: observation.connectionId,
        holder_connection_id: holderConnectionId,
        same_client_new_transaction: sameClientLock,
        fresh_client_new_transaction: freshClientLock,
      });
      expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
    } catch (error) {
      evidence.append('timeout_case_failed', 'complete', {
        case_id: caseId,
        holder_connection_id: holderConnectionId || null,
        contender_settled: contenderSettled,
        wait_proof: waitProof ?? null,
        session_lock_wait_timeout: sessionLockWaitTimeout,
        same_client_new_transaction: sameClientLock ?? null,
        fresh_client_new_transaction: freshClientLock ?? null,
        ...safeErrorObservation(error, 'complete'),
      });
      throw error;
    } finally {
      releaseHolder.resolve();
      await holderOutcome;
      finalCounts ??= await counts();
      evidence.append('timeout_cleanup', 'complete', {
        case_id: caseId,
        holder_connection_id: holderConnectionId || null,
        final_counts: finalCounts,
        holder_status: 'released',
      });
    }
  }, 45_000);

  it('releases the lock after a holder process is killed and a later bootstrap succeeds', async () => {
    const caseId = 'killed-holder-lock-release';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const workerPath = fileURLToPath(
      new URL('./support/f03-lock-holder.worker.ts', import.meta.url),
    );
    const child = fork(workerPath, [], {
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: process.env,
    });
    children.push(child);
    const locked = waitForMessage(child, 'locked');
    const lockMessage = await locked;
    const holderConnectionId = String(lockMessage.connectionId);
    evidence.append('killed_holder_locked', 'bootstrap_lock_acquired', {
      case_id: caseId,
      child_pid: child.pid ?? null,
      holder_connection_id: holderConnectionId,
    });
    expect(String(lockMessage.connectionId)).not.toBe('undefined');
    const killAtEpochMs = epochMs();
    child.kill('SIGKILL');
    await waitForExit(child);
    let outcome: PromiseSettledResult<void> | undefined;
    let finalCounts: BootstrapCounts | undefined;
    try {
      outcome = await Promise.allSettled([
        bootstrapService(newClient(), bootstrapConfig(0)).onApplicationBootstrap(),
      ]).then(([result]) => result as PromiseSettledResult<void>);
    } finally {
      finalCounts = await counts();
    }
    evidence.append('killed_holder_final', 'complete', {
      case_id: caseId,
      child_pid: child.pid ?? null,
      holder_connection_id: holderConnectionId,
      kill_at_epoch_ms: killAtEpochMs,
      exit_observed_at_epoch_ms: epochMs(),
      exit_code: child.exitCode,
      exit_signal: child.signalCode,
      outcome_status: outcome?.status ?? null,
      final_counts: finalCounts ?? null,
    });
    expect(outcome?.status).toBe('fulfilled');
    expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
  }, 30_000);

  it('runs three independent processes against an empty database with one creator', async () => {
    const caseId = 'three-processes-empty-database';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const initialStoreCount = await admin.store.count();
    evidence.append('three_process_preflight', 'preflight', {
      case_id: caseId,
      initial_store_count: initialStoreCount,
    });
    expect(initialStoreCount).toBe(0);
    const configs = [0, 1, 2].map(bootstrapConfig);
    let results: Array<Record<string, unknown>> = [];
    let finalCounts: BootstrapCounts | undefined;
    try {
      results = await runBootstrapWorkers(configs, evidence, caseId);
    } finally {
      finalCounts = await counts();
    }
    const observedFinal = {
      case_id: caseId,
      settlement_statuses: results.map((entry) => entry.status),
      created_count: results.filter((entry) => entry.created === true).length,
      skipped_count: results.filter((entry) => entry.created === false).length,
      connection_ids: results.map((entry) => String(entry.connectionId)),
      distinct_connection_count: new Set(results.map((entry) => String(entry.connectionId))).size,
      final_counts: finalCounts ?? null,
    };
    evidence.append('three_process_empty_final', 'complete', observedFinal);
    expect(observedFinal.settlement_statuses).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(observedFinal.created_count).toBe(1);
    expect(observedFinal.skipped_count).toBe(2);
    expect(observedFinal.distinct_connection_count).toBe(3);
    expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
  }, 30_000);

  it('runs three independent processes against an existing no-OWNER store with one creator', async () => {
    const caseId = 'three-processes-existing-no-owner';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const store = await admin.store.create({
      data: { name: `sw008-process-existing-${randomUUID()}`, status: 'ACTIVE' },
      select: { id: true },
    });
    await admin.staff.create({
      data: { storeId: store.id, name: 'sw008-process-staff', role: 'STAFF', status: 'ACTIVE' },
    });
    const configs = [3, 4, 5].map(bootstrapConfig);
    let results: Array<Record<string, unknown>> = [];
    let finalCounts: BootstrapCounts | undefined;
    try {
      results = await runBootstrapWorkers(configs, evidence, caseId);
    } finally {
      finalCounts = await counts();
    }
    const storeStaffCount = await admin.staff.count({ where: { storeId: store.id } });
    const observedFinal = {
      case_id: caseId,
      created_count: results.filter((entry) => entry.created === true).length,
      skipped_count: results.filter((entry) => entry.created === false).length,
      connection_ids: results.map((entry) => String(entry.connectionId)),
      distinct_connection_count: new Set(results.map((entry) => String(entry.connectionId))).size,
      final_counts: finalCounts ?? null,
      store_staff_count: storeStaffCount,
    };
    evidence.append('three_process_existing_no_owner_final', 'complete', observedFinal);
    expect(observedFinal.created_count).toBe(1);
    expect(observedFinal.skipped_count).toBe(2);
    expect(observedFinal.distinct_connection_count).toBe(3);
    expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
    expect(storeStaffCount).toBe(2);
  }, 30_000);

  it('runs three independent processes against an existing OWNER as all-skips with unchanged values', async () => {
    const caseId = 'three-processes-existing-owner-all-skips';
    const evidence = testEvidence(caseId);
    await cleanupKnownSyntheticRows();
    const store = await admin.store.create({
      data: { name: `sw008-process-owner-${randomUUID()}`, status: 'ACTIVE' },
      select: { id: true },
    });
    const owner = await admin.staff.create({
      data: { storeId: store.id, name: 'sw008-process-owner', role: 'OWNER', status: 'ACTIVE' },
      select: { id: true },
    });
    const originalUsername = `sw008-process-existing-${randomUUID()}`;
    const originalHash = await new PasswordService().hash(randomBytes(24).toString('base64url'));
    await admin.staffCredential.create({
      data: { staffId: owner.id, username: originalUsername, passwordHash: originalHash },
    });
    const configs = [6, 7, 8].map(bootstrapConfig);
    let results: Array<Record<string, unknown>> = [];
    let finalCounts: BootstrapCounts | undefined;
    try {
      results = await runBootstrapWorkers(configs, evidence, caseId);
    } finally {
      finalCounts = await counts();
    }
    const credential = await admin.staffCredential.findUnique({ where: { staffId: owner.id } });
    const observedFinal = {
      case_id: caseId,
      settlement_statuses: results.map((entry) => entry.status),
      all_skipped: results.every((entry) => entry.created === false),
      connection_ids: results.map((entry) => String(entry.connectionId)),
      distinct_connection_count: new Set(results.map((entry) => String(entry.connectionId))).size,
      final_counts: finalCounts ?? null,
      credential_username: credential?.username ?? null,
      credential_username_unchanged: credential?.username === originalUsername,
      credential_hash_unchanged: credential?.passwordHash === originalHash,
    };
    evidence.append('three_process_existing_owner_final', 'complete', observedFinal);
    expect(observedFinal.settlement_statuses).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(observedFinal.all_skipped).toBe(true);
    expect(finalCounts).toEqual({ stores: 1, owners: 1, credentials: 1 });
    expect(observedFinal.credential_username).toBe(originalUsername);
    expect(observedFinal.credential_hash_unchanged).toBe(true);
  }, 30_000);

  async function runBootstrapWorkers(
    configs: AppConfig[],
    evidence: Sw011EvidenceWriter,
    caseId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const workerPath = fileURLToPath(new URL('./support/f03-bootstrap.worker.ts', import.meta.url));
    const started = configs.map((config) => {
      const child = fork(workerPath, [], {
        execArgv: ['--import', 'tsx'],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: process.env,
      });
      children.push(child);
      const result = waitForMessage(child, 'result');
      const exit = waitForExit(child);
      child.send({
        type: 'start',
        username: config.bootstrapOwnerUsername,
        password: config.bootstrapOwnerPassword,
        ownerName: config.bootstrapOwnerName,
        storeName: config.bootstrapStoreName,
      });
      evidence.append('bootstrap_worker_spawned', 'preflight', {
        case_id: caseId,
        child_pid: child.pid ?? null,
        spawn_at_epoch_ms: epochMs(),
      });
      return { child, result, exit };
    });
    const results: Array<Record<string, unknown>> = [];
    for (const entry of started) {
      const message = await entry.result;
      await entry.exit;
      evidence.append('bootstrap_worker_finished', 'complete', {
        case_id: caseId,
        child_pid: entry.child.pid ?? null,
        exit_code: entry.child.exitCode,
        exit_signal: entry.child.signalCode,
        finished_at_epoch_ms: epochMs(),
        result: message,
      });
      expect(entry.child.pid).toBeGreaterThan(0);
      expect(entry.child.exitCode).toBe(0);
      results.push(message);
    }
    return results;
  }
});
