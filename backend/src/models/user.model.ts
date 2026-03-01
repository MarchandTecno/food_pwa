import type { users } from '@prisma/client';

export interface UserOutput {
  id: string;
  email: string;
  nombre: string | null;
  created_at: Date | null;
}

function readOptionalDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return null;
}

export function toUserOutput(user: users): UserOutput {
  const rawUser = user as unknown as Record<string, unknown>;

  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    created_at: readOptionalDate(rawUser.created_at),
  };
}
