import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { enforceRateLimit, generateOpaqueToken, getClientIp, isSameOrigin, sha256Hex } from '@/modules/auth/utils/security';
import { sendEmail } from '@/utils/email';
import { getAppUrl } from '@/modules/core/utils/appUrl';
import { writeRateLimitAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:forgot:${ip}`, limit: 8, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_FORGOT_PASSWORD_RATE_LIMITED',
        key: `auth:forgot:${ip}`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: true, sent: true }, { status: 200 });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ ok: true, sent: true }, { status: 200 });
    }

    const rawToken = generateOpaqueToken(32);
    const tokenHash = sha256Hex(rawToken);
    await prisma.$transaction(async (tx: any) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    });

    const resetUrl = `${getAppUrl(req.headers)}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendEmail({
      to: email,
      subject: 'Reset Password - Geosains LMS',
      text: `Klik link berikut untuk reset password Anda:\n${resetUrl}\n\nLink ini berlaku 1 jam. Jika Anda tidak meminta reset, abaikan email ini.`,
    });
    const devResetUrl = process.env.NODE_ENV !== 'production' ? resetUrl : undefined;

    return NextResponse.json({ ok: true, sent: true, devResetUrl }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memproses permintaan' }, { status: 500 });
  }
}
