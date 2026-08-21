import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getUsersRoute, POST as postUsersRoute } from '@/app/api/users/route';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
    passwordResetToken: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  isSameOrigin: vi.fn(),
  validatePasswordStrength: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeAccessDeniedAuditLog: vi.fn(),
}));

describe('Users Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
  });

  it('should audit unauthenticated admin user listing attempts', async () => {
    const req = new NextRequest('http://localhost/api/users');
    const res = await getUsersRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_ADMIN_ROUTE_DENIED',
        status: 401,
        reason: 'missing_token',
        metadata: { method: 'GET' },
      })
    );
  });

  it('should audit cross-origin admin user creation attempts', async () => {
    (isSameOrigin as any).mockReturnValue(false);
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });

    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      headers: {
        cookie: 'token=abc',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Admin Two',
        email: 'admin2@example.com',
        password: 'Password123!',
        role: 'ADMIN',
      }),
    });

    const res = await postUsersRoute(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_ADMIN_ROUTE_DENIED',
        status: 403,
        reason: 'cross_origin',
        metadata: { method: 'POST' },
      })
    );
  });
});
