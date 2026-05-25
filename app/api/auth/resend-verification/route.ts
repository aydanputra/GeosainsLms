import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { enforceRateLimit, generateOpaqueToken, getClientIp, isSameOrigin, sha256Hex } from '@/modules/auth/utils/security';
import { sendEmail } from '@/utils/email';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:resend-verify:${ip}`, limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
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

    const rawToken = generateOpaqueToken(32);
    const tokenHash = sha256Hex(rawToken);
    await prisma.$transaction(async (tx: any) => {
      await tx.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    const verifyUrl = `${req.nextUrl.origin}/verify-email?token=${encodeURIComponent(rawToken)}`;
    await sendEmail({
      to: email,
      subject: 'Verifikasi Email - Geosains LMS',
      text: `Klik link berikut untuk verifikasi email Anda:\n${verifyUrl}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.`,
    });
    const devVerifyUrl = process.env.NODE_ENV !== 'production' ? verifyUrl : undefined;

    return NextResponse.json({ ok: true, sent: true, devVerifyUrl }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal mengirim ulang verifikasi' }, { status: 500 });
  }
}
