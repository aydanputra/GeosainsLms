import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/modules/auth/utils/auth';

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function clampLimit(raw: number | null, fallback = 20) {
  const limit = raw ?? fallback;
  return Math.max(1, Math.min(100, limit));
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dateKeyUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const tab = (req.nextUrl.searchParams.get('tab') || 'overview').trim().toLowerCase();
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cursor = (req.nextUrl.searchParams.get('cursor') || '').trim();
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = clampLimit(rawLimit, 20);
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));
    const courseId = (req.nextUrl.searchParams.get('courseId') || '').trim();

    const createdAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    if (tab === 'overview') {
      const now = new Date();
      const defaultTo = endOfUtcDay(now);
      const defaultFrom = startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)));

      const rangeFrom = startOfUtcDay(from ?? defaultFrom);
      const rangeTo = endOfUtcDay(to ?? defaultTo);

      const [
        publishedCourses,
        courseEnrolled,
        lessons,
        quizzes,
        questions,
        instructors,
        students,
        reviews,
        revenueAgg,
      ] = await Promise.all([
        prisma.course.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
        prisma.enrollment.count({ where: { course: { deletedAt: null } } }),
        prisma.lesson.count({ where: { module: { course: { deletedAt: null } } } }),
        prisma.quiz.count({ where: { lesson: { module: { course: { deletedAt: null } } } } }),
        prisma.question.count({ where: { quiz: { lesson: { module: { course: { deletedAt: null } } } } } }),
        prisma.user.count({ where: { role: 'MENTOR' } }),
        prisma.user.count({ where: { role: 'STUDENT' } }),
        prisma.courseReview.count({ where: { course: { deletedAt: null } } }),
        prisma.orderItem.aggregate({
          _sum: { price: true },
          where: {
            courseId: { not: null },
            ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
            order: { is: { status: 'PAID', ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) } },
          },
        }),
      ]);

      const [paidItems, rangeEnrollmentsCount, rangeEnrollments] = await Promise.all([
        prisma.orderItem.findMany({
          where: {
            courseId: { not: null },
            ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
            order: { is: { status: 'PAID', createdAt: { gte: rangeFrom, lte: rangeTo } } },
          },
          select: { price: true, order: { select: { createdAt: true } } },
        }),
        prisma.enrollment.count({
          where: {
            course: { deletedAt: null },
            ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
            createdAt: { gte: rangeFrom, lte: rangeTo },
          },
        }),
        prisma.enrollment.findMany({
          where: {
            course: { deletedAt: null },
            ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
            createdAt: { gte: rangeFrom, lte: rangeTo },
          },
          select: { createdAt: true },
        }),
      ]);

      const totalDays = Math.max(
        1,
        Math.floor((startOfUtcDay(rangeTo).getTime() - startOfUtcDay(rangeFrom).getTime()) / (24 * 60 * 60 * 1000)) + 1
      );

      const earningsByDay = new Map<string, number>();
      for (const it of paidItems) {
        const key = dateKeyUtc(startOfUtcDay(it.order.createdAt));
        earningsByDay.set(key, (earningsByDay.get(key) || 0) + Number(it.price || 0));
      }

      const enrollmentsByDay = new Map<string, number>();
      for (const e of rangeEnrollments) {
        const key = dateKeyUtc(startOfUtcDay(e.createdAt));
        enrollmentsByDay.set(key, (enrollmentsByDay.get(key) || 0) + 1);
      }

      const series: Array<{ date: string; totalEarning: number; courseEnrolled: number }> = [];
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(startOfUtcDay(rangeFrom));
        d.setUTCDate(d.getUTCDate() + i);
        const key = dateKeyUtc(d);
        series.push({
          date: key,
          totalEarning: earningsByDay.get(key) || 0,
          courseEnrolled: enrollmentsByDay.get(key) || 0,
        });
      }

      const totalEarning = series.reduce((sum, p) => sum + p.totalEarning, 0);

      return NextResponse.json(
        {
          overview: {
            publishedCourses,
            courseEnrolled,
            lessons,
            quizzes,
            questions,
            instructors,
            students,
            reviews,
            revenue: revenueAgg._sum.price || 0,
          },
          range: {
            from: rangeFrom,
            to: rangeTo,
            totalEarning,
            courseEnrolled: rangeEnrollmentsCount,
            totalRefund: null,
            totalDiscount: null,
          },
          earningsSeries: series,
        },
        { status: 200 }
      );
    }

    if (tab === 'courses') {
      const where: Prisma.CourseWhereInput = {
        deletedAt: null,
        ...(courseId && courseId !== 'ALL' ? { id: courseId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { instructor: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { instructor: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              ],
            }
          : {}),
      };

      const courses = await prisma.course.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          title: true,
          slug: true,
          createdAt: true,
          status: true,
          instructor: { select: { id: true, name: true, email: true } },
          _count: { select: { enrollments: true, modules: true } },
        },
      });

      const hasMore = courses.length > limit;
      const page = hasMore ? courses.slice(0, limit) : courses;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

      const courseIds = page.map((c) => c.id);
      const [lessonCounts, assignmentCounts, earningsByCourse] = await Promise.all([
        prisma.lesson.groupBy({
          by: ['moduleId'],
          where: { module: { courseId: { in: courseIds } } },
          _count: { _all: true },
        }),
        prisma.assignment.groupBy({
          by: ['lessonId'],
          where: { lesson: { module: { courseId: { in: courseIds } } } },
          _count: { _all: true },
        }),
        prisma.orderItem.groupBy({
          by: ['courseId'],
          where: { courseId: { in: courseIds }, order: { is: { status: 'PAID', ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) } } },
          _sum: { price: true },
        }),
      ]);

      const moduleById = new Map<string, string>();
      const modules = await prisma.module.findMany({
        where: { courseId: { in: courseIds } },
        select: { id: true, courseId: true },
      });
      for (const m of modules) moduleById.set(m.id, m.courseId);

      const lessonsByCourse = new Map<string, number>();
      for (const row of lessonCounts) {
        const courseIdForModule = moduleById.get(row.moduleId);
        if (!courseIdForModule) continue;
        lessonsByCourse.set(courseIdForModule, (lessonsByCourse.get(courseIdForModule) || 0) + (row._count._all || 0));
      }

      const assignmentsByCourse = new Map<string, number>();
      if (assignmentCounts.length > 0) {
        const lessonIds = assignmentCounts.map((x) => x.lessonId);
        const lessons = await prisma.lesson.findMany({
          where: { id: { in: lessonIds } },
          select: { id: true, moduleId: true },
        });
        const moduleIdByLessonId = new Map(lessons.map((l) => [l.id, l.moduleId] as const));
        for (const row of assignmentCounts) {
          const moduleId = moduleIdByLessonId.get(row.lessonId);
          if (!moduleId) continue;
          const courseIdForModule = moduleById.get(moduleId);
          if (!courseIdForModule) continue;
          assignmentsByCourse.set(courseIdForModule, (assignmentsByCourse.get(courseIdForModule) || 0) + (row._count._all || 0));
        }
      }

      const earningsMap = new Map<string, number>();
      for (const e of earningsByCourse) earningsMap.set(String(e.courseId), Number(e._sum.price || 0));

      return NextResponse.json(
        {
          courses: page.map((c) => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
            status: c.status,
            createdAt: c.createdAt,
            instructor: { id: c.instructor.id, name: c.instructor.name || c.instructor.email, email: c.instructor.email },
            lessons: lessonsByCourse.get(c.id) || 0,
            assignments: assignmentsByCourse.get(c.id) || 0,
            totalLearners: c._count.enrollments || 0,
            earnings: earningsMap.get(c.id) || 0,
          })),
          nextCursor,
        },
        { status: 200 }
      );
    }

    if (tab === 'reviews') {
      const reviews = await prisma.courseReview.findMany({
        where: {
          course: { deletedAt: null },
          ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
          ...(q
            ? {
                OR: [
                  { comment: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { user: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                  { user: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                  { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true, slug: true } },
        },
      });

      const hasMore = reviews.length > limit;
      const page = hasMore ? reviews.slice(0, limit) : reviews;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

      return NextResponse.json(
        {
          reviews: page.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt,
            student: { id: r.user.id, name: r.user.name || r.user.email, email: r.user.email },
            course: { id: r.course.id, title: r.course.title, slug: r.course.slug },
          })),
          nextCursor,
        },
        { status: 200 }
      );
    }

    if (tab === 'sales') {
      const items = await prisma.orderItem.findMany({
        where: {
          courseId: { not: null },
          order: { is: { ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) } },
          ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
          ...(q
            ? {
                OR: [
                  { order: { is: { id: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                  { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                  { course: { is: { instructor: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } },
                  { course: { is: { instructor: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } },
                ],
              }
            : {}),
        },
        orderBy: [{ order: { createdAt: 'desc' } }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          price: true,
          order: { select: { id: true, status: true, createdAt: true } },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              deletedAt: true,
              instructor: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      const filtered = items.filter((i) => i.course && !i.course.deletedAt);
      const hasMore = filtered.length > limit;
      const page = hasMore ? filtered.slice(0, limit) : filtered;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

      return NextResponse.json(
        {
          sales: page.map((it) => ({
            id: it.id,
            orderId: it.order.id,
            course: { id: it.course!.id, title: it.course!.title, slug: it.course!.slug },
            instructor: {
              id: it.course!.instructor.id,
              name: it.course!.instructor.name || it.course!.instructor.email,
              email: it.course!.instructor.email,
            },
            date: it.order.createdAt,
            status: it.order.status,
            price: it.price,
          })),
          nextCursor,
        },
        { status: 200 }
      );
    }

    if (tab === 'students') {
      const enrollmentStats = await prisma.enrollment.groupBy({
        by: ['userId'],
        where: {
          course: { deletedAt: null },
          ...(courseId && courseId !== 'ALL' ? { courseId } : {}),
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
        _count: { _all: true },
        _min: { createdAt: true },
      });

      const userIds = enrollmentStats.map((e) => e.userId);
      if (userIds.length === 0) {
        return NextResponse.json({ students: [], nextCursor: null }, { status: 200 });
      }

      const statsByUser = new Map<string, { courseTaken: number; firstEnrollmentAt: Date | null }>();
      for (const s of enrollmentStats) {
        statsByUser.set(s.userId, { courseTaken: s._count._all || 0, firstEnrollmentAt: s._min.createdAt ?? null });
      }

      const studentsList = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          role: 'STUDENT',
          ...(q
            ? {
                OR: [
                  { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const hasMore = studentsList.length > limit;
      const page = hasMore ? studentsList.slice(0, limit) : studentsList;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

      return NextResponse.json(
        {
          students: page.map((s) => {
            const stats = statsByUser.get(s.id) || { courseTaken: 0, firstEnrollmentAt: null };
            return {
              id: s.id,
              name: s.name || s.email,
              email: s.email,
              createdAt: stats.firstEnrollmentAt,
              courseTaken: stats.courseTaken,
            };
          }),
          nextCursor,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load reports' }, { status: 500 });
  }
}
