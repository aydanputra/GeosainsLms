import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { DripType, Prisma } from '@prisma/client';

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
      assignmentId: { in: assignments.map((a) => a.id) },
      status: 'GRADED',
      grade: { not: null },
    },
    select: { assignmentId: true, grade: true },
  });

  const bestByAssignmentId = new Map<string, number>();
  for (const s of submissions) {
    const g = typeof s.grade === 'number' ? s.grade : null;
    if (g === null) continue;
    const prev = bestByAssignmentId.get(s.assignmentId);
    if (prev === undefined || g > prev) bestByAssignmentId.set(s.assignmentId, g);
  }

  for (const a of assignments) {
    const best = bestByAssignmentId.get(a.id);
    const passing = typeof a.passingGrade === 'number' ? a.passingGrade : 0;
    if (typeof best === 'number' && best >= passing) {
      completedSet.add(a.lessonId);
    }
  }
}

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const token = req.cookies.get('token')?.value;
    
    // 1. Fetch User (Optional)
    let user = null;
    if (token) {
        user = await verifyToken(token);
    }

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
    const settings = settingsPage?.content ? (JSON.parse(settingsPage.content) as Record<string, unknown>) : {};
    const mustLogin = settings['studentsMustBeLoggedInToViewCourse'] === true;
    const allowStaffView = settings['allowStaffViewCourseContentWithoutEnrolling'] !== false;

    if (mustLogin && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Course Structure (Lightweight)
    const course = await prisma.course.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        dripEnabled: true,
        dripType: true,
        dripDays: true,
        validityDays: true,
        subscriptionEligible: true,
        createdAt: true,
        publishedAt: true,
        instructorId: true,
        modules: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            lessons: {
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                isPreview: true,
                order: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        instructor: {
          select: { id: true },
        },
      },
    });

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const moduleIds = course.modules.map((m) => m.id);
    const moduleDescriptions = moduleIds.length
      ? await prisma.$queryRaw<{ id: string; description: string | null }[]>(
          Prisma.sql`SELECT "id", "description" FROM "Module" WHERE "id" IN (${Prisma.join(moduleIds)})`
        )
      : [];
    const descriptionById = new Map(moduleDescriptions.map((r) => [r.id, r.description] as const));

    // 3. Fetch Enrollment (If User exists)
    let enrollment = null;
    let isInstructor = false;
    let isAdmin = false;
    let isCoInstructor = false;
    let enrollmentExpired = false;
    let activeSubscription: { id: string; startDate: Date; endDate: Date } | null = null;

    if (user) {
        isAdmin = user.role === 'ADMIN';
        isInstructor = user.id === course.instructorId;

        // Preview Mode Security: 
        // If preview=student is requested, we strip admin/instructor privileges for this request.
        // This allows admins to see the course exactly as a student sees it (including locks).
        const previewMode = req.nextUrl.searchParams.get('preview');
        if (previewMode === 'student') {
            isAdmin = false;
            isInstructor = false;
            isCoInstructor = false;
        }

        if (!isAdmin && !isInstructor && previewMode !== 'student') {
          const row = await prisma.courseCoInstructor.findUnique({
            where: { courseId_userId: { courseId: course.id, userId: String(user.id) } } as any,
            select: { id: true },
          });
          isCoInstructor = Boolean(row);
        }
        
        enrollment = await prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId: user.id,
                    courseId: course.id
                }
            }
        });

        if (enrollment && course.validityDays && course.validityDays > 0) {
          const expiresAt = new Date(enrollment.createdAt);
          expiresAt.setDate(expiresAt.getDate() + course.validityDays);
          if (new Date() > expiresAt) {
            enrollment = null;
            enrollmentExpired = true;
          }
        }

        if (!enrollment && course.subscriptionEligible && !(isAdmin || isInstructor || isCoInstructor)) {
          const now = new Date();
          activeSubscription = await prisma.subscription.findFirst({
            where: {
              userId: String(user.id),
              startDate: { lte: now },
              endDate: { gte: now },
              status: 'ACTIVE',
            },
            select: { id: true, startDate: true, endDate: true },
          });
        }
    }

    const globalLessons = course.modules
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((m) => m.lessons.map((l) => ({ id: l.id, isPreview: l.isPreview })));

    const lessonIndexById = new Map(globalLessons.map((l, idx) => [l.id, idx]));

    let completedSet = new Set<string>();
    if (user && (enrollment || activeSubscription) && course.dripEnabled && course.dripType === DripType.SEQUENTIAL) {
      const completed = await prisma.userProgress.findMany({
        where: { userId: user.id, lessonId: { in: globalLessons.map((l) => l.id) }, completed: true },
        select: { lessonId: true },
      });
      completedSet = new Set(completed.map((p) => p.lessonId));
      await addPassedAssignmentLessons({
        userId: String(user.id),
        lessonIds: globalLessons.map((l) => l.id),
        completedSet,
      });
    }

    // 4. Calculate Lock Status per Lesson
    const modulesWithStatus = course.modules.map(module => ({
        ...module,
        description: descriptionById.get(module.id) ?? null,
        lessons: module.lessons.map(lesson => {
            let isLocked = false;
            let unlockDate: Date | null = null;
            let lockReason:
              | 'NOT_ENROLLED'
              | 'DRIP_LOCKED'
              | 'SEQUENTIAL_LOCKED'
              | 'SCHEDULE_LOCKED'
              | 'ENROLLMENT_EXPIRED'
              | 'OK'
              | null = null;

            // Rule 1: Admin/Instructor/Preview -> Always OK
            if (lesson.isPreview) {
                isLocked = false;
                lockReason = 'OK';
            } 
            else if ((isAdmin || isInstructor || isCoInstructor) && allowStaffView) {
                isLocked = false;
                lockReason = 'OK';
            }
            // Rule 2: Not Enrolled -> Locked
            else if (!enrollment && !activeSubscription) {
                isLocked = true;
                lockReason = enrollmentExpired ? 'ENROLLMENT_EXPIRED' : 'NOT_ENROLLED';
            }
            // Rule 3: Enrolled -> Check Drip
            else {
              if (course.dripEnabled && course.dripType === DripType.AFTER_ENROLLMENT && course.dripDays) {
                const idx = lessonIndexById.get(lesson.id) ?? 0;
                const daysToUnlock = idx * course.dripDays;
                const base = enrollment ? new Date(enrollment.createdAt) : activeSubscription ? new Date(activeSubscription.startDate) : new Date();
                const unlockAt = new Date(base);
                unlockAt.setDate(unlockAt.getDate() + daysToUnlock);

                if (new Date() < unlockAt) {
                  isLocked = true;
                  unlockDate = unlockAt;
                  lockReason = 'DRIP_LOCKED';
                } else {
                  isLocked = false;
                  lockReason = 'OK';
                }
              } else if (course.dripEnabled && course.dripType === DripType.SCHEDULE && course.dripDays) {
                const idx = lessonIndexById.get(lesson.id) ?? 0;
                const daysToUnlock = idx * course.dripDays;
                const base = course.publishedAt || course.createdAt;
                const unlockAt = new Date(base);
                unlockAt.setDate(unlockAt.getDate() + daysToUnlock);

                if (new Date() < unlockAt) {
                  isLocked = true;
                  unlockDate = unlockAt;
                  lockReason = 'SCHEDULE_LOCKED';
                } else {
                  isLocked = false;
                  lockReason = 'OK';
                }
              } else if (course.dripEnabled && course.dripType === DripType.SEQUENTIAL) {
                const idx = lessonIndexById.get(lesson.id) ?? 0;
                for (let i = 0; i < idx; i++) {
                  const prev = globalLessons[i];
                  if (prev.isPreview) continue;
                  if (!completedSet.has(prev.id)) {
                    isLocked = true;
                    lockReason = 'SEQUENTIAL_LOCKED';
                    break;
                  }
                }
                if (!isLocked) {
                  lockReason = 'OK';
                }
              } else {
                isLocked = false;
                lockReason = 'OK';
              }
            }

            return {
                ...lesson,
                isLocked,
                unlockDate: unlockDate ? unlockDate.toISOString() : null,
                lockReason
            };
        })
    }));

    return NextResponse.json({
        course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            dripEnabled: course.dripEnabled,
            modules: modulesWithStatus
        }
    });

  } catch (error: any) {
    console.error("Outline API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
