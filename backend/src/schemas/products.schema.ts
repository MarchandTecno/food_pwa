import { z } from 'zod';
import { parseOrThrow } from './schemaUtils';

const MAX_PAGE_SIZE = 100;

const trimmedString = z.string().transform((value) => value.trim());
const nonEmptyTrimmedString = trimmedString.pipe(z.string().min(1));

const productFilterInputSchema = z
  .object({
    is_available: z.boolean().optional(),
    text: nonEmptyTrimmedString.optional(),
  })
  .optional();

const productSortInputSchema = z
  .object({
    field: z.enum(['nombre']),
    direction: z.enum(['asc', 'desc']).optional(),
  })
  .optional();

export const listProductsArgsSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    offset: z.number().int().min(0).optional(),
    cursor: nonEmptyTrimmedString.optional(),
    filter: productFilterInputSchema,
    sort: productSortInputSchema,
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

export const createProductArgsSchema = z.object({
  nombre: nonEmptyTrimmedString,
  descripcion: trimmedString.optional(),
  precio_venta: z.number().min(0).optional(),
  imagen_url: trimmedString.optional(),
  category_id: nonEmptyTrimmedString.optional(),
});

export const updateProductArgsSchema = z
  .object({
    id: nonEmptyTrimmedString,
    nombre: nonEmptyTrimmedString.optional(),
    descripcion: trimmedString.optional(),
    precio_venta: z.number().min(0).optional(),
    imagen_url: trimmedString.optional(),
    is_available: z.boolean().optional(),
    category_id: nonEmptyTrimmedString.optional(),
  })
  .superRefine((input, ctx) => {
    const hasAnyFieldToUpdate =
      input.nombre !== undefined ||
      input.descripcion !== undefined ||
      input.precio_venta !== undefined ||
      input.imagen_url !== undefined ||
      input.is_available !== undefined ||
      input.category_id !== undefined;

    if (!hasAnyFieldToUpdate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: 'at least one field must be provided to updateProduct',
      });
    }
  });

export const idArgsSchema = z.object({
  id: nonEmptyTrimmedString,
});

export type ListProductsArgsInput = z.infer<typeof listProductsArgsSchema>;
export type CreateProductArgsInput = z.infer<typeof createProductArgsSchema>;
export type UpdateProductArgsInput = z.infer<typeof updateProductArgsSchema>;
export type IdArgsInput = z.infer<typeof idArgsSchema>;

export function parseListProductsArgsOrThrow(input: unknown): ListProductsArgsInput {
  return parseOrThrow(listProductsArgsSchema, input);
}

export function parseCreateProductArgsOrThrow(input: unknown): CreateProductArgsInput {
  return parseOrThrow(createProductArgsSchema, input);
}

export function parseUpdateProductArgsOrThrow(input: unknown): UpdateProductArgsInput {
  return parseOrThrow(updateProductArgsSchema, input);
}

export function parseIdArgsOrThrow(input: unknown): IdArgsInput {
  return parseOrThrow(idArgsSchema, input);
}
