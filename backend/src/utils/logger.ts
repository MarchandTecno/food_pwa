export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  event: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  resolver?: string;
  operationType?: 'query' | 'mutation' | 'subscription' | 'unknown';
  latencyMs?: number;
  result?: 'ok' | 'error';
  errorCode?: string;
  message?: string;
  [key: string]: unknown;
}

const enabledLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const isTestEnvironment = process.env.NODE_ENV === 'test';
const logsEnabledInTests = process.env.LOG_IN_TESTS === 'true';
const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel): boolean {
  const configured = (enabledLevel in levelWeight ? enabledLevel : 'info') as LogLevel;
  return levelWeight[level] >= levelWeight[configured];
}

function emit(level: LogLevel, payload: LogPayload): void {
  if (isTestEnvironment && !logsEnabledInTests) return;
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  };

  console.log(JSON.stringify(entry));
}

export function logDebug(payload: LogPayload): void {
  emit('debug', payload);
}

export function logInfo(payload: LogPayload): void {
  emit('info', payload);
}

export function logWarn(payload: LogPayload): void {
  emit('warn', payload);
}

export function logError(payload: LogPayload): void {
  emit('error', payload);
}
