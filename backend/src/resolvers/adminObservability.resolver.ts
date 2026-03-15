import type { Context } from '../context';
import { createContext } from '../context';
import {
  getAdminObservabilitySnapshot,
  listAdminAuditLogsPage,
  type AdminListAuditLogsArgs,
} from '../services/adminObservability.service';

export const adminObservabilityQueryResolvers = {
  adminAuditLogsPage: async (_: unknown, args: AdminListAuditLogsArgs, ctx: Context = createContext()) => {
    return listAdminAuditLogsPage(ctx, args);
  },
  adminObservabilitySnapshot: async (_: unknown, __: Record<string, never>, ctx: Context = createContext()) => {
    return getAdminObservabilitySnapshot(ctx);
  },
};