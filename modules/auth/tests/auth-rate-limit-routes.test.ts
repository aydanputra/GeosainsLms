import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as googleRoute } from '@/app/api/auth/google/route';
import { POST as setup2faRoute } from '@/app/api/auth/2fa/setup/route';
import { POST as verifyEmailRoute } from '@/app/api/auth/verify-email/route';
import { POST as verificationStatusRoute } from '@/app/api/auth/verification-status/route';
import { POST as resendVerificationRoute } from '@/app/api/auth/resend-verification/route';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeRateLimitAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    emailVerificationToken: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/modules/auth/api/service', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
}));

vi.mock('@/modules/auth/utils/auth', async () => {
  const actual = await vi.importActual<typeof import('@/modules/auth/utils/auth')>('@/modules/auth/utils/auth');
  return {
    ...actual,
    verifyToken: vi.fn(),
    verifyPassword: vi.fn(),
    createToken: vi.fn(),
    hashPassword: vi.fn(),
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
  writeAuditLog: vi.fn(),
  writeRateLimitAuditLog: vi.fn(),
}));

vi.mock('@/modules/auth/utils/emailVerification', () => ({
  issueVerificationEmail: vi.fn(),
}));

vi.mock('@/modules/auth/utils/verificationAutoLogin', () => ({
  createPendingVerificationToken: vi.fn(),
  setPendingVerificationCookie: vi.fn(),
  clearPendingVerificationCookie: vi.fn(),
  createPasswordSetupToken: vi.fn(),
  getDashboardPathByRole: vi.fn(() => '/dashboard/student'),
  readPendingVerificationCookie: vi.fn(),
  setAuthCookies: vi.fn(),
  setPasswordSetupCookie: vi.fn(),
}));

vi.mock('@/modules/core/utils/appUrl', () => ({
  getAppUrl: vi.fn(() => 'http://localhost'),
}));

describe('Auth Rate Limit Audit Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (getClientIp as any).mockReturnValue('127.0.0.1');
    (enforceRateLimit as any).mockReturnValue({ ok: false, retryAfterSeconds: 120 });
  });

  it('should audit register route rate limits', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', { method: 'POST', body: JSON.stringify({}) });
    const res = await registerRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_REGISTER_RATE_LIMITED', key: 'auth:register:127.0.0.1' })
    );
  });

  it('should audit google auth route rate limits', async () => {
    const req = new NextRequest('http://localhost/api/auth/google', { method: 'POST', body: JSON.stringify({}) });
    const res = await googleRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_GOOGLE_RATE_LIMITED', key: 'auth:google:127.0.0.1' })
    );
  });

  it('should audit 2FA setup route rate limits', async () => {
    const req = new NextRequest('http://localhost/api/auth/2fa/setup', { method: 'POST', body: JSON.stringify({}) });
    const res = await setup2faRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_2FA_SETUP_RATE_LIMITED', key: 'auth:2fa:setup:127.0.0.1' })
    );
  });

  it('should audit verify email route rate limits', async () => {
    const req = new NextRequest('http://localhost/api/auth/verify-email', { method: 'POST', body: JSON.stringify({}) });
    const res = await verifyEmailRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_VERIFY_EMAIL_RATE_LIMITED', key: 'auth:verify-email:127.0.0.1' })
    );
  });

  it('should audit verification status route rate limits', async () => {
    const req = new NextRequest('http://localhost/api/auth/verification-status', { method: 'POST', body: JSON.stringify({}) });
    const res = await verificationStatusRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_VERIFICATION_STATUS_RATE_LIMITED',
        key: 'auth:verification-status:127.0.0.1',
      })
    );
  });

  it('should audit resend verification route rate limits', async () => {
    const req = new NextRequest('http://localhost/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({}) });
    const res = await resendVerificationRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_RESEND_VERIFICATION_RATE_LIMITED',
        key: 'auth:resend-verify:127.0.0.1',
      })
    );
  });
});
