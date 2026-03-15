import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import type { Context } from '../context';
import { executeDbOperation } from '../database';
import {
  listRolePermissionMatrix,
  toAdminSessionLogListOutput,
  toAdminUserOutput,
  toAdminUserListOutput,
  type AdminRolePermissionOutput,
  type AdminSessionLogOutput,
  type AdminUserOutput,
} from '../models/adminUser.model';
import {
  parseAdminCreateUserArgsOrThrow,
  parseAdminListSessionLogsArgsOrThrow,
  parseAdminListUsersArgsOrThrow,
  parseAdminResetUserPasswordArgsOrThrow,
  parseAdminUpdateUserAssignmentArgsOrThrow,
  type AdminCreateUserArgsInput,
  type AdminListSessionLogsArgsInput,
  type AdminListUsersArgsInput,
  type AdminResetUserPasswordArgsInput,
  type AdminUpdateUserAssignmentArgsInput,
} from '../schemas/adminUsers.schema';
import { requireSuperAdminScope } from '../utils/authorization';
import { badUserInputError, notFoundError } from '../utils/graphqlErrors';
import { normalizeGlobalRole, type GlobalRoleCode } from '../utils/roles';
import type { PageInfo } from '../types/pagination';

const AUDIT_ACTION_USER_CREATE = 'USER_CREATE';
const AUDIT_ACTION_USER_ASSIGN = 'USER_ASSIGN';
const AUDIT_ACTION_PASSWORD_RESET = 'PWD_RESET';

export type AdminListUsersArgs = AdminListUsersArgsInput;
export type AdminCreateUserArgs = AdminCreateUserArgsInput;
export type AdminUpdateUserAssignmentArgs = AdminUpdateUserAssignmentArgsInput;
export type AdminResetUserPasswordArgs = AdminResetUserPasswordArgsInput;
export type AdminListSessionLogsArgs = AdminListSessionLogsArgsInput;

export interface AdminSessionLogPageResult {
  items: AdminSessionLogOutput[];
  pageInfo: PageInfo;
}

function normalizeIpForAudit(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return ip.slice(0, 45);
}

function toAuditJsonRecord(payload: Record<string, unknown>): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue;
}

async function ensureTenantExists(ctx: Context, tenantId: string): Promise<void> {
  const tenant = await ctx.prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    throw notFoundError('Tenant not found');
  }
}

async function ensureBranchBelongsToTenant(ctx: Context, branchId: string, tenantId: string): Promise<void> {
  const branch = await ctx.prisma.branches.findUnique({
    where: { id: branchId },
    select: { id: true, tenant_id: true },
  });

  if (!branch) {
    throw notFoundError('Branch not found');
  }

  if (!branch.tenant_id || branch.tenant_id !== tenantId) {
    throw badUserInputError('Invalid input: branch_id does not belong to tenant_id');
  }
}

async function listRoleMappings(ctx: Context): Promise<{ id: number; nombre_rol: string; code: GlobalRoleCode }[]> {
  const roles = await ctx.prisma.roles.findMany({
    select: {
      id: true,
      nombre_rol: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return roles
    .map((role) => {
      const code = normalizeGlobalRole(role.nombre_rol);
      if (!code) return null;

      return {
        id: role.id,
        nombre_rol: role.nombre_rol,
        code,
      };
    })
    .filter((entry): entry is { id: number; nombre_rol: string; code: GlobalRoleCode } => Boolean(entry));
}

async function resolveRoleIdByCode(ctx: Context, code: GlobalRoleCode): Promise<number> {
  const roleMappings = await listRoleMappings(ctx);
  const match = roleMappings.find((entry) => entry.code === code);

  if (!match) {
    throw badUserInputError(`Invalid input: role ${code} is not configured in roles table`);
  }

  return match.id;
}

async function resolveRoleIdsByCode(ctx: Context, code: GlobalRoleCode): Promise<number[]> {
  const roleMappings = await listRoleMappings(ctx);
  return roleMappings.filter((entry) => entry.code === code).map((entry) => entry.id);
}

interface UserAuditLogPayload {
  actorUserId: string;
  tenantId?: string | null;
  action: string;
  recordId?: string | null;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

async function createUserAuditLog(ctx: Context, payload: UserAuditLogPayload): Promise<void> {
  await ctx.prisma.audit_logs.create({
    data: {
      tenant_id: payload.tenantId ?? null,
      user_id: payload.actorUserId,
      accion: payload.action,
      tabla_afectada: 'users',
      registro_id: payload.recordId ?? null,
      valor_anterior: payload.previousValue,
      valor_nuevo: payload.newValue,
      ip_address: normalizeIpForAudit(ctx.requestIp),
    },
  });
}

function normalizeActionFilter(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized.slice(0, 20) : undefined;
}

interface SessionLogWhereBuildResult {
  where: Prisma.audit_logsWhereInput;
  noResults: boolean;
}

async function buildAdminSessionLogsWhere(
  ctx: Context,
  args: AdminListSessionLogsArgsInput,
): Promise<SessionLogWhereBuildResult> {
  const where: Prisma.audit_logsWhereInput = {
    tabla_afectada: 'users',
  };

  const andClauses: Prisma.audit_logsWhereInput[] = [];

  if (args.filter?.tenant_id) {
    andClauses.push({
      tenant_id: args.filter.tenant_id,
    });
  }

  if (args.filter?.user_id) {
    andClauses.push({
      OR: [{ user_id: args.filter.user_id }, { registro_id: args.filter.user_id }],
    });
  }

  const actionFilter = normalizeActionFilter(args.filter?.action);
  if (actionFilter) {
    andClauses.push({
      accion: actionFilter,
    });
  }

  if (args.filter?.search) {
    const text = args.filter.search;
    andClauses.push({
      OR: [
        {
          ip_address: {
            contains: text,
            mode: 'insensitive',
          },
        },
        {
          accion: {
            contains: text,
            mode: 'insensitive',
          },
        },
        {
          users: {
            is: {
              OR: [
                {
                  email: {
                    contains: text,
                    mode: 'insensitive',
                  },
                },
                {
                  nombre: {
                    contains: text,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },
        {
          tenants: {
            is: {
              nombre_comercial: {
                contains: text,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    });
  }

  if (args.filter?.role) {
    const roleIds = await resolveRoleIdsByCode(ctx, args.filter.role);
    if (roleIds.length === 0) {
      return { where, noResults: true };
    }

    const roleUsers = await ctx.prisma.users.findMany({
      where: {
        rol_id: {
          in: roleIds,
        },
      },
      select: {
        id: true,
      },
    });

    const roleUserIds = roleUsers.map((entry) => entry.id);
    if (roleUserIds.length === 0) {
      return { where, noResults: true };
    }

    andClauses.push({
      user_id: {
        in: roleUserIds,
      },
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  return {
    where,
    noResults: false,
  };
}

export async function listAdminRolePermissions(ctx: Context): Promise<AdminRolePermissionOutput[]> {
  await requireSuperAdminScope(ctx);
  return listRolePermissionMatrix();
}

export async function listAdminUsers(ctx: Context, args: AdminListUsersArgs): Promise<AdminUserOutput[]> {
  return executeDbOperation(async () => {
    await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminListUsersArgsOrThrow(args ?? {});

    const where: Prisma.usersWhereInput = {};
    const searchText = validatedArgs.filter?.search;

    if (searchText) {
      where.OR = [
        {
          nombre: {
            contains: searchText,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: searchText,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (validatedArgs.filter?.tenant_id) {
      where.tenant_id = validatedArgs.filter.tenant_id;
    }

    if (validatedArgs.filter?.branch_id) {
      where.branch_id = validatedArgs.filter.branch_id;
    }

    if (validatedArgs.filter?.is_active !== undefined) {
      where.is_active = validatedArgs.filter.is_active;
    }

    if (validatedArgs.filter?.role) {
      const roleIds = await resolveRoleIdsByCode(ctx, validatedArgs.filter.role);
      if (roleIds.length === 0) {
        return [];
      }

      where.rol_id = {
        in: roleIds,
      };
    }

    const users = await ctx.prisma.users.findMany({
      where,
      take: validatedArgs.limit ?? 100,
      skip: validatedArgs.offset ?? 0,
      orderBy: [{ last_login: 'desc' }, { nombre: 'asc' }, { id: 'asc' }],
      include: {
        roles: {
          select: {
            nombre_rol: true,
          },
        },
        tenants: {
          select: {
            nombre_comercial: true,
          },
        },
        branches: {
          select: {
            nombre_sucursal: true,
          },
        },
      },
    });

    return toAdminUserListOutput(users);
  });
}

export async function createAdminUser(ctx: Context, args: AdminCreateUserArgs): Promise<AdminUserOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminCreateUserArgsOrThrow(args);

    const roleId = await resolveRoleIdByCode(ctx, validatedArgs.input.role);

    const tenantId = validatedArgs.input.role === 'SUPERADMIN' ? null : (validatedArgs.input.tenant_id ?? null);
    const branchId = validatedArgs.input.role === 'SUPERADMIN' ? null : (validatedArgs.input.branch_id ?? null);

    if (tenantId) {
      await ensureTenantExists(ctx, tenantId);
    }

    if (tenantId && branchId) {
      await ensureBranchBelongsToTenant(ctx, branchId, tenantId);
    }

    const passwordHash = await bcrypt.hash(validatedArgs.input.password, 10);

    const createdUser = await ctx.prisma.users.create({
      data: {
        nombre: validatedArgs.input.nombre,
        email: validatedArgs.input.email,
        password_hash: passwordHash,
        rol_id: roleId,
        tenant_id: tenantId,
        branch_id: branchId,
        is_active: validatedArgs.input.is_active ?? true,
      },
      include: {
        roles: {
          select: {
            nombre_rol: true,
          },
        },
        tenants: {
          select: {
            nombre_comercial: true,
          },
        },
        branches: {
          select: {
            nombre_sucursal: true,
          },
        },
      },
    });

    await createUserAuditLog(ctx, {
      actorUserId: scope.userId,
      tenantId: createdUser.tenant_id,
      action: AUDIT_ACTION_USER_CREATE,
      recordId: createdUser.id,
      newValue: toAuditJsonRecord({
        email: createdUser.email,
        role: validatedArgs.input.role,
        tenant_id: createdUser.tenant_id,
        branch_id: createdUser.branch_id,
      }),
    });

    return toAdminUserOutput(createdUser);
  });
}

export async function updateAdminUserAssignment(
  ctx: Context,
  args: AdminUpdateUserAssignmentArgs,
): Promise<AdminUserOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminUpdateUserAssignmentArgsOrThrow(args);

    const existingUser = await ctx.prisma.users.findUnique({
      where: { id: validatedArgs.input.user_id },
      include: {
        roles: {
          select: {
            nombre_rol: true,
          },
        },
        tenants: {
          select: {
            nombre_comercial: true,
          },
        },
        branches: {
          select: {
            nombre_sucursal: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw notFoundError('User not found');
    }

    const existingRoleCode = normalizeGlobalRole(existingUser.roles?.nombre_rol ?? undefined);
    const nextRoleCode = validatedArgs.input.role ?? existingRoleCode;

    if (!nextRoleCode) {
      throw badUserInputError('Invalid input: user role is not recognized, provide role explicitly');
    }

    const tenantChangedExplicitly = validatedArgs.input.tenant_id !== undefined;
    const branchChangedExplicitly = validatedArgs.input.branch_id !== undefined;

    const nextTenantId =
      nextRoleCode === 'SUPERADMIN'
        ? null
        : tenantChangedExplicitly
          ? (validatedArgs.input.tenant_id ?? null)
          : (existingUser.tenant_id ?? null);

    let nextBranchId: string | null;
    if (nextRoleCode === 'SUPERADMIN') {
      nextBranchId = null;
    } else if (branchChangedExplicitly) {
      nextBranchId = validatedArgs.input.branch_id ?? null;
    } else if (tenantChangedExplicitly && validatedArgs.input.tenant_id !== (existingUser.tenant_id ?? null)) {
      nextBranchId = null;
    } else {
      nextBranchId = existingUser.branch_id ?? null;
    }

    if (nextRoleCode !== 'SUPERADMIN' && !nextTenantId) {
      throw badUserInputError('Invalid input: tenant_id is required for OWNER, KITCHEN and DELIVERY roles');
    }

    if (nextTenantId) {
      await ensureTenantExists(ctx, nextTenantId);
    }

    if (nextTenantId && nextBranchId) {
      await ensureBranchBelongsToTenant(ctx, nextBranchId, nextTenantId);
    }

    if ((nextRoleCode === 'KITCHEN' || nextRoleCode === 'DELIVERY') && !nextBranchId) {
      throw badUserInputError('Invalid input: branch_id is required for KITCHEN and DELIVERY roles');
    }

    const updateData: Prisma.usersUncheckedUpdateInput = {};

    if (validatedArgs.input.role !== undefined) {
      updateData.rol_id = await resolveRoleIdByCode(ctx, validatedArgs.input.role);
    }

    if (tenantChangedExplicitly || nextRoleCode === 'SUPERADMIN') {
      updateData.tenant_id = nextTenantId;
    }

    if (branchChangedExplicitly || tenantChangedExplicitly || nextRoleCode === 'SUPERADMIN') {
      updateData.branch_id = nextBranchId;
    }

    if (validatedArgs.input.is_active !== undefined) {
      updateData.is_active = validatedArgs.input.is_active;
    }

    const updatedUser = await ctx.prisma.users.update({
      where: { id: existingUser.id },
      data: updateData,
      include: {
        roles: {
          select: {
            nombre_rol: true,
          },
        },
        tenants: {
          select: {
            nombre_comercial: true,
          },
        },
        branches: {
          select: {
            nombre_sucursal: true,
          },
        },
      },
    });

    await createUserAuditLog(ctx, {
      actorUserId: scope.userId,
      tenantId: updatedUser.tenant_id,
      action: AUDIT_ACTION_USER_ASSIGN,
      recordId: updatedUser.id,
      previousValue: toAuditJsonRecord({
        role: existingRoleCode ?? null,
        tenant_id: existingUser.tenant_id,
        branch_id: existingUser.branch_id,
        is_active: existingUser.is_active,
      }),
      newValue: toAuditJsonRecord({
        role: normalizeGlobalRole(updatedUser.roles?.nombre_rol ?? undefined) ?? null,
        tenant_id: updatedUser.tenant_id,
        branch_id: updatedUser.branch_id,
        is_active: updatedUser.is_active,
      }),
    });

    return toAdminUserOutput(updatedUser);
  });
}

export async function resetAdminUserPassword(ctx: Context, args: AdminResetUserPasswordArgs): Promise<boolean> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminResetUserPasswordArgsOrThrow(args);

    const targetUser = await ctx.prisma.users.findUnique({
      where: { id: validatedArgs.user_id },
      select: {
        id: true,
        email: true,
        tenant_id: true,
      },
    });

    if (!targetUser) {
      throw notFoundError('User not found');
    }

    const passwordHash = await bcrypt.hash(validatedArgs.new_password, 10);

    await ctx.prisma.users.update({
      where: { id: targetUser.id },
      data: {
        password_hash: passwordHash,
      },
    });

    await createUserAuditLog(ctx, {
      actorUserId: scope.userId,
      tenantId: targetUser.tenant_id,
      action: AUDIT_ACTION_PASSWORD_RESET,
      recordId: targetUser.id,
      newValue: toAuditJsonRecord({
        reset_for: targetUser.email,
      }),
    });

    return true;
  });
}

export async function listAdminSessionLogs(ctx: Context, args: AdminListSessionLogsArgs): Promise<AdminSessionLogOutput[]> {
  const page = await listAdminSessionLogsPage(ctx, args);
  return page.items;
}

export async function listAdminSessionLogsPage(
  ctx: Context,
  args: AdminListSessionLogsArgs,
): Promise<AdminSessionLogPageResult> {
  return executeDbOperation(async () => {
    await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminListSessionLogsArgsOrThrow(args ?? {});
    const safeLimit = validatedArgs.limit ?? 25;
    const safeOffset = Math.max(validatedArgs.offset ?? 0, 0);

    const whereResult = await buildAdminSessionLogsWhere(ctx, validatedArgs);

    if (whereResult.noResults) {
      return {
        items: [],
        pageInfo: {
          total: 0,
          hasNextPage: false,
          nextCursor: null,
          limit: safeLimit,
          offset: safeOffset,
        },
      };
    }

    const [rows, total] = await Promise.all([
      ctx.prisma.audit_logs.findMany({
        where: whereResult.where,
        take: safeLimit + 1,
        skip: safeOffset,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        include: {
          users: {
            include: {
              roles: {
                select: {
                  nombre_rol: true,
                },
              },
            },
          },
          tenants: {
            select: {
              nombre_comercial: true,
            },
          },
        },
      }),
      ctx.prisma.audit_logs.count({
        where: whereResult.where,
      }),
    ]);

    const hasNextPage = rows.length > safeLimit;
    const visibleRows = hasNextPage ? rows.slice(0, safeLimit) : rows;
    const items = toAdminSessionLogListOutput(visibleRows);

    return {
      items,
      pageInfo: {
        total,
        hasNextPage,
        nextCursor: hasNextPage ? String(safeOffset + safeLimit) : null,
        limit: safeLimit,
        offset: safeOffset,
      },
    };
  });
}
