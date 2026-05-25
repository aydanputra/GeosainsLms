import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
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
        userId: true,
        quizId: true,
        quiz: {
          select: {
            passingGrade: true,
            lesson: {
              select: {
                id: true,
                module: { select: { courseId: true, course: { select: { instructorId: true, deletedAt: true } } } },
              },
            },
          },
        },
      },
    });

    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    if (!attempt.quiz.lesson?.module?.courseId) return NextResponse.json({ error: 'Invalid attempt context' }, { status: 400 });

    const course = attempt.quiz.lesson.module.course;
    if (course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (user.role === 'MENTOR' && String(user.id) !== course.instructorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const lessonId = attempt.quiz.lesson.id;
    const passingGrade = attempt.quiz.passingGrade ?? 80;

    await prisma.$transaction(async (tx: any) => {
      await tx.quizAttempt.delete({ where: { id: attemptId } });

      const remaining = await tx.quizAttempt.findMany({
        where: {
          userId: attempt.userId,
          quizId: attempt.quizId,
          completedAt: { not: null },
        },
        select: { score: true },
        take: 200,
      });

      const stillPassed = remaining.some((a: { score: unknown }) => (Number(a.score) || 0) >= passingGrade);
      if (!stillPassed) {
        await tx.userProgress.updateMany({
          where: { userId: attempt.userId, lessonId },
          data: { completed: false },
        });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset attempt' }, { status: 500 });
  }
}
