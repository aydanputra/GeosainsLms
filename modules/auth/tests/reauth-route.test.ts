import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as reauthRoute } from '@/app/api/auth/reauth/route';
import { verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeRateLimitAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', async () => {
  const actual = await vi.importActual<typeof import('@/modules/auth/utils/auth')>('@/modules/auth/utils/auth');
  return {
    ...actual,
    verifyToken: vi.fn(),
    verifyPassword: vi.fn(),
  };
});

vi.mock('@/modules/auth/utils/security', async () => {
  const actual = await vi.importActual<typeof import('@/modules/auth/utils/security')>('@/modules/auth/utils/security');
  return {
    ...actual,
    enforceRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    isSameOrigin: vi.fn(),
  };
});

vi.mock('@/utils/audit', () => ({
  writeRateLimitAuditLog: vi.fn(),
}));

describe('Reauth Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'unit-test-secret';
    (isSameOrigin as any).mockReturnValue(true);
    (getClientIp as any).mockReturnValue('127.0.0.1');
    (enforceRateLimit as any).mockReturnValue({ ok: true });
  });

  it('should return 429 when IP rate limit is exceeded', async () => {
    (enforceRateLimit as any).mockReturnValueOnce({ ok: false, retryAfterSeconds: 300 });

    const req = new NextRequest('http://localhost/api/auth/reauth', {
      method: 'POST',
      body: JSON.stringify({ password: 'Secret123!' }),
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
    });

    const res = await reauthRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('300');
    expect(data).toEqual({ error: 'Terlalu banyak percobaan re-auth. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_REAUTH_RATE_LIMITED',
        key: 'auth:reauth:ip:127.0.0.1',
      })
    );
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('should return 429 when user reauth rate limit is exceeded', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    (enforceRateLimit as any)
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: false, retryAfterSeconds: 180 });

    const req = new NextRequest('http://localhost/api/auth/reauth', {
      method: 'POST',
      body: JSON.stringify({ password: 'Secret123!' }),
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
    });

    const res = await reauthRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('180');
    expect(data).toEqual({ error: 'Terlalu banyak percobaan re-auth untuk akun ini. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_REAUTH_RATE_LIMITED',
        key: 'auth:reauth:user:admin-1',
      })
    );
  });
});
