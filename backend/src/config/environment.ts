const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly port: number;
  readonly databaseUrl: string;
  readonly jwtAccessSecret: string;
  readonly jwtAccessTtlSeconds: number;
  readonly wechatAppId?: string;
  readonly wechatAppSecret?: string;
  readonly bootstrapOwnerUsername?: string;
  readonly bootstrapOwnerPassword?: string;
  readonly bootstrapOwnerName?: string;
  readonly bootstrapStoreName?: string;
}

export class ConfigurationError extends Error {
  readonly failedKeys: readonly string[];

  constructor(failedKeys: readonly string[]) {
    const uniqueKeys = [...new Set(failedKeys)].sort();
    super(`Invalid environment configuration: ${uniqueKeys.join(', ')}`);
    this.name = 'ConfigurationError';
    this.failedKeys = uniqueKeys;
  }
}

function isNodeEnvironment(value: string): value is NodeEnvironment {
  return (NODE_ENVIRONMENTS as readonly string[]).includes(value);
}

function isMysqlUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'mysql:' && parsed.hostname.length > 0 && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

function optionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function optionalSecret(value: string | undefined): string | undefined {
  return value && value.trim() ? value : undefined;
}

export function loadEnvironmentConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const failedKeys = new Set<string>();

  const nodeEnvValue = env.NODE_ENV?.trim();
  const nodeEnv = nodeEnvValue && isNodeEnvironment(nodeEnvValue) ? nodeEnvValue : undefined;
  if (!nodeEnv) {
    failedKeys.add('NODE_ENV');
  }

  const portValue = env.PORT?.trim();
  const port = portValue && /^\d+$/.test(portValue) ? Number(portValue) : undefined;
  if (port === undefined || !Number.isInteger(port) || port < 0 || port > 65535) {
    failedKeys.add('PORT');
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl || !isMysqlUrl(databaseUrl)) {
    failedKeys.add('DATABASE_URL');
  }

  const jwtAccessSecret = optionalSecret(env.JWT_ACCESS_SECRET);
  if (!jwtAccessSecret) {
    failedKeys.add('JWT_ACCESS_SECRET');
  }

  const jwtAccessTtlValue = env.JWT_ACCESS_TTL?.trim();
  const jwtAccessTtlSeconds =
    jwtAccessTtlValue && /^\d+$/.test(jwtAccessTtlValue) ? Number(jwtAccessTtlValue) : undefined;
  if (
    jwtAccessTtlSeconds === undefined ||
    !Number.isSafeInteger(jwtAccessTtlSeconds) ||
    jwtAccessTtlSeconds <= 0 ||
    jwtAccessTtlSeconds > 2_147_483_647
  ) {
    failedKeys.add('JWT_ACCESS_TTL');
  }

  const bootstrapOwnerUsername = optionalString(env.BOOTSTRAP_OWNER_USERNAME);
  const bootstrapOwnerPassword = optionalSecret(env.BOOTSTRAP_OWNER_PASSWORD);
  if (bootstrapOwnerUsername && !bootstrapOwnerPassword) {
    failedKeys.add('BOOTSTRAP_OWNER_PASSWORD');
  }
  if (bootstrapOwnerPassword && !bootstrapOwnerUsername) {
    failedKeys.add('BOOTSTRAP_OWNER_USERNAME');
  }

  if (failedKeys.size > 0) {
    throw new ConfigurationError([...failedKeys]);
  }

  return {
    nodeEnv: nodeEnv as NodeEnvironment,
    port: port as number,
    databaseUrl: databaseUrl as string,
    jwtAccessSecret: jwtAccessSecret as string,
    jwtAccessTtlSeconds: jwtAccessTtlSeconds as number,
    wechatAppId: optionalString(env.WECHAT_APP_ID),
    wechatAppSecret: optionalSecret(env.WECHAT_APP_SECRET),
    bootstrapOwnerUsername,
    bootstrapOwnerPassword,
    bootstrapOwnerName: optionalString(env.BOOTSTRAP_OWNER_NAME),
    bootstrapStoreName: optionalString(env.BOOTSTRAP_STORE_NAME),
  };
}
