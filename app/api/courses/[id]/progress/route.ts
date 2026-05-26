import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import { CourseStatus } from '@prisma/client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        instructorId: true,
        validityDays: true,
        subscriptionEligible: true,
        modules: {
          orderBy: { order: 'asc' },
          select: {
            lessons: {
              orderBy: { order: 'asc' },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!course || course.deletedAt) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
    const settings = settingsPage?.content ? (JSON.parse(settingsPage.content) as Record<string, unknown>) : {};
    const allowStaffView = settings['allowStaffViewCourseContentWithoutEnrolling'] !== false;

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = user.id === course.instructorId;
    const isCoInstructor =
      !isAdmin && !isInstructor
        ? Boolean(
            await prisma.courseCoInstructor.findUnique({
              where: { courseId_userId: { courseId: course.id, userId: String(user.id) } } as any,
              select: { id: true },
            })
          )
        : false;
    const isStaff = isAdmin || isInstructor || isCoInstructor;
    const canBypassEnrollment = isStaff && allowStaffView;

    if (course.status !== CourseStatus.PUBLISHED && !isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!canBypassEnrollment) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        select: { createdAt: true },
      });
      if (!enrollment) {
        if (course.subscriptionEligible) {
          const now = new Date();
          const activeSubscription = await prisma.subscription.findFirst({
            where: {
              userId: String(user.id),
              startDate: { lte: now },
              endDate: { gte: now },
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          if (!activeSubscription) {
            return NextResponse.json({ error: 'User not enrolled in this course' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ error: 'User not enrolled in this course' }, { status: 403 });
        }
      } else {
        const validityDays = course.validityDays;
        if (validityDays && validityDays > 0) {
          const expiresAt = new Date(enrollment.createdAt);
          expiresAt.setDate(expiresAt.getDate() + validityDays);
          if (new Date() > expiresAt) {
            return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
          }
        }
      }
    }

    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));

    if (lessonIds.length === 0) {
      return NextResponse.json({ completedLessonIds: [], totalLessons: 0 }, { status: 200 });
    }

    const completed = await prisma.userProgress.findMany({
      where: {
        userId: user.id,
        lessonId: { in: lessonIds },
        completed: true,
      },
      select: { lessonId: true },
    });

    const completedLessonIds = completed.map((p) => p.lessonId);

    return NextResponse.json(
      {
        completedLessonIds,
        totalLessons: lessonIds.length,
        completedLessons: completedLessonIds.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch progress' }, { status: 500 });
  }
}
