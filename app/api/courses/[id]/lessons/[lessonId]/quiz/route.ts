import { NextRequest, NextResponse } from 'next/server';
import { createQuiz, submitQuiz } from '@/modules/course/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import { getCourseLessonSequence, getLessonQuizAccessContext } from '@/modules/course/api/performance';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const { id: courseId, lessonId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lesson = await getLessonQuizAccessContext(lessonId);

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (lesson.module.courseId !== courseId) {
      return NextResponse.json({ error: 'Invalid course context' }, { status: 400 });
    }

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = user.id === lesson.module.course.instructorId;

    const body = await req.json();

    // Create Quiz (Admin/Mentor)
    if (body.questions) {
      if (user.role !== 'ADMIN' && user.role !== 'MENTOR') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (!isAdmin && !isInstructor) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const quiz = await createQuiz({ ...body, lessonId });
      return NextResponse.json(quiz, { status: 201 });
    }
    
    // Submit Quiz (Student)
    if (body.answers) {
      if (!isAdmin && !isInstructor) {
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId: user.id,
              courseId,
            },
          },
          select: { createdAt: true },
        });

        const now = new Date();
        const course = lesson.module.course;
        const activeSubscription =
          !enrollment && course.subscriptionEligible
            ? await prisma.subscription.findFirst({
                where: { userId: String(user.id), startDate: { lte: now }, endDate: { gte: now }, status: 'ACTIVE' },
                select: { startDate: true },
              })
            : null;

        if (!enrollment && !activeSubscription) {
          return NextResponse.json({ error: 'User not enrolled in this course' }, { status: 403 });
        }

        if (enrollment) {
          const validityDays = course.validityDays;
          if (validityDays && validityDays > 0) {
            const expiresAt = new Date(enrollment.createdAt);
            expiresAt.setDate(expiresAt.getDate() + validityDays);
            if (new Date() > expiresAt) {
              return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
            }
          }
        }

        const accessStartDate = enrollment?.createdAt || activeSubscription?.startDate || null;
        if (course.dripEnabled) {
          const sequence = await getCourseLessonSequence(courseId);
          const globalLessons = sequence.globalLessons.map((lessonRow) => ({
            id: lessonRow.id,
            isPreview: lessonRow.isPreview,
          }));
          const idx = globalLessons.findIndex((l) => l.id === lessonId);

          if (idx >= 0 && !lesson.isPreview) {
            if (course.dripType === 'AFTER_ENROLLMENT' && course.dripDays) {
              const unlockDate = new Date(accessStartDate || now);
              unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
              if (now < unlockDate) {
                return NextResponse.json(
                  { error: 'Lesson is locked', lockReason: 'DRIP_LOCKED', unlockDate: unlockDate.toISOString() },
                  { status: 403 }
                );
              }
            }

            if (course.dripType === 'SCHEDULE' && course.dripDays) {
              const base = course.publishedAt || course.createdAt;
              const unlockDate = new Date(base);
              unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
              if (now < unlockDate) {
                return NextResponse.json(
                  { error: 'Lesson is locked', lockReason: 'SCHEDULE_LOCKED', unlockDate: unlockDate.toISOString() },
                  { status: 403 }
                );
              }
            }

            if (course.dripType === 'SEQUENTIAL') {
              const completed = await prisma.userProgress.findMany({
                where: { userId: user.id, lessonId: { in: globalLessons.map((l) => l.id) }, completed: true },
                select: { lessonId: true },
              });
              const completedSet = new Set(completed.map((p) => p.lessonId));

              for (let i = 0; i < idx; i++) {
                const prev = globalLessons[i];
                if (prev.isPreview) continue;
                if (!completedSet.has(prev.id)) {
                  return NextResponse.json(
                    { error: 'Lesson is locked', lockReason: 'SEQUENTIAL_LOCKED' },
                    { status: 403 }
                  );
                }
              }
            }
          }
        }
      }

      const answers = body.answers as unknown;
      const isValidAnswersArray =
        Array.isArray(answers) &&
        answers.every(
          (a) =>
            typeof a === 'number' ||
            (Array.isArray(a) && a.every((n) => typeof n === 'number'))
        );

      if (!isValidAnswersArray) {
        return NextResponse.json({ error: 'Invalid answers payload' }, { status: 400 });
      }

      const result = await submitQuiz(user.id, lessonId, answers as Array<number | number[]>);
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
