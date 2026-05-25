import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/modules/auth/api/service';
import { prisma } from '@/utils/prisma';
import { enforceRateLimit, generateOpaqueToken, getClientIp, isSameOrigin, sha256Hex } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';
import { sendEmail } from '@/utils/email';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:register:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedRole = typeof (body as any)?.role === 'string' ? String((body as any).role).trim().toUpperCase() : '';
    const requestedMentor = requestedRole === 'MENTOR';

    const user = await registerUser(body);
    await writeAuditLog({
      req,
      actor: user?.id && user?.role ? { id: String((user as any).id), role: (user as any).role } : null,
      action: 'AUTH_REGISTER',
      entityType: 'User',
      entityId: typeof (user as any)?.id === 'string' ? (user as any).id : null,
      metadata: { method: 'password' },
    });

    const emailVerifiedAt = (user as any)?.emailVerifiedAt ? new Date((user as any).emailVerifiedAt as any) : null;
    const needsEmailVerification = !emailVerifiedAt;
    const rawToken = needsEmailVerification ? generateOpaqueToken(32) : null;
    const verifyUrl = rawToken ? `${req.nextUrl.origin}/verify-email?token=${encodeURIComponent(rawToken)}` : null;
    if (rawToken) {
      const tokenHash = sha256Hex(rawToken);
      await prisma.emailVerificationToken.create({
        data: {
          userId: String((user as any).id),
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      const email = typeof (user as any)?.email === 'string' ? (user as any).email.trim().toLowerCase() : '';
      if (email && verifyUrl) {
        await sendEmail({
          to: email,
          subject: 'Verifikasi Email - Geosains LMS',
          text: `Klik link berikut untuk verifikasi email Anda:\n${verifyUrl}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.`,
        });
      }
    }

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', NOT: { id: String((user as any)?.id || '') } },
      select: { id: true },
    });

    if (admins.length) {
      const name = typeof (user as any)?.name === 'string' ? (user as any).name : '';
      const email = typeof (user as any)?.email === 'string' ? (user as any).email : '';
      const userId = typeof (user as any)?.id === 'string' ? (user as any).id : '';
      const role = typeof (user as any)?.role === 'string' ? (user as any).role : 'STUDENT';
      const title = requestedMentor ? 'Pendaftaran Mentor (Pending)' : 'Pendaftaran Baru';
      const message =
        `User baru mendaftar\nNama: ${name || '-'}\nEmail: ${email || '-'}\nRole: ${role}\nRequestedRole: ${requestedMentor ? 'MENTOR' : 'STUDENT'}\nUserId: ${userId}\nMetode: Email/Password\nLINK:/dashboard/admin/users`;
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title,
          message,
          read: false,
        })),
      });
    }

    const devVerifyUrl = process.env.NODE_ENV !== 'production' && verifyUrl ? verifyUrl : undefined;

    return NextResponse.json(
      { user, verificationSent: needsEmailVerification, devVerifyUrl },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 400 }
    );
  }
}
