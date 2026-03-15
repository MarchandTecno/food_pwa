import type { Context } from '../context';
import { createContext } from '../context';
import {
  createAdminUser,
  listAdminRolePermissions,
  listAdminSessionLogs,
  listAdminSessionLogsPage,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUserAssignment,
  type AdminCreateUserArgs,
  type AdminListSessionLogsArgs,
  type AdminListUsersArgs,
  type AdminResetUserPasswordArgs,
  type AdminUpdateUserAssignmentArgs,
} from '../services/adminUsers.service';

export const adminUserQueryResolvers = {
  adminRolePermissions: async (_: unknown, __: Record<string, never>, ctx: Context = createContext()) => {
    return listAdminRolePermissions(ctx);
  },
  adminUsers: async (_: unknown, args: AdminListUsersArgs, ctx: Context = createContext()) => {
    return listAdminUsers(ctx, args);
  },
  adminSessionLogs: async (_: unknown, args: AdminListSessionLogsArgs, ctx: Context = createContext()) => {
    return listAdminSessionLogs(ctx, args);
  },
  adminSessionLogsPage: async (_: unknown, args: AdminListSessionLogsArgs, ctx: Context = createContext()) => {
    return listAdminSessionLogsPage(ctx, args);
  },
};

export const adminUserMutationResolvers = {
  adminCreateUser: async (_: unknown, args: AdminCreateUserArgs, ctx: Context = createContext()) => {
    return createAdminUser(ctx, args);
  },
  adminUpdateUserAssignment: async (_: unknown, args: AdminUpdateUserAssignmentArgs, ctx: Context = createContext()) => {
    return updateAdminUserAssignment(ctx, args);
  },
  adminResetUserPassword: async (_: unknown, args: AdminResetUserPasswordArgs, ctx: Context = createContext()) => {
    return resetAdminUserPassword(ctx, args);
  },
};
