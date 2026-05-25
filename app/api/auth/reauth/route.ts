import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken, verifyPassword } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { SignJWT } from 'jose';

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const actor = await prisma.user.findUnique({
      where: { id: String(user.id) },
      select: { id: true, password: true, isSuperAdmin: true },
    });
    if (!actor?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password tidak valid' }, { status: 400 });

    const ok = actor.password ? await verifyPassword(password, actor.password) : false;
    if (!ok) return NextResponse.json({ error: 'Password salah' }, { status: 401 });

    const reauthToken = await new SignJWT({ purpose: 'super_admin_reauth', uid: actor.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(getSecretKey());

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set('super_admin_reauth', reauthToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
