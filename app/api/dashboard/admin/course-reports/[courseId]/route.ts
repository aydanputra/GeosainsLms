import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
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

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dateKeyUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { courseId } = await params;
    const tab = (req.nextUrl.searchParams.get('tab') || 'overview').trim().toLowerCase();
    const cursor = (req.nextUrl.searchParams.get('cursor') || '').trim();
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));

    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, slug: true, deletedAt: true, instructorId: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const totalLessons = await prisma.lesson.count({ where: { module: { courseId } } });
    const totalQuizzes = await prisma.quiz.count({ where: { lesson: { module: { courseId } } } });
    const totalAssignments = await prisma.assignment.count({ where: { lesson: { module: { courseId } } } });
    const totalStudents = await prisma.enrollment.count({ where: { courseId } });

    const now = new Date();
    const defaultTo = endOfUtcDay(now);
    const defaultFrom = startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)));
    const rangeFrom = startOfUtcDay(from ?? defaultFrom);
    const rangeTo = endOfUtcDay(to ?? defaultTo);

    if (tab === 'chart') {
      const metric = (req.nextUrl.searchParams.get('metric') || '').trim().toLowerCase();
      const resolvedMetric = metric || 'earning';

      const totalDays = Math.max(
        1,
        Math.floor((startOfUtcDay(rangeTo).getTime() - startOfUtcDay(rangeFrom).getTime()) / (24 * 60 * 60 * 1000)) + 1
      );

      if (resolvedMetric === 'enrolled') {
        const items = await prisma.enrollment.findMany({
          where: { courseId, createdAt: { gte: rangeFrom, lte: rangeTo } },
          select: { createdAt: true },
        });

        const byDay = new Map<string, number>();
        for (const it of items) {
          const key = dateKeyUtc(startOfUtcDay(it.createdAt));
          byDay.set(key, (byDay.get(key) || 0) + 1);
        }

        const series: Array<{ date: string; value: number }> = [];
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(startOfUtcDay(rangeFrom));
          d.setUTCDate(d.getUTCDate() + i);
          const key = dateKeyUtc(d);
          series.push({ date: key, value: byDay.get(key) || 0 });
        }

        return NextResponse.json(
          {
            chart: {
              metric: 'enrolled',
              title: 'Grafik Pendaftaran',
              from: rangeFrom,
              to: rangeTo,
              series,
            },
          },
          { status: 200 }
        );
      }

      if (resolvedMetric === 'refund') {
        const refundedItems = await prisma.orderItem.findMany({
          where: {
            courseId,
            refundAmount: { gt: 0 },
            order: { is: { status: 'PAID', createdAt: { gte: rangeFrom, lte: rangeTo } } },
          },
          select: { refundAmount: true, order: { select: { createdAt: true } } },
        });

        const byDay = new Map<string, number>();
        for (const it of refundedItems) {
          const key = dateKeyUtc(startOfUtcDay(it.order.createdAt));
          byDay.set(key, (byDay.get(key) || 0) + Number(it.refundAmount || 0));
        }

        const series: Array<{ date: string; value: number }> = [];
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(startOfUtcDay(rangeFrom));
          d.setUTCDate(d.getUTCDate() + i);
          const key = dateKeyUtc(d);
          series.push({ date: key, value: byDay.get(key) || 0 });
        }

        return NextResponse.json(
          {
            chart: {
              metric: 'refund',
              title: 'Grafik Total Refund',
              from: rangeFrom,
              to: rangeTo,
              series,
            },
          },
          { status: 200 }
        );
      }

      if (resolvedMetric === 'discount') {
        const discountedItems = await prisma.orderItem.findMany({
          where: {
            courseId,
            discountAmount: { gt: 0 },
            order: { is: { status: 'PAID', createdAt: { gte: rangeFrom, lte: rangeTo } } },
          },
          select: { discountAmount: true, order: { select: { createdAt: true } } },
        });

        const byDay = new Map<string, number>();
        for (const it of discountedItems) {
          const key = dateKeyUtc(startOfUtcDay(it.order.createdAt));
          byDay.set(key, (byDay.get(key) || 0) + Number(it.discountAmount || 0));
        }

        const series: Array<{ date: string; value: number }> = [];
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(startOfUtcDay(rangeFrom));
          d.setUTCDate(d.getUTCDate() + i);
          const key = dateKeyUtc(d);
          series.push({ date: key, value: byDay.get(key) || 0 });
        }

        return NextResponse.json(
          {
            chart: {
              metric: 'discount',
              title: 'Grafik Total Diskon',
              from: rangeFrom,
              to: rangeTo,
              series,
            },
          },
          { status: 200 }
        );
      }

      const paidItems = await prisma.orderItem.findMany({
        where: {
          courseId,
          order: { is: { status: 'PAID', createdAt: { gte: rangeFrom, lte: rangeTo } } },
        },
        select: { price: true, quantity: true, discountAmount: true, order: { select: { createdAt: true } } },
      });

      const byDay = new Map<string, number>();
      for (const it of paidItems) {
        const key = dateKeyUtc(startOfUtcDay(it.order.createdAt));
        const lineSubtotal = Number(it.price || 0) * Number(it.quantity || 0);
        const lineTotal = Math.max(0, lineSubtotal - Number(it.discountAmount || 0));
        byDay.set(key, (byDay.get(key) || 0) + lineTotal);
      }

      const series: Array<{ date: string; value: number }> = [];
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(startOfUtcDay(rangeFrom));
        d.setUTCDate(d.getUTCDate() + i);
        const key = dateKeyUtc(d);
        series.push({ date: key, value: byDay.get(key) || 0 });
      }

      return NextResponse.json(
        {
          chart: {
            metric: 'earning',
            title: 'Grafik Pendapatan',
            from: rangeFrom,
            to: rangeTo,
            series,
          },
        },
        { status: 200 }
      );
    }

    const [ratingAgg, instructor, paidItems, rangeEnrollmentsCount, totalsAgg] = await Promise.all([
      prisma.courseReview.aggregate({
        where: { courseId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.user.findUnique({
        where: { id: course.instructorId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      }),
      prisma.orderItem.findMany({
        where: {
          courseId,
          order: { is: { status: 'PAID', createdAt: { gte: rangeFrom, lte: rangeTo } } },
        },
        select: { price: true, quantity: true, discountAmount: true, order: { select: { createdAt: true } } },
      }),
      prisma.enrollment.count({ where: { courseId, createdAt: { gte: rangeFrom, lte: rangeTo } } }),
      prisma.orderItem.aggregate({
        where: {
          courseId,
          order: { is: { status: 'PAID', createdAt: { gte: rangeFrom, lte: rangeTo } } },
        },
        _sum: { discountAmount: true, refundAmount: true },
      }),
    ]);

    const earningsByDay = new Map<string, number>();
    for (const it of paidItems) {
      const key = dateKeyUtc(startOfUtcDay(it.order.createdAt));
      const lineSubtotal = Number(it.price || 0) * Number(it.quantity || 0);
      const lineTotal = Math.max(0, lineSubtotal - Number(it.discountAmount || 0));
      earningsByDay.set(key, (earningsByDay.get(key) || 0) + lineTotal);
    }
    const totalDays = Math.max(
      1,
      Math.floor((startOfUtcDay(rangeTo).getTime() - startOfUtcDay(rangeFrom).getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    const series: Array<{ date: string; totalEarning: number }> = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startOfUtcDay(rangeFrom));
      d.setUTCDate(d.getUTCDate() + i);
      const key = dateKeyUtc(d);
      series.push({ date: key, totalEarning: earningsByDay.get(key) || 0 });
    }
    const totalEarning = series.reduce((sum, p) => sum + p.totalEarning, 0);
    const totalDiscount = Number(totalsAgg?._sum?.discountAmount || 0);
    const totalRefund = Number(totalsAgg?._sum?.refundAmount || 0);

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: { id: true, userId: true, createdAt: true },
    });
    const userIds = enrollments.map((e) => e.userId);
    const completedByUser = new Set<string>();
    const inProgressByUser = new Set<string>();
    if (userIds.length > 0 && totalLessons > 0) {
      const progressCounts = await prisma.userProgress.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, completed: true, lesson: { module: { courseId } } },
        _count: { _all: true },
      });
      for (const row of progressCounts) {
        const completedLessons = row._count._all || 0;
        if (completedLessons >= totalLessons) completedByUser.add(row.userId);
        else if (completedLessons > 0) inProgressByUser.add(row.userId);
      }
    }

    const completedCourses = completedByUser.size;
    const inProgressCourses = inProgressByUser.size;

    if (tab === 'overview') {
      return NextResponse.json(
        {
          course: { id: course.id, title: course.title, slug: course.slug },
          stats: {
            lessons: totalLessons,
            quizzes: totalQuizzes,
            assignments: totalAssignments,
            students: totalStudents,
            coursesCompleted: completedCourses,
            coursesInProgress: inProgressCourses,
            averageRating: ratingAgg._avg.rating || 0,
            totalReviews: ratingAgg._count._all || 0,
          },
          range: {
            from: rangeFrom,
            to: rangeTo,
            totalEarning,
            courseEnrolled: rangeEnrollmentsCount,
            totalRefund: totalRefund > 0 ? totalRefund : null,
            totalDiscount: totalDiscount > 0 ? totalDiscount : null,
          },
          earningsSeries: series,
          instructor: instructor
            ? { id: instructor.id, name: instructor.name || instructor.email, email: instructor.email, avatarUrl: instructor.avatarUrl }
            : null,
        },
        { status: 200 }
      );
    }

    if (tab === 'students') {
      const studentEnrollments = await prisma.enrollment.findMany({
        where: { courseId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          createdAt: true,
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      const hasMore = studentEnrollments.length > limit;
      const page = hasMore ? studentEnrollments.slice(0, limit) : studentEnrollments;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
      const ids = page.map((e) => e.userId);

      const completedCounts = ids.length
        ? await prisma.userProgress.groupBy({
            by: ['userId'],
            where: { userId: { in: ids }, completed: true, lesson: { module: { courseId } } },
            _count: { _all: true },
          })
        : [];
      const completedMap = new Map<string, number>();
      for (const row of completedCounts) completedMap.set(row.userId, row._count._all || 0);

      return NextResponse.json(
        {
          students: page.map((e) => {
            const completedLessons = completedMap.get(e.userId) || 0;
            const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
            return {
              enrollmentId: e.id,
              enrolledAt: e.createdAt,
              student: { id: e.user.id, name: e.user.name || e.user.email, email: e.user.email },
              totalLessons,
              completedLessons,
              progressPercent,
            };
          }),
          nextCursor,
        },
        { status: 200 }
      );
    }

    if (tab === 'reviews') {
      const reviews = await prisma.courseReview.findMany({
        where: { courseId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
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
          })),
          nextCursor,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load report detail' }, { status: 500 });
  }
}
