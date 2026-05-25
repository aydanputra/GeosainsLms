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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const courseId = (req.nextUrl.searchParams.get('courseId') || '').trim();
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cursor = (req.nextUrl.searchParams.get('cursor') || '').trim();
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));

    const createdAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        ...(q
          ? {
              OR: [
                { user: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { user: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { course: { is: { slug: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        userId: true,
        courseId: true,
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, slug: true, totalLessons: true, deletedAt: true } },
      },
    });

    const hasMore = enrollments.length > limit;
    const page = hasMore ? enrollments.slice(0, limit) : enrollments;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const progressRows = await Promise.all(
      page
        .filter((e) => !e.course.deletedAt)
        .map(async (e) => {
          const totalLessons =
            typeof e.course.totalLessons === 'number' && e.course.totalLessons > 0
              ? e.course.totalLessons
              : await prisma.lesson.count({ where: { module: { courseId: e.courseId } } });
          const completedLessons = totalLessons
            ? await prisma.userProgress.count({
                where: {
                  userId: e.userId,
                  completed: true,
                  lesson: { module: { courseId: e.courseId } },
                },
              })
            : 0;
          const progressPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
          return {
            id: e.id,
            createdAt: e.createdAt,
            course: { id: e.course.id, title: e.course.title, slug: e.course.slug },
            student: { id: e.user.id, name: e.user.name || e.user.email, email: e.user.email },
            totalLessons,
            completedLessons,
            progressPercent,
          };
        })
    );

    return NextResponse.json({ enrollments: progressRows, nextCursor }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load enrollments' }, { status: 500 });
  }
}
