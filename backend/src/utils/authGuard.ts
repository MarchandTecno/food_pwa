import type { Context } from '../context';
import { unauthenticatedError } from './graphqlErrors';

export function getAuthenticatedUserId(ctx: Context): string {
  if (!ctx.authContext?.isAuthenticated || !ctx.authContext.user) {
    throw unauthenticatedError();
  }

  return ctx.authContext.user.userId;
}
