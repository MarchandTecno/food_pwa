export type TenantSubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
export type AdminGlobalRole = 'SUPERADMIN' | 'OWNER' | 'KITCHEN' | 'DELIVERY';

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

export interface AdminRolePermission {
  role: AdminGlobalRole;
  hierarchy_level: number;
  label: string;
  scope: string;
  permissions: string[];
}

export interface AdminUserRecord {
  id: string;
  nombre: string;
  email: string;
  role: AdminGlobalRole | null;
  role_label: string;
  tenant_id: string | null;
  tenant_nombre: string | null;
  branch_id: string | null;
  branch_nombre: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
}

export interface AdminSessionLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_nombre: string | null;
  tenant_id: string | null;
  tenant_nombre: string | null;
  role: AdminGlobalRole | null;
  action: string;
  ip_address: string | null;
  happened_at: string | null;
  last_access: string | null;
}

export interface PageInfo {
  total: number;
  hasNextPage: boolean;
  nextCursor: string | null;
  limit: number;
  offset: number | null;
}

export interface AdminSessionLogPage {
  items: AdminSessionLog[];
  pageInfo: PageInfo;
}

export interface AdminAuditLog {
  id: string;
  actor_user_id: string | null;
  actor_user_email: string | null;
  actor_user_nombre: string | null;
  actor_role: AdminGlobalRole | null;
  tenant_id: string | null;
  tenant_nombre: string | null;
  entity: string;
  action: string;
  record_id: string | null;
  ip_address: string | null;
  happened_at: string | null;
  previous_value: string | null;
  new_value: string | null;
}

export interface AdminAuditLogFilter {
  tenant_id?: string;
  actor_user_id?: string;
  actor_search?: string;
  entity?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AdminAuditLogPage {
  items: AdminAuditLog[];
  pageInfo: PageInfo;
}

export interface AdminMetricCount {
  label: string;
  count: number;
}

export interface AdminMetricPoint {
  timestamp: string;
  label: string;
  value: number;
}

export interface AdminMetricBreakdown {
  label: string;
  count: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
}

export interface AdminHealthSnapshot {
  status: string;
  db: string;
  uptime_seconds: number;
  checked_at: string;
  db_ping_ms: number | null;
  error: string | null;
}

export interface AdminServerMetrics {
  total_requests: number;
  avg_latency_ms: number;
  peak_latency_ms: number;
  recent_latency: AdminMetricPoint[];
  operations: AdminMetricBreakdown[];
  errors_by_code: AdminMetricCount[];
}

export interface AdminDatabaseMetrics {
  total_queries: number;
  avg_query_ms: number;
  slow_queries: number;
  last_query_at: string | null;
  recent_queries: AdminMetricPoint[];
  queries_by_type: AdminMetricBreakdown[];
}

export interface AdminObservabilitySnapshot {
  checked_at: string;
  health: AdminHealthSnapshot;
  server: AdminServerMetrics;
  database: AdminDatabaseMetrics;
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

export interface AdminUserFilter {
  search?: string;
  tenant_id?: string;
  branch_id?: string;
  role?: AdminGlobalRole;
  is_active?: boolean;
}

export interface CreateAdminUserPayload {
  nombre: string;
  email: string;
  password: string;
  role: AdminGlobalRole;
  tenant_id?: string;
  branch_id?: string;
  is_active?: boolean;
}

export interface UpdateAdminUserAssignmentPayload {
  user_id: string;
  role?: AdminGlobalRole;
  tenant_id?: string | null;
  branch_id?: string | null;
  is_active?: boolean;
}

export interface AdminSessionLogFilter {
  tenant_id?: string;
  user_id?: string;
  role?: AdminGlobalRole;
  action?: string;
  search?: string;
}
