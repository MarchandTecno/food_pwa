import { Prisma, PrismaClient } from '@prisma/client';
import { recordDatabaseQuery } from '../utils/metrics';

type GlobalPrismaRef = typeof globalThis & {
  __foodflowPrisma?: PrismaClient;
  __foodflowPrismaMetricsBound?: boolean;
};

const globalRef = globalThis as GlobalPrismaRef;

const prismaLogConfig =
  process.env.NODE_ENV === 'development'
    ? ([
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ] satisfies Prisma.LogDefinition[])
    : ([
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
      ] satisfies Prisma.LogDefinition[]);

export const prisma =
  globalRef.__foodflowPrisma ??
  new PrismaClient({
    log: prismaLogConfig,
  });

if (!globalRef.__foodflowPrismaMetricsBound) {
  const prismaWithQueryEvents = prisma as unknown as {
    $on(eventType: 'query', callback: (event: Prisma.QueryEvent) => void): void;
  };

  prismaWithQueryEvents.$on('query', (event: Prisma.QueryEvent) => {
    recordDatabaseQuery(event.query, event.duration, event.timestamp);
  });
  globalRef.__foodflowPrismaMetricsBound = true;
}

if (process.env.NODE_ENV !== 'production') {
  globalRef.__foodflowPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
