import type { Context } from '../context';
import { createContext } from '../context';
import {
  createAdminBranch,
  createAdminTenant,
  getAdminTenantById,
  listAdminTenantBranches,
  listAdminTenants,
  setAdminBranchSuspended,
  updateAdminTenantBranding,
  updateAdminTenantRegion,
  updateAdminTenantSubscription,
  type AdminCreateBranchArgs,
  type AdminCreateTenantArgs,
  type AdminListTenantsArgs,
  type AdminSetBranchSuspendedArgs,
  type AdminTenantBranchesArgs,
  type AdminTenantIdArgs,
  type AdminUpdateTenantBrandingArgs,
  type AdminUpdateTenantRegionArgs,
  type AdminUpdateTenantSubscriptionArgs,
} from '../services/adminTenants.service';

export const adminTenantQueryResolvers = {
  adminTenants: async (_: unknown, args: AdminListTenantsArgs, ctx: Context = createContext()) => {
    return listAdminTenants(ctx, args);
  },
  adminTenant: async (_: unknown, args: AdminTenantIdArgs, ctx: Context = createContext()) => {
    return getAdminTenantById(ctx, args);
  },
  adminTenantBranches: async (_: unknown, args: AdminTenantBranchesArgs, ctx: Context = createContext()) => {
    return listAdminTenantBranches(ctx, args);
  },
};

export const adminTenantMutationResolvers = {
  adminCreateTenant: async (_: unknown, args: AdminCreateTenantArgs, ctx: Context = createContext()) => {
    return createAdminTenant(ctx, args);
  },
  adminUpdateTenantBranding: async (_: unknown, args: AdminUpdateTenantBrandingArgs, ctx: Context = createContext()) => {
    return updateAdminTenantBranding(ctx, args);
  },
  adminUpdateTenantRegion: async (_: unknown, args: AdminUpdateTenantRegionArgs, ctx: Context = createContext()) => {
    return updateAdminTenantRegion(ctx, args);
  },
  adminUpdateTenantSubscription: async (
    _: unknown,
    args: AdminUpdateTenantSubscriptionArgs,
    ctx: Context = createContext(),
  ) => {
    return updateAdminTenantSubscription(ctx, args);
  },
  adminCreateBranch: async (_: unknown, args: AdminCreateBranchArgs, ctx: Context = createContext()) => {
    return createAdminBranch(ctx, args);
  },
  adminSetBranchSuspended: async (_: unknown, args: AdminSetBranchSuspendedArgs, ctx: Context = createContext()) => {
    return setAdminBranchSuspended(ctx, args);
  },
};
