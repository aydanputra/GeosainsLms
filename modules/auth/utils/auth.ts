import { hash, compare } from 'bcryptjs';
import { JWTPayload, SignJWT, jwtVerify } from 'jose';
import { Role } from '@prisma/client';
import { prisma } from '@/utils/prisma';

const SALT_ROUNDS = 10;

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return new TextEncoder().encode(secret);
};

export const hashPassword = async (password: string): Promise<string> => {
  return hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return compare(password, hash);
};

export type AuthTokenPayload = JWTPayload & {
  id: string;
  email: string;
  role: Role;
  isSuperAdmin: boolean;
  totpEnabled: boolean;
  sessionVersion: number;
};

export const createToken = async (payload: AuthTokenPayload): Promise<string> => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Token expires in 1 day
    .sign(getSecretKey());
};

export const verifyToken = async (token: string): Promise<AuthTokenPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    const userId = typeof payload?.id === 'string' ? payload.id : '';
    const tokenSessionVersion = typeof payload?.sessionVersion === 'number' ? payload.sessionVersion : Number.NaN;

    if (!userId || !Number.isInteger(tokenSessionVersion)) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isSuperAdmin: true,
        totpEnabled: true,
        sessionVersion: true,
      },
    });

    if (!user || user.sessionVersion !== tokenSessionVersion) {
      return null;
    }

    return {
      ...payload,
      id: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      totpEnabled: Boolean(user.totpEnabled),
      sessionVersion: user.sessionVersion,
    } as AuthTokenPayload;
  } catch {
    return null;
  }
};
