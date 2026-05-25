import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/modules/auth/utils/auth';
 
function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
 
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
 
export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
 
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 
    const cursor = req.nextUrl.searchParams.get('cursor');
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));
 
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: studentId, course: { deletedAt: null } },
      select: { courseId: true },
    });
    const courseIds = Array.from(new Set(enrollments.map((e) => e.courseId)));
 
    const createdAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;
 
    const where: Prisma.CourseReviewWhereInput = {
      userId: studentId,
      ...(courseIds.length ? { courseId: { in: courseIds } } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(q
        ? {
            OR: [
              { comment: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
            ],
          }
        : {}),
    };
 
    const reviews = await prisma.courseReview.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        course: { select: { id: true, title: true, slug: true } },
      },
    });
 
    const mapped = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      course: r.course,
    }));
 
    const page = mapped.slice(0, limit);
    const nextCursor = mapped.length > limit ? page[page.length - 1]?.id ?? null : null;
 
    return NextResponse.json({ reviews: page, nextCursor }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load reviews' }, { status: 500 });
  }
}
