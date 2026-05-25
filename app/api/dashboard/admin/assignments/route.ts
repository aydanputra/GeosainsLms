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

    const assignments = await prisma.assignment.findMany({
      where: {
        ...(courseId && courseId !== 'ALL' ? { lesson: { module: { courseId } } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { lesson: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { lesson: { is: { module: { is: { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        description: true,
        timeLimit: true,
        passingGrade: true,
        maxFileSize: true,
        createdAt: true,
        updatedAt: true,
        lessonId: true,
        lesson: {
          select: {
            id: true,
            title: true,
            module: { select: { course: { select: { id: true, title: true, slug: true } } } },
          },
        },
        _count: { select: { submissions: true } },
      },
    });

    const hasMore = assignments.length > limit;
    const page = hasMore ? assignments.slice(0, limit) : assignments;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const ids = page.map((a) => a.id);
    const submissionStats = ids.length
      ? await prisma.assignmentSubmission.groupBy({
          by: ['assignmentId'],
          where: { assignmentId: { in: ids } },
          _max: { submittedAt: true },
          _count: { _all: true },
        })
      : [];
    const statsMap = new Map<string, { lastSubmittedAt: Date | null; total: number }>();
    for (const s of submissionStats) {
      statsMap.set(String(s.assignmentId), { lastSubmittedAt: s._max.submittedAt ?? null, total: s._count._all ?? 0 });
    }

    return NextResponse.json(
      {
        assignments: page.map((a) => {
          const stats = statsMap.get(a.id) || { lastSubmittedAt: null, total: a._count.submissions };
          return {
            id: a.id,
            title: a.title,
            passingGrade: a.passingGrade ?? 0,
            timeLimit: a.timeLimit ?? null,
            maxFileSize: a.maxFileSize ?? 5,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            course: {
              id: a.lesson.module.course.id,
              title: a.lesson.module.course.title,
              slug: a.lesson.module.course.slug,
            },
            lesson: { id: a.lesson.id, title: a.lesson.title },
            submissionsCount: stats.total,
            lastSubmittedAt: stats.lastSubmittedAt,
          };
        }),
        nextCursor,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load assignments' }, { status: 500 });
  }
}
