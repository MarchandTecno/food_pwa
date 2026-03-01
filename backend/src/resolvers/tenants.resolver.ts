import type { Context } from '../context';
import { createContext } from '../context';
import { getTenantById, listTenants, type IdArgs, type LimitArgs } from '../services/tenants.service';

export const tenantQueryResolvers = {
  tenants: async (_: unknown, args: LimitArgs, ctx: Context = createContext()) => {
    return listTenants(ctx, args);
  },
  tenant: async (_: unknown, args: IdArgs, ctx: Context = createContext()) => {
    return getTenantById(ctx, args);
  },
};
