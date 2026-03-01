import type { Context } from '../context';
import { getAuthenticatedUserId } from '../utils/authGuard';
import { badUserInputError } from '../utils/graphqlErrors';
import { executeDbOperation } from '../database';
import { toTenantListOutput, toTenantOutput } from '../models/tenant.model';

export interface LimitArgs {
  limit?: number;
}

export interface IdArgs {
  id: string;
}

const MAX_TENANTS_PAGE_SIZE = 100;

function validateLimit(limit?: number): number {
  if (limit === undefined) return 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TENANTS_PAGE_SIZE) {
    throw badUserInputError(`Invalid input: limit must be between 1 and ${MAX_TENANTS_PAGE_SIZE}`);
  }

  return limit;
}

async function getAuthenticatedTenantId(ctx: Context): Promise<string | undefined> {
  const userId = getAuthenticatedUserId(ctx);
  const user = await ctx.prisma.users.findUnique({
    where: { id: userId },
    select: { tenant_id: true },
  });

  return user?.tenant_id ?? undefined;
}

export async function listTenants(ctx: Context, args: LimitArgs) {
  return executeDbOperation(async () => {
    const tenantId = await getAuthenticatedTenantId(ctx);
    if (!tenantId) {
      return [];
    }

    const tenants = await ctx.prisma.tenants.findMany({
      where: { id: tenantId },
      take: validateLimit(args.limit),
    });

    return toTenantListOutput(tenants);
  });
}

export async function getTenantById(ctx: Context, args: IdArgs) {
  return executeDbOperation(async () => {
    const tenantId = await getAuthenticatedTenantId(ctx);
    if (!tenantId || tenantId !== args.id) {
      return null;
    }

    const tenant = await ctx.prisma.tenants.findUnique({
      where: { id: args.id },
    });

    return tenant ? toTenantOutput(tenant) : null;
  });
}
