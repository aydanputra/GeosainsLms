import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = req.cookies.get('token')?.value;
    const sid = req.cookies.get('sid')?.value || null;

    const payload = token ? await verifyToken(token).catch(() => null) : null;
    const actorId = payload?.id ? String(payload.id) : null;
    const actorRole = payload?.role || null;

    if (actorId && actorRole) {
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
        actor: { id: actorId, role: actorRole },
        action: 'AUTH_LOGOUT',
        entityType: 'User',
        entityId: actorId,
        metadata: { sessionId: sid, logoutAt: new Date().toISOString(), country, city },
      });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 0, path: '/' });
    res.cookies.set('sid', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 0, path: '/' });
    return res;
  } catch (error: any) {
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 0, path: '/' });
    res.cookies.set('sid', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 0, path: '/' });
    return res;
  }
}
