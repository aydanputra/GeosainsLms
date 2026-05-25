import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyPassword, verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { SignJWT } from 'jose';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:2fa:setup:${ip}`, limit: 25, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { currentPassword?: unknown };
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!currentPassword) return NextResponse.json({ error: 'Password saat ini wajib diisi' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: String(payload.id) },
      select: { id: true, email: true, name: true, password: true, totpEnabled: true },
    });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.totpEnabled) return NextResponse.json({ error: 'Verifikasi 2 langkah sudah aktif' }, { status: 400 });

    const ok = await verifyPassword(currentPassword, user.password);
    if (!ok) return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });

    const secretBytes = new Uint8Array(randomBytes(20));
    const secret = base32Encode(secretBytes);
    const issuer = 'Geosains LMS';
    const label = `${issuer}:${user.email}`;
    const otpauthUrl =
      `otpauth://totp/${encodeURIComponent(label)}` +
      `?secret=${encodeURIComponent(secret)}` +
      `&issuer=${encodeURIComponent(issuer)}` +
      `&algorithm=SHA1&digits=6&period=30`;

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });

    const setupJwt = await new SignJWT({ purpose: 'totp_setup', uid: String(user.id), secret })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(getSecretKey());

    const res = NextResponse.json({ otpauthUrl, qrDataUrl, secret }, { status: 200 });
    res.cookies.set('totp_setup', setupJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60,
      path: '/',
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memulai setup 2FA' }, { status: 500 });
  }
}
