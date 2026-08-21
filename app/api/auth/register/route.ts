import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/modules/auth/api/service';
import { prisma } from '@/utils/prisma';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog, writeRateLimitAuditLog } from '@/utils/audit';
import { issueVerificationEmail } from '@/modules/auth/utils/emailVerification';
import { getAppUrl } from '@/modules/core/utils/appUrl';
import { createPendingVerificationToken, setPendingVerificationCookie } from '@/modules/auth/utils/verificationAutoLogin';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const ip = getClientIp(req);
    const rl = enforceRateLimit({ key: `auth:register:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      await writeRateLimitAuditLog({
        req,
        action: 'AUTH_REGISTER_RATE_LIMITED',
        key: `auth:register:${ip}`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
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
    let verifyUrl: string | null = null;
    if (needsEmailVerification) {
      const email = typeof (user as any)?.email === 'string' ? (user as any).email.trim().toLowerCase() : '';
      if (email) {
        const issued = await issueVerificationEmail({
          userId: String((user as any).id),
          email,
          name: typeof (user as any)?.name === 'string' ? (user as any).name : '',
          origin: getAppUrl(req.headers),
        });
        verifyUrl = issued.verifyUrl;
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

    const response = NextResponse.json(
      { user, verificationSent: needsEmailVerification, devVerifyUrl },
      { status: 201 }
    );
    if (needsEmailVerification && (user as any)?.id) {
      const pendingToken = await createPendingVerificationToken(String((user as any).id));
      setPendingVerificationCookie(response, pendingToken);
    }
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 400 }
    );
  }
}
