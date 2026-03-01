import type { users } from '@prisma/client';
import { toUserOutput, type UserOutput } from './user.model';

export interface AuthPayloadOutput {
  token: string;
  user: UserOutput;
}

export function toAuthPayloadOutput(token: string, user: users): AuthPayloadOutput {
  return {
    token,
    user: toUserOutput(user),
  };
}
