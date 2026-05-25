import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function getAdminPredicate() {
  return {
    OR: [
      { title: { startsWith: 'Admin' } },
      { title: { startsWith: 'Kebijakan' } },
      { title: { startsWith: 'Program' } },
      { title: { startsWith: 'Promo' } },
      { title: { startsWith: 'Diskon' } },
    ],
  };
}

function getMessagePredicate() {
  return {
    OR: [
      ...(getAdminPredicate().OR as any[]),
      { title: { startsWith: 'Pesan dari' } },
      { title: { startsWith: 'Direct Message' } },
      { title: { startsWith: 'DM' } },
      { title: { startsWith: 'Pesan Kursus' } },
      { title: { startsWith: 'Pesan Produk' } },
      { title: { startsWith: 'Komentar' } },
      { title: { startsWith: 'Q&A' } },
      { title: { startsWith: 'Balasan dari' } },
      { title: { startsWith: 'Tugas' } },
      { title: { startsWith: 'Pelajaran' } },
      { title: { startsWith: 'Materi' } },
    ],
  };
}

function getEnrollmentPredicate() {
  return {
    OR: [
      { title: { startsWith: 'Pendaftaran' } },
      { title: { contains: 'enroll', mode: 'insensitive' } },
      { message: { contains: 'enroll', mode: 'insensitive' } },
    ],
  };
}

function getPurchasePredicate() {
  return {
    OR: [
      { title: { startsWith: 'Pembelian' } },
      { title: { startsWith: 'Pesanan' } },
      { title: { contains: 'order', mode: 'insensitive' } },
      { message: { contains: 'order', mode: 'insensitive' } },
    ],
  };
}

function getKindWhere(kind: string | null) {
  const normalized = typeof kind === 'string' ? kind.toLowerCase() : 'all';
  if (normalized === 'messages') return getMessagePredicate();
  if (normalized === 'alerts') return { NOT: getMessagePredicate() };
  return {};
}

function getScopeWhere(scope: string | null) {
  const normalized = typeof scope === 'string' ? scope.toLowerCase() : 'all';
  if (normalized === 'admin') return getAdminPredicate();
  if (normalized === 'enrollments') return getEnrollmentPredicate();
  if (normalized === 'purchases') return getPurchasePredicate();
  if (normalized === 'general') return { AND: [{ NOT: getMessagePredicate() }, { NOT: getEnrollmentPredicate() }, { NOT: getPurchasePredicate() }] };
  if (normalized === 'messages') return getMessagePredicate();
  if (normalized === 'alerts') return { NOT: getMessagePredicate() };
  return {};
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === '1';
    const kind = req.nextUrl.searchParams.get('kind');
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 50));
    const kindWhere = getKindWhere(kind);

    const notifications = await prisma.notification.findMany({
      where: { userId: String(user.id), ...(unreadOnly ? { read: false } : {}), ...(kindWhere as any) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: String(user.id), read: false, ...(kindWhere as any) },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { all?: unknown; ids?: unknown; kind?: unknown };
    const all = body.all === true;
    const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === 'string') : [];
    const kind = typeof body.kind === 'string' ? body.kind : null;
    const kindWhere = getKindWhere(kind);

    if (!all && ids.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const result = all
      ? await prisma.notification.updateMany({
          where: { userId: String(user.id), read: false, ...(kindWhere as any) },
          data: { read: true },
        })
      : await prisma.notification.updateMany({
          where: { userId: String(user.id), id: { in: ids } },
          data: { read: true },
        });

    const unreadCount = await prisma.notification.count({
      where: { userId: String(user.id), read: false, ...(kindWhere as any) },
    });

    return NextResponse.json({ ok: true, updatedCount: result.count, unreadCount }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = req.nextUrl.searchParams.get('scope');
    const scopeWhere = getScopeWhere(scope);

    const result = await prisma.notification.deleteMany({
      where: { userId: String(user.id), ...(scopeWhere as any) },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: String(user.id), read: false },
    });

    return NextResponse.json({ ok: true, deletedCount: result.count, unreadCount }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete notifications' }, { status: 500 });
  }
}
