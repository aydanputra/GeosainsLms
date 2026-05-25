import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

const SETTINGS_SLUG = '__course_settings__';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const page = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
    const settings = safeParse(page?.content);
    const enabled = settings['becomeInstructorButtonEnabled'] === true;
    if (!enabled) return NextResponse.json({ error: 'Fitur tidak aktif' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { message?: unknown };
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true },
    });

    if (admins.length === 0) return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 500 });

    const requester = await prisma.user.findUnique({
      where: { id: String(user.id) },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!requester) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    if (requester.role !== 'STUDENT') return NextResponse.json({ error: 'Permintaan hanya untuk siswa' }, { status: 400 });

    const title = 'Permintaan menjadi instruktur';
    const detail = message ? `\n\nPesan: ${message}` : '';
    const notifMessage = `User: ${requester.name || requester.email}\nEmail: ${requester.email}\nUserId: ${requester.id}${detail}`;

    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title,
        message: notifMessage,
        read: false,
      })),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengirim permintaan' }, { status: 500 });
  }
}

