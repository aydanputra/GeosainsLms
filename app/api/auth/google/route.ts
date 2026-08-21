import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import { prisma } from '@/utils/prisma';
import { createToken, hashPassword } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog, writeRateLimitAuditLog } from '@/utils/audit';
import { issueVerificationEmail } from '@/modules/auth/utils/emailVerification';
import { getAppUrl } from '@/modules/core/utils/appUrl';
import { createPendingVerificationToken, setAuthCookies, setPendingVerificationCookie } from '@/modules/auth/utils/verificationAutoLogin';
import fs from 'fs';
import path from 'path';

const BodySchema = z.object({
  credential: z.string().min(1),
});

const GoogleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

function isPlaceholderClientId(value: string) {
  const v = value.trim().toLowerCase();
  return v === 'your-google-client-id.apps.googleusercontent.com' || v.startsWith('your-goo');
}

function readGoogleClientIdFromDotenvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const pick = (key: string) => {
      const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`);
      for (const line of lines) {
        if (!line || line.trim().startsWith('#')) continue;
        const m = line.match(re);
        if (!m) continue;
        let value = String(m[1] || '').trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1).trim();
        }
        return value || null;
      }
      return null;
    };

    return pick('GOOGLE_CLIENT_ID') || pick('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
  } catch {
    return null;
  }
}

function getGoogleClientId() {
  const fromEnv = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  if (fromEnv && !isPlaceholderClientId(fromEnv)) return fromEnv;
  const fromFile = readGoogleClientIdFromDotenvFile() || '';
  if (fromFile && !isPlaceholderClientId(fromFile)) return fromFile;
  return fromEnv || fromFile || null;
}

export async function GET() {
  const googleClientId = getGoogleClientId();
  return NextResponse.json(
    {
      clientId: googleClientId,
      env: {
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || null,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null,
        NODE_ENV: process.env.NODE_ENV || null,
      },
      file: {
        clientId: readGoogleClientIdFromDotenvFile(),
        cwd: process.cwd(),
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:google:${ip}`, limit: 25, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_GOOGLE_RATE_LIMITED',
        key: `auth:google:${ip}`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const googleClientId = getGoogleClientId();
    if (!googleClientId) {
      return NextResponse.json({ error: 'GOOGLE_CLIENT_ID belum dikonfigurasi' }, { status: 500 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 });
    }

    const { credential } = parsed.data;
    const { payload } = await jwtVerify(credential, GoogleJwks, {
      audience: googleClientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const picture = typeof payload.picture === 'string' ? payload.picture.trim() : '';
    const emailVerified = payload.email_verified === true;

    if (!email) {
      return NextResponse.json({ error: 'Email Google tidak ditemukan' }, { status: 400 });
    }
    if (!emailVerified) {
      return NextResponse.json({ error: 'Email Google belum terverifikasi' }, { status: 400 });
    }

    let createdNew = false;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const randomPassword = randomBytes(24).toString('base64url');
      const hashedPassword = await hashPassword(randomPassword);
      user = await prisma.user.create({
        data: {
          email,
          name: name || null,
          avatarUrl: picture || null,
          password: hashedPassword,
          role: 'STUDENT',
          emailVerifiedAt: null,
        },
      });
      createdNew = true;
    } else {
      const shouldUpdate =
        (name && !user.name) ||
        (picture && (!user.avatarUrl || user.avatarUrl.startsWith('blob:')));
      if (shouldUpdate) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: user.name || (name || null),
            avatarUrl: user.avatarUrl || (picture || null),
          },
        });
      }
    }

    if (createdNew) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', NOT: { id: user.id } },
        select: { id: true },
      });
      if (admins.length) {
        const title = 'Pendaftaran Baru';
        const message = `User baru mendaftar\nNama: ${user.name || '-'}\nEmail: ${user.email}\nRole: ${user.role}\nUserId: ${user.id}\nMetode: Google\nLINK:/dashboard/admin/users`;
        await prisma.notification.createMany({
          data: admins.map((a: { id: string }) => ({
            userId: a.id,
            title,
            message,
            read: false,
          })),
        });
      }
    }

    if (!user.emailVerifiedAt && user.role !== 'ADMIN') {
      const issued = await issueVerificationEmail({
        userId: String(user.id),
        email,
        name: user.name || name || null,
        origin: getAppUrl(req.headers),
      });
      const devVerifyUrl = process.env.NODE_ENV !== 'production' ? issued.verifyUrl : undefined;
      const response = NextResponse.json(
        {
          verificationSent: true,
          createdNew,
          devVerifyUrl,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatarUrl: user.avatarUrl,
            isSuperAdmin: Boolean((user as any).isSuperAdmin),
          },
        },
        { status: 200 }
      );
      const pendingToken = await createPendingVerificationToken(String(user.id), {
        source: 'google',
        allowPasswordSetup: createdNew,
      });
      setPendingVerificationCookie(response, pendingToken);
      return response;
    }

    if (Boolean((user as any).totpEnabled)) {
      const tempToken = await new SignJWT({ purpose: 'totp_login', uid: String(user.id), method: 'google' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(getSecretKey());

      return NextResponse.json(
        {
          code: 'TOTP_REQUIRED',
          tempToken,
          createdNew,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatarUrl: user.avatarUrl,
            isSuperAdmin: Boolean((user as any).isSuperAdmin),
          },
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
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          isSuperAdmin: Boolean((user as any).isSuperAdmin),
        },
        token,
        createdNew,
      },
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
      actor: { id: String(user.id), role: user.role },
      action: 'AUTH_LOGIN_GOOGLE',
      entityType: 'User',
      entityId: String(user.id),
      metadata: { method: 'google', createdNew, sessionId, country, city },
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Google login failed' },
      { status: 401 }
    );
  }
}
