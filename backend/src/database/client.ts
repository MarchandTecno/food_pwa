import { PrismaClient } from '@prisma/client';

type GlobalPrismaRef = typeof globalThis & {
  __foodflowPrisma?: PrismaClient;
};

const globalRef = globalThis as GlobalPrismaRef;

export const prisma =
  globalRef.__foodflowPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalRef.__foodflowPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
