import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { getMentorRevenueSummary } from '@/modules/dashboard/api/performance';

const db = prisma as any;

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date; range: '7d' | '30d' | '90d' } {
  const rangeRaw = String(searchParams.get('range') || '').trim().toLowerCase();
  const to = new Date();
  const from = new Date(to);

  if (rangeRaw === '7d') from.setDate(to.getDate() - 6);
  else if (rangeRaw === '90d') from.setDate(to.getDate() - 89);
  else from.setDate(to.getDate() - 29);

  from.setHours(0, 0, 0, 0);
  const range = rangeRaw === '7d' || rangeRaw === '90d' ? (rangeRaw as '7d' | '90d') : '30d';
  return { from, to, range };
}

function rangeDays(range: '7d' | '30d' | '90d') {
  if (range === '7d') return 7;
  if (range === '90d') return 90;
  return 30;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'MENTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const includeAnalytics = String(req.nextUrl.searchParams.get('analytics') || '').trim() === '1';
    const { from, to, range } = includeAnalytics ? parseRange(req.nextUrl.searchParams) : { from: new Date(0), to: new Date(0), range: '30d' as const };

    const instructorId = String(user.id);
    const courseWhere = { instructorId, deletedAt: null };
    const revenueSummary = await getMentorRevenueSummary(instructorId);
    const { scope, productsSold, totalEarning, platformFeeTotal, affiliateFeeTotal } = revenueSummary;
    const { courseIds, vendorIds, productIds } = scope;

    const totalBundles = courseIds.length
      ? await prisma.courseBundle.count({ where: { published: true, courseIds: { hasSome: courseIds } } })
      : 0;
    const publishedPosts = await prisma.post.count({ where: { authorId: instructorId, published: true } });
    const totalProducts = vendorIds.length ? await prisma.product.count({ where: { vendorId: { in: vendorIds } } }) : 0;

    const [
      totalCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
      enrolledStudents,
      lessonsTotal,
      quizzesTotal,
      assignmentsTotal,
      pendingSubmissions,
    ] = await Promise.all([
      prisma.course.count({ where: courseWhere }),
      prisma.course.count({ where: { ...courseWhere, status: 'PUBLISHED' } }),
      prisma.course.count({ where: { ...courseWhere, status: 'DRAFT' } }),
      prisma.course.count({ where: { ...courseWhere, status: 'ARCHIVED' } }),
      prisma.enrollment.count({ where: { course: courseWhere } }),
      prisma.lesson.count({ where: { module: { course: courseWhere } } }),
      prisma.quiz.count({ where: { lesson: { module: { course: courseWhere } } } }),
      prisma.assignment.count({ where: { lesson: { module: { course: courseWhere } } } }),
      prisma.assignmentSubmission.count({
        where: {
          status: 'PENDING',
          assignment: { lesson: { module: { course: courseWhere } } },
        },
      }),
    ]);

    const base = {
      totalCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
      enrolledStudents,
      lessonsTotal,
      quizzesTotal,
      assignmentsTotal,
      pendingSubmissions,
      totalBundles,
      totalProducts,
      productsSold,
      totalEarning,
      publishedPosts,
      platformFeeTotal,
      affiliateFeeTotal,
    };

    if (!includeAnalytics) return NextResponse.json(base);

    const days = rangeDays(range);
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevTo.getDate() - (days - 1));
    prevFrom.setHours(0, 0, 0, 0);

    const productIdsForMentor = productIds;
    const vendorIdsForMentor = vendorIds;

    const pageviewWhere: any = {
      createdAt: { gte: from, lte: to },
      OR: [
        ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
        ...(vendorIdsForMentor.length ? [{ vendorId: { in: vendorIdsForMentor } }] : []),
        ...(productIdsForMentor.length ? [{ productId: { in: productIdsForMentor } }] : []),
      ],
    };

    const prevPageviewWhere: any = {
      createdAt: { gte: prevFrom, lte: prevTo },
      OR: [
        ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
        ...(vendorIdsForMentor.length ? [{ vendorId: { in: vendorIdsForMentor } }] : []),
        ...(productIdsForMentor.length ? [{ productId: { in: productIdsForMentor } }] : []),
      ],
    };

    const [
      courseViews,
      shopViews,
      uniqueSessionsRows,
      prevCourseViews,
      prevShopViews,
      prevUniqueSessionsRows,
      newEnrollments,
      prevNewEnrollments,
      totalStudentsDistinct,
      newStudentsDistinct,
      dailyViewsRaw,
      dailyEnrollmentsRaw,
      topCourseRaw,
      topProductRaw,
      topReferrersRaw,
    ] = await Promise.all([
      courseIds.length ? db.pageView.count({ where: { createdAt: { gte: from, lte: to }, courseId: { in: courseIds } } }) : 0,
      vendorIdsForMentor.length || productIdsForMentor.length
        ? db.pageView.count({
            where: {
              createdAt: { gte: from, lte: to },
              OR: [
                ...(vendorIdsForMentor.length ? [{ vendorId: { in: vendorIdsForMentor } }] : []),
                ...(productIdsForMentor.length ? [{ productId: { in: productIdsForMentor } }] : []),
              ],
            },
          })
        : 0,
      db.pageView.findMany({ where: pageviewWhere, distinct: ['sessionId'], select: { sessionId: true } }),
      courseIds.length ? db.pageView.count({ where: { createdAt: { gte: prevFrom, lte: prevTo }, courseId: { in: courseIds } } }) : 0,
      vendorIdsForMentor.length || productIdsForMentor.length
        ? db.pageView.count({
            where: {
              createdAt: { gte: prevFrom, lte: prevTo },
              OR: [
                ...(vendorIdsForMentor.length ? [{ vendorId: { in: vendorIdsForMentor } }] : []),
                ...(productIdsForMentor.length ? [{ productId: { in: productIdsForMentor } }] : []),
              ],
            },
          })
        : 0,
      db.pageView.findMany({ where: prevPageviewWhere, distinct: ['sessionId'], select: { sessionId: true } }),
      courseIds.length ? prisma.enrollment.count({ where: { courseId: { in: courseIds }, createdAt: { gte: from, lte: to } } }) : 0,
      courseIds.length ? prisma.enrollment.count({ where: { courseId: { in: courseIds }, createdAt: { gte: prevFrom, lte: prevTo } } }) : 0,
      courseIds.length
        ? db.enrollment
            .groupBy({
              by: ['userId'],
              where: { courseId: { in: courseIds } },
            })
            .then((rows: any[]) => rows.length)
        : 0,
      courseIds.length
        ? db.enrollment
            .groupBy({
              by: ['userId'],
              where: { courseId: { in: courseIds }, createdAt: { gte: from, lte: to } },
            })
            .then((rows: any[]) => rows.length)
        : 0,
      prisma.$queryRaw<Array<{ day: Date; courseViews: number; shopViews: number }>>`
        SELECT
          date_trunc('day', pv."createdAt") AS day,
          COUNT(*) FILTER (WHERE pv."courseId" IS NOT NULL)::int AS "courseViews",
          COUNT(*) FILTER (WHERE pv."vendorId" IS NOT NULL OR pv."productId" IS NOT NULL)::int AS "shopViews"
        FROM "PageView" pv
        WHERE pv."createdAt" >= ${from}
          AND pv."createdAt" <= ${to}
          AND (
            ${courseIds.length ? Prisma.sql`pv."courseId" IN (${Prisma.join(courseIds)})` : Prisma.sql`FALSE`}
            OR ${vendorIdsForMentor.length ? Prisma.sql`pv."vendorId" IN (${Prisma.join(vendorIdsForMentor)})` : Prisma.sql`FALSE`}
            OR ${productIdsForMentor.length ? Prisma.sql`pv."productId" IN (${Prisma.join(productIdsForMentor)})` : Prisma.sql`FALSE`}
          )
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ day: Date; enrollments: number; students: number }>>`
        SELECT
          date_trunc('day', e."createdAt") AS day,
          COUNT(*)::int AS enrollments,
          COUNT(DISTINCT e."userId")::int AS students
        FROM "Enrollment" e
        WHERE e."createdAt" >= ${from} AND e."createdAt" <= ${to}
          AND ${courseIds.length ? Prisma.sql`e."courseId" IN (${Prisma.join(courseIds)})` : Prisma.sql`FALSE`}
        GROUP BY 1
        ORDER BY 1
      `,
      courseIds.length
        ? db.pageView.groupBy({
            by: ['courseId'],
            where: { createdAt: { gte: from, lte: to }, courseId: { in: courseIds } },
            _count: { _all: true },
            orderBy: { _count: { courseId: 'desc' } },
            take: 10,
          })
        : [],
      productIdsForMentor.length
        ? db.pageView.groupBy({
            by: ['productId'],
            where: { createdAt: { gte: from, lte: to }, productId: { in: productIdsForMentor } },
            _count: { _all: true },
            orderBy: { _count: { productId: 'desc' } },
            take: 10,
          })
        : [],
      db.pageView.groupBy({
        by: ['referrerHost'],
        where: { ...pageviewWhere, referrerHost: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referrerHost: 'desc' } },
        take: 12,
      }),
    ]);

    const uniqueSessions = Array.isArray(uniqueSessionsRows) ? uniqueSessionsRows.length : 0;
    const prevUniqueSessions = Array.isArray(prevUniqueSessionsRows) ? prevUniqueSessionsRows.length : 0;

    const topCourseIds = Array.isArray(topCourseRaw) ? (topCourseRaw as any[]).map((r: any) => String(r.courseId)).filter(Boolean) : [];
    const topProductIds = Array.isArray(topProductRaw) ? (topProductRaw as any[]).map((r: any) => String(r.productId)).filter(Boolean) : [];
    const [topCoursesMeta, topProductsMeta] = await Promise.all([
      topCourseIds.length ? prisma.course.findMany({ where: { id: { in: topCourseIds } }, select: { id: true, title: true, slug: true } }) : Promise.resolve([]),
      topProductIds.length ? prisma.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true, slug: true } }) : Promise.resolve([]),
    ]);
    const courseById = new Map(topCoursesMeta.map((c) => [String(c.id), c]));
    const productById = new Map(topProductsMeta.map((p) => [String(p.id), p]));

    const topCourses = (topCourseRaw as any[])
      .map((r: any) => {
        const id = String(r.courseId || '');
        const c = courseById.get(id);
        if (!c) return null;
        return { id, title: c.title, slug: c.slug, views: Number(r?._count?._all || 0) };
      })
      .filter(Boolean);

    const topProducts = (topProductRaw as any[])
      .map((r: any) => {
        const id = String(r.productId || '');
        const p = productById.get(id);
        if (!p) return null;
        return { id, name: p.name, slug: p.slug, views: Number(r?._count?._all || 0) };
      })
      .filter(Boolean);

    const topReferrers = (topReferrersRaw as any[])
      .map((r: any) => ({ host: String(r.referrerHost || ''), views: Number(r?._count?._all || 0) }))
      .filter((x: any) => Boolean(x.host));

    const daily = Array.isArray(dailyViewsRaw)
      ? dailyViewsRaw.map((r) => ({
          day: r.day instanceof Date ? r.day.toISOString() : new Date(String(r.day)).toISOString(),
          courseViews: Number((r as any).courseViews) || 0,
          shopViews: Number((r as any).shopViews) || 0,
        }))
      : [];

    const dailyEnrollments = Array.isArray(dailyEnrollmentsRaw)
      ? dailyEnrollmentsRaw.map((r) => ({
          day: r.day instanceof Date ? r.day.toISOString() : new Date(String(r.day)).toISOString(),
          enrollments: Number((r as any).enrollments) || 0,
          students: Number((r as any).students) || 0,
        }))
      : [];

    return NextResponse.json({
      ...base,
      analytics: {
        range,
        from: from.toISOString(),
        to: to.toISOString(),
        totals: {
          courseViews,
          shopViews,
          totalViews: Number(courseViews || 0) + Number(shopViews || 0),
          uniqueSessions,
          newEnrollments,
          newStudents: newStudentsDistinct,
          totalStudents: totalStudentsDistinct,
        },
        previousTotals: {
          courseViews: prevCourseViews,
          shopViews: prevShopViews,
          totalViews: Number(prevCourseViews || 0) + Number(prevShopViews || 0),
          uniqueSessions: prevUniqueSessions,
          newEnrollments: prevNewEnrollments,
        },
        daily,
        dailyEnrollments,
        topCourses,
        topProducts,
        topReferrers,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
