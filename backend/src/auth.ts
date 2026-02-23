import jwt from 'jsonwebtoken';
import type { Request } from 'express';

export interface AuthPayload {
  userId: string;
  email?: string;
  role?: 'admin' | 'manager' | 'staff' | 'customer';
}

export interface AuthContext {
  user?: AuthPayload;
  isAuthenticated: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Verifica el token JWT del header Authorization
 * Espera formato: "Bearer <token>"
 */
export function verifyToken(authHeader?: string): AuthPayload | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return decoded;
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Genera un token JWT válido por 24 horas
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
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
