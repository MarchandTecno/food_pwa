import { unwrapResolverError } from '@apollo/server/errors';
import { Prisma } from '@prisma/client';
import type { GraphQLFormattedError } from 'graphql';
import { GraphQLError as GraphQLErrorCtor } from 'graphql';
import { badUserInputError, notFoundError } from '../utils/graphqlErrors';

function internalDatabaseError(message = 'Database operation failed'): GraphQLErrorCtor {
  return new GraphQLErrorCtor(`INTERNAL_SERVER_ERROR: ${message}`, {
    extensions: {
      code: 'INTERNAL_SERVER_ERROR',
      category: 'DATABASE',
    },
  });
}

function mapPrismaKnownRequestError(error: Prisma.PrismaClientKnownRequestError): GraphQLErrorCtor {
  switch (error.code) {
    case 'P2002':
      return badUserInputError('Invalid input: duplicate value violates unique constraint');
    case 'P2003':
      return badUserInputError('Invalid input: related resource does not exist');
    case 'P2025':
      return notFoundError('Resource not found');
    default:
      return internalDatabaseError();
  }
}

export function mapDatabaseError(error: unknown): GraphQLErrorCtor | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaKnownRequestError(error);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return badUserInputError('Invalid input: database validation failed');
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return internalDatabaseError('Database is not available');
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return internalDatabaseError();
  }

  return null;
}

export function applyDatabaseErrorPolicy(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const resolverError = unwrapResolverError(error as Error);
  const mapped = mapDatabaseError(resolverError);
  if (!mapped) {
    return formattedError;
  }

  return {
    ...formattedError,
    message: mapped.message,
    extensions: {
      ...(formattedError.extensions ?? {}),
      ...(mapped.extensions ?? {}),
    },
  };
}
