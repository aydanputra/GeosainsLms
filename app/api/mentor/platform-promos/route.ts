import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';

async function requireMentorOrAdmin(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return null;
  return user;
}

async function assertCourseAccess(user: any, courseId: string) {
  if (user.role === 'ADMIN') return true;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, instructorId: true, deletedAt: true } });
  if (!course || course.deletedAt) return false;
  if (String(course.instructorId) === String(user.id)) return true;
  const co = await prisma.courseCoInstructor.findFirst({ where: { courseId, userId: String(user.id) }, select: { id: true } });
  return Boolean(co);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireMentorOrAdmin(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const courseId = req.nextUrl.searchParams.get('courseId')?.trim() || '';
    if (courseId) {
      const ok = await assertCourseAccess(user, courseId);
      if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const promos = await prisma.coupon.findMany({
      where: {
        allowMentorOptIn: true,
        isActive: true,
        scope: 'COURSES',
        funding: { in: ['MARKETPLACE', 'SPLIT'] },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        code: true,
        type: true,
        amount: true,
        funding: true,
        marketplaceSharePercent: true,
        maxDiscount: true,
        minSubtotal: true,
        startsAt: true,
        expiresAt: true,
        courseIds: true,
      },
    });

    return NextResponse.json(
      promos.map((p) => ({
        id: p.id,
        code: p.code,
        type: p.type,
        amount: p.amount,
        funding: p.funding,
        marketplaceSharePercent: p.marketplaceSharePercent,
        maxDiscount: p.maxDiscount,
        minSubtotal: p.minSubtotal,
        startsAt: p.startsAt ? p.startsAt.toISOString() : null,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
        joined: courseId ? p.courseIds.includes(courseId) : false,
      }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat promo platform' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const user = await requireMentorOrAdmin(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action.trim().toUpperCase() : '';
    const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : '';
    const couponId = typeof body?.couponId === 'string' ? body.couponId.trim() : '';
    if (!courseId || !couponId) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    if (action !== 'JOIN' && action !== 'LEAVE') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const ok = await assertCourseAccess(user, courseId);
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      select: {
        id: true,
        isActive: true,
        allowMentorOptIn: true,
        scope: true,
        funding: true,
        startsAt: true,
        expiresAt: true,
        courseIds: true,
      },
    });
    if (!coupon || !coupon.isActive || !coupon.allowMentorOptIn) return NextResponse.json({ error: 'Promo tidak tersedia' }, { status: 404 });
    if (coupon.scope !== 'COURSES') return NextResponse.json({ error: 'Promo tidak bisa diikuti untuk kursus' }, { status: 400 });
    if (coupon.funding === 'STORE') return NextResponse.json({ error: 'Promo bukan diskon marketplace' }, { status: 400 });
    if (coupon.startsAt && coupon.startsAt > now) return NextResponse.json({ error: 'Promo belum berlaku' }, { status: 400 });
    if (coupon.expiresAt && coupon.expiresAt <= now) return NextResponse.json({ error: 'Promo sudah berakhir' }, { status: 400 });

    const nextIds =
      action === 'JOIN'
        ? Array.from(new Set([...(coupon.courseIds || []), courseId]))
        : (coupon.courseIds || []).filter((id) => id !== courseId);

    const updated = await prisma.coupon.update({
      where: { id: coupon.id },
      data: { courseIds: nextIds },
      select: { id: true, courseIds: true },
    });

    return NextResponse.json({ ok: true, joined: updated.courseIds.includes(courseId) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan promo' }, { status: 500 });
  }
}

