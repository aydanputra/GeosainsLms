import { unstable_cache } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/utils/prisma';

const COURSE_SETTINGS_SLUG = '__course_settings__';
const COURSE_RUNTIME_REVALIDATE = 60;
const LESSON_RUNTIME_REVALIDATE = 30;

function safeParseSettings(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const getCachedCourseRuntimeSettings = unstable_cache(
  async () => {
    const page = await prisma.page.findUnique({
      where: { slug: COURSE_SETTINGS_SLUG },
      select: { content: true },
    });
    const settings = safeParseSettings(page?.content);
    return {
      becomeInstructorButtonEnabled: settings['becomeInstructorButtonEnabled'] === true,
      studentsMustBeLoggedInToViewCourse: settings['studentsMustBeLoggedInToViewCourse'] === true,
      allowStaffViewCourseContentWithoutEnrolling: settings['allowStaffViewCourseContentWithoutEnrolling'] !== false,
      courseRetakeEnabled: settings['courseRetakeEnabled'] === true,
      allowInstructorsToPublishCourses: settings['allowInstructorsToPublishCourses'] !== false,
      allowInstructorsToTrashCourses: settings['allowInstructorsToTrashCourses'] !== false,
      allowInstructorsToChangeCourseAuthor: settings['allowInstructorsToChangeCourseAuthor'] === true,
      defaultQuizRetryLimit:
        typeof settings['defaultQuizRetryLimit'] === 'number' && Number.isFinite(settings['defaultQuizRetryLimit'])
          ? Math.floor(settings['defaultQuizRetryLimit'] as number)
          : null,
      certificatesEnabled: settings['certificatesEnabled'] !== false,
      autoIssueCertificateOnCompletion: settings['autoIssueCertificateOnCompletion'] !== false,
    };
  },
  ['course-runtime-settings'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedCourseLessonSequence = unstable_cache(
  async (courseId: string) => {
    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            isPreview: true,
            order: true,
          },
        },
      },
    });

    const globalLessons = modules
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((module) =>
        module.lessons.map((lesson) => ({
          id: lesson.id,
          isPreview: lesson.isPreview,
          order: lesson.order,
        }))
      );

    return {
      modules,
      globalLessons,
    };
  },
  ['course-lesson-sequence'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedCourseOutlineBase = unstable_cache(
  async (slug: string) => {
    const course = await prisma.course.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        dripEnabled: true,
        dripType: true,
        dripDays: true,
        validityDays: true,
        subscriptionEligible: true,
        createdAt: true,
        publishedAt: true,
        instructorId: true,
        enableQA: true,
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
      },
    });

    if (!course) return null;

    const moduleIds = course.modules.map((module) => module.id);
    const moduleDescriptions = moduleIds.length
      ? await prisma.$queryRaw<Array<{ id: string; description: string | null }>>(
          Prisma.sql`SELECT "id", "description" FROM "Module" WHERE "id" IN (${Prisma.join(moduleIds)})`
        )
      : [];
    const descriptionById = new Map(moduleDescriptions.map((row) => [row.id, row.description] as const));

    return {
      ...course,
      modules: course.modules.map((module) => ({
        ...module,
        description: descriptionById.get(module.id) ?? null,
      })),
    };
  },
  ['course-outline-base'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedLessonPayload = unstable_cache(
  async (lessonId: string) => {
    return prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        assignment: true,
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },
  ['course-lesson-payload'],
  { revalidate: LESSON_RUNTIME_REVALIDATE }
);

const getCachedLessonAttachmentAccessContext = unstable_cache(
  async (attachmentId: string) => {
    return prisma.lessonAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        lessonId: true,
        name: true,
        type: true,
        url: true,
        storagePath: true,
        lesson: {
          select: {
            id: true,
            isPreview: true,
            module: {
              select: {
                course: {
                  select: {
                    id: true,
                    instructorId: true,
                    subscriptionEligible: true,
                    validityDays: true,
                    dripEnabled: true,
                    dripType: true,
                    dripDays: true,
                    publishedAt: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },
  ['course-lesson-attachment-context'],
  { revalidate: LESSON_RUNTIME_REVALIDATE }
);

const getCachedAssignmentAccessContext = unstable_cache(
  async (assignmentId: string) => {
    return prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        title: true,
        lessonId: true,
        maxFileSize: true,
        passingGrade: true,
        lesson: {
          select: {
            id: true,
            isPreview: true,
            content: true,
            module: {
              select: {
                courseId: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    instructorId: true,
                    subscriptionEligible: true,
                    validityDays: true,
                    dripEnabled: true,
                    dripType: true,
                    dripDays: true,
                    publishedAt: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },
  ['course-assignment-context'],
  { revalidate: LESSON_RUNTIME_REVALIDATE }
);

const getCachedCourseAccessContext = unstable_cache(
  async (courseId: string) => {
    return prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        slug: true,
        deletedAt: true,
        instructorId: true,
        status: true,
        validityDays: true,
        subscriptionEligible: true,
        enableQA: true,
        reviewsEnabled: true,
      },
    });
  },
  ['course-access-context'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedCourseMessagingContext = unstable_cache(
  async (courseId: string) => {
    return prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        slug: true,
        instructorId: true,
        deletedAt: true,
        status: true,
        coInstructors: { select: { userId: true } },
      },
    });
  },
  ['course-messaging-context'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedAnnouncementAccessContext = unstable_cache(
  async (announcementId: string) => {
    return prisma.announcement.findUnique({
      where: { id: announcementId },
      select: {
        id: true,
        course: {
          select: {
            id: true,
            instructorId: true,
            status: true,
            deletedAt: true,
            validityDays: true,
          },
        },
      },
    });
  },
  ['announcement-access-context'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedLessonCourseContext = unstable_cache(
  async (lessonId: string) => {
    return prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        module: {
          select: {
            courseId: true,
          },
        },
      },
    });
  },
  ['lesson-course-context'],
  { revalidate: LESSON_RUNTIME_REVALIDATE }
);

const getCachedCourseCommerceContext = unstable_cache(
  async (courseId: string) => {
    return prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        categoryId: true,
        categoryIds: true,
        status: true,
        deletedAt: true,
        instructorId: true,
        enrollmentEndDate: true,
        maxStudents: true,
        validityDays: true,
        subscriptionEligible: true,
        requirements: true,
      },
    });
  },
  ['course-commerce-context'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedLessonQuizAccessContext = unstable_cache(
  async (lessonId: string) => {
    return prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        isPreview: true,
        module: {
          select: {
            courseId: true,
            course: {
              select: {
                id: true,
                instructorId: true,
                subscriptionEligible: true,
                validityDays: true,
                dripEnabled: true,
                dripType: true,
                dripDays: true,
                publishedAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
  },
  ['lesson-quiz-access-context'],
  { revalidate: LESSON_RUNTIME_REVALIDATE }
);

const getCachedCourseCertificateContext = unstable_cache(
  async (courseId: string) => {
    return prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        deletedAt: true,
        instructorId: true,
        certificateEnabled: true,
        modules: {
          select: {
            lessons: {
              select: {
                id: true,
                quiz: { select: { id: true, passingGrade: true } },
                assignment: { select: { id: true, passingGrade: true } },
              },
            },
          },
        },
      },
    });
  },
  ['course-certificate-context'],
  { revalidate: COURSE_RUNTIME_REVALIDATE }
);

const getCachedQaThreadAccessContext = unstable_cache(
  async (threadId: string) => {
    return prisma.qAThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        title: true,
        question: true,
        status: true,
        createdAt: true,
        authorId: true,
        lessonId: true,
        lesson: { select: { id: true, title: true } },
        author: { select: { id: true, name: true, email: true, role: true } },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            instructorId: true,
            status: true,
            deletedAt: true,
            validityDays: true,
            enableQA: true,
            subscriptionEligible: true,
          },
        },
      },
    });
  },
  ['qa-thread-access-context'],
  { revalidate: LESSON_RUNTIME_REVALIDATE }
);

export async function getCourseRuntimeSettings() {
  return getCachedCourseRuntimeSettings();
}

export async function getCourseLessonSequence(courseId: string) {
  return getCachedCourseLessonSequence(courseId);
}

export async function getCourseOutlineBase(slug: string) {
  return getCachedCourseOutlineBase(slug);
}

export async function getLessonPayload(lessonId: string) {
  return getCachedLessonPayload(lessonId);
}

export async function getLessonAttachmentAccessContext(attachmentId: string) {
  return getCachedLessonAttachmentAccessContext(attachmentId);
}

export async function getAssignmentAccessContext(assignmentId: string) {
  return getCachedAssignmentAccessContext(assignmentId);
}

export async function getCourseAccessContext(courseId: string) {
  return getCachedCourseAccessContext(courseId);
}

export async function getCourseMessagingContext(courseId: string) {
  return getCachedCourseMessagingContext(courseId);
}

export async function getAnnouncementAccessContext(announcementId: string) {
  return getCachedAnnouncementAccessContext(announcementId);
}

export async function getLessonCourseContext(lessonId: string) {
  return getCachedLessonCourseContext(lessonId);
}

export async function getQaThreadAccessContext(threadId: string) {
  return getCachedQaThreadAccessContext(threadId);
}

export async function getCourseCommerceContext(courseId: string) {
  return getCachedCourseCommerceContext(courseId);
}

export async function getLessonQuizAccessContext(lessonId: string) {
  return getCachedLessonQuizAccessContext(lessonId);
}

export async function getCourseCertificateContext(courseId: string) {
  return getCachedCourseCertificateContext(courseId);
}
