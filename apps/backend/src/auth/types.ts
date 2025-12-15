import type { Role } from '@prisma/client';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}
