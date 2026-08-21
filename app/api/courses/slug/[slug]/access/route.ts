import { NextRequest, NextResponse } from 'next/server';
import { DripType } from '@prisma/client';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import {
  getCourseLessonSequence,
  getCourseOutlineBase,
  getCourseRuntimeSettings,
} from '@/modules/course/api/performance';

async function addPassedAssignmentLessons(args: {
  userId: string;
  lessonIds: string[];
  completedSet: Set<string>;
}) {
  const { userId, lessonIds, completedSet } = args;
  if (!lessonIds.length) return;

  const assignments = await prisma.assignment.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true, lessonId: true, passingGrade: true },
  });
  if (!assignments.length) return;

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      userId,
      assignmentId: { in: assignments.map((assignment) => assignment.id) },
      status: 'GRADED',
      grade: { not: null },
    },
    select: { assignmentId: true, grade: true },
  });

  const bestByAssignmentId = new Map<string, number>();
  for (const submission of submissions) {
    const grade = typeof submission.grade === 'number' ? submission.grade : null;
    if (grade === null) continue;
    const previousBest = bestByAssignmentId.get(submission.assignmentId);
    if (previousBest === undefined || grade > previousBest) {
      bestByAssignmentId.set(submission.assignmentId, grade);
    }
  }

  for (const assignment of assignments) {
    const bestGrade = bestByAssignmentId.get(assignment.id);
    const passingGrade = typeof assignment.passingGrade === 'number' ? assignment.passingGrade : 0;
    if (typeof bestGrade === 'number' && bestGrade >= passingGrade) {
      completedSet.add(assignment.lessonId);
    }
  }
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

function lockReasonLabel(reason: unknown) {
  if (reason === 'DRIP_LOCKED') return 'Drip';
  if (reason === 'SCHEDULE_LOCKED') return 'Jadwal';
  if (reason === 'SEQUENTIAL_LOCKED') return 'Berurutan';
  if (reason === 'ENROLLMENT_EXPIRED') return 'Akses berakhir';
  if (reason === 'NOT_ENROLLED') return 'Belum terdaftar';
  return 'Terkunci';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const previewMode = req.nextUrl.searchParams.get('preview') === 'student';
    const token = req.cookies.get('token')?.value;
    const user = token ? await verifyToken(token) : null;

    const [course, courseSettings] = await Promise.all([getCourseOutlineBase(slug), getCourseRuntimeSettings()]);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const allowStaffView = courseSettings.allowStaffViewCourseContentWithoutEnrolling !== false;

    const isCreator = Boolean(user && (user.id === course.instructorId || user.role === 'ADMIN'));
    if (course.status !== 'PUBLISHED' && !isCreator) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    let isAdmin = Boolean(user?.role === 'ADMIN');
    let isInstructor = Boolean(user?.id === course.instructorId);
    let isCoInstructor = false;

    if (previewMode) {
      isAdmin = false;
      isInstructor = false;
    } else if (user && !isAdmin && !isInstructor) {
      const row = await prisma.courseCoInstructor.findUnique({
        where: { courseId_userId: { courseId: course.id, userId: String(user.id) } } as any,
        select: { id: true },
      });
      isCoInstructor = Boolean(row);
    }

    let enrollment = null;
    let activeSubscription: { startDate: Date } | null = null;
    let enrollmentExpired = false;

    if (previewMode && isCreator) {
      enrollment = null;
    } else if (user) {
      enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: String(user.id),
            courseId: course.id,
          },
        },
      });
    }

    if (enrollment && course.validityDays && course.validityDays > 0) {
      const expiresAt = new Date(enrollment.createdAt);
      expiresAt.setDate(expiresAt.getDate() + course.validityDays);
      if (new Date() > expiresAt) {
        enrollment = null;
        enrollmentExpired = true;
      }
    }

    if (!enrollment && user && course.subscriptionEligible && !(isAdmin || isInstructor || isCoInstructor)) {
      const now = new Date();
      activeSubscription = await prisma.subscription.findFirst({
        where: {
          userId: String(user.id),
          startDate: { lte: now },
          endDate: { gte: now },
          status: 'ACTIVE',
        },
        select: { startDate: true },
      });
    }

    const shouldReturnPersonalizedModules = Boolean(
      enrollment || activeSubscription || ((isAdmin || isInstructor || isCoInstructor) && allowStaffView)
    );

    let modules:
      | Array<{
          id: string;
          title: string;
          order: number;
          lessons: Array<{
            id: string;
            title: string;
            type: string;
            duration: number;
            isPreview: boolean;
            isLocked: boolean;
            lockLabel: string;
            unlockDateLabel: string | null;
          }>;
        }>
      | null = null;

    if (shouldReturnPersonalizedModules) {
      const courseModules = course.modules;
      const sequence = await getCourseLessonSequence(course.id);
      const globalLessons = sequence.globalLessons.map((lesson) => ({
        id: lesson.id,
        isPreview: lesson.isPreview,
      }));
      const lessonIndexById = new Map(globalLessons.map((lesson, index) => [lesson.id, index]));

      let completedSet = new Set<string>();
      if (user?.id && (enrollment || activeSubscription) && course.dripEnabled && course.dripType === DripType.SEQUENTIAL) {
        const completed = await prisma.userProgress.findMany({
          where: {
            userId: String(user.id),
            lessonId: { in: globalLessons.map((lesson) => lesson.id) },
            completed: true,
          },
          select: { lessonId: true },
        });
        completedSet = new Set(completed.map((progress) => progress.lessonId));
        await addPassedAssignmentLessons({
          userId: String(user.id),
          lessonIds: globalLessons.map((lesson) => lesson.id),
          completedSet,
        });
      }

      modules = courseModules.map((module) => ({
        id: String(module.id),
        title: String(module.title || ''),
        order: Number(module.order || 0),
        lessons: module.lessons.map((lesson) => {
          let isLocked = false;
          let unlockDate: Date | null = null;
          let lockReason:
            | 'NOT_ENROLLED'
            | 'DRIP_LOCKED'
            | 'SEQUENTIAL_LOCKED'
            | 'SCHEDULE_LOCKED'
            | 'ENROLLMENT_EXPIRED'
            | 'OK' = 'OK';

          if (lesson.isPreview) {
            isLocked = false;
            lockReason = 'OK';
          } else if ((isAdmin || isInstructor || isCoInstructor) && allowStaffView) {
            isLocked = false;
            lockReason = 'OK';
          } else if (!enrollment && !activeSubscription) {
            isLocked = true;
            lockReason = enrollmentExpired ? 'ENROLLMENT_EXPIRED' : 'NOT_ENROLLED';
          } else if (course.dripEnabled && course.dripType === DripType.AFTER_ENROLLMENT && course.dripDays) {
            const index = lessonIndexById.get(lesson.id) ?? 0;
            const daysToUnlock = index * course.dripDays;
            const baseDate = enrollment?.createdAt || activeSubscription?.startDate || new Date();
            unlockDate = new Date(baseDate);
            unlockDate.setDate(unlockDate.getDate() + daysToUnlock);
            if (new Date() < unlockDate) {
              isLocked = true;
              lockReason = 'DRIP_LOCKED';
            }
          } else if (course.dripEnabled && course.dripType === DripType.SCHEDULE && course.dripDays) {
            const index = lessonIndexById.get(lesson.id) ?? 0;
            const daysToUnlock = index * course.dripDays;
            unlockDate = new Date(course.publishedAt || course.createdAt);
            unlockDate.setDate(unlockDate.getDate() + daysToUnlock);
            if (new Date() < unlockDate) {
              isLocked = true;
              lockReason = 'SCHEDULE_LOCKED';
            }
          } else if (course.dripEnabled && course.dripType === DripType.SEQUENTIAL) {
            const index = lessonIndexById.get(lesson.id) ?? 0;
            for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
              const previousLesson = globalLessons[previousIndex];
              if (previousLesson.isPreview) continue;
              if (!completedSet.has(previousLesson.id)) {
                isLocked = true;
                lockReason = 'SEQUENTIAL_LOCKED';
                break;
              }
            }
          }

          return {
            id: String(lesson.id),
            title: String(lesson.title || ''),
            type: String(lesson.type || ''),
            duration: Number(lesson.duration || 0) || 0,
            isPreview: Boolean(lesson.isPreview),
            isLocked,
            lockLabel: lockReasonLabel(lockReason),
            unlockDateLabel: unlockDate ? formatDate(unlockDate.toISOString()) : null,
          };
        }),
      }));
    }

    const canViewQa = Boolean(course.enableQA) && Boolean(user) && (Boolean(isCreator) || Boolean(enrollment));
    const qaThreads = canViewQa
      ? await prisma.qAThread.findMany({
          where: { courseId: course.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 6,
          include: {
            author: { select: { id: true, name: true, email: true, role: true } },
            lesson: { select: { id: true, title: true } },
            _count: { select: { replies: true } },
            replies: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          },
        })
      : [];

    return NextResponse.json({
      isLoggedIn: Boolean(user),
      isEnrolled: Boolean(enrollment),
      enrollmentExpired,
      canRate: Boolean(user && enrollment),
      canViewQa,
      viewer: {
        id: user?.id ? String(user.id) : null,
        role: user?.role ? String(user.role) : null,
      },
      modules,
      qaThreads: Array.isArray(qaThreads)
        ? qaThreads.map((thread: any) => ({
            id: String(thread.id),
            lessonId: thread.lessonId ? String(thread.lessonId) : null,
            lessonTitle: thread.lesson?.title ? String(thread.lesson.title) : null,
            title: String(thread.title || ''),
            question: String(thread.question || ''),
            createdAtLabel: new Date(thread.createdAt).toLocaleDateString('id-ID'),
            authorName: String(thread.author?.name || thread.author?.email || 'User'),
            replyCount: Number(thread._count?.replies || 0) || 0,
            lastReplyAtLabel: thread.replies?.[0]?.createdAt
              ? new Date(thread.replies[0].createdAt).toLocaleDateString('id-ID')
              : null,
          }))
        : [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
