import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
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

function normalizeAnswer(value: unknown): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) return [Math.trunc(value)];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'number' && Number.isFinite(v)).map((n) => Math.trunc(n));
  return [];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const { attemptId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
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
            lesson: {
              select: {
                id: true,
                title: true,
                module: { select: { courseId: true, course: { select: { instructorId: true, deletedAt: true } } } },
              },
            },
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                text: true,
                type: true,
                points: true,
                correctAnswer: true,
                correctAnswers: true,
                explanation: true,
                order: true,
                options: { orderBy: { order: 'asc' }, select: { id: true, text: true, order: true } },
              },
            },
          },
        },
      },
    });

    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

    const course = attempt.quiz.lesson?.module.course;
    const courseId = attempt.quiz.lesson?.module.courseId;
    if (!courseId || !course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
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

    const answersArray = Array.isArray(attempt.answers) ? attempt.answers : [];

    const questions = attempt.quiz.questions.map((q, idx) => {
      const submitted = normalizeAnswer(answersArray[idx]);
      const correct =
        Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0
          ? q.correctAnswers
          : typeof q.correctAnswer === 'number'
            ? [q.correctAnswer]
            : [];

      const optionText = (i: number) => q.options.find((o) => o.order === i)?.text ?? null;

      return {
        id: q.id,
        order: q.order,
        text: q.text,
        type: q.type,
        points: q.points,
        explanation: q.explanation,
        submitted,
        submittedText: submitted.map(optionText).filter(Boolean),
        correct,
        correctText: correct.map(optionText).filter(Boolean),
        isCorrect:
          submitted.length === correct.length && [...submitted].sort((a, b) => a - b).every((v, i) => v === [...correct].sort((a, b) => a - b)[i]),
      };
    });

    return NextResponse.json(
      {
        attempt: {
          id: attempt.id,
          score: attempt.score,
          passed: attempt.score >= (attempt.quiz.passingGrade ?? 80),
          passingGrade: attempt.quiz.passingGrade ?? 80,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          student: { id: attempt.user.id, name: attempt.user.name || attempt.user.email, email: attempt.user.email },
          quiz: { id: attempt.quiz.id, lessonId: attempt.quiz.lesson?.id ?? null, lessonTitle: attempt.quiz.lesson?.title ?? 'Quiz' },
          questions,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load attempt detail' }, { status: 500 });
  }
}
