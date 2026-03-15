import type { audit_logs, roles, tenants, users } from '@prisma/client';
import { normalizeGlobalRole, type GlobalRoleCode } from '../utils/roles';

export interface AdminAuditLogOutput {
  id: string;
  actor_user_id: string | null;
  actor_user_email: string | null;
  actor_user_nombre: string | null;
  actor_role: GlobalRoleCode | null;
  tenant_id: string | null;
  tenant_nombre: string | null;
  entity: string;
  action: string;
  record_id: string | null;
  ip_address: string | null;
  happened_at: Date | null;
  previous_value: string | null;
  new_value: string | null;
}

type AuditLogWithRelations = audit_logs & {
  users?: (users & { roles?: Pick<roles, 'nombre_rol'> | null }) | null;
  tenants?: Pick<tenants, 'nombre_comercial'> | null;
};

function readOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return null;
}

function stringifyAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function toAdminAuditLogOutput(log: AuditLogWithRelations): AdminAuditLogOutput {
  return {
    id: log.id,
    actor_user_id: log.user_id ?? null,
    actor_user_email: log.users?.email ?? null,
    actor_user_nombre: log.users?.nombre ?? null,
    actor_role: normalizeGlobalRole(log.users?.roles?.nombre_rol ?? undefined) ?? null,
    tenant_id: log.tenant_id ?? null,
    tenant_nombre: log.tenants?.nombre_comercial ?? null,
    entity: log.tabla_afectada,
    action: log.accion,
    record_id: log.registro_id ?? null,
    ip_address: log.ip_address ?? null,
    happened_at: readOptionalDate(log.created_at),
    previous_value: stringifyAuditValue(log.valor_anterior),
    new_value: stringifyAuditValue(log.valor_nuevo),
  };
}

export function toAdminAuditLogListOutput(logs: AuditLogWithRelations[]): AdminAuditLogOutput[] {
  return logs.map((log) => toAdminAuditLogOutput(log));
}