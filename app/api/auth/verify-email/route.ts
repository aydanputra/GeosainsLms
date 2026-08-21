import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { enforceRateLimit, getClientIp, sha256Hex } from '@/modules/auth/utils/security';
import { createToken } from '@/modules/auth/utils/auth';
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
    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:verify-email:${ip}`, limit: 30, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_VERIFY_EMAIL_RATE_LIMITED',
        key: `auth:verify-email:${ip}`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 });

    const tokenHash = sha256Hex(token);
    const now = new Date();

    const row = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, emailVerifiedAt: true, role: true, isSuperAdmin: true, totpEnabled: true, sessionVersion: true } } },
    });

    if (!row || row.usedAt || row.expiresAt <= now) {
      return NextResponse.json({ error: 'Token tidak valid atau sudah kedaluwarsa' }, { status: 400 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      });
      if (!row.user.emailVerifiedAt) {
        await tx.user.update({ where: { id: row.user.id }, data: { emailVerifiedAt: now } });
      }
      await tx.emailVerificationToken.deleteMany({
        where: { userId: row.user.id, usedAt: null, id: { not: row.id } },
      });
    });

    const pending = await readPendingVerificationCookie(req);
    const passwordSetupRequired = Boolean(pending?.allowPasswordSetup && pending?.source === 'google');
    const redirectTo = passwordSetupRequired
      ? '/dashboard/settings?tab=basic&intent=set-password'
      : getDashboardPathByRole(row.user.role);
    const response = NextResponse.json(
      {
        ok: true,
        autoLogin: false,
        redirectTo,
        passwordSetupRequired,
      },
      { status: 200 }
    );

    const canAutoLogin =
      pending?.uid === String(row.user.id) &&
      row.user.role !== 'ADMIN' &&
      !Boolean((row.user as any).totpEnabled);

    if (!canAutoLogin) {
      clearPendingVerificationCookie(response);
      return response;
    }

    const authToken = await createToken({
      id: row.user.id,
      email: row.user.email,
      role: row.user.role,
      isSuperAdmin: Boolean((row.user as any).isSuperAdmin),
      totpEnabled: Boolean((row.user as any).totpEnabled),
      sessionVersion: Number((row.user as any).sessionVersion || 0),
    });

    const sessionId = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
    })();

    const autoLoginResponse = NextResponse.json(
      {
        ok: true,
        autoLogin: true,
        redirectTo,
        passwordSetupRequired,
      },
      { status: 200 }
    );

    setAuthCookies(autoLoginResponse, authToken, sessionId);
    if (passwordSetupRequired) {
      const passwordSetupToken = await createPasswordSetupToken(String(row.user.id), { source: 'google' });
      setPasswordSetupCookie(autoLoginResponse, passwordSetupToken);
    }
    clearPendingVerificationCookie(autoLoginResponse);

    await writeAuditLog({
      req,
      actor: { id: String(row.user.id), role: row.user.role },
      action: 'AUTH_VERIFY_EMAIL_AUTO_LOGIN',
      entityType: 'User',
      entityId: String(row.user.id),
      metadata: { sessionId, method: 'email_verification' },
    });

    return autoLoginResponse;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal verifikasi email' }, { status: 500 });
  }
}
