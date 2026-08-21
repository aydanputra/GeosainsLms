import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/utils/prisma';
import { jwtVerify } from 'jose';
import { verifyToken } from '../utils/auth';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('jose', async () => {
  const actual = await vi.importActual<typeof import('jose')>('jose');
  return {
    ...actual,
    jwtVerify: vi.fn(),
  };
});

describe('Auth Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'unit-test-secret';
  });

  it('should accept token when sessionVersion still matches database', async () => {
    (jwtVerify as any).mockResolvedValue({
      payload: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'STUDENT',
        isSuperAdmin: false,
        totpEnabled: false,
        sessionVersion: 2,
      },
    });

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      role: 'STUDENT',
      isSuperAdmin: false,
      totpEnabled: false,
      sessionVersion: 2,
    });

    const payload = await verifyToken('mock-token');

    expect(payload).toEqual(expect.objectContaining({
      id: 'user-1',
      email: 'test@example.com',
      role: 'STUDENT',
      sessionVersion: 2,
    }));
  });

  it('should reject token when sessionVersion no longer matches database', async () => {
    (jwtVerify as any).mockResolvedValue({
      payload: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'STUDENT',
        isSuperAdmin: false,
        totpEnabled: false,
        sessionVersion: 2,
      },
    });

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      role: 'STUDENT',
      isSuperAdmin: false,
      totpEnabled: false,
      sessionVersion: 3,
    });

    await expect(verifyToken('mock-token')).resolves.toBeNull();
  });
});
