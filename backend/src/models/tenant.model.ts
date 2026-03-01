import type { tenants } from '@prisma/client';

export interface TenantOutput {
  id: string;
  nombre: string | null;
  email: string | null;
  whatsapp: string | null;
  created_at: Date | null;
}

function readOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return null;
}

export function toTenantOutput(tenant: tenants): TenantOutput {
  const rawTenant = tenant as unknown as Record<string, unknown>;

  return {
    id: tenant.id,
    nombre: tenant.nombre_comercial,
    email: tenant.email_admin,
    whatsapp: tenant.telefono_contacto,
    created_at: readOptionalDate(rawTenant.created_at),
  };
}

export function toTenantListOutput(items: tenants[]): TenantOutput[] {
  return items.map(toTenantOutput);
}
