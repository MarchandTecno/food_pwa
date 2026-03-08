import type { Context } from '../context';
import { createContext } from '../context';
import { getAuthenticatedUserId } from '../utils/authGuard';
import { loginUser, registerUser, type LoginArgs, type RegisterArgs } from '../services/auth.service';
import { toUserOutput } from '../models/user.model';

export const authQueryResolvers = {
  me: async (_: unknown, __: Record<string, never>, ctx: Context = createContext()) => {
    const userId = getAuthenticatedUserId(ctx);
    const user = await ctx.prisma.users.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: {
            nombre_rol: true,
          },
        },
      },
    });
    return user ? toUserOutput(user) : null;
  },
};

export const authMutationResolvers = {
  login: async (_: unknown, args: LoginArgs, ctx: Context = createContext()) => {
    return loginUser(ctx, args);
  },
  register: async (_: unknown, args: RegisterArgs, ctx: Context = createContext()) => {
    return registerUser(ctx, args);
  },
};
