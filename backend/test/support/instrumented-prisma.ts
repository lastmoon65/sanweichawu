import type { PrismaClient } from '@prisma/client';

type ModelDelegateName = 'store' | 'staff' | 'staffCredential';
type MutationName = 'create' | 'update';

export interface TransactionObservation {
  readonly connectionId: string;
  readonly isolationLevel: string;
  readonly requestedIsolationLevel: string | null;
  readonly startedAtEpochMs: number;
}

export interface BootstrapLockObservation extends TransactionObservation {
  readonly transaction: unknown;
}

export interface TransactionHooks {
  readonly onTransactionStart?: (observation: TransactionObservation) => void | Promise<void>;
  readonly onBootstrapLockAcquired?: (
    observation: BootstrapLockObservation,
  ) => void | Promise<void>;
  readonly onQueryRaw?: (
    sql: string,
    phase: 'before' | 'after' | 'error',
    observation: TransactionObservation,
    error?: unknown,
    result?: unknown,
  ) => void | Promise<void>;
  readonly onExecuteRaw?: (
    sql: string,
    phase: 'before' | 'after' | 'error',
    observation: TransactionObservation,
    parameters: readonly unknown[],
    result?: unknown,
    error?: unknown,
  ) => void | Promise<void>;
  readonly onMutation?: (
    model: ModelDelegateName,
    operation: MutationName,
    value: unknown,
  ) => void | Promise<void>;
}

function normalizeScalar(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return String(value ?? '');
}

function mutationValue(result: unknown): unknown {
  if (result === null || typeof result !== 'object' || !('id' in result)) return result;
  return { id: (result as { id: unknown }).id };
}

function isBootstrapLockQuery(sql: string): boolean {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    normalized.includes('select lock_key from bootstrap_locks') && normalized.includes('for update')
  );
}

function requestedIsolationLevel(
  options: Parameters<PrismaClient['$transaction']>[1],
): string | null {
  if (options === null || typeof options !== 'object' || !('isolationLevel' in options)) {
    return null;
  }
  return normalizeScalar(options.isolationLevel);
}

function instrumentDelegate(
  delegate: object,
  model: ModelDelegateName,
  hooks: TransactionHooks,
): object {
  return new Proxy(delegate, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function' || (property !== 'create' && property !== 'update')) {
        return value;
      }

      const operation = property as MutationName;
      return async (...args: unknown[]): Promise<unknown> => {
        const result = await (value as (...input: unknown[]) => Promise<unknown>).apply(
          target,
          args,
        );
        await hooks.onMutation?.(model, operation, mutationValue(result));
        return result;
      };
    },
  });
}

export function instrumentPrismaClient(
  client: PrismaClient,
  hooks: TransactionHooks,
): PrismaClient {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return async <T>(
          callback: (transaction: unknown) => Promise<T>,
          options?: Parameters<PrismaClient['$transaction']>[1],
        ): Promise<T> =>
          target.$transaction(async (transaction) => {
            const transactionRows = await transaction.$queryRawUnsafe<
              Array<{ connection_id: bigint | string; isolation_level: string }>
            >(
              'SELECT CONNECTION_ID() AS connection_id, @@SESSION.transaction_isolation AS isolation_level',
            );
            const row = transactionRows[0];
            const observation: TransactionObservation = {
              connectionId: normalizeScalar(row?.connection_id),
              isolationLevel: normalizeScalar(row?.isolation_level),
              requestedIsolationLevel: requestedIsolationLevel(options),
              startedAtEpochMs: performance.timeOrigin + performance.now(),
            };
            await hooks.onTransactionStart?.(observation);

            const transactionProxy = new Proxy(transaction, {
              get(transactionTarget, transactionProperty, transactionReceiver) {
                if (
                  transactionProperty === '$queryRaw' ||
                  transactionProperty === '$queryRawUnsafe'
                ) {
                  return async (...args: unknown[]): Promise<unknown> => {
                    const sql =
                      transactionProperty === '$queryRaw'
                        ? (args[0] as TemplateStringsArray).join('?')
                        : String(args[0] ?? '');
                    await hooks.onQueryRaw?.(sql, 'before', observation);
                    try {
                      const result = await Reflect.apply(
                        Reflect.get(
                          transactionTarget,
                          transactionProperty,
                          transactionReceiver,
                        ) as (...input: unknown[]) => Promise<unknown>,
                        transactionTarget,
                        args,
                      );
                      await hooks.onQueryRaw?.(sql, 'after', observation, undefined, result);
                      if (
                        hooks.onBootstrapLockAcquired !== undefined &&
                        isBootstrapLockQuery(sql) &&
                        Array.isArray(result) &&
                        result.length === 1
                      ) {
                        await hooks.onBootstrapLockAcquired({
                          ...observation,
                          transaction,
                        });
                      }
                      return result;
                    } catch (error) {
                      await hooks.onQueryRaw?.(sql, 'error', observation, error);
                      throw error;
                    }
                  };
                }

                if (
                  transactionProperty === '$executeRaw' ||
                  transactionProperty === '$executeRawUnsafe'
                ) {
                  return async (...args: unknown[]): Promise<unknown> => {
                    const sql =
                      transactionProperty === '$executeRaw'
                        ? (args[0] as TemplateStringsArray).join('?')
                        : String(args[0] ?? '');
                    const parameters = args.slice(1);
                    await hooks.onExecuteRaw?.(sql, 'before', observation, parameters);
                    try {
                      const result = await Reflect.apply(
                        Reflect.get(
                          transactionTarget,
                          transactionProperty,
                          transactionReceiver,
                        ) as (...input: unknown[]) => Promise<unknown>,
                        transactionTarget,
                        args,
                      );
                      await hooks.onExecuteRaw?.(
                        sql,
                        'after',
                        observation,
                        parameters,
                        result,
                      );
                      return result;
                    } catch (error) {
                      await hooks.onExecuteRaw?.(
                        sql,
                        'error',
                        observation,
                        parameters,
                        undefined,
                        error,
                      );
                      throw error;
                    }
                  };
                }

                if (
                  transactionProperty === 'store' ||
                  transactionProperty === 'staff' ||
                  transactionProperty === 'staffCredential'
                ) {
                  return instrumentDelegate(
                    Reflect.get(
                      transactionTarget,
                      transactionProperty,
                      transactionReceiver,
                    ) as object,
                    transactionProperty,
                    hooks,
                  );
                }

                return Reflect.get(transactionTarget, transactionProperty, transactionReceiver);
              },
            });

            return callback(transactionProxy);
          }, options);
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
