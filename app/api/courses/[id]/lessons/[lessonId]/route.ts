import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { extractYoutubeId } from '@/modules/course/api/service';
import { DripType } from '@prisma/client';

async function buildCompletedSetForSequential(args: { userId: string; lessonIds: string[] }) {
  const { userId, lessonIds } = args;
  const completed = await prisma.userProgress.findMany({
    where: { userId, lessonId: { in: lessonIds }, completed: true },
    select: { lessonId: true },
  });
  const completedSet = new Set(completed.map((p) => p.lessonId));

  const assignments = await prisma.assignment.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true, lessonId: true, passingGrade: true },
  });
  if (!assignments.length) return completedSet;

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

  return completedSet;
}

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: courseId, lessonId } = await params;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        instructorId: true,
        dripEnabled: true,
        dripType: true,
        dripDays: true,
        validityDays: true,
        subscriptionEligible: true,
        createdAt: true,
        publishedAt: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const lessonMeta = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, isPreview: true, order: true, module: { select: { courseId: true } } },
    });

    if (!lessonMeta) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (lessonMeta.module.courseId !== courseId) {
      return NextResponse.json({ error: 'Invalid course context' }, { status: 400 });
    }

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
    const settings = settingsPage?.content ? (JSON.parse(settingsPage.content) as Record<string, unknown>) : {};
    const allowStaffView = settings['allowStaffViewCourseContentWithoutEnrolling'] !== false;

    const isInstructor = course.instructorId === user.id;
    const isAdmin = user.role === 'ADMIN';
    const isCoInstructor =
      !isAdmin && !isInstructor
        ? Boolean(
            await prisma.courseCoInstructor.findUnique({
              where: { courseId_userId: { courseId, userId: String(user.id) } } as any,
              select: { id: true },
            })
          )
        : false;

    const canBypassEnrollment = (isAdmin || isInstructor || isCoInstructor) && allowStaffView;

    const enrollment =
      !canBypassEnrollment
        ? await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: user.id, courseId } },
            select: { createdAt: true },
          })
        : null;

    const now = new Date();
    const activeSubscription =
      !canBypassEnrollment && course.subscriptionEligible
        ? await prisma.subscription.findFirst({
            where: {
              userId: String(user.id),
              startDate: { lte: now },
              endDate: { gte: now },
              status: 'ACTIVE',
            },
            select: { id: true, startDate: true, endDate: true },
          })
        : null;

    const accessStartDate = enrollment?.createdAt || activeSubscription?.startDate || null;

    if (!enrollment && !activeSubscription && !canBypassEnrollment) {
      if (!lessonMeta.isPreview) {
        return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
      }
    }

    if (enrollment && course.validityDays && course.validityDays > 0) {
      const expiresAt = new Date(enrollment.createdAt);
      expiresAt.setDate(expiresAt.getDate() + course.validityDays);
      if (new Date() > expiresAt) {
        return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
      }
    }

    if (accessStartDate && !canBypassEnrollment && course.dripEnabled) {
      const modules = await prisma.module.findMany({
        where: { courseId },
        orderBy: { order: 'asc' },
        select: {
          lessons: {
            orderBy: { order: 'asc' },
            select: { id: true, isPreview: true },
          },
        },
      });

      const globalLessons = modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, isPreview: l.isPreview })));
      const lessonIndexById = new Map(globalLessons.map((l, idx) => [l.id, idx]));
      const idx = lessonIndexById.get(lessonId) ?? 0;

      if (course.dripType === DripType.AFTER_ENROLLMENT && course.dripDays) {
        const unlockDate = new Date(accessStartDate);
        unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
        if (now < unlockDate) {
          return NextResponse.json({ error: 'Lesson is locked', unlockDate: unlockDate.toISOString() }, { status: 403 });
        }
      }

      if (course.dripType === DripType.SCHEDULE && course.dripDays) {
        const base = course.publishedAt || course.createdAt;
        const unlockDate = new Date(base);
        unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
        if (now < unlockDate) {
          return NextResponse.json({ error: 'Lesson is locked', unlockDate: unlockDate.toISOString() }, { status: 403 });
        }
      }

      if (course.dripType === DripType.SEQUENTIAL) {
        const completedSet = await buildCompletedSetForSequential({
          userId: String(user.id),
          lessonIds: globalLessons.map((l) => l.id),
        });

        for (let i = 0; i < idx; i++) {
          const prev = globalLessons[i];
          if (prev.isPreview) continue;
          if (!completedSet.has(prev.id)) {
            return NextResponse.json({ error: 'Lesson is locked' }, { status: 403 });
          }
        }
      }
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        assignment: true,
        quiz: {
            include: {
                questions: {
                    orderBy: { order: 'asc' }, // Ensure questions are ordered
                    include: { 
                        options: {
                            orderBy: { order: 'asc' } // Ensure options are ordered
                        } 
                    }
                }
            }
        },
        attachments: {
            orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    if (!isInstructor && !isAdmin && lesson.quiz) {
      const safeLesson = {
        ...lesson,
        quiz: {
          ...lesson.quiz,
          questions: lesson.quiz.questions.map(
            ({ correctAnswer: _correctAnswer, correctAnswers: _correctAnswers, answerKey: _answerKey, explanation: _explanation, ...q }) => ({
              ...q,
            })
          ),
        },
      };
      return NextResponse.json(safeLesson);
    }

    return NextResponse.json(lesson);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: courseId, lessonId } = await params;
    
    // Phase 5: Authorization Layer - Ownership Check
    const lessonContext = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } }, assignment: true },
    });

    if (!lessonContext) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (lessonContext.module.courseId !== courseId) {
      return NextResponse.json({ error: 'Invalid course context' }, { status: 400 });
    }

    if (user.role !== 'ADMIN' && lessonContext.module.course.instructorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.title) {
      return NextResponse.json({ error: 'Judul pelajaran wajib diisi' }, { status: 400 });
    }

    let content = body.content;
    if (content === undefined) content = undefined;

    const rawType = typeof body.type === 'string' ? body.type : undefined;
    const normalizedType = rawType === 'ASSIGNMENT' ? 'TEXT' : rawType;

    // Extract Video ID
    let videoId = undefined; // Undefined means don't update if not present
    if (normalizedType === 'VIDEO') {
        if (body.videoUrl) {
            const extracted = extractYoutubeId(body.videoUrl);
            if (!extracted) {
                return NextResponse.json({ error: 'URL YouTube tidak valid' }, { status: 400 });
            }
            videoId = extracted;
        } else {
            // If type is video but no url provided, maybe user didn't change it, 
            // but if they send empty string, we might want to clear it?
            // Usually editor sends full object. If videoUrl is empty string, videoId should be null?
            if (body.videoUrl === '') videoId = null;
        }
    } else {
        // If type changed to TEXT, clear videoId
        if (normalizedType === 'TEXT') videoId = null;
    }

    const lesson = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.lesson.update({
        where: { id: lessonId },
        data: {
          title: body.title,
          content: content ?? undefined,
          videoId: videoId,
          type: normalizedType,
          duration: body.duration,
          isPreview: body.isPreview,
        },
      } as any);

      if (rawType === 'ASSIGNMENT' && body.assignment) {
        const assignment = await tx.assignment.upsert({
          where: { lessonId: lessonId },
          update: {
            title: String(body.title || 'Tugas'),
            description: typeof body.assignment.description === 'string' ? body.assignment.description : null,
            timeLimit: typeof body.assignment.timeLimit === 'number' ? body.assignment.timeLimit : null,
            passingGrade: typeof body.assignment.passingGrade === 'number' ? body.assignment.passingGrade : 0,
            maxFileSize: typeof body.assignment.maxFileSize === 'number' ? body.assignment.maxFileSize : 5,
          },
          create: {
            lessonId: lessonId,
            title: String(body.title || 'Tugas'),
            description: typeof body.assignment.description === 'string' ? body.assignment.description : null,
            timeLimit: typeof body.assignment.timeLimit === 'number' ? body.assignment.timeLimit : null,
            passingGrade: typeof body.assignment.passingGrade === 'number' ? body.assignment.passingGrade : 0,
            maxFileSize: typeof body.assignment.maxFileSize === 'number' ? body.assignment.maxFileSize : 5,
          },
        });

        return { ...updated, assignment };
      }

      return updated;
    });

    return NextResponse.json(lesson);
  } catch (error: any) {
    console.error("Update Lesson Error:", error);
    return NextResponse.json({ error: error.message || 'Gagal memperbarui pelajaran' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { lessonId } = await params;

    // Phase 5: Authorization Layer - Ownership Check
    if (user.role !== 'ADMIN') {
        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { module: { include: { course: true } } }
        });
        
        if (!lesson || lesson.module.course.instructorId !== user.id) {
             return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
        }
    }

    await prisma.lesson.delete({
      where: { id: lessonId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Lesson Error:", error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus pelajaran' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest, 
  ctx: { params: Promise<{ id: string; lessonId: string }> }
) {
  return PUT(req, ctx);
}
