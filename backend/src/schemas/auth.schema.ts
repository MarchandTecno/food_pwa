import { z } from 'zod';
import { parseOrThrow } from './schemaUtils';

const trimmedNonEmptyString = z.string().transform((value) => value.trim()).pipe(z.string().min(1));

export const loginArgsSchema = z.object({
  email: z.string().transform((value) => value.trim().toLowerCase()).pipe(z.string().email()),
  password: z.string().min(8),
});

export const registerArgsSchema = z.object({
  email: z.string().transform((value) => value.trim().toLowerCase()).pipe(z.string().email()),
  password: z.string().min(8),
  nombre: trimmedNonEmptyString.optional(),
});

export type LoginArgsInput = z.infer<typeof loginArgsSchema>;
export type RegisterArgsInput = z.infer<typeof registerArgsSchema>;

export function parseLoginArgsOrThrow(input: unknown): LoginArgsInput {
  return parseOrThrow(loginArgsSchema, input);
}

export function parseRegisterArgsOrThrow(input: unknown): RegisterArgsInput {
  return parseOrThrow(registerArgsSchema, input);
}
