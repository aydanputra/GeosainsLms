import { prisma } from '@/utils/prisma';
import { z } from 'zod';
import { LessonType, CourseStatus, CourseLevel, DripType } from '@prisma/client';

// Helper for YouTube ID extraction
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  // Handle if it's already an ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Schemas
export const CourseSchema = z.object({
  title: z.string().min(3),
  subtitle: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  price: z.number().min(0).default(0),
  normalPrice: z.number().min(0).optional().nullable(),
  subscriptionEligible: z.boolean().default(false),
  status: z.nativeEnum(CourseStatus).default(CourseStatus.DRAFT),
  level: z.nativeEnum(CourseLevel).default(CourseLevel.BEGINNER),
  categoryId: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  instructorId: z.string(),
  thumbnailUrl: z.string().optional(),
  introVideoUrl: z.string().optional(),
  published: z.boolean().optional(), // For backward compatibility in API payload
  learningOutcomes: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  audience: z.array(z.string()).optional(),
  enableQA: z.boolean().default(true),
  isPublic: z.boolean().default(false),
  reviewsEnabled: z.boolean().default(true),
  certificateEnabled: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
  prePurchaseNote: z.string().max(2000).optional().nullable(),
  
  // Enrollment
  maxStudents: z.number().int().optional().nullable(),
  validityDays: z.number().int().optional().nullable(),
  enrollmentEndDate: z.string().optional().nullable(), // ISO String

  // Content Drip
  dripEnabled: z.boolean().default(false),
  dripType: z.nativeEnum(DripType).default(DripType.NONE),
  dripDays: z.number().int().optional().nullable(),
});

export const LessonSchema = z.object({
  title: z.string().min(3),
  type: z.nativeEnum(LessonType),
  content: z.any().optional(), // JSON content
  videoUrl: z.string().optional(), // Input can be URL
  videoId: z.string().optional(),  // Or direct ID
  moduleId: z.string(),
  order: z.number().int(),
  duration: z.number().int().default(0),
  isPreview: z.boolean().default(false),
});

export const QuizSchema = z.object({
  lessonId: z.string(),
  description: z.string().optional(),
  retryLimit: z.number().nullable().optional(),
  passingGrade: z.number().default(80),
  timeLimit: z.number().nullable().optional(),
  hideQuizTime: z.boolean().default(false),
  quizAutoStart: z.boolean().default(false),
  questionLayout: z.string().default('SINGLE_QUESTION'),
  questionOrder: z.string().default('RANDOM'),
  hideQuestionNo: z.boolean().default(false),
  shortAnswerCharLimit: z.number().nullable().optional(),
  essayCharLimit: z.number().nullable().optional(),
  maxQuestions: z.number().nullable().optional(),
  questions: z.array(z.object({
    text: z.string(),
    type: z.string().default('MULTIPLE_CHOICE'),
    points: z.number().default(1),
    answerRequired: z.boolean().default(false),
    randomizeOptions: z.boolean().default(false),
    multipleCorrect: z.boolean().default(false),
    displayPoints: z.boolean().default(true),
    options: z.array(z.object({ text: z.string() })).optional(),
    correctAnswer: z.number().int().optional(),
    correctAnswers: z.array(z.number().int()).default([]),
    answerKey: z.string().optional(),
    explanation: z.string().optional(),
  })),
});

// Helper for unique slug generation
async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existing = await prisma.course.findUnique({
      where: { slug },
      select: { id: true }
    });
    
    if (!existing) return slug;
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Publish Validation
export const validateCourseBeforePublish = async (courseId: string) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        include: {
          lessons: {
            include: {
              assignment: true,
              quiz: {
                include: {
                  questions: {
                    include: {
                      options: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!course) throw new Error('Course not found');

  // 0. Basic Info Validation
  if (!course.title || course.title.length < 5) throw new Error('Course title is too short (min 5 chars).');
  if (!course.categoryId) throw new Error('Course must have a category assigned.');
  if (course.price < 0) throw new Error('Price cannot be negative.');

  // 1. Minimal 1 module
  if (course.modules.length === 0) {
    throw new Error('Course must have at least one module before publishing.');
  }

  let totalValidLessons = 0;

  for (const courseModule of course.modules) {
    // 2. Setiap module punya minimal 1 lesson
    if (courseModule.lessons.length === 0) {
      throw new Error(`Module "${courseModule.title}" is empty. Please add at least one lesson.`);
    }

    for (const lesson of courseModule.lessons) {
      totalValidLessons++;

      // 3. Lesson VIDEO wajib punya videoId valid
      if (lesson.type === 'VIDEO') {
        if (!lesson.videoId) {
          throw new Error(`Lesson "${lesson.title}" is a VIDEO type but has no valid Video ID.`);
        }
      }

      // 4. Lesson TEXT wajib punya content
      if (lesson.type === 'TEXT') {
        if ((lesson as any).assignment) {
          const desc = (lesson as any).assignment?.description;
          if (!desc || (typeof desc === 'string' && desc.trim().length === 0)) {
            throw new Error(`Assignment "${lesson.title}" has no description.`);
          }
        } else {
        const content = lesson.content as any;
        // Check for empty string, null, or empty object/array
        if (!content || 
            (typeof content === 'string' && content.trim().length === 0) ||
            (typeof content === 'object' && Object.keys(content).length === 0)) {
               throw new Error(`Lesson "${lesson.title}" is a TEXT type but has no content.`);
        }
        }
      }

      // 5. Lesson QUIZ wajib punya Quiz dan Question valid
      if (lesson.type === 'QUIZ') {
        if (!lesson.quiz) {
            throw new Error(`Lesson "${lesson.title}" is a QUIZ type but quiz data is missing.`);
        }
        if (lesson.quiz.questions.length === 0) {
            throw new Error(`Quiz in lesson "${lesson.title}" has no questions.`);
        }
        
        for (const q of lesson.quiz.questions) {
            if (q.options.length < 2) {
                throw new Error(`Question "${q.text}" in "${lesson.title}" must have at least 2 options.`);
            }
            if (q.correctAnswer === null || q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
                throw new Error(`Question "${q.text}" has an invalid correct answer index.`);
            }
        }
      }
    }
  }

  // 6. Final check
  if (totalValidLessons === 0) {
      throw new Error('Course must have at least one valid lesson.');
  }

  return true;
};

// Course Services
export const createCourse = async (data: z.infer<typeof CourseSchema>) => {
  // If slug is provided, check uniqueness. If duplicate, append random suffix or fail.
  // If no slug provided, generate unique one.
  let slug = data.slug;
  if (slug) {
    const existing = await prisma.course.findUnique({
        where: { slug },
        select: { id: true }
    });
    if (existing) {
        // If provided slug exists, try to make it unique or fallback to auto-generate
        // Ideally we should throw error if user manually set it, but for wizard flow, let's auto-fix
        slug = await generateUniqueSlug(data.title); 
    }
  } else {
    slug = await generateUniqueSlug(data.title);
  }
  
  let status = data.status;
  if (data.published !== undefined) {
    status = data.published ? CourseStatus.PUBLISHED : CourseStatus.DRAFT;
  }

  const { published, ...createData } = data;
  const categoryIds = Array.isArray((createData as any).categoryIds)
    ? (createData as any).categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean)
    : [];
  const categoryId = typeof (createData as any).categoryId === 'string' ? String((createData as any).categoryId).trim() : '';
  if (categoryIds.length > 0 && !categoryId) (createData as any).categoryId = categoryIds[0];
  if (categoryId && categoryIds.length === 0) (createData as any).categoryIds = [categoryId];

  return prisma.course.create({
    data: ({
      ...createData,
      slug,
      status,
      publishedAt: status === CourseStatus.PUBLISHED ? new Date() : null,
    } as any),
  });
};

export const getCourses = async (publishedOnly = true, instructorId?: string) => {
  return prisma.course.findMany({
    where: {
      deletedAt: null,
      ...(publishedOnly ? { status: CourseStatus.PUBLISHED } : {}),
      ...(instructorId ? { instructorId } : {}),
    },
    include: {
      instructor: {
        select: { name: true, email: true },
      },
      category: {
        select: { name: true },
      },
      modules: {
        include: {
          lessons: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getEnrolledCourses = async (userId: string) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          instructor: {
            select: { name: true, email: true },
          },
          category: {
            select: { name: true },
          },
          modules: {
            include: {
              lessons: true,
            },
          },
        },
      },
    },
  });
  const now = new Date();
  return enrollments
    .filter((e) => e.course.deletedAt === null)
    .filter((e) => {
      const validityDays = e.course.validityDays;
      if (!validityDays || validityDays <= 0) return true;
      const expiresAt = new Date(e.createdAt);
      expiresAt.setDate(expiresAt.getDate() + validityDays);
      return now <= expiresAt;
    })
    .map((e) => e.course);
};

export const getCourseById = async (id: string) => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      instructor: {
        select: { name: true, email: true },
      },
      category: true,
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
                    include: { options: { orderBy: { order: 'asc' } } }
                  }
                }
              },
              attachments: true,
            },
          },
        },
      },
    },
  });

  if (!course || course.deletedAt) return null;
  return course;
};

export const updateCourse = async (id: string, data: Partial<z.infer<typeof CourseSchema>>) => {
  let status = data.status;
  if (data.published !== undefined) {
    status = data.published ? CourseStatus.PUBLISHED : CourseStatus.DRAFT;
  }
  
  if (status === CourseStatus.PUBLISHED) {
    await validateCourseBeforePublish(id);
  }

  const { published, ...updateData } = data;
  
  // Clean up undefined/null values that shouldn't override existing data
  // But allow explicitly null if schema permits (like dates)
  const payload: any = {};
  Object.keys(updateData).forEach(key => {
    // @ts-ignore
    const value = updateData[key];
    // Skip undefined values, but keep nulls if valid
    if (value !== undefined) {
        payload[key] = value;
    }
  });

  const normalizedCategoryIds = Array.isArray(payload.categoryIds)
    ? payload.categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean)
    : null;
  const normalizedCategoryId = typeof payload.categoryId === 'string' ? String(payload.categoryId).trim() : null;
  if (normalizedCategoryIds) {
    payload.categoryIds = normalizedCategoryIds;
    if (normalizedCategoryIds.length > 0 && (!normalizedCategoryId || normalizedCategoryId === 'null')) {
      payload.categoryId = normalizedCategoryIds[0];
    }
  }
  if (normalizedCategoryId && (!normalizedCategoryIds || normalizedCategoryIds.length === 0)) {
    payload.categoryId = normalizedCategoryId;
    payload.categoryIds = [normalizedCategoryId];
  }

  if (status) {
    payload.status = status;
    if (status === CourseStatus.PUBLISHED) {
      payload.publishedAt = new Date();
    }
  }

  return prisma.course.update({
    where: { id },
    data: payload,
  });
};

export const deleteCourse = async (id: string) => {
  return prisma.course.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

// Lesson Services
export const createLesson = async (data: z.infer<typeof LessonSchema>) => {
  let videoId = data.videoId;
  if (data.type === 'VIDEO' && data.videoUrl) {
    const extracted = extractYoutubeId(data.videoUrl);
    if (extracted) {
      videoId = extracted;
    } else {
      throw new Error('Invalid YouTube URL');
    }
  }

  const { videoUrl, ...lessonData } = data;

  return prisma.lesson.create({
    data: {
      ...lessonData,
      videoId,
    },
  });
};

export const updateLesson = async (id: string, data: Partial<z.infer<typeof LessonSchema>>) => {
  let videoId = data.videoId;
  if (data.type === 'VIDEO' && data.videoUrl) {
    const extracted = extractYoutubeId(data.videoUrl);
    if (extracted) {
      videoId = extracted;
    } else {
      throw new Error('Invalid YouTube URL');
    }
  }

  const { videoUrl, ...lessonData } = data;

  return prisma.lesson.update({
    where: { id },
    data: {
      ...lessonData,
      ...(videoId !== undefined && { videoId }),
    },
  });
};

// Quiz Services
export const createQuiz = async (data: any) => {
  // Use upsert or delete+create to handle updates
  // Since we want to replace questions, delete+create is safer for nested relations
  
  return prisma.$transaction(async (tx) => {
    let effectiveRetryLimit: number | null | undefined = undefined;
    if (typeof data?.retryLimit === 'number') {
      effectiveRetryLimit = data.retryLimit > 0 ? Math.floor(data.retryLimit) : null;
    } else if (data?.retryLimit === null) {
      effectiveRetryLimit = null;
    }

    if (effectiveRetryLimit === undefined) {
      const settingsPage = await tx.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
      let settings: any = {};
      try {
        settings = settingsPage?.content ? JSON.parse(settingsPage.content) : {};
      } catch {
        settings = {};
      }
      const def = settings?.defaultQuizRetryLimit;
      effectiveRetryLimit = typeof def === 'number' && def > 0 ? Math.floor(def) : null;
    }

    // 1. Find existing quiz
    const existing = await tx.quiz.findUnique({ where: { lessonId: data.lessonId } });
    
    if (existing) {
        // Delete existing quiz (cascade will delete questions/options)
        await tx.quiz.delete({ where: { id: existing.id } });
    }

    // 2. Create new quiz
    return tx.quiz.create({
        data: {
        lessonId: data.lessonId,
        description: data.description,
        retryLimit: effectiveRetryLimit,
        passingGrade: data.passingGrade,
        timeLimit: data.timeLimit,
        hideQuizTime: data.hideQuizTime,
        quizAutoStart: data.quizAutoStart,
        questionLayout: data.questionLayout,
        questionOrder: data.questionOrder,
        hideQuestionNo: data.hideQuestionNo,
        shortAnswerCharLimit: data.shortAnswerCharLimit,
        essayCharLimit: data.essayCharLimit,
        maxQuestions: data.maxQuestions,
        questions: {
            create: data.questions.map((q: any, idx: number) => ({
            text: q.text,
            type: q.type,
            points: q.points,
            answerRequired: q.answerRequired,
            randomizeOptions: q.randomizeOptions,
            displayPoints: q.displayPoints,
            correctAnswer: q.correctAnswer,
            correctAnswers: q.correctAnswers,
            answerKey: q.answerKey,
            explanation: q.explanation,
            order: idx,
            options: {
                create: q.options?.map((opt: any, optIdx: number) => ({
                text: opt.text,
                order: optIdx
                })) || []
            }
            })),
        },
        },
        include: {
        questions: {
            include: {
            options: true
            }
        },
        },
    });
  });
};

export const submitQuiz = async (userId: string, lessonId: string, answers: Array<number | number[]>) => {
  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  if (!quiz) throw new Error('Quiz not found');
  
  const totalPoints = quiz.questions.reduce((acc: number, q: any) => acc + (typeof q.points === 'number' ? q.points : 1), 0);
  let earnedPoints = 0;

  quiz.questions.forEach((q: any, index: number) => {
    const points = typeof q.points === 'number' ? q.points : 1;
    const answer = answers[index];
    if (answer === undefined || answer === null) return;

    const correctAnswers: number[] = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
    const multipleCorrect = Boolean(q.multipleCorrect) || correctAnswers.length > 0;

    if (multipleCorrect) {
      const submitted = Array.isArray(answer) ? answer : [answer];
      const submittedSorted = [...submitted].sort((a, b) => a - b);
      const correctSorted = [...correctAnswers].sort((a, b) => a - b);
      const isCorrect =
        submittedSorted.length === correctSorted.length &&
        submittedSorted.every((v, i) => v === correctSorted[i]);
      if (isCorrect) earnedPoints += points;
      return;
    }

    if (typeof q.correctAnswer === 'number' && q.correctAnswer === answer) {
      earnedPoints += points;
    }
  });

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = score >= (quiz.passingGrade ?? 80);

  // Use transaction for race condition safety
  let attemptCount: number | null = null;
  await prisma.$transaction(async (tx) => {
    // 1. Re-check retry limit inside transaction with lock
    // Only count completed attempts (where completedAt is not null)
    const attempts = await tx.quizAttempt.count({
      where: {
        userId,
        quizId: quiz.id,
        completedAt: { not: null },
      },
    });

    if (quiz?.retryLimit && attempts >= quiz.retryLimit) {
      throw new Error('QUIZ_RETRY_LIMIT_REACHED');
    }

    // 2. Create Attempt
    await tx.quizAttempt.create({
      data: {
        userId,
        quizId: quiz.id,
        score,
        answers,
        completedAt: new Date(), // Always set completedAt for final submit
      }
    });
    attemptCount = attempts + 1;

    if (passed) {
      const existingProgress = await tx.userProgress.findUnique({
        where: {
          userId_lessonId: {
            userId: userId,
            lessonId: lessonId,
          },
        },
      });

      if (existingProgress) {
        if (!existingProgress.completed) {
          await tx.userProgress.update({
            where: { id: existingProgress.id },
            data: { completed: true },
          });
        }
      } else {
        await tx.userProgress.create({
          data: {
            userId: userId,
            lessonId: lessonId,
            completed: true,
          },
        });
      }
    }
  });

  if (passed) {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
    if (lesson) {
      await checkAndIssueCertificate(userId, lesson.module.courseId);
    }
  }

  // Return fresh progress status
  const progress = await prisma.userProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  return {
    score,
    passed,
    progress,
    attemptCount,
  };
};

// Progress Services
export const markLessonComplete = async (userId: string, lessonId: string) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: true } },
      quiz: { select: { id: true, passingGrade: true } },
      assignment: { select: { id: true, passingGrade: true } },
    },
  });

  if (!lesson) throw new Error('Lesson not found');

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId: lesson.module.courseId,
      },
    },
    select: { createdAt: true },
  });

  if (!enrollment) throw new Error('User not enrolled in this course');

  const validityDays = lesson.module.course.validityDays;
  if (validityDays && validityDays > 0) {
    const expiresAt = new Date(enrollment.createdAt);
    expiresAt.setDate(expiresAt.getDate() + validityDays);
    if (new Date() > expiresAt) {
      throw new Error('ENROLLMENT_EXPIRED');
    }
  }

  const course = lesson.module.course;
  if (course.dripEnabled) {
    const modules = await prisma.module.findMany({
      where: { courseId: course.id },
      orderBy: { order: 'asc' },
      select: {
        lessons: {
          orderBy: { order: 'asc' },
          select: { id: true, isPreview: true },
        },
      },
    });

    const globalLessons = modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, isPreview: l.isPreview })));
    const idx = globalLessons.findIndex((l) => l.id === lessonId);
    const now = new Date();

    if (idx >= 0 && !lesson.isPreview) {
      if (course.dripType === 'AFTER_ENROLLMENT' && course.dripDays) {
        const unlockDate = new Date(enrollment.createdAt);
        unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
        if (now < unlockDate) {
          throw new Error('DRIP_LOCKED');
        }
      }

      if (course.dripType === 'SCHEDULE' && course.dripDays) {
        const base = course.publishedAt || course.createdAt;
        const unlockDate = new Date(base);
        unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
        if (now < unlockDate) {
          throw new Error('SCHEDULE_LOCKED');
        }
      }

      if (course.dripType === 'SEQUENTIAL') {
        const completed = await prisma.userProgress.findMany({
          where: { userId, lessonId: { in: globalLessons.map((l) => l.id) }, completed: true },
          select: { lessonId: true },
        });
        const completedSet = new Set(completed.map((p) => p.lessonId));

        for (let i = 0; i < idx; i++) {
          const prev = globalLessons[i];
          if (prev.isPreview) continue;
          if (!completedSet.has(prev.id)) {
            throw new Error('SEQUENTIAL_LOCKED');
          }
        }
      }
    }
  }

  if (lesson.quiz?.id) {
    const bestAttempt = await prisma.quizAttempt.findFirst({
      where: { userId, quizId: lesson.quiz.id, completedAt: { not: null } },
      orderBy: { score: 'desc' },
      select: { score: true },
    });

    const passingGrade = lesson.quiz.passingGrade ?? 80;
    if (!bestAttempt || bestAttempt.score < passingGrade) {
      throw new Error('QUIZ_NOT_PASSED');
    }
  }

  if (lesson.assignment?.id) {
    const bestSubmission = await prisma.assignmentSubmission.findFirst({
      where: {
        userId,
        assignmentId: lesson.assignment.id,
        status: 'GRADED',
        grade: { not: null },
      },
      orderBy: { grade: 'desc' },
      select: { grade: true },
    });

    const passingGrade = lesson.assignment.passingGrade ?? 0;
    if (!bestSubmission || typeof bestSubmission.grade !== 'number' || bestSubmission.grade < passingGrade) {
      throw new Error('ASSIGNMENT_NOT_PASSED');
    }
  }

  const existingProgress = await prisma.userProgress.findUnique({
    where: {
      userId_lessonId: {
        userId,
        lessonId,
      },
    },
  });

  if (existingProgress) {
    if (existingProgress.completed) {
      return existingProgress; // Idempotent: If already complete, return as is
    }
    return prisma.userProgress.update({
      where: { id: existingProgress.id },
      data: { completed: true },
    });
  }

  const progress = await prisma.userProgress.create({
    data: {
      userId,
      lessonId,
      completed: true,
    },
  });

  // Check if course is fully completed to issue certificate
  // We do this async or here
  await checkAndIssueCertificate(userId, lesson.module.courseId);

  return progress;
};

import { issueCertificateIfEligible } from '@/modules/certificates/api/service';

// ... (existing code)

function safeParseCourseSettings(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

const checkAndIssueCertificate = async (userId: string, courseId: string) => {
    try {
        const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
        const settings = safeParseCourseSettings(settingsPage?.content);
        const certificatesEnabled = settings['certificatesEnabled'] !== false;
        const autoIssue = settings['autoIssueCertificateOnCompletion'] !== false;
        if (!certificatesEnabled || !autoIssue) return;
        await issueCertificateIfEligible(userId, courseId);
    } catch (error) {
        console.error('Failed to issue certificate:', error);
        // Don't throw, just log. Certificate can be issued later.
    }
};

export const generateCertificate = async (userId: string, courseId: string) => {
  const course = (await prisma.course.findUnique({
    where: { id: courseId },
    select: ({ id: true, deletedAt: true, certificateEnabled: true } as any),
  })) as any;
  if (!course || course.deletedAt) throw new Error('Course not found');
  if (course.certificateEnabled === false) throw new Error('Sertifikat dinonaktifkan');

  const certificate = await issueCertificateIfEligible(userId, courseId);
  if (!certificate) throw new Error('Kursus belum selesai');
  return certificate;
};
