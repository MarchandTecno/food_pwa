import type { users } from '@prisma/client';
import { normalizeRole } from '../utils/roles';

export interface UserOutput {
  id: string;
  email: string;
  nombre: string | null;
  role: string | null;
  created_at: Date | null;
}

type UserWithOptionalRole = users & {
  roles?: {
    nombre_rol: string;
  } | null;
};

function readOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return null;
}

export function toUserOutput(user: UserWithOptionalRole): UserOutput {
  const rawUser = user as unknown as Record<string, unknown>;

  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    role: normalizeRole(user.roles?.nombre_rol ?? undefined) ?? null,
    created_at: readOptionalDate(rawUser.created_at),
  };
}
