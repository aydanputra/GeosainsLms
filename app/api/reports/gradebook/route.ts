import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

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
    if (!courseId) {
      const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
      const settings = safeParse(settingsPage?.content);
      const allowCoInstructorAccess = settings['gradebookAllowCoInstructorAccess'] === true;

      const courses = await prisma.course.findMany({
        where: {
          deletedAt: null,
          ...(user.role === 'MENTOR'
            ? allowCoInstructorAccess
              ? {
                  OR: [
                    { instructorId: String(user.id) },
                    { coInstructors: { some: { userId: String(user.id) } } },
                  ],
                }
              : { instructorId: String(user.id) }
            : {}),
        },
        select: { id: true, title: true, slug: true, status: true },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ courses }, { status: 200 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, slug: true, instructorId: true, deletedAt: true, enableQA: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
    const settings = safeParse(settingsPage?.content);
    const allowCoInstructorAccess = settings['gradebookAllowCoInstructorAccess'] === true;
    const ungradedPolicy = settings['gradebookUngradedAssignmentPolicy'] === 'ZERO' ? 'ZERO' : 'IGNORE';

    if (user.role === 'MENTOR' && String(user.id) !== course.instructorId) {
      if (!allowCoInstructorAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const isCoInstructor = Boolean(
        await prisma.courseCoInstructor.findUnique({
          where: { courseId_userId: { courseId, userId: String(user.id) } } as any,
          select: { id: true },
        })
      );
      if (!isCoInstructor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: {
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const studentIds = enrollments.map((e) => e.user.id);

    const totalLessons = await prisma.lesson.count({
      where: { module: { courseId } },
    });

    const completedByUser = studentIds.length
      ? await prisma.userProgress.groupBy({
          by: ['userId'],
          where: { userId: { in: studentIds }, completed: true, lesson: { module: { courseId } } },
          _count: { _all: true },
        })
      : [];
    const completedMap = new Map(completedByUser.map((r) => [r.userId, r._count._all]));

    const quizzes = await prisma.quiz.findMany({
      where: { lesson: { module: { courseId } } },
      select: { id: true, passingGrade: true },
    });
    const quizPassing = new Map(quizzes.map((q) => [q.id, q.passingGrade]));
    const quizIds = quizzes.map((q) => q.id);

    const quizBest = studentIds.length && quizIds.length
      ? await prisma.quizAttempt.groupBy({
          by: ['userId', 'quizId'],
          where: { userId: { in: studentIds }, quizId: { in: quizIds }, completedAt: { not: null } },
          _max: { score: true },
        })
      : [];

    const quizAgg = new Map<
      string,
      {
        attempted: number;
        passed: number;
        bestScores: number[];
      }
    >();
    for (const r of quizBest) {
      const userId = r.userId;
      const bestScore = typeof r._max.score === 'number' ? r._max.score : null;
      if (bestScore === null) continue;
      const passing = quizPassing.get(r.quizId) ?? 80;
      const entry = quizAgg.get(userId) ?? { attempted: 0, passed: 0, bestScores: [] };
      entry.attempted += 1;
      entry.bestScores.push(bestScore);
      if (bestScore >= passing) entry.passed += 1;
      quizAgg.set(userId, entry);
    }

    const assignments = await prisma.assignment.findMany({
      where: { lesson: { module: { courseId } } },
      select: { id: true, passingGrade: true },
    });
    const assignmentPassing = new Map(assignments.map((a) => [a.id, a.passingGrade]));
    const assignmentIds = assignments.map((a) => a.id);

    const assignmentBest = studentIds.length && assignmentIds.length
      ? await prisma.assignmentSubmission.groupBy({
          by: ['userId', 'assignmentId'],
          where: {
            userId: { in: studentIds },
            assignmentId: { in: assignmentIds },
            status: 'GRADED',
            grade: { not: null },
          },
          _max: { grade: true },
        })
      : [];

    const assignmentAgg = new Map<
      string,
      {
        graded: number;
        passed: number;
        bestGrades: number[];
      }
    >();
    for (const r of assignmentBest) {
      const userId = r.userId;
      const bestGrade = typeof r._max.grade === 'number' ? r._max.grade : null;
      if (bestGrade === null) continue;
      const passing = assignmentPassing.get(r.assignmentId) ?? 0;
      const entry = assignmentAgg.get(userId) ?? { graded: 0, passed: 0, bestGrades: [] };
      entry.graded += 1;
      entry.bestGrades.push(bestGrade);
      if (bestGrade >= passing) entry.passed += 1;
      assignmentAgg.set(userId, entry);
    }

    const rows = enrollments.map((e) => {
      const userId = e.user.id;
      const completed = completedMap.get(userId) ?? 0;
      const progressPercent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
      const q = quizAgg.get(userId) ?? { attempted: 0, passed: 0, bestScores: [] };
      const a = assignmentAgg.get(userId) ?? { graded: 0, passed: 0, bestGrades: [] };
      const assignmentGradesForAvg =
        ungradedPolicy === 'ZERO'
          ? [...a.bestGrades, ...Array(Math.max(0, assignmentIds.length - a.bestGrades.length)).fill(0)]
          : a.bestGrades;
      return {
        userId,
        name: e.user.name || e.user.email,
        email: e.user.email,
        enrolledAt: e.createdAt,
        progressPercent,
        quizTotal: quizIds.length,
        quizAttempted: q.attempted,
        quizPassed: q.passed,
        quizBestAvg: Math.round(avg(q.bestScores)),
        assignmentTotal: assignmentIds.length,
        assignmentGraded: a.graded,
        assignmentPassed: a.passed,
        assignmentBestAvg: Math.round(avg(assignmentGradesForAvg)),
      };
    });

    return NextResponse.json(
      {
        course: { id: course.id, title: course.title, slug: course.slug },
        totals: { lessons: totalLessons, quizzes: quizIds.length, assignments: assignmentIds.length },
        rows,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load gradebook' }, { status: 500 });
  }
}
