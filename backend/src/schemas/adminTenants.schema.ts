import { z } from 'zod';
import { parseOrThrow } from './schemaUtils';

const MAX_PAGE_SIZE = 100;

const nonEmptyTrimmedString = z.string().transform((value) => value.trim()).pipe(z.string().min(1));
const optionalStringInput = z.union([z.string(), z.null(), z.undefined()]);

const optionalTrimmedString = optionalStringInput.transform((value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
});

const optionalTrimmedNullableString = optionalStringInput.transform((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
});

const optionalCurrencyCode = optionalStringInput.transform((value, ctx) => {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;

  if (normalized.length < 3 || normalized.length > 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must be between 3 and 5 characters',
    });
    return z.NEVER;
  }

  return normalized;
});

const optionalRegionCode = optionalStringInput.transform((value, ctx) => {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;

  if (normalized.length > 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must not exceed 10 characters',
    });
    return z.NEVER;
  }

  return normalized;
});

const optionalTimeZone = optionalStringInput.transform((value, ctx) => {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.length > 64) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must not exceed 64 characters',
    });
    return z.NEVER;
  }

  return trimmed;
});

const cssVariableInputSchema = z.object({
  key: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .regex(/^--[a-z0-9-]+$/i, 'must be a valid CSS variable name prefixed with --'),
    ),
  value: nonEmptyTrimmedString,
});

const subscriptionStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'CANCELED']);

export const adminListTenantsArgsSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  offset: z.number().int().min(0).optional(),
  filter: z
    .object({
      search: optionalTrimmedString,
      subscription_status: subscriptionStatusSchema.optional(),
    })
    .optional(),
});

export const adminTenantIdArgsSchema = z.object({
  id: nonEmptyTrimmedString,
});

export const adminTenantBranchesArgsSchema = z.object({
  tenant_id: nonEmptyTrimmedString,
});

const createTenantInputSchema = z.object({
  nombre_comercial: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(100)),
  razon_social: optionalTrimmedString,
  rfc_tax_id: optionalTrimmedString,
  email_admin: z.string().transform((value) => value.trim().toLowerCase()).pipe(z.string().email()),
  telefono_contacto: optionalTrimmedString,
  logo_url: optionalTrimmedString,
  moneda: optionalCurrencyCode,
  region_code: optionalRegionCode,
  time_zone: optionalTimeZone,
  palette_css: z.array(cssVariableInputSchema).optional(),
  subscription_status: subscriptionStatusSchema.optional(),
});

export const adminCreateTenantArgsSchema = z.object({
  input: createTenantInputSchema,
});

const updateTenantBrandingInputSchema = z
  .object({
    logo_url: optionalTrimmedNullableString,
    palette_css: z.array(cssVariableInputSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.logo_url === undefined && value.palette_css === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['logo_url'],
        message: 'logo_url or palette_css must be provided',
      });
    }
  });

export const adminUpdateTenantBrandingArgsSchema = z.object({
  tenant_id: nonEmptyTrimmedString,
  input: updateTenantBrandingInputSchema,
});

const updateTenantRegionInputSchema = z
  .object({
    moneda: optionalCurrencyCode,
    region_code: optionalRegionCode,
    time_zone: optionalTimeZone,
  })
  .superRefine((value, ctx) => {
    if (value.moneda === undefined && value.region_code === undefined && value.time_zone === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['moneda'],
        message: 'at least one region field must be provided',
      });
    }
  });

export const adminUpdateTenantRegionArgsSchema = z.object({
  tenant_id: nonEmptyTrimmedString,
  input: updateTenantRegionInputSchema,
});

export const adminUpdateTenantSubscriptionArgsSchema = z.object({
  tenant_id: nonEmptyTrimmedString,
  status: subscriptionStatusSchema,
  reason: optionalTrimmedString,
});

const createBranchInputSchema = z.object({
  tenant_id: nonEmptyTrimmedString,
  nombre_sucursal: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(100)),
  direccion_fisica: optionalTrimmedString,
  horario_apertura: optionalTrimmedString,
  horario_cierre: optionalTrimmedString,
  is_open: z.boolean().optional(),
});

export const adminCreateBranchArgsSchema = z.object({
  input: createBranchInputSchema,
});

export const adminSetBranchSuspendedArgsSchema = z.object({
  branch_id: nonEmptyTrimmedString,
  suspended: z.boolean(),
  reason: optionalTrimmedString,
});

export type AdminListTenantsArgsInput = z.infer<typeof adminListTenantsArgsSchema>;
export type AdminTenantIdArgsInput = z.infer<typeof adminTenantIdArgsSchema>;
export type AdminTenantBranchesArgsInput = z.infer<typeof adminTenantBranchesArgsSchema>;
export type AdminCreateTenantArgsInput = z.infer<typeof adminCreateTenantArgsSchema>;
export type AdminUpdateTenantBrandingArgsInput = z.infer<typeof adminUpdateTenantBrandingArgsSchema>;
export type AdminUpdateTenantRegionArgsInput = z.infer<typeof adminUpdateTenantRegionArgsSchema>;
export type AdminUpdateTenantSubscriptionArgsInput = z.infer<typeof adminUpdateTenantSubscriptionArgsSchema>;
export type AdminCreateBranchArgsInput = z.infer<typeof adminCreateBranchArgsSchema>;
export type AdminSetBranchSuspendedArgsInput = z.infer<typeof adminSetBranchSuspendedArgsSchema>;

export function parseAdminListTenantsArgsOrThrow(input: unknown): AdminListTenantsArgsInput {
  return parseOrThrow(adminListTenantsArgsSchema, input);
}

export function parseAdminTenantIdArgsOrThrow(input: unknown): AdminTenantIdArgsInput {
  return parseOrThrow(adminTenantIdArgsSchema, input);
}

export function parseAdminTenantBranchesArgsOrThrow(input: unknown): AdminTenantBranchesArgsInput {
  return parseOrThrow(adminTenantBranchesArgsSchema, input);
}

export function parseAdminCreateTenantArgsOrThrow(input: unknown): AdminCreateTenantArgsInput {
  return parseOrThrow(adminCreateTenantArgsSchema, input);
}

export function parseAdminUpdateTenantBrandingArgsOrThrow(input: unknown): AdminUpdateTenantBrandingArgsInput {
  return parseOrThrow(adminUpdateTenantBrandingArgsSchema, input);
}

export function parseAdminUpdateTenantRegionArgsOrThrow(input: unknown): AdminUpdateTenantRegionArgsInput {
  return parseOrThrow(adminUpdateTenantRegionArgsSchema, input);
}

export function parseAdminUpdateTenantSubscriptionArgsOrThrow(input: unknown): AdminUpdateTenantSubscriptionArgsInput {
  return parseOrThrow(adminUpdateTenantSubscriptionArgsSchema, input);
}

export function parseAdminCreateBranchArgsOrThrow(input: unknown): AdminCreateBranchArgsInput {
  return parseOrThrow(adminCreateBranchArgsSchema, input);
}

export function parseAdminSetBranchSuspendedArgsOrThrow(input: unknown): AdminSetBranchSuspendedArgsInput {
  return parseOrThrow(adminSetBranchSuspendedArgsSchema, input);
}
