import { GraphQLError } from 'graphql';

function formatMessage(prefix: string, message: string): string {
  return `${prefix}: ${message}`;
}

export function unauthenticatedError(message = 'Authentication required'): GraphQLError {
  return new GraphQLError(formatMessage('UNAUTHENTICATED', message), {
    extensions: { code: 'UNAUTHENTICATED' },
  });
}

export function badUserInputError(message: string): GraphQLError {
  return new GraphQLError(formatMessage('BAD_USER_INPUT', message), {
    extensions: { code: 'BAD_USER_INPUT' },
  });
}

export function invalidCredentialsError(): GraphQLError {
  return badUserInputError('Invalid input: credentials are not valid');
}

export function registrationNotAllowedError(): GraphQLError {
  return badUserInputError('Invalid input: registration request could not be completed');
}

export function notFoundError(message: string): GraphQLError {
  return new GraphQLError(formatMessage('NOT_FOUND', message), {
    extensions: { code: 'NOT_FOUND' },
  });
}

export function forbiddenError(message = 'Operation not allowed'): GraphQLError {
  return new GraphQLError(formatMessage('FORBIDDEN', message), {
    extensions: { code: 'FORBIDDEN' },
  });
}
