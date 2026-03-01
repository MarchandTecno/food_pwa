import type { Request } from 'express';
import type { Response } from 'express';
import type { AuthContext } from './auth';
import { extractAuthContext } from './auth';
import { prisma } from './database/client';
import type { PrismaClient } from '@prisma/client';

export { prisma };

export interface Context {
  prisma: PrismaClient;
  authContext?: AuthContext;
  requestId?: string;
  requestIp?: string;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function createContext(req?: Request, res?: Response): Context {
  const authContext = req ? extractAuthContext(req) : undefined;
  const requestId = res?.locals?.requestId as string | undefined;
  const requestIp = req
    ? getHeaderValue(req.headers['x-forwarded-for']) ?? req.ip ?? req.socket?.remoteAddress ?? undefined
    : undefined;

  return { prisma, authContext, requestId, requestIp };
}
