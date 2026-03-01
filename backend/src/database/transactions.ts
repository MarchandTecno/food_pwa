import type { Prisma, PrismaClient } from '@prisma/client';

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export async function withTransaction<T>(
  client: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  return client.$transaction((tx) => operation(tx), options);
}
