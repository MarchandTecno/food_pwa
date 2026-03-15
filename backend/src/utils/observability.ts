import type { PrismaClient } from '@prisma/client';

export interface SystemHealthSnapshot {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  checkedAt: string;
  uptimeSeconds: number;
  dbPingMs: number | null;
  error?: string;
}

export async function getSystemHealthSnapshot(client: PrismaClient): Promise<SystemHealthSnapshot> {
  const checkedAt = new Date();
  const startedAt = Date.now();

  try {
    await client.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      db: 'up',
      checkedAt: checkedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dbPingMs: Number((Date.now() - startedAt).toFixed(2)),
    };
  } catch (error) {
    return {
      status: 'degraded',
      db: 'down',
      checkedAt: checkedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dbPingMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}