import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import type { SignOptions } from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  email?: string;
  tenantId?: string;
  branchId?: string;
  role?: 'admin' | 'manager' | 'staff' | 'customer';
}

export interface AuthContext {
  user?: AuthPayload;
  isAuthenticated: boolean;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const JWT_EXPIRATION: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRATION as SignOptions['expiresIn']) ?? '24h';

function resolveJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (NODE_ENV === 'production') {
    throw new Error('[Auth] JWT_SECRET is required in production');
  }

  return 'dev-only-insecure-secret-change-me';
}

const JWT_SECRET = resolveJwtSecret();

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Verifica el token JWT del header Authorization
 * Espera formato: "Bearer <token>"
 */
export function verifyToken(authHeader?: string): AuthPayload | null {
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Genera un token JWT con expiración configurable
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION, algorithm: 'HS256' });
}

/**
 * Extrae y verifica el contexto de autenticación desde el request de Express
 */
export function extractAuthContext(req: Request): AuthContext {
  const authHeader = req.headers.authorization;
  const user = verifyToken(authHeader);

  return {
    user: user || undefined,
    isAuthenticated: !!user,
  };
}
