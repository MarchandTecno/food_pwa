const NODE_ENV = process.env.NODE_ENV ?? 'development';

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function getMissingVars(keys: string[]): string[] {
  return keys.filter((key) => !hasValue(process.env[key]));
}

export function validateRuntimeConfig(): void {
  const requiredInAllEnvs = ['DATABASE_URL'];
  const missingCommon = getMissingVars(requiredInAllEnvs);

  if (missingCommon.length > 0) {
    throw new Error(`[Config] Missing required environment variable(s): ${missingCommon.join(', ')}`);
  }

  if (NODE_ENV === 'production') {
    const requiredInProduction = ['JWT_SECRET'];
    const missingProd = getMissingVars(requiredInProduction);

    if (missingProd.length > 0) {
      throw new Error(`[Config] Missing required production environment variable(s): ${missingProd.join(', ')}`);
    }

    const hasCorsOrigins = hasValue(process.env.CORS_ORIGINS) || hasValue(process.env.CORS_ORIGIN);
    if (!hasCorsOrigins) {
      throw new Error('[Config] CORS_ORIGINS (or CORS_ORIGIN) is required in production');
    }
  }
}
