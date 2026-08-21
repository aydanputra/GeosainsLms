import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';
import { createCourse } from '@/modules/course/api/service';
import { CourseSchema } from '@/modules/course/api/service';

const COURSE_SETTINGS_SLUG = '__course_settings__';

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

function normalizeCoursePayload(body: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...body };

  if (typeof normalized.categoryId === 'string') {
    normalized.categoryId = normalized.categoryId.trim();
    if (!normalized.categoryId) delete normalized.categoryId;
  }

  const categoryIds = toStringArray((normalized as any).categoryIds);
  if (categoryIds) (normalized as any).categoryIds = categoryIds;
  if (Array.isArray((normalized as any).categoryIds) && (normalized as any).categoryIds.length > 0 && !normalized.categoryId) {
    normalized.categoryId = String((normalized as any).categoryIds[0] || '').trim() || undefined;
  }
  if (typeof normalized.categoryId === 'string' && normalized.categoryId && !Array.isArray((normalized as any).categoryIds)) {
    (normalized as any).categoryIds = [normalized.categoryId];
  }

  if (typeof normalized.instructorId === 'string') {
    normalized.instructorId = normalized.instructorId.trim();
    if (!normalized.instructorId) delete normalized.instructorId;
  }

  if (typeof normalized.thumbnailUrl === 'string' && normalized.thumbnailUrl.startsWith('blob:')) {
    delete normalized.thumbnailUrl;
  }

  if (Object.prototype.hasOwnProperty.call(normalized, 'enrollmentEndDate')) {
    const enrollmentEndDate = normalized.enrollmentEndDate;
    normalized.enrollmentEndDate = enrollmentEndDate === '' || enrollmentEndDate === null ? null : enrollmentEndDate;
  }

  normalized.maxStudents = toNullableInt(normalized.maxStudents);
  normalized.validityDays = toNullableInt(normalized.validityDays);
  normalized.dripDays = toNullableInt(normalized.dripDays);

  const price = toNullableFloat(normalized.price);
  if (price !== undefined) normalized.price = price ?? 0;

  const normalPrice = toNullableFloat(normalized.normalPrice);
  if (normalPrice !== undefined) normalized.normalPrice = normalPrice;

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

function safeParseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function applyCourseDefaults(courseData: Record<string, unknown>, defaults: Record<string, unknown>) {
  const out = { ...courseData };

  const assignIfUndefined = (key: string) => {
    if (out[key] !== undefined) return;
    if (defaults[key] === undefined) return;
    out[key] = defaults[key];
  };

  assignIfUndefined('enableQA');
  assignIfUndefined('isPublic');
  assignIfUndefined('reviewsEnabled');
  assignIfUndefined('certificateEnabled');
  assignIfUndefined('level');
  assignIfUndefined('categoryId');
  assignIfUndefined('price');
  assignIfUndefined('subscriptionEligible');
  assignIfUndefined('maxStudents');
  assignIfUndefined('validityDays');
  assignIfUndefined('enrollmentEndDate');
  assignIfUndefined('dripEnabled');
  assignIfUndefined('dripType');
  assignIfUndefined('dripDays');

  return out;
}

export async function GET(req: NextRequest) {
  try {
    const publishedOnly = req.nextUrl.searchParams.get('published') !== 'false';
    const publicOnly = req.nextUrl.searchParams.get('publicOnly') === 'true';
    const instructorId = req.nextUrl.searchParams.get('instructorId') || undefined;

    if (publishedOnly) {
      const settingsPage = await prisma.page.findUnique({ where: { slug: COURSE_SETTINGS_SLUG }, select: { content: true } });
      const settings = safeParseJsonObject(settingsPage?.content);
      const mustLogin = settings['studentsMustBeLoggedInToViewCourse'] === true;
      if (mustLogin) {
        const token = req.cookies.get('token')?.value;
        const user = token ? await verifyToken(token) : null;
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Phase 3: Soft delete enforcement
    const where: any = {
      deletedAt: null,
    };

    if (instructorId) {
      where.instructorId = instructorId;
    }

    if (publishedOnly) {
      where.status = CourseStatus.PUBLISHED;
    }

    if (publicOnly) {
      where.isPublic = true;
    }
    
    const courses = await prisma.course.findMany({
      where,
      include: {
        instructor: { select: { name: true, email: true } },
        category: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const courseIds = courses.map((c) => c.id);
    const ratings =
      courseIds.length > 0
        ? await prisma.courseReview.groupBy({
            by: ['courseId'],
            where: { courseId: { in: courseIds } },
            _avg: { rating: true },
            _count: { rating: true },
          })
        : [];

    const ratingMap = new Map(
      ratings.map((r) => [
        r.courseId,
        {
          ratingAvg: r._avg.rating ?? 0,
          ratingCount: r._count.rating ?? 0,
        },
      ])
    );
    
    return NextResponse.json(
      courses.map((c) => ({
        ...c,
        thumbnailUrl: typeof c.thumbnailUrl === 'string' && c.thumbnailUrl.startsWith('blob:') ? null : c.thumbnailUrl,
        ratingAvg: ratingMap.get(c.id)?.ratingAvg ?? 0,
        ratingCount: ratingMap.get(c.id)?.ratingCount ?? 0,
      }))
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Tidak terotorisasi' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = normalizeCoursePayload((await req.json()) as Record<string, unknown>);

    if (!body.title) {
      return NextResponse.json({ message: 'Judul kursus wajib diisi' }, { status: 400 });
    }

    // Determine instructorId: Use provided ID if Admin, otherwise use current user ID
    let instructorId = user.id;
    const requestedInstructorId = typeof body.instructorId === 'string' ? body.instructorId.trim() : '';
    if (user.role === 'ADMIN' && requestedInstructorId) {
      instructorId = requestedInstructorId;
    }

    // Verify instructor exists
    const instructorExists = await prisma.user.findUnique({ where: { id: instructorId } });
    if (!instructorExists) {
      if (instructorId === user.id) {
        return NextResponse.json({ message: 'Sesi tidak valid' }, { status: 401 });
      }
      return NextResponse.json({ message: `Pengguna instruktur tidak ditemukan (ID: ${instructorId})` }, { status: 400 });
    }
    
    // Pass everything to service, let service handle sanitization and assignment
    // Don't strip instructorId here if createCourse expects it
    const settingsPage = await prisma.page.findUnique({ where: { slug: COURSE_SETTINGS_SLUG }, select: { content: true } });
    const defaults = safeParseJsonObject(settingsPage?.content);

    const courseData = applyCourseDefaults(
      {
      ...body,
      instructorId: instructorId,
      },
      defaults
    );

    const parsedCourse = CourseSchema.safeParse(courseData);
    if (!parsedCourse.success) {
      return NextResponse.json(
        { message: parsedCourse.error.issues[0]?.message || 'Data kursus tidak valid' },
        { status: 400 }
      );
    }

    // Use service layer for creation (handles slug generation)
    const course = await createCourse(parsedCourse.data);
    
    revalidateTag('public-course-catalog-data-shared');
    revalidateTag('public-course-slugs');
    revalidateTag('public-course-tag-slugs');
    revalidateTag('public-page-courses');
    revalidateTag('homepage-courses');
    return NextResponse.json(course, { status: 201 });
  } catch (error: any) {
    console.error("Create Course Error:", error);
    return NextResponse.json({ message: error.message || 'Gagal membuat kursus' }, { status: 500 });
  }
}
