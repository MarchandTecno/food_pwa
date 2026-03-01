interface LatencyStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

const operationLatencyMetrics = new Map<string, LatencyStats>();
const errorCodeMetrics = new Map<string, number>();

export function recordOperationLatency(operationName: string, latencyMs: number): void {
  const key = operationName || 'anonymous';
  const prev = operationLatencyMetrics.get(key);

  if (!prev) {
    operationLatencyMetrics.set(key, {
      count: 1,
      totalMs: latencyMs,
      minMs: latencyMs,
      maxMs: latencyMs,
    });
    return;
  }

  prev.count += 1;
  prev.totalMs += latencyMs;
  prev.minMs = Math.min(prev.minMs, latencyMs);
  prev.maxMs = Math.max(prev.maxMs, latencyMs);
}

export function recordGraphqlErrorCode(code: string): void {
  const key = code || 'UNKNOWN';
  const current = errorCodeMetrics.get(key) ?? 0;
  errorCodeMetrics.set(key, current + 1);
}

export function getMetricsSnapshot() {
  const operations = Array.from(operationLatencyMetrics.entries()).map(([operation, stats]) => ({
    operation,
    count: stats.count,
    avgMs: Number((stats.totalMs / stats.count).toFixed(2)),
    minMs: Number(stats.minMs.toFixed(2)),
    maxMs: Number(stats.maxMs.toFixed(2)),
  }));

  const errorCountsByCode = Object.fromEntries(errorCodeMetrics.entries());

  return {
    operations,
    errorCountsByCode,
  };
}
