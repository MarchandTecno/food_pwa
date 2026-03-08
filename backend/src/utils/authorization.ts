import type { AppRole } from '../auth';
import type { Context } from '../context';
import { getAuthenticatedUserId } from './authGuard';
import { forbiddenError, unauthenticatedError } from './graphqlErrors';
import { normalizeRole } from './roles';

export interface AuthenticatedScope {
  userId: string;
  tenantId?: string;
  branchId?: string;
  role?: AppRole;
}

export async function getAuthenticatedScope(ctx: Context): Promise<AuthenticatedScope> {
  const userId = getAuthenticatedUserId(ctx);
  const user = await ctx.prisma.users.findUnique({
    where: { id: userId },
    select: {
      tenant_id: true,
      branch_id: true,
      roles: {
        select: {
          nombre_rol: true,
        },
      },
    },
  });

  if (!user) {
    throw unauthenticatedError('Authenticated user no longer exists');
  }

  const dbRole = normalizeRole(user.roles?.nombre_rol ?? undefined);

  return {
    userId,
    tenantId: user.tenant_id ?? ctx.authContext?.user?.tenantId ?? undefined,
    branchId: user.branch_id ?? ctx.authContext?.user?.branchId ?? undefined,
    role: dbRole ?? ctx.authContext?.user?.role,
  };
}

export async function requireSuperAdminScope(ctx: Context): Promise<AuthenticatedScope> {
  const scope = await getAuthenticatedScope(ctx);

  if (scope.role !== 'superadmin') {
    throw forbiddenError('Operation requires superadmin role');
  }

  return scope;
}
