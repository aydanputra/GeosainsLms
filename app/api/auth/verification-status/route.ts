import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { createToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import {
  clearPendingVerificationCookie,
  createPasswordSetupToken,
  getDashboardPathByRole,
  readPendingVerificationCookie,
  setAuthCookies,
  setPasswordSetupCookie,
} from '@/modules/auth/utils/verificationAutoLogin';
import { writeAuditLog, writeRateLimitAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:verification-status:${ip}`, limit: 60, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_VERIFICATION_STATUS_RATE_LIMITED',
        key: `auth:verification-status:${ip}`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, isSuperAdmin: true, emailVerifiedAt: true, totpEnabled: true, sessionVersion: true },
    });

    if (!user) {
      return NextResponse.json({ verified: false, autoLogin: false }, { status: 200 });
    }

    if (!user.emailVerifiedAt) {
      return NextResponse.json({ verified: false, autoLogin: false }, { status: 200 });
    }

    const pending = await readPendingVerificationCookie(req);
    const passwordSetupRequired = Boolean(pending?.uid === String(user.id) && pending?.allowPasswordSetup && pending?.source === 'google');
    const redirectTo = passwordSetupRequired
      ? '/dashboard/settings?tab=basic&intent=set-password'
      : getDashboardPathByRole(user.role);
    const canAutoLogin =
      pending?.uid === String(user.id) &&
      user.role !== 'ADMIN' &&
      !Boolean((user as any).totpEnabled);

    if (!canAutoLogin) {
      const response = NextResponse.json(
        {
          verified: true,
          autoLogin: false,
          redirectTo,
          passwordSetupRequired,
        },
        { status: 200 }
      );
      clearPendingVerificationCookie(response);
      return response;
    }

    const authToken = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: Boolean((user as any).isSuperAdmin),
      totpEnabled: Boolean((user as any).totpEnabled),
      sessionVersion: Number((user as any).sessionVersion || 0),
    });

    const sessionId = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
    })();

    const response = NextResponse.json(
      {
        verified: true,
        autoLogin: true,
        redirectTo,
        passwordSetupRequired,
      },
      { status: 200 }
    );

    setAuthCookies(response, authToken, sessionId);
    if (passwordSetupRequired) {
      const passwordSetupToken = await createPasswordSetupToken(String(user.id), { source: 'google' });
      setPasswordSetupCookie(response, passwordSetupToken);
    }
    clearPendingVerificationCookie(response);

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'AUTH_VERIFY_EMAIL_STATUS_AUTO_LOGIN',
      entityType: 'User',
      entityId: String(user.id),
      metadata: { sessionId, method: 'verification_status_poll' },
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memeriksa status verifikasi' }, { status: 500 });
  }
}
