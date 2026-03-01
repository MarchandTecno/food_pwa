import { Prisma } from '@prisma/client';
import type { GraphQLFormattedError } from 'graphql';
import { applyDatabaseErrorPolicy, mapDatabaseError } from '../../src/database/errors';

function createKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('known', {
    code,
    clientVersion: 'test',
  });
}

describe('database/errors', () => {
  it('maps known Prisma codes to GraphQL-safe errors', () => {
    const duplicate = mapDatabaseError(createKnownError('P2002'));
    expect(duplicate?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(duplicate?.message).toContain('duplicate value violates unique constraint');

    const fk = mapDatabaseError(createKnownError('P2003'));
    expect(fk?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(fk?.message).toContain('related resource does not exist');

    const missing = mapDatabaseError(createKnownError('P2025'));
    expect(missing?.extensions?.code).toBe('NOT_FOUND');
  });

  it('maps unknown known-request code to internal database error', () => {
    const mapped = mapDatabaseError(createKnownError('P2999'));
    expect(mapped?.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(mapped?.extensions?.category).toBe('DATABASE');
  });

  it('maps Prisma validation/init/panic errors', () => {
    const validation = mapDatabaseError(new Prisma.PrismaClientValidationError('invalid', { clientVersion: 'test' }));
    expect(validation?.extensions?.code).toBe('BAD_USER_INPUT');

    const init = mapDatabaseError(new Prisma.PrismaClientInitializationError('db down', 'test'));
    expect(init?.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(init?.message).toContain('Database is not available');

    const panic = mapDatabaseError(new Prisma.PrismaClientRustPanicError('panic', 'test'));
    expect(panic?.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('returns null for non-Prisma errors', () => {
    const mapped = mapDatabaseError(new Error('boom'));
    expect(mapped).toBeNull();
  });

  it('applyDatabaseErrorPolicy keeps non-database errors unchanged', () => {
    const formattedError: GraphQLFormattedError = {
      message: 'ORIGINAL',
      extensions: { code: 'UNAUTHENTICATED', errorId: 'req-1' },
    };

    const result = applyDatabaseErrorPolicy(formattedError, new Error('not prisma'));
    expect(result).toBe(formattedError);
  });

  it('applyDatabaseErrorPolicy maps Prisma errors and preserves existing extension fields', () => {
    const formattedError: GraphQLFormattedError = {
      message: 'ORIGINAL',
      extensions: { errorId: 'req-2-1', custom: 'keep-me' },
    };

    const result = applyDatabaseErrorPolicy(formattedError, createKnownError('P2002'));
    expect(result.message).toContain('duplicate value violates unique constraint');
    expect(result.extensions?.code).toBe('BAD_USER_INPUT');
    expect(result.extensions?.errorId).toBe('req-2-1');
    expect(result.extensions?.custom).toBe('keep-me');
  });
});
