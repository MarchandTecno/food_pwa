export type TenantSubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';

export interface CssVariable {
  key: string;
  value: string;
}

export interface AdminUser {
  id: string;
  email: string;
  nombre: string | null;
  role: string | null;
}

export interface AdminTenant {
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
  palette_css: CssVariable[];
  subscription_status: TenantSubscriptionStatus;
  subscription_note: string | null;
  subscription_updated_at: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminBranch {
  id: string;
  tenant_id: string | null;
  nombre_sucursal: string;
  direccion_fisica: string | null;
  horario_apertura: string | null;
  horario_cierre: string | null;
  is_open: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
}

export interface CreateTenantPayload {
  nombre_comercial: string;
  razon_social?: string;
  rfc_tax_id?: string;
  email_admin: string;
  telefono_contacto?: string;
  logo_url?: string;
  moneda?: string;
  region_code?: string;
  time_zone?: string;
}

export interface UpdateBrandingPayload {
  logo_url?: string | null;
  palette_css?: CssVariable[];
}

export interface CreateBranchPayload {
  tenant_id: string;
  nombre_sucursal: string;
  direccion_fisica?: string;
  horario_apertura?: string;
  horario_cierre?: string;
}
