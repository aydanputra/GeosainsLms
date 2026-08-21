import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { createToken, verifyPassword, verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { createDecipheriv, createHash, createHmac } from 'crypto';
import { writeAuditLog, writeRateLimitAuditLog } from '@/utils/audit';

function getEncKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return createHash('sha256').update(secret).digest();
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_LOOKUP: Record<string, number> = Object.fromEntries(BASE32_ALPHABET.split('').map((c, i) => [c, i]));

function base32Decode(input: string) {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of cleaned) {
    const v = BASE32_LOOKUP[ch];
    if (typeof v !== 'number') continue;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function hotp(secret: Uint8Array, counter: number) {
  const buf = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  buf.writeUInt32BE(high >>> 0, 0);
  buf.writeUInt32BE(low, 4);
  const h = createHmac('sha1', Buffer.from(secret)).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function verifyTotp(secretBase32: string, code: string, window = 1) {
  const normalized = String(code || '').replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  const secret = base32Decode(secretBase32);
  if (!secret.length) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (hotp(secret, step + w) === normalized) return true;
  }
  return false;
}

function decryptSecret(enc: string) {
  const parts = String(enc || '').split('.');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ct = Buffer.from(ctB64, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', getEncKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString('utf8');
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:2fa:disable:${ip}`, limit: 25, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_2FA_DISABLE_RATE_LIMITED',
        key: `auth:2fa:disable:${ip}`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = String(payload.id);

    const body = (await req.json().catch(() => ({}))) as { currentPassword?: unknown; code?: unknown };
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const code = typeof body.code === 'string' ? body.code : '';
    if (!currentPassword) return NextResponse.json({ error: 'Password saat ini wajib diisi' }, { status: 400 });
    if (!code) return NextResponse.json({ error: 'Kode verifikasi wajib diisi' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, role: true, isSuperAdmin: true, password: true, totpEnabled: true, totpSecretEnc: true },
    });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.totpEnabled || !user.totpSecretEnc) return NextResponse.json({ error: 'Verifikasi 2 langkah belum aktif' }, { status: 400 });

    const ok = await verifyPassword(currentPassword, user.password);
    if (!ok) return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });

    const secret = decryptSecret(user.totpSecretEnc);
    if (!secret) return NextResponse.json({ error: 'Tidak bisa memverifikasi 2FA' }, { status: 400 });
    if (!verifyTotp(secret, code, 1)) return NextResponse.json({ error: 'Kode verifikasi tidak valid' }, { status: 400 });

    const updatedUser = await prisma.user.update({
      where: { id: uid },
      data: {
        totpEnabled: false,
        totpSecretEnc: null,
        totpVerifiedAt: null,
        sessionVersion: { increment: 1 },
      },
      select: { id: true, email: true, role: true, isSuperAdmin: true, sessionVersion: true },
    });

    const actorRoleRaw = typeof (payload as any)?.role === 'string' ? String((payload as any).role).toUpperCase() : '';
    const actorRole = (actorRoleRaw === 'ADMIN' || actorRoleRaw === 'MENTOR' || actorRoleRaw === 'STUDENT' ? actorRoleRaw : user.role) as any;

    await writeAuditLog({
      req,
      actor: { id: uid, role: actorRole },
      action: 'AUTH_TOTP_DISABLE',
      entityType: 'User',
      entityId: uid,
      metadata: { method: 'totp' },
    });

    const authToken = await createToken({
      id: uid,
      email: String(updatedUser.email || ''),
      role: actorRole,
      isSuperAdmin: Boolean((updatedUser as any)?.isSuperAdmin),
      totpEnabled: false,
      sessionVersion: Number((updatedUser as any)?.sessionVersion || 0),
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menonaktifkan 2FA' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
