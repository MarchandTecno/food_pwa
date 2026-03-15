import type { Prisma } from '@prisma/client';
import type { Context } from '../context';
import { executeDbOperation, withTransaction } from '../database';
import {
  toAdminBranchListOutput,
  toAdminBranchOutput,
  toAdminTenantListOutput,
  toAdminTenantOutput,
  type AdminBranchOutput,
  type AdminTenantOutput,
} from '../models/adminTenant.model';
import {
  parseAdminCreateBranchArgsOrThrow,
  parseAdminCreateTenantArgsOrThrow,
  parseAdminListTenantsArgsOrThrow,
  parseAdminSetBranchSuspendedArgsOrThrow,
  parseAdminTenantBranchesArgsOrThrow,
  parseAdminTenantIdArgsOrThrow,
  parseAdminUpdateTenantBrandingArgsOrThrow,
  parseAdminUpdateTenantRegionArgsOrThrow,
  parseAdminUpdateTenantSubscriptionArgsOrThrow,
  type AdminCreateBranchArgsInput,
  type AdminCreateTenantArgsInput,
  type AdminListTenantsArgsInput,
  type AdminSetBranchSuspendedArgsInput,
  type AdminTenantBranchesArgsInput,
  type AdminTenantIdArgsInput,
  type AdminUpdateTenantBrandingArgsInput,
  type AdminUpdateTenantRegionArgsInput,
  type AdminUpdateTenantSubscriptionArgsInput,
} from '../schemas/adminTenants.schema';
import { badUserInputError, notFoundError } from '../utils/graphqlErrors';
import { requireSuperAdminScope } from '../utils/authorization';
import { createAuditLog, toAuditJsonRecord } from '../utils/audit';

export type AdminListTenantsArgs = AdminListTenantsArgsInput;
export type AdminTenantIdArgs = AdminTenantIdArgsInput;
export type AdminTenantBranchesArgs = AdminTenantBranchesArgsInput;
export type AdminCreateTenantArgs = AdminCreateTenantArgsInput;
export type AdminUpdateTenantBrandingArgs = AdminUpdateTenantBrandingArgsInput;
export type AdminUpdateTenantRegionArgs = AdminUpdateTenantRegionArgsInput;
export type AdminUpdateTenantSubscriptionArgs = AdminUpdateTenantSubscriptionArgsInput;
export type AdminCreateBranchArgs = AdminCreateBranchArgsInput;
export type AdminSetBranchSuspendedArgs = AdminSetBranchSuspendedArgsInput;

const AUDIT_ACTION_TENANT_CREATE = 'TENANT_CREATE';
const AUDIT_ACTION_TENANT_BRAND = 'TENANT_BRAND';
const AUDIT_ACTION_TENANT_REGION = 'TENANT_REGION';
const AUDIT_ACTION_TENANT_SUBS = 'TENANT_SUBS';
const AUDIT_ACTION_BRANCH_CREATE = 'BRANCH_CREATE';
const AUDIT_ACTION_BRANCH_SUSPEND = 'BRANCH_SUSPEND';
const AUDIT_ACTION_BRANCH_RESTORE = 'BRANCH_RESTORE';

function cssPaletteToJson(
  entries:
    | {
        key: string;
        value: string;
      }[]
    | undefined,
): Prisma.InputJsonValue | undefined {
  if (!entries) return undefined;

  const palette: Record<string, string> = {};
  for (const entry of entries) {
    palette[entry.key] = entry.value;
  }

  return palette;
}

function parseTimeOfDayOrThrow(value: string | undefined, fieldName: string): Date | undefined {
  if (!value) return undefined;

  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) {
    throw badUserInputError(`Invalid input: ${fieldName} must use HH:mm format`);
  }

  const [hoursPart, minutesPart] = value.split(':');
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

function toIsoStringOrNull(value: Date | null | undefined): string | null {
  if (!(value instanceof Date)) return null;
  return value.toISOString();
}

function toTenantAuditRecord(tenant: {
  nombre_comercial?: string;
  email_admin?: string;
  moneda?: string | null;
  region_code?: string | null;
  time_zone?: string | null;
  subscription_status?: string | null;
  subscription_note?: string | null;
  is_active?: boolean | null;
  logo_url?: string | null;
  brand_palette?: unknown;
}): Prisma.InputJsonValue {
  return toAuditJsonRecord({
    nombre_comercial: tenant.nombre_comercial ?? null,
    email_admin: tenant.email_admin ?? null,
    moneda: tenant.moneda ?? null,
    region_code: tenant.region_code ?? null,
    time_zone: tenant.time_zone ?? null,
    subscription_status: tenant.subscription_status ?? null,
    subscription_note: tenant.subscription_note ?? null,
    is_active: tenant.is_active ?? null,
    logo_url: tenant.logo_url ?? null,
    brand_palette: tenant.brand_palette ?? null,
  });
}

function toBranchAuditRecord(branch: {
  tenant_id?: string | null;
  nombre_sucursal?: string;
  direccion_fisica?: string | null;
  horario_apertura?: Date | null;
  horario_cierre?: Date | null;
  is_open?: boolean | null;
  is_suspended?: boolean | null;
  suspension_reason?: string | null;
}): Prisma.InputJsonValue {
  return toAuditJsonRecord({
    tenant_id: branch.tenant_id ?? null,
    nombre_sucursal: branch.nombre_sucursal ?? null,
    direccion_fisica: branch.direccion_fisica ?? null,
    horario_apertura: toIsoStringOrNull(branch.horario_apertura),
    horario_cierre: toIsoStringOrNull(branch.horario_cierre),
    is_open: branch.is_open ?? null,
    is_suspended: branch.is_suspended ?? null,
    suspension_reason: branch.suspension_reason ?? null,
  });
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

export async function listAdminTenants(ctx: Context, args: AdminListTenantsArgs): Promise<AdminTenantOutput[]> {
  return executeDbOperation(async () => {
    await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminListTenantsArgsOrThrow(args ?? {});

    const where: Prisma.tenantsWhereInput = {};
    const searchText = validatedArgs.filter?.search;

    if (searchText) {
      where.OR = [
        {
          nombre_comercial: {
            contains: searchText,
            mode: 'insensitive',
          },
        },
        {
          razon_social: {
            contains: searchText,
            mode: 'insensitive',
          },
        },
        {
          email_admin: {
            contains: searchText,
            mode: 'insensitive',
          },
        },
        {
          rfc_tax_id: {
            contains: searchText,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (validatedArgs.filter?.subscription_status) {
      where.subscription_status = validatedArgs.filter.subscription_status;
    }

    const tenants = await ctx.prisma.tenants.findMany({
      where,
      take: validatedArgs.limit ?? 50,
      skip: validatedArgs.offset ?? 0,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });

    return toAdminTenantListOutput(tenants);
  });
}

export async function getAdminTenantById(ctx: Context, args: AdminTenantIdArgs): Promise<AdminTenantOutput | null> {
  return executeDbOperation(async () => {
    await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminTenantIdArgsOrThrow(args);

    const tenant = await ctx.prisma.tenants.findUnique({
      where: { id: validatedArgs.id },
    });

    return tenant ? toAdminTenantOutput(tenant) : null;
  });
}

export async function createAdminTenant(ctx: Context, args: AdminCreateTenantArgs): Promise<AdminTenantOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminCreateTenantArgsOrThrow(args);

    const status = validatedArgs.input.subscription_status ?? 'ACTIVE';
    return withTransaction(ctx.prisma, async (tx) => {
      const createdTenant = await tx.tenants.create({
        data: {
          nombre_comercial: validatedArgs.input.nombre_comercial,
          razon_social: validatedArgs.input.razon_social,
          rfc_tax_id: validatedArgs.input.rfc_tax_id,
          email_admin: validatedArgs.input.email_admin,
          telefono_contacto: validatedArgs.input.telefono_contacto,
          logo_url: validatedArgs.input.logo_url,
          moneda: validatedArgs.input.moneda ?? 'MXN',
          region_code: validatedArgs.input.region_code,
          time_zone: validatedArgs.input.time_zone ?? 'UTC',
          brand_palette: cssPaletteToJson(validatedArgs.input.palette_css),
          subscription_status: status,
          subscription_updated_at: new Date(),
          is_active: status === 'ACTIVE',
        },
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'tenants',
        action: AUDIT_ACTION_TENANT_CREATE,
        actorUserId: scope.userId,
        tenantId: createdTenant.id,
        recordId: createdTenant.id,
        newValue: toTenantAuditRecord(createdTenant),
      });

      return toAdminTenantOutput(createdTenant);
    });
  });
}

export async function updateAdminTenantBranding(
  ctx: Context,
  args: AdminUpdateTenantBrandingArgs,
): Promise<AdminTenantOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminUpdateTenantBrandingArgsOrThrow(args);

    return withTransaction(ctx.prisma, async (tx) => {
      const existingTenant = await tx.tenants.findUnique({
        where: { id: validatedArgs.tenant_id },
      });

      if (!existingTenant) {
        throw notFoundError('Tenant not found');
      }

      const data: Prisma.tenantsUpdateInput = {
        updated_at: new Date(),
      };

      if (validatedArgs.input.logo_url !== undefined) {
        data.logo_url = validatedArgs.input.logo_url;
      }

      if (validatedArgs.input.palette_css !== undefined) {
        data.brand_palette = cssPaletteToJson(validatedArgs.input.palette_css) ?? {};
      }

      const updatedTenant = await tx.tenants.update({
        where: { id: validatedArgs.tenant_id },
        data,
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'tenants',
        action: AUDIT_ACTION_TENANT_BRAND,
        actorUserId: scope.userId,
        tenantId: updatedTenant.id,
        recordId: updatedTenant.id,
        previousValue: toTenantAuditRecord(existingTenant),
        newValue: toTenantAuditRecord(updatedTenant),
      });

      return toAdminTenantOutput(updatedTenant);
    });
  });
}

export async function updateAdminTenantRegion(ctx: Context, args: AdminUpdateTenantRegionArgs): Promise<AdminTenantOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminUpdateTenantRegionArgsOrThrow(args);

    return withTransaction(ctx.prisma, async (tx) => {
      const existingTenant = await tx.tenants.findUnique({
        where: { id: validatedArgs.tenant_id },
      });

      if (!existingTenant) {
        throw notFoundError('Tenant not found');
      }

      const data: Prisma.tenantsUpdateInput = {
        updated_at: new Date(),
      };

      if (validatedArgs.input.moneda !== undefined) {
        data.moneda = validatedArgs.input.moneda;
      }

      if (validatedArgs.input.region_code !== undefined) {
        data.region_code = validatedArgs.input.region_code;
      }

      if (validatedArgs.input.time_zone !== undefined) {
        data.time_zone = validatedArgs.input.time_zone;
      }

      const updatedTenant = await tx.tenants.update({
        where: { id: validatedArgs.tenant_id },
        data,
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'tenants',
        action: AUDIT_ACTION_TENANT_REGION,
        actorUserId: scope.userId,
        tenantId: updatedTenant.id,
        recordId: updatedTenant.id,
        previousValue: toTenantAuditRecord(existingTenant),
        newValue: toTenantAuditRecord(updatedTenant),
      });

      return toAdminTenantOutput(updatedTenant);
    });
  });
}

export async function updateAdminTenantSubscription(
  ctx: Context,
  args: AdminUpdateTenantSubscriptionArgs,
): Promise<AdminTenantOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminUpdateTenantSubscriptionArgsOrThrow(args);

    return withTransaction(ctx.prisma, async (tx) => {
      const existingTenant = await tx.tenants.findUnique({
        where: { id: validatedArgs.tenant_id },
      });

      if (!existingTenant) {
        throw notFoundError('Tenant not found');
      }

      const updatedTenant = await tx.tenants.update({
        where: { id: validatedArgs.tenant_id },
        data: {
          subscription_status: validatedArgs.status,
          subscription_note: validatedArgs.reason ?? null,
          subscription_updated_at: new Date(),
          updated_at: new Date(),
          is_active: validatedArgs.status === 'ACTIVE',
        },
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'tenants',
        action: AUDIT_ACTION_TENANT_SUBS,
        actorUserId: scope.userId,
        tenantId: updatedTenant.id,
        recordId: updatedTenant.id,
        previousValue: toTenantAuditRecord(existingTenant),
        newValue: toTenantAuditRecord(updatedTenant),
      });

      return toAdminTenantOutput(updatedTenant);
    });
  });
}

export async function listAdminTenantBranches(
  ctx: Context,
  args: AdminTenantBranchesArgs,
): Promise<AdminBranchOutput[]> {
  return executeDbOperation(async () => {
    await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminTenantBranchesArgsOrThrow(args);

    await ensureTenantExists(ctx, validatedArgs.tenant_id);

    const branches = await ctx.prisma.branches.findMany({
      where: {
        tenant_id: validatedArgs.tenant_id,
      },
      orderBy: [{ nombre_sucursal: 'asc' }, { id: 'asc' }],
    });

    return toAdminBranchListOutput(branches);
  });
}

export async function createAdminBranch(ctx: Context, args: AdminCreateBranchArgs): Promise<AdminBranchOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminCreateBranchArgsOrThrow(args);

    return withTransaction(ctx.prisma, async (tx) => {
      const tenant = await tx.tenants.findUnique({
        where: { id: validatedArgs.input.tenant_id },
        select: { id: true },
      });

      if (!tenant) {
        throw notFoundError('Tenant not found');
      }

      const createdBranch = await tx.branches.create({
        data: {
          tenant_id: validatedArgs.input.tenant_id,
          nombre_sucursal: validatedArgs.input.nombre_sucursal,
          direccion_fisica: validatedArgs.input.direccion_fisica,
          horario_apertura: parseTimeOfDayOrThrow(validatedArgs.input.horario_apertura, 'horario_apertura'),
          horario_cierre: parseTimeOfDayOrThrow(validatedArgs.input.horario_cierre, 'horario_cierre'),
          is_open: validatedArgs.input.is_open ?? true,
          is_suspended: false,
          suspension_reason: null,
        },
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'branches',
        action: AUDIT_ACTION_BRANCH_CREATE,
        actorUserId: scope.userId,
        tenantId: createdBranch.tenant_id,
        recordId: createdBranch.id,
        newValue: toBranchAuditRecord(createdBranch),
      });

      return toAdminBranchOutput(createdBranch);
    });
  });
}

export async function setAdminBranchSuspended(
  ctx: Context,
  args: AdminSetBranchSuspendedArgs,
): Promise<AdminBranchOutput> {
  return executeDbOperation(async () => {
    const scope = await requireSuperAdminScope(ctx);
    const validatedArgs = parseAdminSetBranchSuspendedArgsOrThrow(args);

    return withTransaction(ctx.prisma, async (tx) => {
      const existingBranch = await tx.branches.findUnique({
        where: { id: validatedArgs.branch_id },
      });

      if (!existingBranch) {
        throw notFoundError('Branch not found');
      }

      const updatedBranch = await tx.branches.update({
        where: { id: validatedArgs.branch_id },
        data: {
          is_suspended: validatedArgs.suspended,
          suspension_reason: validatedArgs.suspended ? (validatedArgs.reason ?? 'Suspended by superadmin') : null,
          ...(validatedArgs.suspended ? { is_open: false } : {}),
        },
      });

      await createAuditLog({
        db: tx,
        ctx,
        entity: 'branches',
        action: validatedArgs.suspended ? AUDIT_ACTION_BRANCH_SUSPEND : AUDIT_ACTION_BRANCH_RESTORE,
        actorUserId: scope.userId,
        tenantId: updatedBranch.tenant_id,
        recordId: updatedBranch.id,
        previousValue: toBranchAuditRecord(existingBranch),
        newValue: toBranchAuditRecord(updatedBranch),
      });

      return toAdminBranchOutput(updatedBranch);
    });
  });
}
