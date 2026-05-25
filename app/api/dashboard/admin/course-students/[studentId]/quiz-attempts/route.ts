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
    const status = (req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));
 
    const normalizedStatus = status === 'PASSED' || status === 'FAILED' || status === 'INCOMPLETE' || status === 'ALL' ? status : 'ALL';
 
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: studentId, course: { deletedAt: null } },
      select: { courseId: true },
    });
    const courseIds = Array.from(new Set(enrollments.map((e) => e.courseId)));
 
    const startedAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;
 
    const completedAtConstraint =
      normalizedStatus === 'INCOMPLETE'
        ? { completedAt: null }
        : normalizedStatus === 'PASSED' || normalizedStatus === 'FAILED'
          ? { completedAt: { not: null } }
          : { completedAt: { not: null } };
 
    const where: Prisma.QuizAttemptWhereInput = {
      userId: studentId,
      quiz: { is: { lesson: { is: { module: { is: { courseId: { in: courseIds } } } } } } },
      ...completedAtConstraint,
      ...(startedAtFilter ? { startedAt: startedAtFilter } : {}),
      ...(q
        ? {
            OR: [
              { quiz: { is: { lesson: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } },
              { quiz: { is: { lesson: { is: { module: { is: { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } } } } } },
            ],
          }
        : {}),
    };
 
    const attempts = await prisma.quizAttempt.findMany({
      where,
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        score: true,
        startedAt: true,
        completedAt: true,
        quiz: {
          select: {
            id: true,
            passingGrade: true,
            lesson: { select: { id: true, title: true, module: { select: { course: { select: { id: true, title: true, slug: true } } } } } },
          },
        },
      },
    });
 
    const mapped = attempts.map((a) => ({
      id: a.id,
      score: a.score,
      passed: a.score >= (a.quiz.passingGrade ?? 80),
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      quiz: {
        id: a.quiz.id,
        lessonId: a.quiz.lesson?.id ?? null,
        lessonTitle: a.quiz.lesson?.title ?? 'Quiz',
        passingGrade: a.quiz.passingGrade ?? 80,
      },
      course: {
        id: a.quiz.lesson?.module.course.id ?? '',
        title: a.quiz.lesson?.module.course.title ?? '',
        slug: a.quiz.lesson?.module.course.slug ?? '',
      },
    }));
 
    const statusFiltered =
      normalizedStatus === 'PASSED'
        ? mapped.filter((a) => a.completedAt && a.passed)
        : normalizedStatus === 'FAILED'
          ? mapped.filter((a) => a.completedAt && !a.passed)
          : normalizedStatus === 'INCOMPLETE'
            ? mapped.filter((a) => !a.completedAt)
            : mapped;
 
    const page = statusFiltered.slice(0, limit);
    const nextCursor = statusFiltered.length > limit ? page[page.length - 1]?.id ?? null : null;
 
    return NextResponse.json({ attempts: page, nextCursor }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load attempts' }, { status: 500 });
  }
}
