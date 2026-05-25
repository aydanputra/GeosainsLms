import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { createToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { jwtVerify } from 'jose';
import { createDecipheriv, createHash, createHmac } from 'crypto';
import { writeAuditLog } from '@/utils/audit';

function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

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
    const ipRl = enforceRateLimit({ key: `auth:2fa:login:ip:${ip}`, limit: 50, windowMs: 15 * 60 * 1000 });
    if (!ipRl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(ipRl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { tempToken?: unknown; code?: unknown };
    const tempToken = typeof body.tempToken === 'string' ? body.tempToken : '';
    const code = typeof body.code === 'string' ? body.code : '';
    if (!tempToken) return NextResponse.json({ error: 'Token login tidak valid' }, { status: 400 });
    if (!code) return NextResponse.json({ error: 'Kode verifikasi wajib diisi' }, { status: 400 });

    const { payload } = await jwtVerify(tempToken, getJwtKey());
    if (payload?.purpose !== 'totp_login') return NextResponse.json({ error: 'Token login tidak valid' }, { status: 400 });

    const uid = String((payload as any)?.uid || '');
    const method = typeof (payload as any)?.method === 'string' ? String((payload as any).method) : 'password';
    if (!uid) return NextResponse.json({ error: 'Token login tidak valid' }, { status: 400 });

    const userRl = enforceRateLimit({ key: `auth:2fa:login:user:${uid}:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 });
    if (!userRl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan untuk akun ini. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(userRl.retryAfterSeconds) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, name: true, role: true, isSuperAdmin: true, totpEnabled: true, totpSecretEnc: true },
    });
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    if (!user.totpEnabled || !user.totpSecretEnc) return NextResponse.json({ error: '2FA tidak aktif' }, { status: 400 });

    const secret = decryptSecret(user.totpSecretEnc);
    if (!secret) return NextResponse.json({ error: 'Tidak bisa memverifikasi 2FA' }, { status: 400 });
    if (!verifyTotp(secret, code, 1)) return NextResponse.json({ error: 'Kode verifikasi tidak valid' }, { status: 400 });

    const authToken = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: Boolean((user as any).isSuperAdmin),
      totpEnabled: true,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isSuperAdmin: Boolean((user as any).isSuperAdmin),
        },
      },
      { status: 200 }
    );

    response.cookies.set('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    const sessionId = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
    })();

    response.cookies.set('sid', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    const country =
      (req as any)?.geo?.country ||
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      null;
    const city =
      (req as any)?.geo?.city ||
      req.headers.get('x-vercel-ip-city') ||
      req.headers.get('cf-ipcity') ||
      null;

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: method === 'google' ? 'AUTH_LOGIN_GOOGLE_TOTP' : 'AUTH_LOGIN_TOTP',
      entityType: 'User',
      entityId: String(user.id),
      metadata: { method, sessionId, country, city },
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Verifikasi 2FA gagal' }, { status: 401 });
  }
}

export const dynamic = 'force-dynamic';
