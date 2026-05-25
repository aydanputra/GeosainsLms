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

function normalizeAnswer(value: unknown): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) return [Math.trunc(value)];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'number' && Number.isFinite(v)).map((n) => Math.trunc(n));
  return [];
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const courseId = (req.nextUrl.searchParams.get('courseId') || '').trim();
    const status = (req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cursor = (req.nextUrl.searchParams.get('cursor') || '').trim();
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));

    const normalizedStatus =
      status === 'PASSED' || status === 'FAILED' || status === 'INCOMPLETE' || status === 'ALL' ? status : 'ALL';

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
          : {};

    const baseWhere: Prisma.QuizAttemptWhereInput = {
      ...completedAtConstraint,
      ...(startedAtFilter ? { startedAt: startedAtFilter } : {}),
      quiz: {
        is: {
          lesson: {
            is: {
              module: {
                is: {
                  ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
                  course: { is: { deletedAt: null } },
                },
              },
            },
          },
        },
      },
      ...(q
        ? {
            OR: [
              { user: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              { user: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              { quiz: { is: { lesson: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } },
              {
                quiz: {
                  is: { lesson: { is: { module: { is: { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } } } },
                },
              },
              {
                quiz: {
                  is: { lesson: { is: { module: { is: { course: { is: { slug: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } } } },
                },
              },
            ],
          }
        : {}),
    };

    const batchSize = Math.min(200, Math.max(limit * 5, limit + 1));
    const maxBatches = 5;

    let lastCursor: string | null = cursor || null;
    let exhausted = false;
    const collected: Array<{
      id: string;
      score: number;
      startedAt: Date;
      completedAt: Date | null;
      answers: unknown;
      student: { id: string; name: string; email: string };
      course: { id: string; title: string; slug: string };
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
          answers: true,
          startedAt: true,
          completedAt: true,
          user: { select: { id: true, name: true, email: true } },
          quiz: {
            select: {
              id: true,
              passingGrade: true,
              lesson: { select: { id: true, title: true, module: { select: { course: { select: { id: true, title: true, slug: true } } } } } },
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
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        answers: a.answers,
        student: { id: a.user.id, name: a.user.name || a.user.email, email: a.user.email },
        course: {
          id: a.quiz.lesson?.module.course.id ?? '',
          title: a.quiz.lesson?.module.course.title ?? '',
          slug: a.quiz.lesson?.module.course.slug ?? '',
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
          ? mapped.filter((a) => a.completedAt && a.score >= a.quiz.passingGrade)
          : normalizedStatus === 'FAILED'
            ? mapped.filter((a) => a.completedAt && a.score < a.quiz.passingGrade)
            : mapped;

      collected.push(...statusFiltered);

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

    const quizIds = Array.from(new Set(page.map((a) => a.quiz.id).filter(Boolean)));
    const questions = quizIds.length
      ? await prisma.question.findMany({
          where: { quizId: { in: quizIds } },
          orderBy: [{ quizId: 'asc' }, { order: 'asc' }],
          select: { quizId: true, points: true, correctAnswer: true, correctAnswers: true, order: true },
        })
      : [];

    const questionsByQuiz = new Map<
      string,
      Array<{ points: number; correctAnswer: number | null; correctAnswers: number[]; order: number }>
    >();
    for (const qRow of questions) {
      const list = questionsByQuiz.get(qRow.quizId) || [];
      list.push({
        points: qRow.points ?? 0,
        correctAnswer: typeof qRow.correctAnswer === 'number' ? qRow.correctAnswer : null,
        correctAnswers: Array.isArray(qRow.correctAnswers) ? qRow.correctAnswers : [],
        order: qRow.order ?? 0,
      });
      questionsByQuiz.set(qRow.quizId, list);
    }

    const withStats = page.map((a) => {
      const qs = questionsByQuiz.get(a.quiz.id) || [];
      const answersArray = Array.isArray(a.answers) ? a.answers : [];
      const totalQuestions = qs.length;
      let totalMarks = 0;
      let correctCount = 0;
      let earnedMarks = 0;

      for (let idx = 0; idx < qs.length; idx++) {
        const qRow = qs[idx];
        const points = Number(qRow.points) || 0;
        totalMarks += points;
        const submitted = normalizeAnswer(answersArray[idx]);
        const correct =
          Array.isArray(qRow.correctAnswers) && qRow.correctAnswers.length > 0
            ? qRow.correctAnswers
            : typeof qRow.correctAnswer === 'number'
              ? [qRow.correctAnswer]
              : [];
        const isCorrect =
          submitted.length === correct.length &&
          [...submitted].sort((x, y) => x - y).every((v, i) => v === [...correct].sort((x, y) => x - y)[i]);
        if (isCorrect) {
          correctCount += 1;
          earnedMarks += points;
        }
      }

      const passed = a.completedAt ? a.score >= a.quiz.passingGrade : false;
      const incorrectCount = totalQuestions ? Math.max(0, totalQuestions - correctCount) : 0;
      const percent = Number(a.score) || 0;
      const earnedText = totalMarks ? `${earnedMarks} (${percent}%)` : `${percent}%`;
      const result = a.completedAt ? (passed ? 'PASSED' : 'FAILED') : 'INCOMPLETE';

      return {
        id: a.id,
        score: percent,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        student: a.student,
        course: a.course,
        quiz: a.quiz,
        totalQuestions,
        totalMarks,
        correctCount,
        incorrectCount,
        earnedMarks,
        earnedText,
        passed,
        result,
      };
    });

    return NextResponse.json({ attempts: withStats, nextCursor }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load quiz attempts' }, { status: 500 });
  }
}
