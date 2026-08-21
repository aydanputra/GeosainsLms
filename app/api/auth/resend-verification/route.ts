import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { issueVerificationEmail } from '@/modules/auth/utils/emailVerification';
import { getAppUrl } from '@/modules/core/utils/appUrl';
import { writeRateLimitAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:resend-verify:${ip}`, limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_RESEND_VERIFICATION_RATE_LIMITED',
        key: `auth:resend-verify:${ip}`,
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
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true },
    });

    if (!user || user.emailVerifiedAt) {
      return NextResponse.json({ ok: true, sent: true }, { status: 200 });
    }

    const issued = await issueVerificationEmail({
      userId: String(user.id),
      email,
      origin: getAppUrl(req.headers),
    });
    const devVerifyUrl = process.env.NODE_ENV !== 'production' ? issued.verifyUrl : undefined;

    return NextResponse.json({ ok: true, sent: true, devVerifyUrl }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal mengirim ulang verifikasi' }, { status: 500 });
  }
}
