import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { badUserInputError } from '../utils/graphqlErrors';

function formatIssuePath(path: (string | number)[]): string {
  if (path.length === 0) return 'input';
  return path.map((segment) => String(segment)).join('.');
}

function toPathSegments(path: PropertyKey[]): (string | number)[] {
  return path.filter((segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number');
}

export function parseOrThrow<T>(schema: ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const issuePath = formatIssuePath(toPathSegments(issue?.path ?? []));
      const message = issue?.message ?? 'invalid input';
      throw badUserInputError(`Invalid input: ${issuePath} ${message}`);
    }

    throw error;
  }
}
