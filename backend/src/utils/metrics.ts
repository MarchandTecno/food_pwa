interface LatencyStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

export interface MetricPointSnapshot {
  timestamp: string;
  label: string;
  value: number;
}

export interface MetricCounterSnapshot {
  label: string;
  count: number;
}

export interface LatencyBreakdownSnapshot {
  label: string;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

export interface ServerMetricsSnapshot {
  totalRequests: number;
  avgLatencyMs: number;
  peakLatencyMs: number;
  recentLatency: MetricPointSnapshot[];
  operations: LatencyBreakdownSnapshot[];
  errorsByCode: MetricCounterSnapshot[];
}

export interface DatabaseMetricsSnapshot {
  totalQueries: number;
  avgQueryMs: number;
  slowQueries: number;
  lastQueryAt: string | null;
  recentQueries: MetricPointSnapshot[];
  queriesByType: LatencyBreakdownSnapshot[];
}

export interface MetricsSnapshot {
  collectedAt: string;
  uptimeSeconds: number;
  server: ServerMetricsSnapshot;
  database: DatabaseMetricsSnapshot;
}

const MAX_RECENT_POINTS = 40;
const SLOW_DB_QUERY_THRESHOLD_MS = 250;

const operationLatencyMetrics = new Map<string, LatencyStats>();
const errorCodeMetrics = new Map<string, number>();
const dbQueryMetrics = new Map<string, LatencyStats>();
const recentLatencyPoints: MetricPointSnapshot[] = [];
const recentDbQueryPoints: MetricPointSnapshot[] = [];

let totalRequestCount = 0;
let totalRequestLatencyMs = 0;
let totalDbQueryCount = 0;
let totalDbQueryLatencyMs = 0;
let slowDbQueryCount = 0;
let lastDbQueryAt: string | null = null;

function updateLatencyStats(bucket: Map<string, LatencyStats>, key: string, durationMs: number): void {
  const current = bucket.get(key);

  if (!current) {
    bucket.set(key, {
      count: 1,
      totalMs: durationMs,
      minMs: durationMs,
      maxMs: durationMs,
    });
    return;
  }

  current.count += 1;
  current.totalMs += durationMs;
  current.minMs = Math.min(current.minMs, durationMs);
  current.maxMs = Math.max(current.maxMs, durationMs);
}

function pushRecentPoint(buffer: MetricPointSnapshot[], entry: MetricPointSnapshot): void {
  buffer.push(entry);

  if (buffer.length > MAX_RECENT_POINTS) {
    buffer.splice(0, buffer.length - MAX_RECENT_POINTS);
  }
}

function toBreakdownSnapshot(bucket: Map<string, LatencyStats>): LatencyBreakdownSnapshot[] {
  return Array.from(bucket.entries())
    .map(([label, stats]) => ({
      label,
      count: stats.count,
      avgMs: Number((stats.totalMs / stats.count).toFixed(2)),
      minMs: Number(stats.minMs.toFixed(2)),
      maxMs: Number(stats.maxMs.toFixed(2)),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function toCounterSnapshot(bucket: Map<string, number>): MetricCounterSnapshot[] {
  return Array.from(bucket.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function classifySqlQuery(query: string): string {
  const match = /^\s*([A-Za-z]+)/.exec(query);
  return match?.[1]?.toUpperCase() ?? 'UNKNOWN';
}

function findPeakLatency(bucket: Map<string, LatencyStats>): number {
  let peak = 0;

  for (const stats of bucket.values()) {
    peak = Math.max(peak, stats.maxMs);
  }

  return Number(peak.toFixed(2));
}

export function recordOperationLatency(operationName: string, latencyMs: number, timestamp: Date = new Date()): void {
  if (!Number.isFinite(latencyMs)) return;

  const key = operationName || 'anonymous';
  totalRequestCount += 1;
  totalRequestLatencyMs += latencyMs;

  updateLatencyStats(operationLatencyMetrics, key, latencyMs);
  pushRecentPoint(recentLatencyPoints, {
    timestamp: timestamp.toISOString(),
    label: key,
    value: Number(latencyMs.toFixed(2)),
  });
}

export function recordGraphqlErrorCode(code: string): void {
  const key = code || 'UNKNOWN';
  const current = errorCodeMetrics.get(key) ?? 0;
  errorCodeMetrics.set(key, current + 1);
}

export function recordDatabaseQuery(query: string, durationMs: number, timestamp: Date = new Date()): void {
  if (!Number.isFinite(durationMs)) return;

  const key = classifySqlQuery(query);
  totalDbQueryCount += 1;
  totalDbQueryLatencyMs += durationMs;
  lastDbQueryAt = timestamp.toISOString();

  if (durationMs >= SLOW_DB_QUERY_THRESHOLD_MS) {
    slowDbQueryCount += 1;
  }

  updateLatencyStats(dbQueryMetrics, key, durationMs);
  pushRecentPoint(recentDbQueryPoints, {
    timestamp: timestamp.toISOString(),
    label: key,
    value: Number(durationMs.toFixed(2)),
  });
}

export function getMetricsSnapshot(): MetricsSnapshot {
  return {
    collectedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    server: {
      totalRequests: totalRequestCount,
      avgLatencyMs: totalRequestCount > 0 ? Number((totalRequestLatencyMs / totalRequestCount).toFixed(2)) : 0,
      peakLatencyMs: findPeakLatency(operationLatencyMetrics),
      recentLatency: [...recentLatencyPoints],
      operations: toBreakdownSnapshot(operationLatencyMetrics),
      errorsByCode: toCounterSnapshot(errorCodeMetrics),
    },
    database: {
      totalQueries: totalDbQueryCount,
      avgQueryMs: totalDbQueryCount > 0 ? Number((totalDbQueryLatencyMs / totalDbQueryCount).toFixed(2)) : 0,
      slowQueries: slowDbQueryCount,
      lastQueryAt: lastDbQueryAt,
      recentQueries: [...recentDbQueryPoints],
      queriesByType: toBreakdownSnapshot(dbQueryMetrics),
    },
  };
}
