import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { enforceRateLimit, getClientIp, sha256Hex } from '@/modules/auth/utils/security';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:verify-email:${ip}`, limit: 30, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
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
      include: { user: { select: { id: true, emailVerifiedAt: true } } },
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal verifikasi email' }, { status: 500 });
  }
}
