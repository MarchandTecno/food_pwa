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

const globalRoleSchema = z.enum(['SUPERADMIN', 'OWNER', 'KITCHEN', 'DELIVERY']);

const strongPasswordSchema = z.string().min(12).max(128).superRefine((value, ctx) => {
  if (/\s/.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must not contain whitespace',
    });
  }

  if (!/[A-Z]/.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must include at least one uppercase letter',
    });
  }

  if (!/[a-z]/.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must include at least one lowercase letter',
    });
  }

  if (!/\d/.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must include at least one numeric digit',
    });
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must include at least one special character',
    });
  }
});

function validateRoleScope(
  role: z.infer<typeof globalRoleSchema>,
  tenantId: string | undefined,
  branchId: string | undefined,
  ctx: z.RefinementCtx,
): void {
  if (role === 'SUPERADMIN') {
    if (tenantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tenant_id'],
        message: 'must not be provided for SUPERADMIN role',
      });
    }

    if (branchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['branch_id'],
        message: 'must not be provided for SUPERADMIN role',
      });
    }

    return;
  }

  if (!tenantId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tenant_id'],
      message: 'is required for OWNER, KITCHEN and DELIVERY roles',
    });
  }

  if ((role === 'KITCHEN' || role === 'DELIVERY') && !branchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['branch_id'],
      message: 'is required for KITCHEN and DELIVERY roles',
    });
  }
}

export const adminListUsersArgsSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  offset: z.number().int().min(0).optional(),
  filter: z
    .object({
      search: optionalTrimmedString,
      tenant_id: optionalTrimmedString,
      branch_id: optionalTrimmedString,
      role: globalRoleSchema.optional(),
      is_active: z.boolean().optional(),
    })
    .optional(),
});

const createAdminUserInputSchema = z
  .object({
    nombre: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(100)),
    email: z.string().transform((value) => value.trim().toLowerCase()).pipe(z.string().email()),
    password: strongPasswordSchema,
    role: globalRoleSchema,
    tenant_id: optionalTrimmedString,
    branch_id: optionalTrimmedString,
    is_active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    validateRoleScope(value.role, value.tenant_id, value.branch_id, ctx);
  });

export const adminCreateUserArgsSchema = z.object({
  input: createAdminUserInputSchema,
});

const updateUserAssignmentInputSchema = z
  .object({
    user_id: nonEmptyTrimmedString,
    role: globalRoleSchema.optional(),
    tenant_id: optionalTrimmedNullableString,
    branch_id: optionalTrimmedNullableString,
    is_active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === undefined && value.tenant_id === undefined && value.branch_id === undefined && value.is_active === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'at least one mutable field must be provided',
      });
    }

    if (typeof value.branch_id === 'string' && value.tenant_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['branch_id'],
        message: 'cannot be provided when tenant_id is explicitly null',
      });
    }
  });

export const adminUpdateUserAssignmentArgsSchema = z.object({
  input: updateUserAssignmentInputSchema,
});

export const adminResetUserPasswordArgsSchema = z.object({
  user_id: nonEmptyTrimmedString,
  new_password: strongPasswordSchema,
});

export const adminListSessionLogsArgsSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  offset: z.number().int().min(0).optional(),
  filter: z
    .object({
      tenant_id: optionalTrimmedString,
      user_id: optionalTrimmedString,
      role: globalRoleSchema.optional(),
      action: optionalTrimmedString,
      search: optionalTrimmedString,
    })
    .optional(),
});

export type AdminListUsersArgsInput = z.infer<typeof adminListUsersArgsSchema>;
export type AdminCreateUserArgsInput = z.infer<typeof adminCreateUserArgsSchema>;
export type AdminUpdateUserAssignmentArgsInput = z.infer<typeof adminUpdateUserAssignmentArgsSchema>;
export type AdminResetUserPasswordArgsInput = z.infer<typeof adminResetUserPasswordArgsSchema>;
export type AdminListSessionLogsArgsInput = z.infer<typeof adminListSessionLogsArgsSchema>;

export function parseAdminListUsersArgsOrThrow(input: unknown): AdminListUsersArgsInput {
  return parseOrThrow(adminListUsersArgsSchema, input);
}

export function parseAdminCreateUserArgsOrThrow(input: unknown): AdminCreateUserArgsInput {
  return parseOrThrow(adminCreateUserArgsSchema, input);
}

export function parseAdminUpdateUserAssignmentArgsOrThrow(input: unknown): AdminUpdateUserAssignmentArgsInput {
  return parseOrThrow(adminUpdateUserAssignmentArgsSchema, input);
}

export function parseAdminResetUserPasswordArgsOrThrow(input: unknown): AdminResetUserPasswordArgsInput {
  return parseOrThrow(adminResetUserPasswordArgsSchema, input);
}

export function parseAdminListSessionLogsArgsOrThrow(input: unknown): AdminListSessionLogsArgsInput {
  return parseOrThrow(adminListSessionLogsArgsSchema, input);
}
