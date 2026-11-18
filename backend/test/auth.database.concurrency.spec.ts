import 'reflect-metadata';

import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Prisma, PrismaClient } from '@prisma/client';
import type { StaffRole } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFailed } from 'vitest';

import { PasswordService } from '../src/auth/password.service.js';
import {
  ACCOUNT_LOCK_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  StaffAuthService,
} from '../src/auth/staff-auth.service.js';
import { TokenService } from '../src/auth/token.service.js';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import {
  createLockSqlTracker,
  epochMs,
  lockTimingSummary,
  proveUnacquiredWindow,
  waitForLockAcquire,
} from './support/lock-wait-observer.js';
import type { LockSqlTracker } from './support/lock-wait-observer.js';
import { safeErrorObservation, Sw011EvidenceWriter } from './support/sw011-behavioral-isolation.js';
import { createTestConfig } from './support/test-config.js';
import { instrumentPrismaClient } from './support/instrumented-prisma.js';
import { requireTaskTestDatabaseUrl } from './support/task-database.js';

const PASSWORD = 'real-database-concurrency-password';

interface TestIdentity {
  staffId: bigint;
  storeId: bigint;
  username: string;
}

function makeService(client: PrismaClient): StaffAuthService {
  return new StaffAuthService(
    client as unknown as PrismaService,
    new PasswordService(),
    new TokenService(
      createTestConfig({
        jwtAccessSecret: randomBytes(32).toString('base64url'),
        jwtAccessTtlSeconds: 60,
      }),
    ),
  );
}

function expectInvalidLogin(result: PromiseSettledResult<unknown>): void {
  expect(result.status).toBe('rejected');
  if (result.status === 'rejected') {
    const exception = result.reason as {
      getStatus?: () => number;
      getResponse?: () => unknown;
    };
    expect(exception.getStatus?.()).toBe(401);
    expect(exception.getResponse?.()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  }
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

type OverlapOutcome =
  | { readonly status: 'fulfilled'; readonly value: unknown }
  | { readonly status: 'rejected'; readonly reason: unknown };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function responseStatus(reason: unknown): number | undefined {
  return (reason as { getStatus?: () => number } | undefined)?.getStatus?.();
}

function waitForChildExit(child: ChildProcess, timeoutMs = 5_000): Promise<boolean> {
  return new Promise((resolvePromise) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolvePromise(true);
      return;
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolvePromise(false);
    }, timeoutMs);
    const onExit = (): void => {
      clearTimeout(timer);
      resolvePromise(true);
    };
    child.once('exit', onExit);
  });
}

function testEvidence(caseId: string): Sw011EvidenceWriter {
  const evidence = new Sw011EvidenceWriter(process.env, 'f02-lock-wait.jsonl');
  evidence.appendRunBinding('test/auth.database.concurrency.spec.ts');
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

function trackStaffCredentialLock(
  evidence: Sw011EvidenceWriter,
  caseId: string,
  role: 'holder' | 'contender',
): LockSqlTracker {
  return createLockSqlTracker(
    (sql) => {
      const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
      return normalized.includes('staff_credentials') && normalized.includes('for update');
    },
    (event) =>
      evidence.append('lock_sql_timing', role, {
        case_id: caseId,
        role,
        ...event,
      }),
  );
}

function observedSettlement(
  result: PromiseSettledResult<unknown> | OverlapOutcome,
): Record<string, unknown> {
  if (result.status === 'fulfilled') return { status: 'fulfilled' };
  return { status: 'rejected', status_code: responseStatus(result.reason) ?? null };
}

async function committedFailedAttempts(client: PrismaClient, staffId: bigint): Promise<number> {
  return client.$transaction(
    async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<Array<{ failed_attempts: number | bigint }>>(
        'SELECT failed_attempts FROM staff_credentials WHERE staff_id = ?',
        staffId.toString(),
      );
      return Number(rows[0]?.failed_attempts ?? -1);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

async function waitForWorkerMessage(
  child: ChildProcess,
  event: string,
  timeoutMs = 5_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off('message', onMessage);
      reject(new Error(`worker event timeout: ${event}`));
    }, timeoutMs);
    const onMessage = (message: unknown): void => {
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === 'event' &&
        (message as { event?: unknown }).event === event
      ) {
        clearTimeout(timer);
        child.off('message', onMessage);
        resolve(message as Record<string, unknown>);
      }
    };
    child.on('message', onMessage);
  });
}

async function waitForWorkerResult(
  child: ChildProcess,
  timeoutMs = 8_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off('message', onMessage);
      reject(new Error('worker result timeout'));
    }, timeoutMs);
    const onMessage = (message: unknown): void => {
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === 'result'
      ) {
        clearTimeout(timer);
        child.off('message', onMessage);
        resolve(message as Record<string, unknown>);
      }
    };
    child.on('message', onMessage);
  });
}

describe('staff login concurrency with independent MySQL connections', () => {
  const databaseUrl = requireTaskTestDatabaseUrl();
  const passwords = new PasswordService();
  const clients: PrismaClient[] = [];
  const createdStaffIds: bigint[] = [];
  const createdStoreIds: bigint[] = [];
  let admin: PrismaClient;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await admin.$connect();
  });

  afterEach(async () => {
    for (const staffId of createdStaffIds.splice(0)) {
      await admin.staffCredential.deleteMany({ where: { staffId } });
      await admin.staff.deleteMany({ where: { id: staffId } });
    }
    for (const storeId of createdStoreIds.splice(0)) {
      await admin.store.deleteMany({ where: { id: storeId } });
    }
    await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
  });

  afterAll(async () => {
    await admin.$disconnect();
  });

  function newClient(): PrismaClient {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    clients.push(client);
    return client;
  }

  async function createIdentity(role: StaffRole = 'MANAGER'): Promise<TestIdentity> {
    const suffix = randomUUID();
    const store = await admin.store.create({
      data: { name: `sw006-auth-concurrency-store-${suffix}`, status: 'ACTIVE' },
      select: { id: true },
    });
    createdStoreIds.push(store.id);
    const staff = await admin.staff.create({
      data: {
        storeId: store.id,
        name: `sw006-auth-concurrency-staff-${suffix}`,
        role,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    createdStaffIds.push(staff.id);
    const username = `sw006-auth-concurrency-${suffix}`;
    await admin.staffCredential.create({
      data: { staffId: staff.id, username, passwordHash: await passwords.hash(PASSWORD) },
    });
    return { staffId: staff.id, storeId: store.id, username };
  }

  async function resetFailedAttempts(identity: TestIdentity): Promise<void> {
    await admin.staffCredential.update({
      where: { staffId: identity.staffId },
      data: { failedAttempts: 2, lockedUntil: null },
    });
  }

  async function connectionId(client: PrismaClient): Promise<string> {
    const rows = await client.$queryRawUnsafe<Array<{ connection_id: bigint | string }>>(
      'SELECT CONNECTION_ID() AS connection_id',
    );
    return String(rows[0]?.connection_id);
  }

  it('serializes parallel wrong-password attempts and locks exactly at the threshold', async () => {
    const caseId = 'parallel-threshold';
    const evidence = testEvidence(caseId);
    const identity = await createIdentity();
    const independentClients = Array.from({ length: MAX_FAILED_LOGIN_ATTEMPTS }, () => newClient());
    const connectionIds = await Promise.all(independentClients.map(connectionId));
    evidence.append('parallel_connections', 'preflight', {
      case_id: caseId,
      connection_ids: connectionIds,
      distinct_connection_count: new Set(connectionIds).size,
      expected_client_count: independentClients.length,
    });
    expect(new Set(connectionIds).size).toBe(independentClients.length);

    const results = await Promise.allSettled(
      independentClients.map((client) =>
        makeService(client).login({ username: identity.username, password: 'wrong password' }),
      ),
    );
    const credential = await admin.staffCredential.findUnique({
      where: { staffId: identity.staffId },
    });
    evidence.append('parallel_threshold_result', 'complete', {
      case_id: caseId,
      results: results.map(observedSettlement),
      failed_attempts: credential?.failedAttempts ?? null,
      locked_until_epoch_ms: credential?.lockedUntil?.getTime() ?? null,
      expected_failed_attempts: MAX_FAILED_LOGIN_ATTEMPTS,
      account_lock_duration_ms: ACCOUNT_LOCK_DURATION_MS,
    });
    for (const result of results) {
      expectInvalidLogin(result);
    }

    expect(credential?.failedAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
    expect(credential?.lockedUntil).not.toBeNull();
    expect(credential?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(credential?.lockedUntil?.getTime()).toBeLessThanOrEqual(
      Date.now() + ACCOUNT_LOCK_DURATION_MS + 5_000,
    );

    const lockedCorrectPassword = await Promise.allSettled([
      makeService(newClient()).login({ username: identity.username, password: PASSWORD }),
    ]);
    evidence.append('locked_correct_password_result', 'complete', {
      case_id: caseId,
      results: lockedCorrectPassword.map(observedSettlement),
    });
    expectInvalidLogin(lockedCorrectPassword[0] as PromiseSettledResult<unknown>);
  });

  it('preserves failure then success then later-failure ordering', async () => {
    const caseId = 'failure-success-failure-order';
    const evidence = testEvidence(caseId);
    const identity = await createIdentity();
    const earlierFailureClient = newClient();
    const successClient = newClient();
    const laterFailureClient = newClient();
    const connectionIds = await Promise.all(
      [earlierFailureClient, successClient, laterFailureClient].map(connectionId),
    );
    evidence.append('ordering_connections', 'preflight', {
      case_id: caseId,
      connection_ids: connectionIds,
      distinct_connection_count: new Set(connectionIds).size,
    });
    expect(new Set(connectionIds).size).toBe(3);

    for (let attempt = 1; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      await expect(
        makeService(earlierFailureClient).login({
          username: identity.username,
          password: 'wrong password',
        }),
      ).rejects.toMatchObject({ status: 401 });
      const failed = await admin.staffCredential.findUnique({
        where: { staffId: identity.staffId },
      });
      evidence.append('ordering_failure_attempt', 'complete', {
        case_id: caseId,
        attempt,
        failed_attempts: failed?.failedAttempts ?? null,
        locked_until_epoch_ms: failed?.lockedUntil?.getTime() ?? null,
      });
      expect(failed?.failedAttempts).toBe(attempt);
      expect(failed?.lockedUntil).toBeNull();
    }

    const success = await makeService(successClient).login({
      username: identity.username,
      password: PASSWORD,
    });
    evidence.append('ordering_success_result', 'complete', {
      case_id: caseId,
      access_token_present: success.accessToken.length > 0,
      token_type: success.tokenType,
      expires_in: success.expiresIn,
    });
    expect(success.accessToken.length).toBeGreaterThan(0);
    let credential = await admin.staffCredential.findUnique({
      where: { staffId: identity.staffId },
    });
    evidence.append('ordering_after_success', 'complete', {
      case_id: caseId,
      failed_attempts: credential?.failedAttempts ?? null,
      locked_until_epoch_ms: credential?.lockedUntil?.getTime() ?? null,
    });
    expect(credential?.failedAttempts).toBe(0);
    expect(credential?.lockedUntil).toBeNull();

    await expect(
      makeService(laterFailureClient).login({
        username: identity.username,
        password: 'wrong password',
      }),
    ).rejects.toMatchObject({ status: 401 });

    credential = await admin.staffCredential.findUnique({
      where: { staffId: identity.staffId },
    });
    evidence.append('ordering_final', 'complete', {
      case_id: caseId,
      failed_attempts: credential?.failedAttempts ?? null,
      locked_until_epoch_ms: credential?.lockedUntil?.getTime() ?? null,
    });
    expect(credential?.failedAttempts).toBe(1);
    expect(credential?.lockedUntil).toBeNull();
  });

  it('overlaps committed failure before success: final reset is zero', async () => {
    await runOverlapScenario('committed-failure-before-success', 'failure', false, 'success');
  }, 15_000);

  it('overlaps committed success before failure: final failure count is one', async () => {
    await runOverlapScenario('committed-success-before-failure', 'success', false, 'failure');
  }, 15_000);

  it('rolls back a failure update before success: contender reads the original two', async () => {
    await runOverlapScenario('rolled-back-failure-before-success', 'failure', true, 'success');
  }, 15_000);

  it('rolls back a success reset before failure: contender reads the original two', async () => {
    await runOverlapScenario('rolled-back-success-before-failure', 'success', true, 'failure');
  }, 15_000);

  it('overlaps a committed failure and success across two OS processes', async () => {
    const caseId = 'cross-process-committed-failure-before-success';
    const evidence = testEvidence(caseId);
    const identity = await createIdentity();
    await resetFailedAttempts(identity);
    const observer = newClient();
    const observerConnectionId = await connectionId(observer);
    const workerPath = fileURLToPath(new URL('./support/f02-holder.worker.ts', import.meta.url));
    const child = fork(workerPath, [], {
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: process.env,
    });
    let released = false;
    let contenderSettled = false;
    let contenderOutcome: Promise<OverlapOutcome> | undefined;

    try {
      const transactionStartedPromise = waitForWorkerMessage(child, 'transaction_started');
      const afterWritePromise = waitForWorkerMessage(child, 'holder_after_write');
      child.send({
        type: 'start',
        username: identity.username,
        password: 'wrong password',
      });
      const transactionStarted = await transactionStartedPromise;
      const afterWrite = await afterWritePromise;
      const holderConnectionId = String(afterWrite.connectionId);
      evidence.append('cross_process_holder_write', 'complete', {
        case_id: caseId,
        child_pid: child.pid ?? null,
        holder_connection_id: holderConnectionId,
        transaction_connection_id: transactionStarted.connectionId,
        holder_write_completed_at_epoch_ms: afterWrite.atEpochMs ?? null,
      });
      expect(holderConnectionId).not.toBe('undefined');
      expect(transactionStarted.connectionId).toBe(holderConnectionId);

      const contenderTransaction = deferred<{ connectionId: string; isolationLevel: string }>();
      const tracker = trackStaffCredentialLock(evidence, caseId, 'contender');
      const contenderClient = instrumentPrismaClient(newClient(), {
        ...tracker.hooks,
        onTransactionStart: (observation) => contenderTransaction.resolve(observation),
      });
      contenderOutcome = makeService(contenderClient)
        .login({ username: identity.username, password: PASSWORD })
        .then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason: unknown) => ({ status: 'rejected' as const, reason }),
        )
        .finally(() => {
          contenderSettled = true;
        });
      const contenderObservation = await contenderTransaction.promise;
      const contenderConnectionId = contenderObservation.connectionId;
      expect(contenderConnectionId).not.toBe(holderConnectionId);

      const waitProof = await proveUnacquiredWindow({
        tracker,
        evidence,
        caseId,
        holderSettled: () => child.exitCode !== null || child.signalCode !== null,
        contenderSettled: () => contenderSettled,
        extra: {
          holder_connection_id: holderConnectionId,
          contender_connection_id: contenderConnectionId,
          child_pid: child.pid ?? null,
        },
      });
      const committedBeforeRelease = await committedFailedAttempts(observer, identity.staffId);
      evidence.append('cross_process_pre_release_observation', 'complete', {
        case_id: caseId,
        contender_connection_id: contenderConnectionId,
        holder_connection_id: holderConnectionId,
        observer_connection_id: observerConnectionId,
        committed_failed_attempts: committedBeforeRelease,
        contender_settled: contenderSettled,
        wait_proof: waitProof,
      });
      expect(contenderSettled).toBe(false);
      expect(committedBeforeRelease).toBe(2);
      expect(observerConnectionId).not.toBe(holderConnectionId);
      expect(observerConnectionId).not.toBe(contenderConnectionId);

      released = true;
      const holderResultPromise = waitForWorkerResult(child);
      const releaseAtEpochMs = epochMs();
      child.send({ type: 'release' });
      const holderResult = await holderResultPromise;
      const acquired = await waitForLockAcquire(tracker);
      const timing = lockTimingSummary(tracker, releaseAtEpochMs);
      evidence.append('cross_process_release_and_acquire', 'complete', {
        case_id: caseId,
        holder_result: holderResult,
        acquired,
        timing,
      });
      expect(timing.ordered).toBe(true);
      expect(holderResult).toMatchObject({ status: 'rejected', statusCode: 401 });
      await expect(contenderOutcome).resolves.toMatchObject({ status: 'fulfilled' });

      const credential = await admin.staffCredential.findUnique({
        where: { staffId: identity.staffId },
      });
      evidence.append('cross_process_final', 'complete', {
        case_id: caseId,
        failed_attempts: credential?.failedAttempts ?? null,
        locked_until_epoch_ms: credential?.lockedUntil?.getTime() ?? null,
        holder_exit_code: child.exitCode,
        holder_signal: child.signalCode,
        contender_settled: contenderSettled,
      });
      expect(credential?.failedAttempts).toBe(0);
      expect(credential?.lockedUntil).toBeNull();
    } catch (error) {
      evidence.append('cross_process_failed', 'complete', {
        case_id: caseId,
        ...safeErrorObservation(error, 'complete'),
      });
      throw error;
    } finally {
      if (!released && child.connected) child.send({ type: 'release' });
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        if (!(await waitForChildExit(child))) {
          child.kill('SIGKILL');
          if (!(await waitForChildExit(child))) {
            throw new Error('holder process did not terminate after SIGTERM/SIGKILL');
          }
        }
      }
      if (contenderOutcome) await contenderOutcome;
      evidence.append('cross_process_settlement', 'complete', {
        case_id: caseId,
        holder_exit_code: child.exitCode,
        holder_signal: child.signalCode,
        contender_settled: contenderSettled,
      });
      expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
      expect(contenderSettled).toBe(true);
    }
  }, 30_000);

  async function runOverlapScenario(
    caseId: string,
    holderKind: 'failure' | 'success',
    rollback: boolean,
    contenderKind: 'failure' | 'success',
  ): Promise<void> {
    const evidence = testEvidence(caseId);
    const identity = await createIdentity();
    await resetFailedAttempts(identity);
    const observer = newClient();
    const observerConnectionId = await connectionId(observer);
    const holderAfterWrite = deferred<void>();
    const releaseHolder = deferred<void>();
    const contenderTransaction = deferred<{ connectionId: string; isolationLevel: string }>();
    let holderConnectionId = '';
    let holderWriteCompletedAtEpochMs: number | null = null;
    let holderSettled = false;
    let contenderSettled = false;

    const holderClient = instrumentPrismaClient(newClient(), {
      onTransactionStart: (observation) => {
        holderConnectionId = observation.connectionId;
      },
      onMutation: async (model, operation) => {
        if (model === 'staffCredential' && operation === 'update') {
          holderWriteCompletedAtEpochMs = epochMs();
          evidence.append('overlap_holder_after_write', 'complete', {
            case_id: caseId,
            holder_kind: holderKind,
            rollback,
            connection_id: holderConnectionId,
            write_completed_at_epoch_ms: holderWriteCompletedAtEpochMs,
          });
          holderAfterWrite.resolve();
          await releaseHolder.promise;
          if (rollback) throw new Error('synthetic overlap rollback');
        }
      },
    });
    const holderOutcome = makeService(holderClient)
      .login({
        username: identity.username,
        password: holderKind === 'success' ? PASSWORD : 'wrong password',
      })
      .then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason: unknown) => ({ status: 'rejected' as const, reason }),
      )
      .finally(() => {
        holderSettled = true;
      });

    let contenderOutcome:
      | Promise<{ status: 'fulfilled'; value: unknown } | { status: 'rejected'; reason: unknown }>
      | undefined;
    try {
      await holderAfterWrite.promise;
      const tracker = trackStaffCredentialLock(evidence, caseId, 'contender');
      const contenderClient = instrumentPrismaClient(newClient(), {
        ...tracker.hooks,
        onTransactionStart: (observation) => contenderTransaction.resolve(observation),
      });
      contenderOutcome = makeService(contenderClient)
        .login({
          username: identity.username,
          password: contenderKind === 'success' ? PASSWORD : 'wrong password',
        })
        .then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason: unknown) => ({ status: 'rejected' as const, reason }),
        )
        .finally(() => {
          contenderSettled = true;
        });

      const contenderObservation = await contenderTransaction.promise;
      const waitProof = await proveUnacquiredWindow({
        tracker,
        evidence,
        caseId,
        holderSettled: () => holderSettled,
        contenderSettled: () => contenderSettled,
        extra: {
          holder_kind: holderKind,
          rollback,
          contender_kind: contenderKind,
          holder_connection_id: holderConnectionId,
          contender_connection_id: contenderObservation.connectionId,
          observer_connection_id: observerConnectionId,
        },
      });
      expect(contenderObservation.connectionId).not.toBe(holderConnectionId);
      const committedBeforeRelease = await committedFailedAttempts(observer, identity.staffId);
      evidence.append('overlap_pre_release_observation', 'complete', {
        case_id: caseId,
        holder_kind: holderKind,
        rollback,
        contender_kind: contenderKind,
        holder_connection_id: holderConnectionId,
        contender_connection_id: contenderObservation.connectionId,
        observer_connection_id: observerConnectionId,
        committed_failed_attempts: committedBeforeRelease,
        holder_settled: holderSettled,
        contender_settled: contenderSettled,
        wait_proof: waitProof,
      });
      expect(contenderSettled).toBe(false);
      expect(holderSettled).toBe(false);
      expect(committedBeforeRelease).toBe(2);

      const releaseAtEpochMs = epochMs();
      releaseHolder.resolve();
      const holderResult = await holderOutcome;
      const acquired = await waitForLockAcquire(tracker);
      const timing = lockTimingSummary(tracker, releaseAtEpochMs);
      evidence.append('overlap_release_and_acquire', 'complete', {
        case_id: caseId,
        holder_result: observedSettlement(holderResult),
        holder_error_type:
          holderResult.status === 'rejected'
            ? safeErrorObservation(holderResult.reason, 'complete').error_type
            : null,
        synthetic_rollback_present:
          holderResult.status === 'rejected' &&
          String(holderResult.reason).includes('synthetic overlap rollback'),
        acquired,
        timing,
      });
      expect(timing.ordered).toBe(true);
      if (rollback) {
        expect(holderResult.status).toBe('rejected');
        if (holderResult.status === 'rejected') {
          expect(String(holderResult.reason)).toContain('synthetic overlap rollback');
        }
      } else if (holderKind === 'failure') {
        expectInvalidLogin(holderResult as PromiseSettledResult<unknown>);
      } else {
        expect(holderResult.status).toBe('fulfilled');
      }

      const contenderResult = await contenderOutcome;
      if (contenderKind === 'success') {
        expect(contenderResult.status).toBe('fulfilled');
      } else {
        expectInvalidLogin(contenderResult as PromiseSettledResult<unknown>);
      }

      const credential = await admin.staffCredential.findUnique({
        where: { staffId: identity.staffId },
      });
      const expectedAttempts =
        contenderKind === 'failure' ? (holderKind === 'success' && !rollback ? 1 : 3) : 0;
      evidence.append('overlap_final', 'complete', {
        case_id: caseId,
        holder_kind: holderKind,
        rollback,
        contender_kind: contenderKind,
        holder_result: observedSettlement(holderResult),
        contender_result: observedSettlement(contenderResult),
        final_failed_attempts: credential?.failedAttempts ?? null,
        final_locked_until_epoch_ms: credential?.lockedUntil?.getTime() ?? null,
        expected_failed_attempts: expectedAttempts,
        holder_settled: holderSettled,
        contender_settled: contenderSettled,
      });
      expect(credential?.failedAttempts).toBe(expectedAttempts);
      expect(credential?.lockedUntil).toBeNull();
    } catch (error) {
      evidence.append('overlap_failed', 'complete', {
        case_id: caseId,
        holder_kind: holderKind,
        rollback,
        contender_kind: contenderKind,
        holder_connection_id: holderConnectionId || null,
        holder_write_completed_at_epoch_ms: holderWriteCompletedAtEpochMs,
        holder_settled: holderSettled,
        contender_settled: contenderSettled,
        ...safeErrorObservation(error, 'complete'),
      });
      throw error;
    } finally {
      releaseHolder.resolve();
      await holderOutcome;
      if (contenderOutcome) await contenderOutcome;
      evidence.append('overlap_settlement', 'complete', {
        case_id: caseId,
        holder_settled: holderSettled,
        contender_settled: contenderSettled,
      });
      expect(holderSettled).toBe(true);
      expect(contenderSettled).toBe(true);
    }
  }
});
