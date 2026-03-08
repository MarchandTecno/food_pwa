import bcrypt from 'bcrypt';
import type { Context } from '../context';
import { generateToken } from '../auth';
import { invalidCredentialsError, registrationNotAllowedError } from '../utils/graphqlErrors';
import { normalizeRole } from '../utils/roles';
import { parseLoginArgsOrThrow, parseRegisterArgsOrThrow } from '../schemas/auth.schema';
import { executeDbOperation } from '../database';
import { toAuthPayloadOutput } from '../models/auth.model';

export interface LoginArgs {
  email: string;
  password: string;
}

export interface RegisterArgs {
  email: string;
  password: string;
  nombre?: string;
}

export async function loginUser(ctx: Context, args: LoginArgs) {
  return executeDbOperation(async () => {
    const { email, password } = parseLoginArgsOrThrow(args);

    const user = await ctx.prisma.users.findUnique({
      where: { email },
      include: {
        roles: {
          select: {
            nombre_rol: true,
          },
        },
      },
    });
    if (!user) {
      throw invalidCredentialsError();
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash || '');
    if (!passwordMatch) {
      throw invalidCredentialsError();
    }

    const role = normalizeRole(user.roles?.nombre_rol ?? undefined) ?? 'customer';

    const token = generateToken({
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id ?? undefined,
      branchId: user.branch_id ?? undefined,
      role,
    });

    return toAuthPayloadOutput(token, user);
  });
}

export async function registerUser(ctx: Context, args: RegisterArgs) {
  return executeDbOperation(async () => {
    const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
    const allowPublicRegister = !isProduction || process.env.ENABLE_PUBLIC_REGISTER === 'true';
    if (!allowPublicRegister) {
      throw registrationNotAllowedError();
    }

    const { email, password, nombre } = parseRegisterArgsOrThrow(args);

    const existingUser = await ctx.prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      throw registrationNotAllowedError();
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await ctx.prisma.users.create({
      data: {
        email,
        password_hash,
        nombre: nombre || 'New User',
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id ?? undefined,
      branchId: user.branch_id ?? undefined,
      role: 'customer',
    });

    return toAuthPayloadOutput(token, user);
  });
}
