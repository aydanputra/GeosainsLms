import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/modules/auth/utils/auth';

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

    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const courseId = req.nextUrl.searchParams.get('courseId');
    const studentId = req.nextUrl.searchParams.get('userId');
    const quizId = req.nextUrl.searchParams.get('quizId');
    const includeIncompleteParam = req.nextUrl.searchParams.get('includeIncomplete') === '1';
    const failedOnly = req.nextUrl.searchParams.get('failedOnly') === '1';
    const status = (req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cursor = req.nextUrl.searchParams.get('cursor');
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));

    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (user.role === 'MENTOR' && String(user.id) !== course.instructorId) {
      const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
      const settings = safeParse(settingsPage?.content);
      const allowCoInstructorAccess = settings['gradebookAllowCoInstructorAccess'] === true;
      if (!allowCoInstructorAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const isCoInstructor = Boolean(
        await prisma.courseCoInstructor.findUnique({
          where: { courseId_userId: { courseId, userId: String(user.id) } } as any,
          select: { id: true },
        })
      );
      if (!isCoInstructor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalizedStatus =
      status === 'PASSED' || status === 'FAILED' || status === 'INCOMPLETE' || status === 'ALL' ? status : '';

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
          : includeIncompleteParam
            ? {}
            : { completedAt: { not: null } };

    const baseWhere: Prisma.QuizAttemptWhereInput = {
      ...(studentId ? { userId: studentId } : {}),
      ...(quizId ? { quizId } : {}),
      ...completedAtConstraint,
      quiz: { is: { lesson: { is: { module: { is: { courseId } } } } } },
      ...(startedAtFilter ? { startedAt: startedAtFilter } : {}),
      ...(q
        ? {
            OR: [
              { user: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              { user: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              { quiz: { is: { lesson: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } },
            ],
          }
        : {}),
    };

    const batchSize = Math.min(200, Math.max(limit * 5, limit + 1));
    const maxBatches = 5;

    let lastCursor: string | null = cursor;
    let exhausted = false;
    const collected: Array<{
      id: string;
      score: number;
      passed: boolean;
      startedAt: Date;
      completedAt: Date | null;
      student: { id: string; name: string; email: string };
      quiz: { id: string; passingGrade: number; lessonId: string | null; lessonTitle: string };
    }> = [];

    for (let i = 0; i < maxBatches; i++) {
      const attempts = await prisma.quizAttempt.findMany({
        where: baseWhere,
        orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }, { id: 'desc' }],
        take: batchSize,
        ...(lastCursor ? { cursor: { id: lastCursor }, skip: 1 } : {}),
        select: {
          id: true,
          score: true,
          startedAt: true,
          completedAt: true,
          user: { select: { id: true, name: true, email: true } },
          quiz: {
            select: {
              id: true,
              passingGrade: true,
              lesson: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (attempts.length === 0) {
        exhausted = true;
        break;
      }

      const mapped = attempts.map((a) => ({
        id: a.id,
        score: a.score,
        passed: a.score >= (a.quiz.passingGrade ?? 80),
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        student: {
          id: a.user.id,
          name: a.user.name || a.user.email,
          email: a.user.email,
        },
        quiz: {
          id: a.quiz.id,
          passingGrade: a.quiz.passingGrade ?? 80,
          lessonId: a.quiz.lesson?.id ?? null,
          lessonTitle: a.quiz.lesson?.title ?? 'Quiz',
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

      const legacyFiltered = failedOnly ? statusFiltered.filter((a) => !a.passed) : statusFiltered;
      collected.push(...legacyFiltered);

      if (collected.length > limit) break;

      if (attempts.length < batchSize) {
        exhausted = true;
        break;
      }

      lastCursor = attempts[attempts.length - 1]?.id ?? null;
      if (!lastCursor) {
        exhausted = true;
        break;
      }
    }

    const page = collected.slice(0, limit);
    const nextCursor = page.length === 0 ? null : exhausted && collected.length <= limit ? null : page[page.length - 1].id;

    return NextResponse.json(
      {
        attempts: page,
        nextCursor,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load quiz attempts' }, { status: 500 });
  }
}
