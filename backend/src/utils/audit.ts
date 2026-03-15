import type { Prisma } from '@prisma/client';
import type { Context } from '../context';

type AuditDbClient = Context['prisma'] | Prisma.TransactionClient;

export interface CreateAuditLogArgs {
  db: AuditDbClient;
  ctx: Context;
  entity: string;
  action: string;
  actorUserId?: string | null;
  tenantId?: string | null;
  recordId?: string | null;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

export function normalizeIpForAudit(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return ip.slice(0, 45);
}

export function toAuditJsonRecord(payload: Record<string, unknown>): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue;
}

export async function createAuditLog(args: CreateAuditLogArgs): Promise<void> {
  await args.db.audit_logs.create({
    data: {
      tenant_id: args.tenantId ?? null,
      user_id: args.actorUserId ?? null,
      accion: args.action,
      tabla_afectada: args.entity,
      registro_id: args.recordId ?? null,
      valor_anterior: args.previousValue,
      valor_nuevo: args.newValue,
      ip_address: normalizeIpForAudit(args.ctx.requestIp),
    },
  });
}