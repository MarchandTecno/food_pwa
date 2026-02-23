import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import type { AuthContext } from './auth';
import { extractAuthContext } from './auth';

export const prisma = new PrismaClient();

export interface Context {
  prisma: PrismaClient;
  authContext?: AuthContext;
}

export function createContext(req?: Request): Context {
  const authContext = req ? extractAuthContext(req) : undefined;
  return { prisma, authContext };
}
