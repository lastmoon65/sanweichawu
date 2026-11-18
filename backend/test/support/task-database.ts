export const TASK_TEST_DATABASE_NAME = 'sw015_p104iso_20261117t1902_test';
export const TASK_MYSQL_HOST = '127.0.0.1';
export const TASK_MYSQL_PORT = '13306';

export function requireTaskTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('DATABASE_URL is required for task database tests');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid MySQL URL');
  }

  const databaseName = parsed.pathname.replace(/^\//, '');
  if (
    parsed.protocol !== 'mysql:' ||
    parsed.hostname !== TASK_MYSQL_HOST ||
    parsed.port !== TASK_MYSQL_PORT ||
    databaseName !== TASK_TEST_DATABASE_NAME
  ) {
    throw new Error(
      `DATABASE_URL must target ${TASK_MYSQL_HOST}:${TASK_MYSQL_PORT}/${TASK_TEST_DATABASE_NAME}`,
    );
  }

  return value;
}
