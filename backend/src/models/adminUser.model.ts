import type { audit_logs, branches, roles, tenants, users } from '@prisma/client';
import { normalizeGlobalRole, type GlobalRoleCode } from '../utils/roles';

export interface AdminRolePermissionOutput {
  role: GlobalRoleCode;
  hierarchy_level: number;
  label: string;
  scope: string;
  permissions: string[];
}

const ROLE_PERMISSION_MATRIX: AdminRolePermissionOutput[] = [
  {
    role: 'SUPERADMIN',
    hierarchy_level: 100,
    label: 'SuperAdmin',
    scope: 'Global multi-tenant',
    permissions: [
      'Gestionar tenants y sucursales',
      'Crear y actualizar usuarios de cualquier tenant',
      'Resetear credenciales de todos los roles',
      'Auditar sesiones e IPs de acceso',
    ],
  },
  {
    role: 'OWNER',
    hierarchy_level: 70,
    label: 'Owner',
    scope: 'Tenant asignado',
    permissions: [
      'Administrar operacion del tenant asignado',
      'Consultar ventas y reportes de su tenant',
      'Gestionar personal Kitchen y Delivery de sus sucursales',
      'Sin acceso a datos de otros tenants',
    ],
  },
  {
    role: 'KITCHEN',
    hierarchy_level: 40,
    label: 'Kitchen',
    scope: 'Sucursal asignada',
    permissions: [
      'Ver y actualizar pedidos de cocina de su sucursal',
      'Sin permisos para administrar usuarios',
      'Sin acceso a informacion de sucursales no asignadas',
    ],
  },
  {
    role: 'DELIVERY',
    hierarchy_level: 30,
    label: 'Delivery',
    scope: 'Sucursal asignada',
    permissions: [
      'Ver entregas y estados logisticos asignados',
      'Sin permisos para administrar usuarios',
      'Sin acceso a informacion de sucursales no asignadas',
    ],
  },
];

export function listRolePermissionMatrix(): AdminRolePermissionOutput[] {
  return ROLE_PERMISSION_MATRIX.map((entry) => ({
    ...entry,
    permissions: [...entry.permissions],
  }));
}

export interface AdminUserOutput {
  id: string;
  nombre: string;
  email: string;
  role: GlobalRoleCode | null;
  role_label: string;
  tenant_id: string | null;
  tenant_nombre: string | null;
  branch_id: string | null;
  branch_nombre: string | null;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date | null;
}

type UserWithAdminRelations = users & {
  roles?: Pick<roles, 'nombre_rol'> | null;
  tenants?: Pick<tenants, 'nombre_comercial'> | null;
  branches?: Pick<branches, 'nombre_sucursal'> | null;
};

function readOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return null;
}

function toRoleLabel(role: GlobalRoleCode | null): string {
  switch (role) {
    case 'SUPERADMIN':
      return 'SuperAdmin';
    case 'OWNER':
      return 'Owner';
    case 'KITCHEN':
      return 'Kitchen';
    case 'DELIVERY':
      return 'Delivery';
    default:
      return 'Sin rol';
  }
}

export function toAdminUserOutput(user: UserWithAdminRelations): AdminUserOutput {
  const rawUser = user as unknown as Record<string, unknown>;
  const role = normalizeGlobalRole(user.roles?.nombre_rol ?? undefined) ?? null;

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    role,
    role_label: toRoleLabel(role),
    tenant_id: user.tenant_id ?? null,
    tenant_nombre: user.tenants?.nombre_comercial ?? null,
    branch_id: user.branch_id ?? null,
    branch_nombre: user.branches?.nombre_sucursal ?? null,
    is_active: user.is_active ?? true,
    last_login: readOptionalDate(user.last_login),
    created_at: readOptionalDate(rawUser.created_at),
  };
}

export function toAdminUserListOutput(usersList: UserWithAdminRelations[]): AdminUserOutput[] {
  return usersList.map((user) => toAdminUserOutput(user));
}

export interface AdminSessionLogOutput {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_nombre: string | null;
  tenant_id: string | null;
  tenant_nombre: string | null;
  role: GlobalRoleCode | null;
  action: string;
  ip_address: string | null;
  happened_at: Date | null;
  last_access: Date | null;
}

type AuditLogWithAdminRelations = audit_logs & {
  users?: (users & { roles?: Pick<roles, 'nombre_rol'> | null }) | null;
  tenants?: Pick<tenants, 'nombre_comercial'> | null;
};

export function toAdminSessionLogOutput(log: AuditLogWithAdminRelations): AdminSessionLogOutput {
  const role = normalizeGlobalRole(log.users?.roles?.nombre_rol ?? undefined) ?? null;
  const happenedAt = readOptionalDate(log.created_at);
  const lastAccess = readOptionalDate(log.users?.last_login) ?? happenedAt;

  return {
    id: log.id,
    user_id: log.user_id ?? null,
    user_email: log.users?.email ?? null,
    user_nombre: log.users?.nombre ?? null,
    tenant_id: log.tenant_id ?? null,
    tenant_nombre: log.tenants?.nombre_comercial ?? null,
    role,
    action: log.accion,
    ip_address: log.ip_address ?? null,
    happened_at: happenedAt,
    last_access: lastAccess,
  };
}

export function toAdminSessionLogListOutput(logs: AuditLogWithAdminRelations[]): AdminSessionLogOutput[] {
  return logs.map((log) => toAdminSessionLogOutput(log));
}
