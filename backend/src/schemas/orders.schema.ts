import { z } from 'zod';
import { parseOrThrow } from './schemaUtils';

const MAX_PAGE_SIZE = 100;

const trimmedString = z.string().transform((value) => value.trim());
const nonEmptyTrimmedString = trimmedString.pipe(z.string().min(1));

const dateRangeInputSchema = z
  .object({
    from: nonEmptyTrimmedString.optional(),
    to: nonEmptyTrimmedString.optional(),
  })
  .optional();

const orderFilterInputSchema = z
  .object({
    status: nonEmptyTrimmedString.optional(),
    date_range: dateRangeInputSchema,
    customer_name: nonEmptyTrimmedString.optional(),
  })
  .optional();

const orderSortInputSchema = z
  .object({
    field: z.enum(['created_at', 'total_neto', 'nombre']),
    direction: z.enum(['asc', 'desc']).optional(),
  })
  .optional();

export const listOrdersArgsSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    offset: z.number().int().min(0).optional(),
    cursor: nonEmptyTrimmedString.optional(),
    filter: orderFilterInputSchema,
    sort: orderSortInputSchema,
  })
  .superRefine((input, ctx) => {
    if (input.cursor && input.offset !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offset'],
        message: 'offset and cursor cannot be used together',
      });
    }
  });

export const createOrderArgsSchema = z.object({
  customer_name: nonEmptyTrimmedString,
  customer_whatsapp: nonEmptyTrimmedString,
  customer_id: nonEmptyTrimmedString.optional(),
  address_id: nonEmptyTrimmedString.optional(),
  payment_method_id: z.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        product_id: nonEmptyTrimmedString,
        cantidad: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const updateOrderStatusArgsSchema = z.object({
  id: nonEmptyTrimmedString,
  status: nonEmptyTrimmedString,
});

export const idArgsSchema = z.object({
  id: nonEmptyTrimmedString,
});

export type ListOrdersArgsInput = z.infer<typeof listOrdersArgsSchema>;
export type CreateOrderArgsInput = z.infer<typeof createOrderArgsSchema>;
export type UpdateOrderStatusArgsInput = z.infer<typeof updateOrderStatusArgsSchema>;
export type IdArgsInput = z.infer<typeof idArgsSchema>;

export function parseListOrdersArgsOrThrow(input: unknown): ListOrdersArgsInput {
  return parseOrThrow(listOrdersArgsSchema, input);
}

export function parseCreateOrderArgsOrThrow(input: unknown): CreateOrderArgsInput {
  return parseOrThrow(createOrderArgsSchema, input);
}

export function parseUpdateOrderStatusArgsOrThrow(input: unknown): UpdateOrderStatusArgsInput {
  return parseOrThrow(updateOrderStatusArgsSchema, input);
}

export function parseIdArgsOrThrow(input: unknown): IdArgsInput {
  return parseOrThrow(idArgsSchema, input);
}
