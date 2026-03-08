import type { branches, tenants } from '@prisma/client';

export type AdminSubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';

export interface CssVariableOutput {
  key: string;
  value: string;
}

export interface AdminTenantOutput {
  id: string;
  nombre_comercial: string;
  razon_social: string | null;
  rfc_tax_id: string | null;
  email_admin: string;
  telefono_contacto: string | null;
  logo_url: string | null;
  moneda: string | null;
  region_code: string | null;
  time_zone: string | null;
  palette_css: CssVariableOutput[];
  subscription_status: AdminSubscriptionStatus;
  subscription_note: string | null;
  subscription_updated_at: Date | null;
  is_active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface AdminBranchOutput {
  id: string;
  tenant_id: string | null;
  nombre_sucursal: string;
  direccion_fisica: string | null;
  horario_apertura: Date | null;
  horario_cierre: Date | null;
  is_open: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
}

function readOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return null;
}

function normalizeSubscriptionStatus(value: string | null | undefined): AdminSubscriptionStatus {
  const status = value?.trim().toUpperCase();

  if (status === 'SUSPENDED') return 'SUSPENDED';
  if (status === 'CANCELED') return 'CANCELED';
  return 'ACTIVE';
}

function toCssVariables(value: unknown): CssVariableOutput[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const entries = Object.entries(value as Record<string, unknown>);

  return entries
    .map(([key, rawValue]) => {
      if (!key.trim()) return null;
      if (typeof rawValue !== 'string') return null;

      const cssValue = rawValue.trim();
      if (!cssValue) return null;

      return {
        key,
        value: cssValue,
      };
    })
    .filter((entry): entry is CssVariableOutput => Boolean(entry));
}

export function toAdminTenantOutput(tenant: tenants): AdminTenantOutput {
  const rawTenant = tenant as unknown as Record<string, unknown>;

  return {
    id: tenant.id,
    nombre_comercial: tenant.nombre_comercial,
    razon_social: tenant.razon_social,
    rfc_tax_id: tenant.rfc_tax_id,
    email_admin: tenant.email_admin,
    telefono_contacto: tenant.telefono_contacto,
    logo_url: tenant.logo_url,
    moneda: tenant.moneda,
    region_code: (rawTenant.region_code as string | null | undefined) ?? null,
    time_zone: (rawTenant.time_zone as string | null | undefined) ?? null,
    palette_css: toCssVariables(rawTenant.brand_palette),
    subscription_status: normalizeSubscriptionStatus((rawTenant.subscription_status as string | null | undefined) ?? null),
    subscription_note: (rawTenant.subscription_note as string | null | undefined) ?? null,
    subscription_updated_at: readOptionalDate(rawTenant.subscription_updated_at),
    is_active: tenant.is_active ?? true,
    created_at: readOptionalDate(rawTenant.created_at),
    updated_at: readOptionalDate(rawTenant.updated_at),
  };
}

export function toAdminTenantListOutput(items: tenants[]): AdminTenantOutput[] {
  return items.map(toAdminTenantOutput);
}

export function toAdminBranchOutput(branch: branches): AdminBranchOutput {
  const rawBranch = branch as unknown as Record<string, unknown>;

  return {
    id: branch.id,
    tenant_id: branch.tenant_id,
    nombre_sucursal: branch.nombre_sucursal,
    direccion_fisica: branch.direccion_fisica,
    horario_apertura: readOptionalDate(rawBranch.horario_apertura),
    horario_cierre: readOptionalDate(rawBranch.horario_cierre),
    is_open: branch.is_open ?? true,
    is_suspended: (rawBranch.is_suspended as boolean | null | undefined) ?? false,
    suspension_reason: (rawBranch.suspension_reason as string | null | undefined) ?? null,
  };
}

export function toAdminBranchListOutput(items: branches[]): AdminBranchOutput[] {
  return items.map(toAdminBranchOutput);
}
