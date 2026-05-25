import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { hashPassword } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin, sha256Hex, validatePasswordStrength } from '@/modules/auth/utils/security';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:reset:${ip}`, limit: 20, windowMs: 30 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!token) return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 });

    const tokenHash = sha256Hex(token);
    const now = new Date();

    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!row || row.usedAt || row.expiresAt <= now) {
      return NextResponse.json({ error: 'Token tidak valid atau sudah kedaluwarsa' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, isSuperAdmin: true, role: true } });
    if (!target) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

    const pwCheck = validatePasswordStrength(password, {
      minLength: target.role === 'ADMIN' && (target as any).isSuperAdmin ? 12 : 8,
      strict: Boolean(target.role === 'ADMIN' && (target as any).isSuperAdmin),
    });
    if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.error }, { status: 400 });

    const hashed = await hashPassword(password);
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({ where: { id: row.userId }, data: { password: hashed } });
      await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: now } });
      await tx.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null, id: { not: row.id } } });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal reset password' }, { status: 500 });
  }
}
