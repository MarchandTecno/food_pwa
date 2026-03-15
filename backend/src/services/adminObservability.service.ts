import type { Prisma } from '@prisma/client';
import type { Context } from '../context';
import { executeDbOperation } from '../database';
import { toAdminAuditLogListOutput, type AdminAuditLogOutput } from '../models/adminObservability.model';
import {
  parseAdminListAuditLogsArgsOrThrow,
  type AdminListAuditLogsArgsInput,
} from '../schemas/adminObservability.schema';
import type { PageInfo } from '../types/pagination';
import { badUserInputError } from '../utils/graphqlErrors';
import { getMetricsSnapshot, type MetricsSnapshot } from '../utils/metrics';
import { getSystemHealthSnapshot } from '../utils/observability';
import { requireSuperAdminScope } from '../utils/authorization';

export type AdminListAuditLogsArgs = AdminListAuditLogsArgsInput;

const AUDIT_ENTITY_ALIAS_MAP: Record<string, string[]> = {
  inventory: ['inventory_adjustments', 'ingredients', 'recipes'],
  inventario: ['inventory_adjustments', 'ingredients', 'recipes'],
  cash: [
    'cash_sessions',
    'cash_movements',
    'core_cash_sessions',
    'core_cash_movements',
    'public_cash_sessions',
    'public_cash_movements',
  ],
  caja: [
    'cash_sessions',
    'cash_movements',
    'core_cash_sessions',
    'core_cash_movements',
    'public_cash_sessions',
    'public_cash_movements',
  ],
  coupons: ['coupons'],
  coupon: ['coupons'],
  cupones: ['coupons'],
  cupon: ['coupons'],
};

export interface AdminAuditLogPageResult {
  items: AdminAuditLogOutput[];
  pageInfo: PageInfo;
}

export interface AdminMetricPointOutput {
  timestamp: string;
  label: string;
  value: number;
}

export interface AdminMetricCountOutput {
  label: string;
  count: number;
}

export interface AdminMetricBreakdownOutput {
  label: string;
  count: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
}

export interface AdminHealthSnapshotOutput {
  status: string;
  db: string;
  uptime_seconds: number;
  checked_at: string;
  db_ping_ms: number | null;
  error: string | null;
}

export interface AdminServerMetricsOutput {
  total_requests: number;
  avg_latency_ms: number;
  peak_latency_ms: number;
  recent_latency: AdminMetricPointOutput[];
  operations: AdminMetricBreakdownOutput[];
  errors_by_code: AdminMetricCountOutput[];
}

export interface AdminDatabaseMetricsOutput {
  total_queries: number;
  avg_query_ms: number;
  slow_queries: number;
  last_query_at: string | null;
  recent_queries: AdminMetricPointOutput[];
  queries_by_type: AdminMetricBreakdownOutput[];
}

export interface AdminObservabilitySnapshotOutput {
  checked_at: string;
  health: AdminHealthSnapshotOutput;
  server: AdminServerMetricsOutput;
  database: AdminDatabaseMetricsOutput;
}

function parseDateOrThrow(value: string | undefined, fieldName: string): Date | undefined {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badUserInputError(`Invalid input: ${fieldName} must be a valid date string`);
  }

  return parsed;
}

function resolveEntityFilterCandidates(rawEntity: string): string[] {
  const normalized = rawEntity.trim().toLowerCase();
  if (!normalized) return [];

  return AUDIT_ENTITY_ALIAS_MAP[normalized] ?? [normalized];
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toMetricBreakdown(entries: MetricsSnapshot['server']['operations']): AdminMetricBreakdownOutput[] {
  return entries.map((entry) => ({
    label: entry.label,
    count: entry.count,
    avg_ms: entry.avgMs,
    min_ms: entry.minMs,
    max_ms: entry.maxMs,
  }));
}

function toMetricCounters(entries: MetricsSnapshot['server']['errorsByCode']): AdminMetricCountOutput[] {
  return entries.map((entry) => ({
    label: entry.label,
    count: entry.count,
  }));
}

function toMetricPoints(entries: MetricsSnapshot['server']['recentLatency']): AdminMetricPointOutput[] {
  return entries.map((entry) => ({
    timestamp: entry.timestamp,
    label: entry.label,
    value: entry.value,
  }));
}

function buildAdminAuditLogsWhere(args: AdminListAuditLogsArgsInput): Prisma.audit_logsWhereInput {
  const where: Prisma.audit_logsWhereInput = {};
  const andClauses: Prisma.audit_logsWhereInput[] = [];

  if (args.filter?.tenant_id) {
    andClauses.push({
      tenant_id: args.filter.tenant_id,
    });
  }

  if (args.filter?.actor_user_id) {
    andClauses.push({
      user_id: args.filter.actor_user_id,
    });
  }

  if (args.filter?.entity) {
    const entities = resolveEntityFilterCandidates(args.filter.entity);

    if (entities.length === 1) {
      andClauses.push({
        tabla_afectada: entities[0],
      });
    } else if (entities.length > 1) {
      andClauses.push({
        tabla_afectada: {
          in: entities,
        },
      });
    }

  }

  if (args.filter?.action) {
    andClauses.push({
      accion: args.filter.action,
    });
  }

  const from = parseDateOrThrow(args.filter?.from, 'filter.from');
  const to = parseDateOrThrow(args.filter?.to, 'filter.to');

  if (from || to) {
    const createdAtFilter: Prisma.DateTimeNullableFilter = {};
    if (from) {
      createdAtFilter.gte = from;
    }
    if (to) {
      createdAtFilter.lte = to;
    }

    andClauses.push({
      created_at: createdAtFilter,
    });
  }

  if (args.filter?.actor_search) {
    const text = args.filter.actor_search;
    andClauses.push({
      users: {
        is: {
          OR: [
            {
              email: {
                contains: text,
                mode: 'insensitive',
              },
            },
            {
              nombre: {
                contains: text,
                mode: 'insensitive',
              },
            },
          ],
        },
      },
    });
  }

  if (args.filter?.search) {
    const text = args.filter.search;
    const searchClauses: Prisma.audit_logsWhereInput[] = [
      {
        ip_address: {
          contains: text,
          mode: 'insensitive',
        },
      },
      {
        accion: {
          contains: text,
          mode: 'insensitive',
        },
      },
      {
        tabla_afectada: {
          contains: text,
          mode: 'insensitive',
        },
      },
      {
        users: {
          is: {
            OR: [
              {
                email: {
                  contains: text,
                  mode: 'insensitive',
                },
              },
              {
                nombre: {
                  contains: text,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      },
      {
        tenants: {
          is: {
            nombre_comercial: {
              contains: text,
              mode: 'insensitive',
            },
          },
        },
      },
    ];

    if (isUuidLike(text)) {
      searchClauses.push({
        registro_id: text,
      });
    }

    andClauses.push({
      OR: searchClauses,
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  return where;
}

export async function listAdminAuditLogsPage(
  ctx: Context,
  args: AdminListAuditLogsArgs,
): Promise<AdminAuditLogPageResult> {
  return executeDbOperation(async () => {
    await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminListAuditLogsArgsOrThrow(args ?? {});
    const safeLimit = validatedArgs.limit ?? 25;
    const safeOffset = Math.max(validatedArgs.offset ?? 0, 0);
    const where = buildAdminAuditLogsWhere(validatedArgs);

    const [rows, total] = await Promise.all([
      ctx.prisma.audit_logs.findMany({
        where,
        take: safeLimit + 1,
        skip: safeOffset,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        include: {
          users: {
            include: {
              roles: {
                select: {
                  nombre_rol: true,
                },
              },
            },
          },
          tenants: {
            select: {
              nombre_comercial: true,
            },
          },
        },
      }),
      ctx.prisma.audit_logs.count({ where }),
    ]);

    const hasNextPage = rows.length > safeLimit;
    const visibleRows = hasNextPage ? rows.slice(0, safeLimit) : rows;

    return {
      items: toAdminAuditLogListOutput(visibleRows),
      pageInfo: {
        total,
        hasNextPage,
        nextCursor: null,
        limit: safeLimit,
        offset: safeOffset,
      },
    };
  });
}

export async function getAdminObservabilitySnapshot(ctx: Context): Promise<AdminObservabilitySnapshotOutput> {
  return executeDbOperation(async () => {
    await requireSuperAdminScope(ctx);

    const [health, metrics] = await Promise.all([getSystemHealthSnapshot(ctx.prisma), Promise.resolve(getMetricsSnapshot())]);

    return {
      checked_at: health.checkedAt,
      health: {
        status: health.status,
        db: health.db,
        uptime_seconds: health.uptimeSeconds,
        checked_at: health.checkedAt,
        db_ping_ms: health.dbPingMs,
        error: health.error ?? null,
      },
      server: {
        total_requests: metrics.server.totalRequests,
        avg_latency_ms: metrics.server.avgLatencyMs,
        peak_latency_ms: metrics.server.peakLatencyMs,
        recent_latency: toMetricPoints(metrics.server.recentLatency),
        operations: toMetricBreakdown(metrics.server.operations),
        errors_by_code: toMetricCounters(metrics.server.errorsByCode),
      },
      database: {
        total_queries: metrics.database.totalQueries,
        avg_query_ms: metrics.database.avgQueryMs,
        slow_queries: metrics.database.slowQueries,
        last_query_at: metrics.database.lastQueryAt,
        recent_queries: toMetricPoints(metrics.database.recentQueries),
        queries_by_type: toMetricBreakdown(metrics.database.queriesByType),
      },
    };
  });
}