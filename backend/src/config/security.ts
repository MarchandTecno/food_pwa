import type { CorsOptions } from 'cors';
import type { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { verifyToken } from '../auth';
import { logInfo, logWarn } from '../utils/logger';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const APOLLO_DEV_ORIGINS = new Set([
  'https://studio.apollographql.com',
  'https://sandbox.embed.apollographql.com',
  'https://embeddable-sandbox.cdn.apollographql.com',
]);

function parseOrigins(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins(): string[] {
  const configured = parseOrigins(process.env.CORS_ORIGINS);
  const legacyConfigured = parseOrigins(process.env.CORS_ORIGIN);
  const origins = configured.length > 0 ? configured : legacyConfigured;

  if (origins.length > 0) {
    return origins;
  }

  if (IS_PRODUCTION) {
    throw new Error('[Security] CORS_ORIGINS (or CORS_ORIGIN) is required in production');
  }

  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return true;
  }

  if (!IS_PRODUCTION) {
    return isLocalDevelopmentOrigin(origin) || APOLLO_DEV_ORIGINS.has(origin);
  }

  return false;
}

export function buildCorsOptions(): CorsOptions {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS not allowed for this origin'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

export function buildCspDirectives(): Record<string, Iterable<string>> {
  if (IS_PRODUCTION) {
    return {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      manifestSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      upgradeInsecureRequests: [],
    };
  }

  return {
    defaultSrc: ["'self'", 'https:'],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://embeddable-sandbox.cdn.apollographql.com',
      'https://cdn.apollographql.com',
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://embeddable-sandbox.cdn.apollographql.com',
      'https://fonts.googleapis.com',
    ],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    connectSrc: ["'self'", 'https:', 'ws:', 'wss:'],
    frameAncestors: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    manifestSrc: ["'self'", 'https://apollo-server-landing-page.cdn.apollographql.com'],
    frameSrc: [
      "'self'",
      'https://embeddable-sandbox.cdn.apollographql.com',
      'https://sandbox.embed.apollographql.com',
    ],
    childSrc: ["'self'", 'https://embeddable-sandbox.cdn.apollographql.com'],
    upgradeInsecureRequests: [],
  };
}

type GraphQLBody = {
  query?: string;
  operationName?: string;
};

type RateLimiterLike = {
  consume: (key: string) => Promise<unknown>;
};

function parseMutationNameList(rawValue: string | undefined, fallbackValue: string): string[] {
  return (rawValue ?? fallbackValue)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value.trim().toLowerCase() === 'true';
}

function parsePositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return Math.floor(parsed);
}

function parseOptionalNonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const authRateLimitMax = parsePositiveIntegerEnv('AUTH_RATE_LIMIT_MAX', 10);
const authRateLimitWindowSec = parsePositiveIntegerEnv('AUTH_RATE_LIMIT_WINDOW_SEC', 60);

const adminCredentialRateLimitMax = parsePositiveIntegerEnv('ADMIN_CREDENTIAL_RATE_LIMIT_MAX', 6);
const adminCredentialRateLimitWindowSec = parsePositiveIntegerEnv('ADMIN_CREDENTIAL_RATE_LIMIT_WINDOW_SEC', 60);

const sensitiveRateLimitMax = parsePositiveIntegerEnv('SENSITIVE_RATE_LIMIT_MAX', 30);
const sensitiveRateLimitWindowSec = parsePositiveIntegerEnv('SENSITIVE_RATE_LIMIT_WINDOW_SEC', 60);

const distributedRateLimitEnabled = parseBooleanEnv('ENABLE_DISTRIBUTED_RATE_LIMIT', true);
const redisUrl = parseOptionalNonEmptyEnv('REDIS_URL');
const redisConnectTimeoutMs = parsePositiveIntegerEnv('REDIS_CONNECT_TIMEOUT_MS', 1000);

function buildMemoryLimiter(keyPrefix: string, points: number, duration: number): RateLimiterMemory {
  return new RateLimiterMemory({
    keyPrefix,
    points,
    duration,
  });
}

let sharedRedisClient: Redis | undefined;
let loggedRedisReady = false;

if (distributedRateLimitEnabled && redisUrl) {
  sharedRedisClient = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: redisConnectTimeoutMs,
  });

  sharedRedisClient.on('ready', () => {
    if (loggedRedisReady) return;
    loggedRedisReady = true;
    logInfo({
      event: 'security.rate_limit.redis_ready',
      message: 'Distributed Redis rate limiter enabled',
    });
  });

  sharedRedisClient.on('error', (error) => {
    logWarn({
      event: 'security.rate_limit.redis_error',
      message: 'Redis rate limiter error, using in-memory insurance limiter',
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function disposeGraphqlRateLimitResources(): Promise<void> {
  if (!sharedRedisClient) return;

  const redisClient = sharedRedisClient;
  sharedRedisClient = undefined;
  loggedRedisReady = false;

  redisClient.removeAllListeners();

  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
}

function buildRateLimiter(keyPrefix: string, points: number, duration: number): RateLimiterLike {
  const insuranceLimiter = buildMemoryLimiter(`${keyPrefix}:insurance`, points, duration);

  if (!sharedRedisClient) {
    return buildMemoryLimiter(keyPrefix, points, duration);
  }

  return new RateLimiterRedis({
    storeClient: sharedRedisClient,
    keyPrefix,
    points,
    duration,
    insuranceLimiter,
  }) as unknown as RateLimiterLike;
}

const authLimiter = buildRateLimiter('auth', authRateLimitMax, authRateLimitWindowSec);

const sensitiveLimiter = buildRateLimiter('sensitive', sensitiveRateLimitMax, sensitiveRateLimitWindowSec);

const adminCredentialLimiter = buildRateLimiter(
  'admin-credentials',
  adminCredentialRateLimitMax,
  adminCredentialRateLimitWindowSec,
);

const sensitiveMutationNames = parseMutationNameList(
  process.env.SENSITIVE_MUTATIONS,
  'createOrder,updateOrderStatus,deleteOrder,createProduct,updateProduct,deleteProduct,adminCreateTenant,adminUpdateTenantBranding,adminUpdateTenantRegion,adminUpdateTenantSubscription,adminCreateBranch,adminSetBranchSuspended',
);

const adminCredentialMutationNames = parseMutationNameList(
  process.env.ADMIN_CREDENTIAL_MUTATIONS,
  'adminCreateUser,adminResetUserPassword',
);

const sensitiveRateLimitEnabled = parseBooleanEnv('ENABLE_SENSITIVE_MUTATION_RATE_LIMIT', false);
const adminCredentialRateLimitEnabled = parseBooleanEnv('ENABLE_ADMIN_CREDENTIAL_RATE_LIMIT', true);

function isMutationWithField(query: string, mutationName: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(mutationName)}\\s*\\(`);
  return /\bmutation\b/.test(query) && pattern.test(query);
}

function isNamedMutationRequest(body: GraphQLBody, mutationNames: string[]): boolean {
  const query = body.query ?? '';
  const operationName = body.operationName ?? '';

  if (/\bmutation\b/.test(query) && mutationNames.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(operationName))) {
    return true;
  }

  return mutationNames.some((name) => isMutationWithField(query, name));
}

function isAuthMutationRequest(body: GraphQLBody): boolean {
  const query = body.query ?? '';
  const opName = (body.operationName ?? '').toLowerCase();

  if (opName.includes('login') || opName.includes('register')) {
    return true;
  }

  return isMutationWithField(query, 'login') || isMutationWithField(query, 'register');
}

function isSensitiveMutationRequest(body: GraphQLBody): boolean {
  return isNamedMutationRequest(body, sensitiveMutationNames);
}

function isAdminCredentialMutationRequest(body: GraphQLBody): boolean {
  return isNamedMutationRequest(body, adminCredentialMutationNames);
}

function getRequestKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getAuthorizationHeader(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function getActorRateLimitKey(req: Request, requestKey: string): string {
  const tokenPayload = verifyToken(getAuthorizationHeader(req));
  if (tokenPayload?.userId) {
    return `user:${tokenPayload.userId}`;
  }

  return `ip:${requestKey}`;
}

function tooManyRequests(res: Response): void {
  res.status(429).json({
    errors: [
      {
        message: 'TOO_MANY_REQUESTS: Rate limit exceeded',
        extensions: { code: 'TOO_MANY_REQUESTS' },
      },
    ],
  });
}

export async function graphqlRateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body as GraphQLBody | undefined;
  if (!body?.query && !body?.operationName) {
    next();
    return;
  }

  const requestKey = getRequestKey(req);
  const actorRateLimitKey = getActorRateLimitKey(req, requestKey);

  try {
    if (isAuthMutationRequest(body)) {
      await authLimiter.consume(`auth:${requestKey}`);
    }

    if (adminCredentialRateLimitEnabled && isAdminCredentialMutationRequest(body)) {
      await adminCredentialLimiter.consume(`admin-credentials:${actorRateLimitKey}`);
    }

    if (sensitiveRateLimitEnabled && isSensitiveMutationRequest(body)) {
      await sensitiveLimiter.consume(`sensitive:${requestKey}`);
    }
  } catch {
    tooManyRequests(res);
    return;
  }

  next();
}
