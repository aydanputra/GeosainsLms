import { prisma } from '@/utils/prisma';
import { hashPassword, createToken, verifyPassword } from '../utils/auth';
import { z } from 'zod';
import { validatePasswordStrength } from '../utils/security';

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['STUDENT', 'MENTOR']).optional(),
});

export const registerUser = async (data: unknown) => {
  const result = RegisterSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Invalid input data');
  }

  const { name, email, password, role } = result.data;
  const requestedRole = role === 'MENTOR' ? 'MENTOR' : 'STUDENT';

  const pwCheck = validatePasswordStrength(password, { minLength: 8, strict: false });
  if (!pwCheck.ok) throw new Error(pwCheck.error);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: requestedRole,
      emailVerifiedAt: null,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const loginUser = async (data: unknown) => {
  const result = LoginSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Invalid input data');
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  if (!user.emailVerifiedAt && user.role !== 'ADMIN') {
    const err = new Error('Email belum terverifikasi') as Error & { code?: string };
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }

  const token = await createToken({
    id: user.id,
    email: user.email,
    role: user.role,
    isSuperAdmin: Boolean((user as any).isSuperAdmin),
    totpEnabled: Boolean((user as any).totpEnabled),
    sessionVersion: Number((user as any).sessionVersion || 0),
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};
