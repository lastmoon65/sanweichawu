import 'reflect-metadata';

import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer, get } from 'node:http';
import { connect } from 'node:net';
import type { AddressInfo } from 'node:net';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { Readable } from 'node:stream';

import { PrismaClient } from '@prisma/client';

import { BOOTSTRAP_PHASES } from '../../src/auth/bootstrap-error-diagnostic.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { requireTaskTestDatabaseUrl } from './task-database.js';

const PROCESS_FIXTURE_PREFIX = 'sw008-process-';
const MAIN_PATH = 'dist/main.js';
const MAX_FRAME_BYTES = 1024 * 1024;
const MONOTONIC_ORIGIN = process.hrtime.bigint();
const SAFE_EVENTS = new Set([
  'bootstrap_owner_created',
  'bootstrap_owner_skipped',
  'bootstrap_owner_failed',
  'prisma_connected',
  'prisma_unavailable',
  'prisma_disconnect_failed',
  'server_started',
  'startup_configuration_invalid',
  'startup_cleanup_failed',
  'startup_failed',
]);
const SAFE_LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const SAFE_REASONS = new Set([
  'bootstrap_failed',
  'owner_exists',
  'cleanup_failed',
  'prisma_unavailable',
  'startup_failed',
]);
const SAFE_ERROR_TYPES = new Set([
  'PrismaKnown',
  'PrismaUnknown',
  'PrismaInitialization',
  'PrismaRustPanic',
  'Timeout',
  'Other',
]);
const SAFE_PRISMA_CODES = new Set([
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
const SAFE_DB_ERRNOS = new Set([1040, 1045, 1205, 1213, 2002, 2003, 2006, 2013]);
const SAFE_SQLSTATES = new Set([
  '08000',
  '08001',
  '08006',
  '40001',
  'HY000',
  'HYT00',
  'HYT01',
  '42000',
]);
const SAFE_FAILED_KEYS = new Set([
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_ACCESS_TTL',
  'BOOTSTRAP_OWNER_USERNAME',
  'BOOTSTRAP_OWNER_PASSWORD',
  'WECHAT_APP_ID',
  'WECHAT_APP_SECRET',
]);

interface CapturedChild {
  readonly child: ChildProcessByStdio<null, Readable, Readable>;
  readonly stdout: SafeCapture;
  readonly stderr: SafeCapture;
}

interface ExitResult {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly at: string;
  readonly elapsedMs: number;
}

type CloseObservationSource =
  | 'close-event'
  | 'exit-and-ended-streams'
  | 'timeout'
  | 'not-observed';

interface CloseResult {
  readonly at: string;
  readonly closeObserved: boolean;
  readonly timedOut: boolean;
  readonly source: CloseObservationSource;
}

interface ProbeObservation {
  readonly at: string;
  readonly elapsedMs: number;
  readonly tcpConnected: boolean;
  readonly readyStatus: number | null;
  readonly listenerOwnedByPid: boolean | null;
}

interface StreamSummary {
  readonly path: string;
  readonly bytes: number;
  readonly safeFrameCount: number;
  readonly nonStructuredFrameCount: number;
  readonly incomplete: boolean;
  readonly leakDetected: boolean;
}

interface CaseRecord {
  readonly caseId: string;
  readonly workerId: string;
  readonly pid: number | null;
  readonly port: number;
  readonly bindAddress: '127.0.0.1';
  readonly sourceHash: string;
  readonly buildHash: string;
  readonly command: string;
  readonly spawnAt: string;
  readonly readyAt: string | null;
  readonly exitAt: string | null;
  readonly closeAt: string | null;
  readonly closeObserved: boolean;
  readonly closeTimedOut: boolean;
  readonly closeSource: CloseObservationSource;
  readonly elapsed: Record<string, number | null>;
  readonly readyProbes: ProbeObservation[];
  readonly serverStarted: boolean;
  readonly server_started: boolean;
  readonly safeEvents: Array<Record<string, unknown>>;
  readonly stdout: StreamSummary;
  readonly stderr: StreamSummary;
  readonly exit: { code: number | null; signal: NodeJS.Signals | null; timedOut: boolean } | null;
  readonly terminationActions: string[];
  readonly descendantPids: number[] | null;
  readonly pidAliveAfterClose: boolean | null;
  readonly portClosedAfterClose: boolean;
  readonly expected: 'failure' | 'success';
  readonly result: 'PASS' | 'FAIL';
  readonly failureReason: string | null;
  readonly listenEvidence: 'continuous-50ms-sample-plus-proc-inode-ownership';
  readonly limitation: string;
}

function monotonicMs(): number {
  return Number(process.hrtime.bigint() - MONOTONIC_ORIGIN) / 1_000_000;
}

function isoNow(): string {
  return new Date().toISOString();
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function walkFiles(root: string, current = root): string[] {
  const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(root, path));
    if (entry.isFile()) files.push(relative(root, path));
  }
  return files;
}

function hashFileSet(root: string, files: string[]): { hash: string; manifest: unknown[] } {
  const manifest = files.map((file) => {
    const bytes = readFileSync(join(root, file));
    return { path: file, bytes: bytes.length, sha256: sha256(bytes) };
  });
  return { hash: sha256(JSON.stringify(manifest)), manifest };
}

function safeSecretVariants(secrets: readonly string[]): string[] {
  const variants = new Set<string>();
  for (const secret of secrets) {
    if (!secret) continue;
    variants.add(secret);
    variants.add(encodeURIComponent(secret));
    variants.add(Buffer.from(secret).toString('base64'));
    variants.add(Buffer.from(secret).toString('base64url'));
  }
  return [...variants].sort((left, right) => right.length - left.length);
}

function sanitizeSafeRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const event = record.event;
  const level = record.level;
  if (typeof event !== 'string' || !SAFE_EVENTS.has(event)) return null;
  if (typeof level !== 'string' || !SAFE_LEVELS.has(level)) return null;
  const safe: Record<string, unknown> = { event, level };
  if (typeof record.timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(record.timestamp)) {
    safe.timestamp = record.timestamp;
  }
  if (typeof record.requestId === 'string' && /^[A-Za-z0-9._:-]{1,80}$/.test(record.requestId)) {
    safe.requestId = record.requestId;
  }
  if (record.address === '127.0.0.1') safe.address = '127.0.0.1';
  if (Number.isInteger(record.port) && Number(record.port) >= 0 && Number(record.port) <= 65535) {
    safe.port = record.port;
  }
  if (record.nodeEnv === 'test') safe.nodeEnv = 'test';
  if (typeof record.reason === 'string' && SAFE_REASONS.has(record.reason)) {
    safe.reason = record.reason;
  }
  if (typeof record.error_type === 'string' && SAFE_ERROR_TYPES.has(record.error_type)) {
    safe.error_type = record.error_type;
  }
  if (typeof record.prisma_code === 'string' && SAFE_PRISMA_CODES.has(record.prisma_code)) {
    safe.prisma_code = record.prisma_code;
  } else if (record.prisma_code === null) {
    safe.prisma_code = null;
  }
  if (Number.isInteger(record.db_errno) && SAFE_DB_ERRNOS.has(Number(record.db_errno))) {
    safe.db_errno = record.db_errno;
  } else if (record.db_errno === null) {
    safe.db_errno = null;
  }
  if (typeof record.sqlstate === 'string' && SAFE_SQLSTATES.has(record.sqlstate)) {
    safe.sqlstate = record.sqlstate;
  } else if (record.sqlstate === null) {
    safe.sqlstate = null;
  }
  if (
    typeof record.phase === 'string' &&
    (BOOTSTRAP_PHASES as readonly string[]).includes(record.phase)
  ) {
    safe.phase = record.phase;
  }
  if (record.service === 'prisma') safe.service = 'prisma';
  if (Array.isArray(record.failedKeys)) {
    safe.failedKeys = record.failedKeys.filter(
      (key): key is string => typeof key === 'string' && SAFE_FAILED_KEYS.has(key),
    );
  }
  return safe;
}

class SafeCapture {
  readonly path: string;
  private buffer = Buffer.alloc(0);
  private bytes = 0;
  private safeFrameCount = 0;
  private nonStructuredFrameCount = 0;
  private incomplete = false;
  private leakDetected = false;
  private readonly secrets: string[];
  readonly safeEvents: Array<Record<string, unknown>> = [];

  constructor(path: string, secrets: readonly string[]) {
    this.path = path;
    this.secrets = safeSecretVariants(secrets);
    writeFileSync(path, '');
  }

  push(chunk: Buffer): void {
    this.bytes += chunk.length;
    const raw = chunk.toString('utf8');
    if (this.secrets.some((secret) => raw.includes(secret))) this.leakDetected = true;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > MAX_FRAME_BYTES) {
      this.incomplete = true;
      this.nonStructuredFrameCount += 1;
      this.buffer = Buffer.alloc(0);
      this.writeSafe({ type: 'capture_incomplete', byteCount: chunk.length });
      return;
    }
    this.drainFrames();
  }

  finalize(): void {
    if (this.buffer.length > 0) {
      const unterminated = this.buffer.toString('utf8');
      if (this.secrets.some((secret) => unterminated.includes(secret))) this.leakDetected = true;
      this.incomplete = true;
      this.nonStructuredFrameCount += 1;
      this.writeSafe({ type: 'unterminated_frame', byteCount: this.buffer.length });
      this.buffer = Buffer.alloc(0);
    }
  }

  summary(): StreamSummary {
    return {
      path: this.path,
      bytes: this.bytes,
      safeFrameCount: this.safeFrameCount,
      nonStructuredFrameCount: this.nonStructuredFrameCount,
      incomplete: this.incomplete,
      leakDetected: this.leakDetected,
    };
  }

  private drainFrames(): void {
    while (true) {
      const newline = this.buffer.indexOf(0x0a);
      if (newline < 0) return;
      const frame = this.buffer.subarray(0, newline).toString('utf8');
      this.buffer = this.buffer.subarray(newline + 1);
      this.handleFrame(frame);
    }
  }

  private handleFrame(frame: string): void {
    if (this.secrets.some((secret) => frame.includes(secret))) this.leakDetected = true;
    try {
      const parsed: unknown = JSON.parse(frame);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const safe = sanitizeSafeRecord(parsed as Record<string, unknown>);
        if (safe !== null) {
          this.safeFrameCount += 1;
          this.safeEvents.push(safe);
          this.writeSafe({ type: 'structured', record: safe });
          return;
        }
      }
    } catch {
      // Raw text is intentionally discarded.
    }
    this.nonStructuredFrameCount += 1;
    this.writeSafe({ type: 'non_structured', byteCount: Buffer.byteLength(frame) });
  }

  private writeSafe(value: Record<string, unknown>): void {
    appendFileSync(this.path, `${JSON.stringify(value)}\n`);
  }
}

function freeLoopbackPort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      server.close((error) => (error ? reject(error) : resolvePromise(address.port)));
    });
  });
}

function probeTcp(port: number, timeoutMs = 120): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = connect({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(value);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function probeReady(port: number): Promise<number | null> {
  return new Promise((resolvePromise) => {
    const request = get(
      { hostname: '127.0.0.1', port, path: '/api/v1/health/ready', timeout: 300 },
      (response) => {
        response.resume();
        response.once('end', () => resolvePromise(response.statusCode ?? null));
      },
    );
    request.once('timeout', () => {
      request.destroy();
      resolvePromise(null);
    });
    request.once('error', () => resolvePromise(null));
  });
}

function listeningInodes(port: number): Set<string> {
  const inodes = new Set<string>();
  const portHex = port.toString(16).toUpperCase().padStart(4, '0');
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/).slice(1)) {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 10) continue;
      const localPort = columns[1]?.split(':')[1];
      if (localPort === portHex && columns[3] === '0A') inodes.add(columns[9] ?? '');
    }
  }
  return inodes;
}

function pidSocketInodes(pid: number): Set<string> | null {
  const inodes = new Set<string>();
  try {
    for (const fd of readdirSync(`/proc/${pid}/fd`)) {
      try {
        const target = readlinkSync(`/proc/${pid}/fd/${fd}`);
        const match = target.match(/^socket:\[(\d+)\]$/);
        if (match) inodes.add(match[1] ?? '');
      } catch {
        // A short-lived fd can disappear during enumeration.
      }
    }
    return inodes;
  } catch {
    return null;
  }
}

function listenerOwnedByPid(pid: number, port: number): boolean | null {
  const listening = listeningInodes(port);
  const owned = pidSocketInodes(pid);
  if (owned === null) return null;
  return [...listening].some((inode) => owned.has(inode));
}

function descendantPids(pid: number): number[] | null {
  try {
    const children = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim();
    return children ? children.split(/\s+/).map(Number).filter(Number.isInteger) : [];
  } catch {
    return null;
  }
}

function pidAlive(pid: number | null): boolean | null {
  if (pid === null) return null;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForExit(
  child: ChildProcessByStdio<null, Readable, Readable>,
  timeoutMs: number,
): Promise<ExitResult> {
  return new Promise((resolvePromise) => {
    const startedAt = monotonicMs();
    if (child.exitCode !== null || child.signalCode !== null) {
      resolvePromise({
        code: child.exitCode,
        signal: child.signalCode,
        timedOut: false,
        at: isoNow(),
        elapsedMs: monotonicMs() - startedAt,
      });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolvePromise({
          code: null,
          signal: null,
          timedOut: true,
          at: isoNow(),
          elapsedMs: monotonicMs() - startedAt,
        });
      }
    }, timeoutMs);
    child.once('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolvePromise({
          code,
          signal,
          timedOut: false,
          at: isoNow(),
          elapsedMs: monotonicMs() - startedAt,
        });
      }
    });
  });
}

function waitForClose(
  child: ChildProcessByStdio<null, Readable, Readable>,
  timeoutMs = 5_000,
): Promise<CloseResult> {
  return new Promise((resolvePromise) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const settle = (result: CloseResult): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      child.removeListener('close', handleClose);
      child.removeListener('exit', checkExitedStreams);
      child.stdout.removeListener('end', checkExitedStreams);
      child.stderr.removeListener('end', checkExitedStreams);
      resolvePromise(result);
    };

    const handleClose = (): void => {
      settle({ at: isoNow(), closeObserved: true, timedOut: false, source: 'close-event' });
    };

    const checkExitedStreams = (): void => {
      if (
        (child.exitCode !== null || child.signalCode !== null) &&
        child.stdout.readableEnded &&
        child.stderr.readableEnded
      ) {
        settle({
          at: isoNow(),
          closeObserved: true,
          timedOut: false,
          source: 'exit-and-ended-streams',
        });
      }
    };

    // Register listeners before inspecting state so an already-scheduled close
    // event cannot race past the observation.
    child.once('close', handleClose);
    child.once('exit', checkExitedStreams);
    child.stdout.once('end', checkExitedStreams);
    child.stderr.once('end', checkExitedStreams);
    timer = setTimeout(() => {
      settle({ at: isoNow(), closeObserved: false, timedOut: true, source: 'timeout' });
    }, timeoutMs);
    checkExitedStreams();
  });
}

function spawnMain(
  caseId: string,
  port: number,
  databaseUrl: string,
  generatedSecrets: string[],
  evidenceDir: string,
  overrides: Record<string, string | undefined>,
): CapturedChild {
  const jwtSecret = randomBytes(32).toString('base64url');
  generatedSecrets.push(jwtSecret);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: jwtSecret,
    JWT_ACCESS_TTL: '60',
  };
  for (const key of [
    'BOOTSTRAP_OWNER_USERNAME',
    'BOOTSTRAP_OWNER_PASSWORD',
    'BOOTSTRAP_OWNER_NAME',
    'BOOTSTRAP_STORE_NAME',
  ]) {
    delete env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const child = spawn(process.execPath, [MAIN_PATH], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = new SafeCapture(
    join(evidenceDir, `${caseId}.stdout.safe.jsonl`),
    generatedSecrets,
  );
  const stderr = new SafeCapture(
    join(evidenceDir, `${caseId}.stderr.safe.jsonl`),
    generatedSecrets,
  );
  child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
  return { child, stdout, stderr };
}

async function waitForReadyAndEvent(
  captured: CapturedChild,
  port: number,
  timeoutMs = 15_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (captured.child.exitCode !== null || captured.child.signalCode !== null) return false;
    if (
      captured.stdout.safeEvents.some((event) => event.event === 'server_started') &&
      (await probeReady(port)) === 200
    )
      return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  return false;
}

function validateEvidenceDirectory(value: string | undefined): string {
  if (!value || !isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    throw new Error('SW015_EVIDENCE_DIR must be a safe absolute path');
  }
  const resolved = resolve(value);
  if (resolved === resolve(resolved, '..')) {
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

function runCaptureSecuritySelfTest(evidenceDir: string): Record<string, unknown> {
  const shortSecret = 'z/q';
  const encodedSecret = encodeURIComponent(shortSecret);
  const path = join(evidenceDir, 'capture-security-self-test.safe.jsonl');
  const capture = new SafeCapture(path, [shortSecret]);
  capture.push(
    Buffer.from('{"event":"bootstrap_owner_failed","level":"error","phase":"hash","message":"'),
  );
  capture.push(Buffer.from(shortSecret.slice(0, 1)));
  capture.push(Buffer.from(`${shortSecret.slice(1)}-${encodedSecret}"}\n`));
  capture.push(Buffer.from('non-frame-'));
  capture.push(Buffer.from(shortSecret.slice(0, 1)));
  capture.push(Buffer.from(shortSecret.slice(1)));
  capture.finalize();
  const stored = readFileSync(path, 'utf8');
  const complete =
    !stored.includes(shortSecret) &&
    !stored.includes(encodedSecret) &&
    capture.summary().leakDetected &&
    capture.summary().incomplete;
  if (!complete) throw new Error('safe capture self-test failed');
  return {
    status: 'PASS',
    encodedCrossChunkDiscarded: true,
    shortSecretDiscarded: true,
    incompleteFrameRejected: true,
  };
}

async function main(): Promise<void> {
  const evidenceDir = validateEvidenceDirectory(process.env.SW015_EVIDENCE_DIR);
  writeFileSync(join(evidenceDir, 'f04-process-matrix.jsonl'), '');
  const securitySelfTest = runCaptureSecuritySelfTest(evidenceDir);
  const databaseUrl = requireTaskTestDatabaseUrl();
  const parsedDatabaseUrl = new URL(databaseUrl);
  const databaseSecrets = [
    databaseUrl,
    parsedDatabaseUrl.username,
    parsedDatabaseUrl.password,
    decodeURIComponent(parsedDatabaseUrl.username),
    decodeURIComponent(parsedDatabaseUrl.password),
  ];
  const sourceRoot = process.cwd();
  const sourceFiles = [
    ...walkFiles(join(sourceRoot, 'src')).map((file) => join('src', file)),
    'prisma/schema.prisma',
    ...walkFiles(join(sourceRoot, 'prisma', 'migrations')).map((file) =>
      join('prisma', 'migrations', file),
    ),
    'package.json',
  ];
  const sourceManifest = hashFileSet(sourceRoot, sourceFiles);
  const buildFiles = walkFiles(join(sourceRoot, 'dist')).map((file) => join('dist', file));
  const buildManifest = hashFileSet(sourceRoot, buildFiles);
  writeFileSync(
    join(evidenceDir, 'source-hash-manifest.json'),
    JSON.stringify({ hash: sourceManifest.hash, files: sourceManifest.manifest }, null, 2),
  );
  writeFileSync(
    join(evidenceDir, 'build-hash-manifest.json'),
    JSON.stringify({ hash: buildManifest.hash, files: buildManifest.manifest }, null, 2),
  );

  const passwords = new PasswordService();
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const records: CaseRecord[] = [];

  async function cleanupFixtures(): Promise<void> {
    const stores = await prisma.store.findMany({
      where: { name: { startsWith: PROCESS_FIXTURE_PREFIX } },
      select: { id: true },
    });
    const storeIds = stores.map((store) => store.id);
    if (storeIds.length === 0) return;
    const staff = await prisma.staff.findMany({
      where: { storeId: { in: storeIds } },
      select: { id: true },
    });
    const staffIds = staff.map((entry) => entry.id);
    await prisma.staffCredential.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
  }

  async function assertCleanTaskDatabase(): Promise<void> {
    await cleanupFixtures();
    const storeCount = await prisma.store.count();
    if (storeCount !== 0) {
      throw new Error('the process harness requires an otherwise empty task-only database');
    }
    const lockRows = await prisma.$queryRawUnsafe<Array<{ lock_key: string }>>(
      'SELECT lock_key FROM bootstrap_locks WHERE lock_key = ?',
      'first_owner_bootstrap_v1',
    );
    if (lockRows.length !== 1) throw new Error('bootstrap lock migration row is missing');
  }

  async function runCase(
    caseId: string,
    expected: 'failure' | 'success',
    overrides: Record<string, string | undefined>,
    secrets: string[],
  ): Promise<void> {
    const port = await freeLoopbackPort();
    // Short values cannot be scanned as substrings without false positives; the
    // dedicated capture self-test exercises short/encoded cross-chunk values.
    const generatedSecrets = [...databaseSecrets, ...secrets].filter((value) => value.length >= 8);
    const captured = spawnMain(caseId, port, databaseUrl, generatedSecrets, evidenceDir, overrides);
    const spawnAt = isoNow();
    const spawnMonotonic = monotonicMs();
    const childPid = captured.child.pid ?? null;
    const readyProbes: ProbeObservation[] = [];
    const terminationActions: string[] = [];
    let readyAt: string | null = null;
    let readyMonotonic: number | null = null;
    let exitResult: ExitResult | null = null;
    let exitMonotonic: number | null = null;
    let closeAt: string | null = null;
    let closeMonotonic: number | null = null;
    let closeObserved = false;
    let closeTimedOut = false;
    let closeSource: CloseObservationSource = 'not-observed';
    let descendantSnapshot: number[] | null = null;
    let failureReason: string | null = null;
    let monitoring = true;

    const monitorPromise = (async () => {
      while (monitoring) {
        const tcpConnected = await probeTcp(port);
        const readyStatus = tcpConnected ? await probeReady(port) : null;
        const owned = childPid ? (tcpConnected ? listenerOwnedByPid(childPid, port) : false) : null;
        readyProbes.push({
          at: isoNow(),
          elapsedMs: Number((monotonicMs() - spawnMonotonic).toFixed(3)),
          tcpConnected,
          readyStatus,
          listenerOwnedByPid: owned,
        });
        if (childPid !== null) {
          const observedDescendants = descendantPids(childPid);
          if (observedDescendants !== null) {
            descendantSnapshot = observedDescendants;
          }
        }
        if (readyStatus === 200 && readyAt === null) {
          readyAt = isoNow();
          readyMonotonic = monotonicMs();
        }
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      }
    })();

    try {
      if (expected === 'failure') {
        const exit = await waitForExit(captured.child, 25_000);
        exitResult = exit;
        exitMonotonic = monotonicMs();
        if (exit.timedOut) {
          failureReason = 'failure case did not exit naturally';
          terminationActions.push('SIGTERM-after-timeout');
          captured.child.kill('SIGTERM');
          let forced = await waitForExit(captured.child, 5_000);
          if (forced.timedOut) {
            terminationActions.push('SIGKILL-after-TERM-timeout');
            captured.child.kill('SIGKILL');
            forced = await waitForExit(captured.child, 5_000);
          }
          exitResult = forced;
          exitMonotonic = monotonicMs();
        }
        if (exitResult.code === null || exitResult.code === 0) {
          failureReason ??= 'failure case did not return a natural nonzero code';
        }
        if (exitResult.signal !== null) {
          failureReason ??= 'failure case ended by signal instead of natural exit';
        }
      } else {
        const readyAndStarted = await waitForReadyAndEvent(captured, port);
        if (readyAndStarted && readyAt === null) {
          readyAt = isoNow();
          readyMonotonic = monotonicMs();
        }
        if (!readyAndStarted || readyAt === null) {
          failureReason = 'success case did not reach ready with server_started';
        }
        if (childPid === null || listenerOwnedByPid(childPid, port) !== true) {
          failureReason ??= 'listener could not be attributed to child PID';
        }
        if (failureReason === null) {
          descendantSnapshot = childPid === null ? null : descendantPids(childPid);
          terminationActions.push('SIGTERM');
          captured.child.kill('SIGTERM');
          const exit = await waitForExit(captured.child, 10_000);
          exitResult = exit;
          exitMonotonic = monotonicMs();
          if (exit.timedOut) {
            failureReason = 'SIGTERM did not terminate child';
            terminationActions.push('SIGKILL-after-TERM-timeout');
            captured.child.kill('SIGKILL');
            exitResult = await waitForExit(captured.child, 5_000);
            exitMonotonic = monotonicMs();
          } else if (exit.signal !== 'SIGTERM' || exit.code !== null) {
            failureReason = 'success case did not record actual SIGTERM';
          }
        }
      }
    } finally {
      monitoring = false;
      await monitorPromise;
      if (captured.child.exitCode === null && captured.child.signalCode === null) {
        terminationActions.push('SIGTERM-finally');
        captured.child.kill('SIGTERM');
        let forced = await waitForExit(captured.child, 5_000);
        if (forced.timedOut) {
          terminationActions.push('SIGKILL-finally');
          captured.child.kill('SIGKILL');
          forced = await waitForExit(captured.child, 5_000);
        }
        exitResult ??= forced;
        if (exitResult === forced) exitMonotonic = monotonicMs();
      }
      const close = await waitForClose(captured.child);
      closeObserved = close.closeObserved;
      closeTimedOut = close.timedOut;
      closeSource = close.source;
      if (closeObserved) {
        closeAt = close.at;
        closeMonotonic = monotonicMs();
      }
      if (!closeObserved) failureReason ??= 'stdio close was not observed';
      captured.stdout.finalize();
      captured.stderr.finalize();
    }

    const stdoutSummary = captured.stdout.summary();
    const stderrSummary = captured.stderr.summary();
    if (stdoutSummary.incomplete || stderrSummary.incomplete)
      failureReason ??= 'stdout/stderr frame was incomplete';
    if (stdoutSummary.leakDetected || stderrSummary.leakDetected)
      failureReason ??= 'generated secret appeared in process output';
    const serverStarted = captured.stdout.safeEvents.some(
      (event) => event.event === 'server_started',
    );
    if (expected === 'failure' && serverStarted)
      failureReason ??= 'failed startup emitted server_started';
    if (expected === 'failure' && readyProbes.some((probe) => probe.readyStatus === 200))
      failureReason ??= 'failed startup completed a ready probe with HTTP 200';
    if (expected === 'failure' && readyProbes.some((probe) => probe.listenerOwnedByPid === true))
      failureReason ??= 'failed startup had a listener owned by its PID';

    const finalTcp = await probeTcp(port);
    const finalReady = finalTcp ? await probeReady(port) : null;
    if (finalTcp || finalReady !== null) failureReason ??= 'port remained open after close';
    const alive = pidAlive(childPid);
    if (alive !== false) failureReason ??= 'child PID remained alive after close';

    const record: CaseRecord = {
      caseId,
      workerId: childPid === null ? 'unknown' : `pid-${childPid}`,
      pid: childPid,
      port,
      bindAddress: '127.0.0.1',
      sourceHash: sourceManifest.hash,
      buildHash: buildManifest.hash,
      command: `node ${MAIN_PATH}`,
      spawnAt,
      readyAt,
      exitAt: exitResult?.at ?? null,
      closeAt,
      closeObserved,
      closeTimedOut,
      closeSource,
      elapsed: {
        spawnToReadyMs:
          readyMonotonic === null ? null : Number((readyMonotonic - spawnMonotonic).toFixed(3)),
        spawnToExitMs:
          exitMonotonic === null ? null : Number((exitMonotonic - spawnMonotonic).toFixed(3)),
        spawnToCloseMs:
          closeMonotonic === null ? null : Number((closeMonotonic - spawnMonotonic).toFixed(3)),
      },
      readyProbes,
      serverStarted,
      server_started: serverStarted,
      safeEvents: captured.stdout.safeEvents,
      stdout: stdoutSummary,
      stderr: stderrSummary,
      exit:
        exitResult === null
          ? null
          : { code: exitResult.code, signal: exitResult.signal, timedOut: exitResult.timedOut },
      terminationActions,
      descendantPids: descendantSnapshot,
      pidAliveAfterClose: alive,
      portClosedAfterClose: !finalTcp && finalReady === null,
      expected,
      result: failureReason === null ? 'PASS' : 'FAIL',
      failureReason,
      listenEvidence: 'continuous-50ms-sample-plus-proc-inode-ownership',
      limitation:
        'TCP/ready sampling is not a proof against an instantaneous unobserved listen; key stages plus proc inode ownership are bound to the child PID.',
    };
    records.push(record);
    appendFileSync(
      join(evidenceDir, 'f04-process-matrix.jsonl'),
      `${JSON.stringify({ schema_version: 1, event: 'process_case', ...record })}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    writeFileSync(join(evidenceDir, `${caseId}.case.json`), JSON.stringify(record, null, 2));
    if (record.result !== 'PASS') throw new Error(`${caseId}: ${record.failureReason}`);
  }

  try {
    await prisma.$connect();
    await assertCleanTaskDatabase();

    await runCase(
      'bootstrap-validation-failure',
      'failure',
      { BOOTSTRAP_OWNER_USERNAME: `sw008-process-validation-${randomUUID()}` },
      [],
    );

    const unreachable = new URL(databaseUrl);
    unreachable.hostname = '127.0.0.1';
    unreachable.port = '1';
    unreachable.searchParams.set('connect_timeout', '2');
    const unreachablePassword = randomBytes(24).toString('base64url');
    const unreachableUsername = `sw008-process-db-${randomUUID()}`;
    await runCase(
      'bootstrap-database-unreachable',
      'failure',
      {
        DATABASE_URL: unreachable.toString(),
        BOOTSTRAP_OWNER_USERNAME: unreachableUsername,
        BOOTSTRAP_OWNER_PASSWORD: unreachablePassword,
      },
      [unreachable.toString(), unreachablePassword, unreachableUsername],
    );

    await assertCleanTaskDatabase();
    const conflictingUsername = `sw008-process-conflict-${randomUUID()}`;
    const conflictStore = await prisma.store.create({
      data: { name: `${PROCESS_FIXTURE_PREFIX}create-failure-${randomUUID()}`, status: 'ACTIVE' },
      select: { id: true },
    });
    const conflictStaff = await prisma.staff.create({
      data: {
        storeId: conflictStore.id,
        name: 'sw008-process-conflict-staff',
        role: 'STAFF',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const conflictHash = await passwords.hash(randomBytes(24).toString('base64url'));
    await prisma.staffCredential.create({
      data: {
        staffId: conflictStaff.id,
        username: conflictingUsername,
        passwordHash: conflictHash,
      },
    });
    const creationPassword = randomBytes(24).toString('base64url');
    await runCase(
      'bootstrap-owner-creation-failure',
      'failure',
      {
        BOOTSTRAP_OWNER_USERNAME: conflictingUsername,
        BOOTSTRAP_OWNER_PASSWORD: creationPassword,
      },
      [creationPassword, conflictingUsername],
    );
    const ownersAfterFailure = await prisma.staff.count({
      where: { storeId: conflictStore.id, role: 'OWNER' },
    });
    const credentialAfterFailure = await prisma.staffCredential.findUnique({
      where: { staffId: conflictStaff.id },
    });
    if (
      ownersAfterFailure !== 0 ||
      credentialAfterFailure?.username !== conflictingUsername ||
      credentialAfterFailure?.passwordHash !== conflictHash
    ) {
      throw new Error('creation conflict changed existing OWNER or credential state');
    }

    await assertCleanTaskDatabase();
    await runCase('bootstrap-disabled-startup', 'success', {}, []);

    await assertCleanTaskDatabase();
    const existingStore = await prisma.store.create({
      data: { name: `${PROCESS_FIXTURE_PREFIX}existing-owner-${randomUUID()}`, status: 'ACTIVE' },
      select: { id: true },
    });
    const existingOwner = await prisma.staff.create({
      data: {
        storeId: existingStore.id,
        name: 'sw008-process-existing-owner',
        role: 'OWNER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const existingUsername = `sw008-process-existing-${randomUUID()}`;
    const existingHash = await passwords.hash(randomBytes(24).toString('base64url'));
    await prisma.staffCredential.create({
      data: {
        staffId: existingOwner.id,
        username: existingUsername,
        passwordHash: existingHash,
      },
    });
    const newBootstrapUsername = `sw008-process-new-${randomUUID()}`;
    const newBootstrapPassword = randomBytes(24).toString('base64url');
    await runCase(
      'bootstrap-existing-owner-startup',
      'success',
      {
        BOOTSTRAP_OWNER_USERNAME: newBootstrapUsername,
        BOOTSTRAP_OWNER_PASSWORD: newBootstrapPassword,
      },
      [existingUsername, newBootstrapUsername, newBootstrapPassword],
    );
    const ownerCount = await prisma.staff.count({
      where: { storeId: existingStore.id, role: 'OWNER' },
    });
    const credentialCount = await prisma.staffCredential.count({
      where: { username: { in: [existingUsername, newBootstrapUsername] } },
    });
    const existingCredential = await prisma.staffCredential.findUnique({
      where: { staffId: existingOwner.id },
    });
    if (
      ownerCount !== 1 ||
      credentialCount !== 1 ||
      existingCredential?.passwordHash !== existingHash
    ) {
      throw new Error('existing OWNER startup changed persisted identity state');
    }
  } finally {
    await cleanupFixtures();
    await prisma.$disconnect();
    writeFileSync(
      join(evidenceDir, 'summary.json'),
      JSON.stringify(
        {
          task: 'SW-20261117-015',
          generatedAt: isoNow(),
          evidenceDirectory: evidenceDir,
          sourceHash: sourceManifest.hash,
          buildHash: buildManifest.hash,
          securitySelfTest,
          cases: records,
        },
        null,
        2,
      ),
    );
  }
}

void main().catch(() => {
  console.error('FAIL: bootstrap startup process harness');
  process.exitCode = 1;
});
