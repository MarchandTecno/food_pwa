import { z } from 'zod';
import { parseOrThrow } from './schemaUtils';

const MAX_PAGE_SIZE = 100;

const optionalStringInput = z.union([z.string(), z.null(), z.undefined()]);

const optionalTrimmedString = optionalStringInput.transform((value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
});

const optionalUppercaseString = optionalStringInput.transform((value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : undefined;
});

const optionalLowercaseString = optionalStringInput.transform((value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
});

function validateDateString(value: string | undefined, path: string[], ctx: z.RefinementCtx): void {
  if (!value) return;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: 'must be a valid date string',
    });
  }
}

export const adminListAuditLogsArgsSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    offset: z.number().int().min(0).optional(),
    filter: z
      .object({
        tenant_id: optionalTrimmedString,
        actor_user_id: optionalTrimmedString,
        actor_search: optionalTrimmedString,
        entity: optionalLowercaseString,
        action: optionalUppercaseString,
        search: optionalTrimmedString,
        from: optionalTrimmedString,
        to: optionalTrimmedString,
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    validateDateString(value.filter?.from, ['filter', 'from'], ctx);
    validateDateString(value.filter?.to, ['filter', 'to'], ctx);

    if (!value.filter?.from || !value.filter?.to) {
      return;
    }

    const from = new Date(value.filter.from);
    const to = new Date(value.filter.to);

    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from > to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['filter', 'from'],
        message: 'must be earlier than or equal to filter.to',
      });
    }
  });

export type AdminListAuditLogsArgsInput = z.infer<typeof adminListAuditLogsArgsSchema>;

export function parseAdminListAuditLogsArgsOrThrow(input: unknown): AdminListAuditLogsArgsInput {
  return parseOrThrow(adminListAuditLogsArgsSchema, input);
}