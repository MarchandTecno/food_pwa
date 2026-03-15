import type { AppRole } from '../auth';

export type GlobalRoleCode = 'SUPERADMIN' | 'OWNER' | 'KITCHEN' | 'DELIVERY';

const ROLE_ALIASES: Record<string, AppRole> = {
  superadmin: 'superadmin',
  'super admin': 'superadmin',
  super_admin: 'superadmin',
  platformadmin: 'superadmin',
  'platform admin': 'superadmin',
  platform_admin: 'superadmin',
  saasadmin: 'superadmin',
  saas_admin: 'superadmin',

  admin: 'admin',
  owner: 'admin',
  dueno: 'admin',
  'dueño': 'admin',

  manager: 'manager',
  gerente: 'manager',

  staff: 'staff',
  cocina: 'staff',
  kitchen: 'staff',
  repartidor: 'staff',
  delivery: 'staff',

  customer: 'customer',
  cliente: 'customer',
};

const GLOBAL_ROLE_ALIASES: Record<string, GlobalRoleCode> = {
  superadmin: 'SUPERADMIN',
  'super admin': 'SUPERADMIN',
  super_admin: 'SUPERADMIN',
  platformadmin: 'SUPERADMIN',
  'platform admin': 'SUPERADMIN',
  platform_admin: 'SUPERADMIN',
  saasadmin: 'SUPERADMIN',
  saas_admin: 'SUPERADMIN',

  owner: 'OWNER',
  dueno: 'OWNER',
  'dueño': 'OWNER',
  admin: 'OWNER',
  manager: 'OWNER',
  gerente: 'OWNER',

  kitchen: 'KITCHEN',
  cocina: 'KITCHEN',
  staff: 'KITCHEN',

  delivery: 'DELIVERY',
  repartidor: 'DELIVERY',
  courier: 'DELIVERY',
};

function normalizeRawRole(rawRole: string): string {
  return rawRole
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeRole(rawRole?: string | null): AppRole | undefined {
  if (!rawRole) return undefined;
  return ROLE_ALIASES[normalizeRawRole(rawRole)];
}

export function normalizeGlobalRole(rawRole?: string | null): GlobalRoleCode | undefined {
  if (!rawRole) return undefined;
  return GLOBAL_ROLE_ALIASES[normalizeRawRole(rawRole)];
}

export function isSuperAdminRole(rawRole?: string | null): boolean {
  return normalizeRole(rawRole) === 'superadmin';
}
