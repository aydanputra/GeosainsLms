import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { getCourseById, updateCourse, deleteCourse } from '@/modules/course/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import { CourseStatus, Prisma } from '@prisma/client';
import { writeAuditLog } from '@/utils/audit';
import { getCourseRuntimeSettings } from '@/modules/course/api/performance';

function toNullableInt(value: unknown): number | null | undefined {
  if (value === '' || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return undefined;
}

function toNullableFloat(value: unknown): number | null | undefined {
  if (value === '' || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && typeof (item as { value?: unknown }).value === 'string') {
        return (item as { value: string }).value.trim();
      }
      return '';
    })
    .filter(Boolean);
}

async function getCoursePermissionSettings() {
  const raw = await getCourseRuntimeSettings();
  return {
    allowInstructorsToPublishCourses: raw.allowInstructorsToPublishCourses !== false,
    allowInstructorsToTrashCourses: raw.allowInstructorsToTrashCourses !== false,
    allowInstructorsToChangeCourseAuthor: raw.allowInstructorsToChangeCourseAuthor === true,
  };
}

async function isCourseCoInstructor(courseId: string, userId: string) {
  const row = await prisma.courseCoInstructor.findUnique({
    where: { courseId_userId: { courseId, userId } } as any,
    select: { id: true },
  });
  return Boolean(row);
}

function normalizeUpdatePayload(body: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...body };

  if (typeof normalized.categoryId === 'string') {
    normalized.categoryId = normalized.categoryId.trim();
    if (!normalized.categoryId) normalized.categoryId = null;
  }
  if (Array.isArray((normalized as any).categoryIds)) {
    (normalized as any).categoryIds = (normalized as any).categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean);
  }
  if (Array.isArray((normalized as any).categoryIds) && (normalized as any).categoryIds.length > 0 && (normalized.categoryId === null || normalized.categoryId === undefined)) {
    normalized.categoryId = String((normalized as any).categoryIds[0] || '').trim() || null;
  }
  if (typeof normalized.categoryId === 'string' && normalized.categoryId && !Array.isArray((normalized as any).categoryIds)) {
    (normalized as any).categoryIds = [normalized.categoryId];
  }

  if (typeof normalized.instructorId === 'string') {
    normalized.instructorId = normalized.instructorId.trim();
    if (!normalized.instructorId) delete normalized.instructorId;
  }

  normalized.maxStudents = toNullableInt(normalized.maxStudents);
  normalized.validityDays = toNullableInt(normalized.validityDays);
  normalized.dripDays = toNullableInt(normalized.dripDays);

  const price = toNullableFloat(normalized.price);
  if (price !== undefined) normalized.price = price ?? 0;

  const normalPrice = toNullableFloat(normalized.normalPrice);
  if (normalPrice !== undefined) normalized.normalPrice = normalPrice;

  if (normalized.enrollmentEndDate === '' || normalized.enrollmentEndDate === undefined) {
    normalized.enrollmentEndDate = null;
  }

  const reviewsEnabled = toOptionalBoolean(normalized.reviewsEnabled);
  if (reviewsEnabled !== undefined) normalized.reviewsEnabled = reviewsEnabled;

  const certificateEnabled = toOptionalBoolean(normalized.certificateEnabled);
  if (certificateEnabled !== undefined) normalized.certificateEnabled = certificateEnabled;

  const enableQA = toOptionalBoolean(normalized.enableQA);
  if (enableQA !== undefined) normalized.enableQA = enableQA;

  const isPublic = toOptionalBoolean(normalized.isPublic);
  if (isPublic !== undefined) normalized.isPublic = isPublic;

  const dripEnabled = toOptionalBoolean(normalized.dripEnabled);
  if (dripEnabled !== undefined) normalized.dripEnabled = dripEnabled;

  const learningOutcomes = toStringArray(normalized.learningOutcomes);
  if (learningOutcomes) normalized.learningOutcomes = learningOutcomes;

  const requirements = toStringArray(normalized.requirements);
  if (requirements) normalized.requirements = requirements;

  const audience = toStringArray(normalized.audience);
  if (audience) normalized.audience = audience;

  const tags = toStringArray(normalized.tags);
  if (tags) normalized.tags = tags;

  if (Object.prototype.hasOwnProperty.call(normalized, 'prePurchaseNote')) {
    const raw = normalized.prePurchaseNote;
    if (raw === '' || raw === null) {
      normalized.prePurchaseNote = null;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      normalized.prePurchaseNote = trimmed ? trimmed : null;
    }
  }

  return normalized;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const course = await getCourseById(id);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const moduleIds = Array.isArray(course.modules) ? course.modules.map((m: any) => m?.id).filter(Boolean) : [];
    const moduleDescriptions = moduleIds.length
      ? await prisma.$queryRaw<{ id: string; description: string | null }[]>(
          Prisma.sql`SELECT "id", "description" FROM "Module" WHERE "id" IN (${Prisma.join(moduleIds)})`
        )
      : [];
    const descriptionById = new Map(moduleDescriptions.map((r) => [r.id, r.description] as const));

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = user.id === course.instructorId;
    const isCoInstructor = !isAdmin && !isInstructor ? await isCourseCoInstructor(course.id, String(user.id)) : false;
    const isOwner = isAdmin || isInstructor || isCoInstructor;

    if (course.status !== CourseStatus.PUBLISHED && !isOwner) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (!isOwner) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: course.id,
          },
        },
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
      }

      const validityDays = course.validityDays;
      if (enrollment && validityDays && validityDays > 0) {
        const expiresAt = new Date(enrollment.createdAt);
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        if (new Date() > expiresAt) {
          return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
        }
      }
    }

    const safeCourse = isOwner
      ? course
      : {
          ...course,
          modules: course.modules.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              type: l.type,
              duration: l.duration,
              isPreview: l.isPreview,
              order: l.order,
              assignment: l.assignment
                ? {
                    id: l.assignment.id,
                    title: l.assignment.title,
                    timeLimit: l.assignment.timeLimit,
                    passingGrade: l.assignment.passingGrade,
                    maxFileSize: l.assignment.maxFileSize,
                  }
                : null,
              quiz: l.quiz
                ? {
                    id: l.quiz.id,
                    lessonId: l.quiz.lessonId,
                    retryLimit: l.quiz.retryLimit,
                    passingGrade: l.quiz.passingGrade,
                    timeLimit: l.quiz.timeLimit,
                    hideQuizTime: l.quiz.hideQuizTime,
                    quizAutoStart: l.quiz.quizAutoStart,
                    questionLayout: l.quiz.questionLayout,
                    questionOrder: l.quiz.questionOrder,
                    hideQuestionNo: l.quiz.hideQuestionNo,
                    shortAnswerCharLimit: l.quiz.shortAnswerCharLimit,
                    essayCharLimit: l.quiz.essayCharLimit,
                    maxQuestions: l.quiz.maxQuestions,
                  }
                : null,
            })),
          })),
        };

    const withModuleDescriptions = {
      ...safeCourse,
      modules: Array.isArray((safeCourse as any).modules)
        ? (safeCourse as any).modules.map((m: any) => ({
            ...m,
            description: descriptionById.get(m.id) ?? null,
          }))
        : [],
    };

    return NextResponse.json(withModuleDescriptions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch course' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = normalizeUpdatePayload((await req.json()) as Record<string, unknown>);

    const course = await prisma.course.findUnique({ where: { id }, select: { id: true, deletedAt: true, instructorId: true } });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = String(user.id) === course.instructorId;
    const isCoInstructor = !isAdmin && !isInstructor ? await isCourseCoInstructor(course.id, String(user.id)) : false;
    const isEditor = isAdmin || isInstructor || isCoInstructor;
    if (!isEditor) return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });

    const permissions = await getCoursePermissionSettings();

    const hasInstructorId = Object.prototype.hasOwnProperty.call(body, 'instructorId');
    if (hasInstructorId) {
      const nextInstructorId = typeof body.instructorId === 'string' ? body.instructorId.trim() : '';
      if (!nextInstructorId) return NextResponse.json({ error: 'instructorId tidak valid' }, { status: 400 });

      const wantsChangeInstructor = nextInstructorId !== course.instructorId;
      if (!wantsChangeInstructor) {
        delete (body as any).instructorId;
      } else {
        if (!isAdmin && !permissions.allowInstructorsToChangeCourseAuthor) {
          return NextResponse.json({ error: 'Tidak diizinkan mengubah author kursus' }, { status: 403 });
        }
        if (!isAdmin && !isInstructor) {
          return NextResponse.json({ error: 'Hanya author utama yang dapat mengubah author kursus' }, { status: 403 });
        }
        const target = await prisma.user.findUnique({ where: { id: nextInstructorId }, select: { id: true, role: true } });
        if (!target) return NextResponse.json({ error: 'Instructor tidak ditemukan' }, { status: 404 });
        if (target.role !== 'ADMIN' && target.role !== 'MENTOR') return NextResponse.json({ error: 'User bukan instruktur' }, { status: 400 });
      }
    }

    const requestedStatus = typeof body.status === 'string' ? body.status : null;
    const requestedPublished = typeof body.published === 'boolean' ? body.published : null;
    const wantsPublish = requestedPublished === true || requestedStatus === 'PUBLISHED';

    if (!isAdmin && wantsPublish && !permissions.allowInstructorsToPublishCourses) {
      return NextResponse.json({ error: 'Kursus perlu review admin sebelum dipublikasikan' }, { status: 403 });
    }

    await updateCourse(id, body);
    
    revalidateTag('public-course-detail-base', { expire: 0 });
    revalidateTag('course-page-site-settings', { expire: 0 });
    revalidateTag('public-course-catalog-data-shared', { expire: 0 });
    revalidateTag('public-course-slugs', { expire: 0 });
    revalidateTag('public-course-tag-slugs', { expire: 0 });
    revalidateTag('public-page-courses', { expire: 0 });
    revalidateTag('homepage-courses', { expire: 0 });
    revalidatePath('/courses');
    revalidatePath('/');
    
    // Fetch updated course with full relations (modules, lessons, etc.)
    // This is crucial for CourseWizard state consistency, especially for Review step validation
    const updatedCourse = await getCourseById(id);
    
    return NextResponse.json(updatedCourse);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Gagal memperbarui kursus' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PUT(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const course = await prisma.course.findUnique({ where: { id }, select: { id: true, deletedAt: true, instructorId: true } });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    if (user.role !== 'ADMIN' && String(user.id) !== course.instructorId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
    }

    const permissions = await getCoursePermissionSettings();
    if (user.role === 'MENTOR' && !permissions.allowInstructorsToTrashCourses) {
      return NextResponse.json({ error: 'Hanya admin yang dapat menghapus kursus' }, { status: 403 });
    }

    await deleteCourse(id);
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'COURSE_DELETE',
      entityType: 'Course',
      entityId: id,
    });

    revalidateTag('public-course-detail-base', { expire: 0 });
    revalidateTag('course-page-site-settings', { expire: 0 });
    revalidateTag('public-course-catalog-data-shared', { expire: 0 });
    revalidateTag('public-course-slugs', { expire: 0 });
    revalidateTag('public-course-tag-slugs', { expire: 0 });
    revalidateTag('public-page-courses', { expire: 0 });
    revalidateTag('homepage-courses', { expire: 0 });
    revalidatePath('/courses');
    revalidatePath('/');

    return NextResponse.json({ message: 'Course deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
