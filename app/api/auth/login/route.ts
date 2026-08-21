import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { createToken, verifyPassword } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog, writeRateLimitAuditLog } from '@/utils/audit';
import { SignJWT } from 'jose';
import { createPendingVerificationToken, setAuthCookies, setPendingVerificationCookie } from '@/modules/auth/utils/verificationAutoLogin';

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const ipRl = enforceRateLimit({ key: `auth:login:ip:${ip}`, limit: 25, windowMs: 15 * 60 * 1000 });
    if (!ipRl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_LOGIN_RATE_LIMITED',
        key: `auth:login:ip:${ip}`,
        retryAfterSeconds: ipRl.retryAfterSeconds,
        metadata: { scope: 'ip' },
      });
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(ipRl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body?.email === 'string' ? String(body.email).trim().toLowerCase() : '';
    if (email) {
      const emailRl = enforceRateLimit({ key: `auth:login:email:${email}:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 });
      if (!emailRl.ok) {
        await writeRateLimitAuditLog({
          req,
          action: 'AUTH_LOGIN_RATE_LIMITED',
          key: `auth:login:email:${email}:${ip}`,
          retryAfterSeconds: emailRl.retryAfterSeconds,
          metadata: { scope: 'email', email },
        });
        return NextResponse.json(
          { error: 'Terlalu banyak percobaan login untuk email ini. Coba lagi nanti.' },
          { status: 429, headers: { 'Retry-After': String(emailRl.retryAfterSeconds) } }
        );
      }
    }
    const password = typeof body?.password === 'string' ? String(body.password) : '';
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
    if (!password) return NextResponse.json({ error: 'Password wajib diisi' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, isSuperAdmin: true, emailVerifiedAt: true, password: true, totpEnabled: true, sessionVersion: true },
    });

    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    if (!user.emailVerifiedAt && user.role !== 'ADMIN') {
      const response = NextResponse.json({ error: 'Email belum terverifikasi', code: 'EMAIL_NOT_VERIFIED' }, { status: 403 });
      const pendingToken = await createPendingVerificationToken(String(user.id));
      setPendingVerificationCookie(response, pendingToken);
      return response;
    }

    if (user.totpEnabled) {
      const tempToken = await new SignJWT({ purpose: 'totp_login', uid: String(user.id), method: 'password' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(getSecretKey());

      return NextResponse.json(
        {
          code: 'TOTP_REQUIRED',
          tempToken,
          user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: Boolean((user as any).isSuperAdmin) },
        },
        { status: 200 }
      );
    }

    const token = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: Boolean((user as any).isSuperAdmin),
      totpEnabled: Boolean((user as any).totpEnabled),
      sessionVersion: Number((user as any).sessionVersion || 0),
    });

    const response = NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: Boolean((user as any).isSuperAdmin) }, token },
      { status: 200 }
    );

    const sessionId = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
    })();

    setAuthCookies(response, token, sessionId);

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
      actor: user?.id && user?.role ? { id: String(user.id), role: user.role } : null,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user?.id ? String(user.id) : null,
      metadata: { method: 'password', sessionId, country, city },
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Something went wrong',
        code: typeof error?.code === 'string' ? error.code : undefined,
      },
      { status: typeof error?.code === 'string' && error.code === 'EMAIL_NOT_VERIFIED' ? 403 : 401 }
    );
  }
}
