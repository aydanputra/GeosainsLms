import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';

async function generateUniqueSlug(tx: typeof prisma, title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  let slug = base || 'course';
  let counter = 1;
  while (true) {
    const existing = await tx.course.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${base || 'course'}-${counter}`;
    counter++;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: courseId } = await params;

    const created = await prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: {
              lessons: {
                orderBy: { order: 'asc' },
                include: {
                  assignment: true,
                  quiz: {
                    include: {
                      questions: {
                        orderBy: { order: 'asc' },
                        include: { options: { orderBy: { order: 'asc' } } },
                      },
                    },
                  },
                },
              },
            },
          },
          coInstructors: { select: { userId: true } },
        },
      });

      if (!course || course.deletedAt) throw new Error('Course not found');

      const isAdmin = user.role === 'ADMIN';
      const isInstructor = String(course.instructorId) === String(user.id);
      const isCoInstructor = (course.coInstructors || []).some((r) => String(r.userId) === String(user.id));
      if (!isAdmin && !isInstructor && !isCoInstructor) throw new Error('Forbidden');

      const ownerInstructorId = isAdmin ? String(course.instructorId) : String(user.id);
      const baseTitle = String(course.title || 'Kursus').trim() || 'Kursus';
      const nextTitle = baseTitle.length > 120 ? `${baseTitle.slice(0, 120)} (Copy)` : `${baseTitle} (Copy)`;
      const slug = await generateUniqueSlug(tx as any, `${nextTitle}`);

      const newCourse = await tx.course.create({
        data: {
          title: nextTitle,
          slug,
          description: course.description,
          price: course.price,
          normalPrice: course.normalPrice,
          thumbnailUrl: course.thumbnailUrl,
          subscriptionEligible: course.subscriptionEligible,
          subtitle: course.subtitle,
          learningOutcomes: Array.isArray(course.learningOutcomes) ? course.learningOutcomes : [],
          requirements: Array.isArray(course.requirements) ? course.requirements : [],
          audience: Array.isArray(course.audience) ? course.audience : [],
          enableQA: course.enableQA,
          isPublic: course.isPublic,
          reviewsEnabled: course.reviewsEnabled,
          certificateEnabled: course.certificateEnabled,
          tags: Array.isArray(course.tags) ? course.tags : [],
          prePurchaseNote: course.prePurchaseNote,
          status: 'DRAFT',
          level: course.level,
          categoryId: course.categoryId,
          categoryIds: Array.isArray((course as any).categoryIds) ? (course as any).categoryIds : [],
          publishedAt: null,
          dripDays: course.dripDays,
          dripEnabled: course.dripEnabled,
          dripType: course.dripType,
          enrollmentEndDate: course.enrollmentEndDate,
          maxStudents: course.maxStudents,
          validityDays: course.validityDays,
          introVideoUrl: course.introVideoUrl,
          instructorId: ownerInstructorId,
        } as any,
        select: { id: true, slug: true },
      });

      const lessonIdMap = new Map<string, string>();

      for (const mod of course.modules || []) {
        const newModule = await tx.module.create({
          data: {
            title: mod.title,
            description: mod.description,
            courseId: newCourse.id,
            order: mod.order,
          },
          select: { id: true },
        });

        for (const lesson of mod.lessons || []) {
          const newLesson = await tx.lesson.create({
            data: {
              title: lesson.title,
              type: lesson.type,
              content: lesson.content as any,
              videoId: lesson.videoId,
              duration: lesson.duration,
              isPreview: lesson.isPreview,
              moduleId: newModule.id,
              order: lesson.order,
            } as any,
            select: { id: true },
          });

          lessonIdMap.set(lesson.id, newLesson.id);

          if (lesson.assignment) {
            await tx.assignment.create({
              data: {
                lessonId: newLesson.id,
                title: lesson.assignment.title,
                description: lesson.assignment.description,
                timeLimit: lesson.assignment.timeLimit,
                passingGrade: lesson.assignment.passingGrade,
                maxFileSize: lesson.assignment.maxFileSize,
              },
            });
          }

          if (lesson.quiz) {
            const q = lesson.quiz;
            const newQuiz = await tx.quiz.create({
              data: {
                lessonId: newLesson.id,
                title: q.title,
                retryLimit: q.retryLimit,
                description: q.description,
                passingGrade: q.passingGrade,
                timeLimit: q.timeLimit,
                hideQuizTime: q.hideQuizTime,
                quizAutoStart: q.quizAutoStart,
                questionLayout: q.questionLayout,
                questionOrder: q.questionOrder,
                hideQuestionNo: q.hideQuestionNo,
                shortAnswerCharLimit: q.shortAnswerCharLimit,
                essayCharLimit: q.essayCharLimit,
                maxQuestions: q.maxQuestions,
              } as any,
              select: { id: true },
            });

            for (const question of q.questions || []) {
              const newQuestion = await tx.question.create({
                data: {
                  quizId: newQuiz.id,
                  text: question.text,
                  correctAnswer: question.correctAnswer,
                  correctAnswers: Array.isArray(question.correctAnswers) ? question.correctAnswers : [],
                  explanation: question.explanation,
                  order: question.order,
                  answerKey: question.answerKey,
                  type: question.type,
                  points: question.points,
                  answerRequired: question.answerRequired,
                  randomizeOptions: question.randomizeOptions,
                  multipleCorrect: question.multipleCorrect,
                  displayPoints: question.displayPoints,
                } as any,
                select: { id: true },
              });

              for (const opt of question.options || []) {
                await tx.option.create({
                  data: {
                    questionId: newQuestion.id,
                    text: opt.text,
                    order: opt.order,
                  },
                });
              }
            }
          }
        }
      }

      return newCourse;
    });

    return NextResponse.json(
      {
        ok: true,
        id: created.id,
        slug: created.slug,
        redirectUrl: `/dashboard/mentor/courses/${encodeURIComponent(created.id)}/edit`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menyalin kursus' }, { status: 400 });
  }
}

