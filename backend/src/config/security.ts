import type { CorsOptions } from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

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

const authLimiter = new RateLimiterMemory({
  points: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
  duration: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SEC ?? 60),
});

const sensitiveLimiter = new RateLimiterMemory({
  points: Number(process.env.SENSITIVE_RATE_LIMIT_MAX ?? 30),
  duration: Number(process.env.SENSITIVE_RATE_LIMIT_WINDOW_SEC ?? 60),
});

const sensitiveMutationNames = (
  process.env.SENSITIVE_MUTATIONS ??
  'createOrder,updateOrderStatus,deleteOrder,createProduct,updateProduct,deleteProduct'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const sensitiveRateLimitEnabled = process.env.ENABLE_SENSITIVE_MUTATION_RATE_LIMIT === 'true';

function isMutationWithField(query: string, mutationName: string): boolean {
  const pattern = new RegExp(`\\b${mutationName}\\s*\\(`);
  return /\bmutation\b/.test(query) && pattern.test(query);
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
  const query = body.query ?? '';
  const operationName = body.operationName ?? '';

  if (/\bmutation\b/.test(query) && sensitiveMutationNames.some((name) => new RegExp(`\\b${name}\\b`).test(operationName))) {
    return true;
  }

  return sensitiveMutationNames.some((name) => isMutationWithField(query, name));
}

function getRequestKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
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

  try {
    if (isAuthMutationRequest(body)) {
      await authLimiter.consume(`auth:${requestKey}`);
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
