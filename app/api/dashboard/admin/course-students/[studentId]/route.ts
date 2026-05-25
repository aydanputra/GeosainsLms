import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
 
function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
 
export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
 
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
 
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, createdAt: true, role: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
 
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: studentId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        course: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } },
      },
    });
 
    const activeEnrollments = enrollments.filter((e) => e.course && !e.course.deletedAt);
    const courseIds = Array.from(new Set(activeEnrollments.map((e) => e.course.id)));
 
    const lessons = courseIds.length
      ? await prisma.lesson.findMany({
          where: { module: { courseId: { in: courseIds } } },
          select: { id: true, module: { select: { courseId: true } } },
        })
      : [];
 
    const totalLessonsByCourse = new Map<string, number>();
    for (const l of lessons) {
      const cid = l.module.courseId;
      totalLessonsByCourse.set(cid, (totalLessonsByCourse.get(cid) ?? 0) + 1);
    }
 
    const completedProgress = courseIds.length
      ? await prisma.userProgress.findMany({
          where: { userId: studentId, completed: true, lesson: { module: { courseId: { in: courseIds } } } },
          select: { lesson: { select: { module: { select: { courseId: true } } } } },
        })
      : [];
 
    const completedLessonsByCourse = new Map<string, number>();
    for (const p of completedProgress) {
      const cid = p.lesson.module.courseId;
      completedLessonsByCourse.set(cid, (completedLessonsByCourse.get(cid) ?? 0) + 1);
    }
 
    const quizzes = courseIds.length
      ? await prisma.quiz.findMany({
          where: { lesson: { module: { courseId: { in: courseIds } } } },
          select: { id: true, passingGrade: true, lesson: { select: { module: { select: { courseId: true } } } } },
        })
      : [];
 
    const quizCourseId = new Map<string, string>();
    const quizPassing = new Map<string, number>();
    const quizTotalByCourse = new Map<string, number>();
    for (const q of quizzes) {
      const cid = q.lesson.module.courseId;
      quizCourseId.set(q.id, cid);
      quizPassing.set(q.id, q.passingGrade ?? 80);
      quizTotalByCourse.set(cid, (quizTotalByCourse.get(cid) ?? 0) + 1);
    }
    const quizIds = quizzes.map((q) => q.id);
 
    const quizBest = quizIds.length
      ? await prisma.quizAttempt.groupBy({
          by: ['quizId'],
          where: { userId: studentId, quizId: { in: quizIds }, completedAt: { not: null } },
          _max: { score: true },
        })
      : [];
 
    const quizAggByCourse = new Map<
      string,
      {
        attempted: number;
        passed: number;
        bestScores: number[];
      }
    >();
    for (const r of quizBest) {
      const bestScore = typeof r._max.score === 'number' ? r._max.score : null;
      if (bestScore === null) continue;
      const cid = quizCourseId.get(r.quizId);
      if (!cid) continue;
      const passing = quizPassing.get(r.quizId) ?? 80;
      const entry = quizAggByCourse.get(cid) ?? { attempted: 0, passed: 0, bestScores: [] };
      entry.attempted += 1;
      entry.bestScores.push(bestScore);
      if (bestScore >= passing) entry.passed += 1;
      quizAggByCourse.set(cid, entry);
    }
 
    const assignments = courseIds.length
      ? await prisma.assignment.findMany({
          where: { lesson: { module: { courseId: { in: courseIds } } } },
          select: { id: true, passingGrade: true, lesson: { select: { module: { select: { courseId: true } } } } },
        })
      : [];
 
    const assignmentCourseId = new Map<string, string>();
    const assignmentPassing = new Map<string, number>();
    const assignmentTotalByCourse = new Map<string, number>();
    for (const a of assignments) {
      const cid = a.lesson.module.courseId;
      assignmentCourseId.set(a.id, cid);
      assignmentPassing.set(a.id, a.passingGrade ?? 0);
      assignmentTotalByCourse.set(cid, (assignmentTotalByCourse.get(cid) ?? 0) + 1);
    }
    const assignmentIds = assignments.map((a) => a.id);
 
    const assignmentBest = assignmentIds.length
      ? await prisma.assignmentSubmission.groupBy({
          by: ['assignmentId'],
          where: { userId: studentId, assignmentId: { in: assignmentIds }, status: 'GRADED', grade: { not: null } },
          _max: { grade: true },
        })
      : [];
 
    const assignmentAggByCourse = new Map<
      string,
      {
        graded: number;
        passed: number;
        bestGrades: number[];
      }
    >();
    for (const r of assignmentBest) {
      const bestGrade = typeof r._max.grade === 'number' ? r._max.grade : null;
      if (bestGrade === null) continue;
      const cid = assignmentCourseId.get(r.assignmentId);
      if (!cid) continue;
      const passing = assignmentPassing.get(r.assignmentId) ?? 0;
      const entry = assignmentAggByCourse.get(cid) ?? { graded: 0, passed: 0, bestGrades: [] };
      entry.graded += 1;
      entry.bestGrades.push(bestGrade);
      if (bestGrade >= passing) entry.passed += 1;
      assignmentAggByCourse.set(cid, entry);
    }
 
    const assignmentSubmittedDistinct = assignmentIds.length
      ? await prisma.assignmentSubmission.groupBy({
          by: ['assignmentId'],
          where: { userId: studentId, assignmentId: { in: assignmentIds } },
          _count: { _all: true },
        })
      : [];
 
    const questions = await prisma.qAThread.count({
      where: { authorId: studentId, ...(courseIds.length ? { courseId: { in: courseIds } } : {}) },
    });
 
    const reviewsPlaced = await prisma.courseReview.count({
      where: { userId: studentId, ...(courseIds.length ? { courseId: { in: courseIds } } : {}) },
    });
 
    const courseRows = activeEnrollments.map((e) => {
      const cid = e.course.id;
      const totalLessons = totalLessonsByCourse.get(cid) ?? 0;
      const completedLessons = completedLessonsByCourse.get(cid) ?? 0;
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const qAgg = quizAggByCourse.get(cid) ?? { attempted: 0, passed: 0, bestScores: [] };
      const aAgg = assignmentAggByCourse.get(cid) ?? { graded: 0, passed: 0, bestGrades: [] };
      return {
        course: { id: e.course.id, title: e.course.title, slug: e.course.slug, status: e.course.status },
        enrolledAt: e.createdAt,
        lessons: { total: totalLessons, completed: completedLessons },
        quizzes: {
          total: quizTotalByCourse.get(cid) ?? 0,
          attempted: qAgg.attempted,
          passed: qAgg.passed,
          bestAvg: Math.round(avg(qAgg.bestScores)),
        },
        assignments: {
          total: assignmentTotalByCourse.get(cid) ?? 0,
          graded: aAgg.graded,
          passed: aAgg.passed,
          bestAvg: Math.round(avg(aAgg.bestGrades)),
        },
        progressPercent,
      };
    });
 
    const totals = {
      enrolledCourses: courseRows.length,
      totalLessons: courseRows.reduce((acc, r) => acc + r.lessons.total, 0),
      completedLessons: courseRows.reduce((acc, r) => acc + r.lessons.completed, 0),
      totalQuizzes: courseRows.reduce((acc, r) => acc + r.quizzes.total, 0),
      quizzesTaken: quizBest.length,
      totalAssignments: courseRows.reduce((acc, r) => acc + r.assignments.total, 0),
      assignmentsSubmitted: assignmentSubmittedDistinct.length,
      completedCourses: courseRows.filter((r) => r.lessons.total > 0 && r.progressPercent === 100).length,
      inProgressCourses: courseRows.filter((r) => !(r.lessons.total > 0 && r.progressPercent === 100)).length,
      reviewsPlaced,
      questions,
    };
 
    return NextResponse.json(
      {
        student: {
          id: student.id,
          name: student.name || student.email,
          email: student.email,
          registeredAt: student.createdAt,
          role: student.role,
        },
        totals,
        courses: courseRows,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load student detail' }, { status: 500 });
  }
}
