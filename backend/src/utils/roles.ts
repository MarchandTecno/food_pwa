import type { AppRole } from '../auth';

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

export function isSuperAdminRole(rawRole?: string | null): boolean {
  return normalizeRole(rawRole) === 'superadmin';
}
