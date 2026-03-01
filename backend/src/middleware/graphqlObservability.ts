import type { ApolloServerPlugin, GraphQLRequestContext, GraphQLRequestContextWillSendResponse } from '@apollo/server';
import type { GraphQLError } from 'graphql';
import type { Context } from '../context';
import { logError, logInfo } from '../utils/logger';
import { recordGraphqlErrorCode, recordOperationLatency } from '../utils/metrics';

function buildErrorId(requestId: string | undefined, index: number): string {
  if (!requestId) {
    return `graphql-error-${Date.now()}-${index + 1}`;
  }

  return `${requestId}-${index + 1}`;
}

function attachErrorIds(ctx: GraphQLRequestContextWillSendResponse<Context>, requestId: string | undefined): string[] {
  if (ctx.response.body.kind !== 'single') {
    return [];
  }

  const errors = ctx.response.body.singleResult.errors;
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error, index) => {
    const mutableError = error as unknown as { extensions?: Record<string, unknown> };
    const existingErrorId =
      mutableError.extensions &&
      typeof mutableError.extensions.errorId === 'string' &&
      mutableError.extensions.errorId.trim()
        ? mutableError.extensions.errorId
        : undefined;

    const errorId = existingErrorId ?? buildErrorId(requestId, index);
    mutableError.extensions = {
      ...(mutableError.extensions ?? {}),
      errorId,
    };

    return errorId;
  });
}

function getRootOperationLabel(requestQuery: string | undefined, fallback: string): string {
  if (!requestQuery) return fallback;

  const compact = requestQuery.replace(/\s+/g, ' ').trim();
  const operationMatch = compact.match(/\b(query|mutation|subscription)\b[^{]*\{\s*([_A-Za-z][_0-9A-Za-z]*)/i);
  if (!operationMatch) return fallback;

  return operationMatch[2];
}

function resolveOperationType(ctx: GraphQLRequestContextWillSendResponse<Context>): 'query' | 'mutation' | 'subscription' | 'unknown' {
  const operationType = ctx.operation?.operation;
  if (operationType === 'query' || operationType === 'mutation' || operationType === 'subscription') {
    return operationType;
  }

  return 'unknown';
}

function firstErrorCode(errors: ReadonlyArray<GraphQLError> | undefined): string {
  if (!errors || errors.length === 0) return 'UNKNOWN';
  const code = errors[0].extensions?.code;
  return typeof code === 'string' && code.trim() ? code : 'UNKNOWN';
}

export function createGraphqlObservabilityPlugin(): ApolloServerPlugin<Context> {
  return {
    async requestDidStart(_: GraphQLRequestContext<Context>) {
      const startedAt = Date.now();

      return {
        async willSendResponse(ctx: GraphQLRequestContextWillSendResponse<Context>) {
          const latencyMs = Date.now() - startedAt;
          const operationType = resolveOperationType(ctx);
          const fallbackName = ctx.request.operationName ?? 'anonymous';
          const resolver = getRootOperationLabel(ctx.request.query, fallbackName);
          const operationMetricName = `${operationType}:${resolver}`;

          recordOperationLatency(operationMetricName, latencyMs);

          const requestId = ctx.contextValue.requestId;
          const userId = ctx.contextValue.authContext?.user?.userId;
          const tenantId = ctx.contextValue.authContext?.user?.tenantId;
          const errorIds = attachErrorIds(ctx, requestId);

          if (ctx.errors && ctx.errors.length > 0) {
            for (const error of ctx.errors) {
              const code = typeof error.extensions?.code === 'string' ? error.extensions.code : 'UNKNOWN';
              recordGraphqlErrorCode(code);
            }

            logError({
              event: 'graphql.request',
              requestId,
              userId,
              tenantId,
              resolver,
              operationType,
              latencyMs,
              result: 'error',
              errorCode: firstErrorCode(ctx.errors),
              errorId: errorIds[0],
            });
            return;
          }

          logInfo({
            event: 'graphql.request',
            requestId,
            userId,
            tenantId,
            resolver,
            operationType,
            latencyMs,
            result: 'ok',
          });
        },
      };
    },
  };
}
