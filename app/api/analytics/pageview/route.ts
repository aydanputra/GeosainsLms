import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';

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

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token).catch(() => null);
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}

function normalizePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (!v.startsWith('/')) return null;
  if (v.length > 400) return null;
  return v;
}

function normalizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length > maxLen) return v.slice(0, maxLen);
  return v;
}

function safeHost(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.host || null;
  } catch {
    return null;
  }
}

function randomId(): string {
  const g = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `pv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { from, to, range } = parseRange(req.nextUrl.searchParams);
    const where = { createdAt: { gte: from, lte: to } } as const;
    const days = rangeDays(range);
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevTo.getDate() - (days - 1));
    prevFrom.setHours(0, 0, 0, 0);
    const prevWhere = { createdAt: { gte: prevFrom, lte: prevTo } } as const;

    const [
      pageviews,
      uniqueSessionsRows,
      newUsers,
      newStudents,
      prevPageviews,
      prevUniqueSessionsRows,
      prevNewUsers,
      prevNewStudents,
      topReferrersRaw,
      topCourseRaw,
      topCategoryRaw,
      topPagesRaw,
      utmSourcesRaw,
      utmMediumsRaw,
      utmCampaignsRaw,
      topProductsRaw,
      topVendorsRaw,
      topMentorsRaw,
      dailyRaw,
      landingPagesRaw,
    ] = await Promise.all([
      db.pageView.count({ where }),
      db.pageView.findMany({ where, distinct: ['sessionId'], select: { sessionId: true } }),
      prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.user.count({ where: { createdAt: { gte: from, lte: to }, role: 'STUDENT' } }),
      db.pageView.count({ where: prevWhere }),
      db.pageView.findMany({ where: prevWhere, distinct: ['sessionId'], select: { sessionId: true } }),
      prisma.user.count({ where: { createdAt: { gte: prevFrom, lte: prevTo } } }),
      prisma.user.count({ where: { createdAt: { gte: prevFrom, lte: prevTo }, role: 'STUDENT' } }),
      db.pageView.groupBy({
        by: ['referrerHost'],
        where: { ...where, referrerHost: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referrerHost: 'desc' } },
        take: 12,
      }),
      db.pageView.groupBy({
        by: ['courseId'],
        where: { ...where, courseId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { courseId: 'desc' } },
        take: 10,
      }),
      db.pageView.groupBy({
        by: ['categoryId'],
        where: { ...where, categoryId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 10,
      }),
      db.pageView.groupBy({
        by: ['path'],
        where,
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 12,
      }),
      db.pageView.groupBy({
        by: ['utmSource'],
        where: { ...where, utmSource: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { utmSource: 'desc' } },
        take: 10,
      }),
      db.pageView.groupBy({
        by: ['utmMedium'],
        where: { ...where, utmMedium: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { utmMedium: 'desc' } },
        take: 10,
      }),
      db.pageView.groupBy({
        by: ['utmCampaign'],
        where: { ...where, utmCampaign: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { utmCampaign: 'desc' } },
        take: 10,
      }),
      db.pageView.groupBy({
        by: ['productId'],
        where: { ...where, productId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 10,
      }),
      db.pageView.groupBy({
        by: ['vendorId'],
        where: { ...where, vendorId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { vendorId: 'desc' } },
        take: 10,
      }),
      prisma.$queryRaw<Array<{ mentorId: string; courseViews: number; vendorViews: number; totalViews: number }>>`
        WITH course_views AS (
          SELECT c."instructorId" AS "mentorId", COUNT(*)::int AS "courseViews"
          FROM "PageView" pv
          JOIN "Course" c ON c.id = pv."courseId"
          WHERE pv."createdAt" >= ${from} AND pv."createdAt" <= ${to} AND pv."courseId" IS NOT NULL
          GROUP BY c."instructorId"
        ),
        vendor_owner_views AS (
          SELECT v."ownerId" AS "mentorId", COUNT(*)::int AS "vendorViews"
          FROM "PageView" pv
          JOIN "ShopVendor" v ON v.id = pv."vendorId"
          WHERE pv."createdAt" >= ${from} AND pv."createdAt" <= ${to} AND pv."vendorId" IS NOT NULL AND v."ownerId" IS NOT NULL
          GROUP BY v."ownerId"
        ),
        vendor_member_views AS (
          SELECT m."userId" AS "mentorId", COUNT(*)::int AS "vendorViews"
          FROM "PageView" pv
          JOIN "ShopVendor" v ON v.id = pv."vendorId"
          JOIN "ShopVendorMember" m ON m."vendorId" = v.id
          WHERE pv."createdAt" >= ${from} AND pv."createdAt" <= ${to} AND pv."vendorId" IS NOT NULL
          GROUP BY m."userId"
        ),
        vendor_views AS (
          SELECT "mentorId", SUM("vendorViews")::int AS "vendorViews"
          FROM (
            SELECT * FROM vendor_owner_views
            UNION ALL
            SELECT * FROM vendor_member_views
          ) x
          GROUP BY "mentorId"
        ),
        combined AS (
          SELECT
            COALESCE(c."mentorId", v."mentorId") AS "mentorId",
            COALESCE(c."courseViews", 0)::int AS "courseViews",
            COALESCE(v."vendorViews", 0)::int AS "vendorViews",
            (COALESCE(c."courseViews", 0) + COALESCE(v."vendorViews", 0))::int AS "totalViews"
          FROM course_views c
          FULL OUTER JOIN vendor_views v ON v."mentorId" = c."mentorId"
        )
        SELECT "mentorId", "courseViews", "vendorViews", "totalViews"
        FROM combined
        WHERE "mentorId" IS NOT NULL
        ORDER BY "totalViews" DESC
        LIMIT 10
      `,
      prisma.$queryRaw<Array<{ day: Date; pageviews: number; sessions: number }>>`
        SELECT
          date_trunc('day', "createdAt") AS day,
          COUNT(*)::int AS pageviews,
          COUNT(DISTINCT "sessionId")::int AS sessions
        FROM "PageView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ path: string; sessions: number }>>`
        SELECT t.path, COUNT(*)::int AS sessions
        FROM (
          SELECT DISTINCT ON ("sessionId") "sessionId", path
          FROM "PageView"
          WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          ORDER BY "sessionId", "createdAt" ASC
        ) t
        GROUP BY t.path
        ORDER BY sessions DESC
        LIMIT 12
      `,
    ]);

    const uniqueSessions = uniqueSessionsRows.length;
    const previousUniqueSessions = prevUniqueSessionsRows.length;
    const pagesPerSession = uniqueSessions ? pageviews / uniqueSessions : 0;
    const previousPagesPerSession = previousUniqueSessions ? prevPageviews / previousUniqueSessions : 0;

    const courseIds = (topCourseRaw as any[]).map((r: any) => String(r.courseId));
    const categoryIds = (topCategoryRaw as any[]).map((r: any) => String(r.categoryId));
    const productIds = (topProductsRaw as any[]).map((r: any) => String(r.productId));
    const vendorIds = Array.from(new Set<string>((topVendorsRaw as any[]).map((r: any) => String(r.vendorId))));
    const mentorIds = Array.from(new Set<string>((topMentorsRaw || []).map((r) => String((r as any).mentorId)).filter(Boolean)));

    const [courses, categories, products, vendors, mentors] = await Promise.all([
      courseIds.length
        ? prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true, slug: true } })
        : Promise.resolve([]),
      categoryIds.length
        ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, slug: true } })
        : Promise.resolve([]),
      productIds.length
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, slug: true, vendorId: true, vendor: { select: { id: true, name: true, slug: true } } },
          })
        : Promise.resolve([]),
      vendorIds.length ? prisma.shopVendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true, slug: true } }) : Promise.resolve([]),
      mentorIds.length
        ? prisma.user.findMany({ where: { id: { in: mentorIds }, role: 'MENTOR' }, select: { id: true, name: true, email: true, avatarUrl: true } })
        : Promise.resolve([]),
    ]);

    const courseById = new Map(courses.map((c) => [String(c.id), c]));
    const categoryById = new Map(categories.map((c) => [String(c.id), c]));
    const productById = new Map(products.map((p) => [String(p.id), p]));
    const vendorById = new Map(vendors.map((v) => [String(v.id), v]));
    const mentorById = new Map(mentors.map((m) => [String(m.id), m]));

    const studentCountByMentorId = new Map<string, number>();
    if (mentorIds.length) {
      const [mentorCourses, mentorCoCourses] = await Promise.all([
        prisma.course.findMany({ where: { instructorId: { in: mentorIds } }, select: { id: true, instructorId: true } }),
        prisma.courseCoInstructor.findMany({ where: { userId: { in: mentorIds } }, select: { courseId: true, userId: true } }),
      ]);

      const courseIdToMentorIds = new Map<string, string[]>();
      for (const c of mentorCourses) {
        const courseId = String(c.id);
        const mentorId = String(c.instructorId);
        const prev = courseIdToMentorIds.get(courseId) || [];
        if (!prev.includes(mentorId)) courseIdToMentorIds.set(courseId, [...prev, mentorId]);
      }

      for (const rel of mentorCoCourses) {
        const courseId = String(rel.courseId);
        const mentorId = String(rel.userId);
        const prev = courseIdToMentorIds.get(courseId) || [];
        if (!prev.includes(mentorId)) courseIdToMentorIds.set(courseId, [...prev, mentorId]);
      }

      const allCourseIds = Array.from(courseIdToMentorIds.keys());
      const enrollments = allCourseIds.length
        ? await prisma.enrollment.findMany({
            where: { courseId: { in: allCourseIds }, user: { role: 'STUDENT' } },
            select: { courseId: true, userId: true },
          })
        : [];

      const mentorStudentSets = new Map<string, Set<string>>();
      for (const e of enrollments) {
        const courseId = String(e.courseId);
        const studentId = String(e.userId);
        const mentorsForCourse = courseIdToMentorIds.get(courseId) || [];
        for (const mentorId of mentorsForCourse) {
          const s = mentorStudentSets.get(mentorId) || new Set<string>();
          s.add(studentId);
          mentorStudentSets.set(mentorId, s);
        }
      }

      for (const [mentorId, set] of mentorStudentSets.entries()) {
        studentCountByMentorId.set(mentorId, set.size);
      }
    }

    const topCourses = topCourseRaw
      .map((r: any) => {
        const id = String(r.courseId);
        const c = courseById.get(id);
        if (!c) return null;
        return { id, title: c.title, slug: c.slug, views: Number((r as any)._count?._all || 0) };
      })
      .filter(Boolean);

    const topCategories = topCategoryRaw
      .map((r: any) => {
        const id = String(r.categoryId);
        const c = categoryById.get(id);
        if (!c) return null;
        return { id, name: c.name, slug: c.slug, views: Number((r as any)._count?._all || 0) };
      })
      .filter(Boolean);

    const topReferrers = topReferrersRaw
      .map((r: any) => ({
        host: r.referrerHost ? String(r.referrerHost) : '',
        views: Number((r as any)._count?._all || 0),
      }))
      .filter((r: any) => Boolean(r.host));

    const daily = Array.isArray(dailyRaw)
      ? dailyRaw.map((r) => ({
          day: r.day instanceof Date ? r.day.toISOString() : new Date(String(r.day)).toISOString(),
          pageviews: Number(r.pageviews) || 0,
          sessions: Number(r.sessions) || 0,
        }))
      : [];

    const topPages = (topPagesRaw as any[])
      .map((r: any) => ({ path: String(r.path || ''), views: Number(r?._count?._all || 0) }))
      .filter((r: any) => Boolean(r.path));

    const landingPages = Array.isArray(landingPagesRaw)
      ? landingPagesRaw
          .map((r) => ({ path: String(r.path || ''), sessions: Number((r as any).sessions) || 0 }))
          .filter((r) => Boolean(r.path))
      : [];

    const utmSources = (utmSourcesRaw as any[])
      .map((r: any) => ({ value: String(r.utmSource || ''), views: Number(r?._count?._all || 0) }))
      .filter((r: any) => Boolean(r.value));

    const utmMediums = (utmMediumsRaw as any[])
      .map((r: any) => ({ value: String(r.utmMedium || ''), views: Number(r?._count?._all || 0) }))
      .filter((r: any) => Boolean(r.value));

    const utmCampaigns = (utmCampaignsRaw as any[])
      .map((r: any) => ({ value: String(r.utmCampaign || ''), views: Number(r?._count?._all || 0) }))
      .filter((r: any) => Boolean(r.value));

    const topProducts = (topProductsRaw as any[])
      .map((r: any) => {
        const id = String(r.productId);
        const p = productById.get(id);
        if (!p) return null;
        const views = Number(r?._count?._all || 0);
        const vendor = (p as any).vendor ?? null;
        return {
          id,
          name: p.name,
          slug: p.slug,
          views,
          vendor: vendor ? { id: String(vendor.id), name: String(vendor.name), slug: String(vendor.slug) } : null,
        };
      })
      .filter(Boolean);

    const topVendors = (topVendorsRaw as any[])
      .map((r: any) => {
        const id = String(r.vendorId);
        const v = vendorById.get(id);
        if (!v) return null;
        return { id, name: v.name, slug: v.slug, views: Number(r?._count?._all || 0) };
      })
      .filter(Boolean);

    const topMentors = Array.isArray(topMentorsRaw)
      ? topMentorsRaw
          .map((r: any) => {
            const id = String(r.mentorId || '');
            const m = mentorById.get(id);
            if (!m) return null;
            return {
              id,
              name: m.name || m.email,
              email: m.email,
              avatarUrl: m.avatarUrl,
              courseViews: Number(r.courseViews) || 0,
              vendorViews: Number(r.vendorViews) || 0,
              totalViews: Number(r.totalViews) || 0,
              students: Number(studentCountByMentorId.get(id) || 0),
            };
          })
          .filter(Boolean)
      : [];

    return NextResponse.json(
      {
        range,
        from: from.toISOString(),
        to: to.toISOString(),
        totals: { pageviews, uniqueSessions, newUsers, newStudents, pagesPerSession },
        previousTotals: {
          pageviews: prevPageviews,
          uniqueSessions: previousUniqueSessions,
          newUsers: prevNewUsers,
          newStudents: prevNewStudents,
          pagesPerSession: previousPagesPerSession,
        },
        daily,
        topCourses,
        topCategories,
        topReferrers,
        topPages,
        landingPages,
        utmSources,
        utmMediums,
        utmCampaigns,
        topProducts,
        topVendors,
        topMentors,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat analytics' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      path?: unknown;
      referrer?: unknown;
      utmSource?: unknown;
      utmMedium?: unknown;
      utmCampaign?: unknown;
    };

    const path = normalizePath(body.path);
    if (!path) return NextResponse.json({ ok: true }, { status: 200 });

    if (
      path.startsWith('/dashboard') ||
      path.startsWith('/api') ||
      path.startsWith('/login') ||
      path.startsWith('/register') ||
      path.startsWith('/_next')
    ) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const token = req.cookies.get('token')?.value;
    let userId: string | null = null;
    if (token) {
      const u = await verifyToken(token).catch(() => null);
      if (u?.id) userId = String(u.id);
    }

    let sessionId = req.cookies.get('pv_sid')?.value || null;
    const shouldSetCookie = !sessionId;
    if (!sessionId) sessionId = randomId();

    const referrer = normalizeText(body.referrer, 600);
    const referrerHost = safeHost(referrer);
    const utmSource = normalizeText(body.utmSource, 80);
    const utmMedium = normalizeText(body.utmMedium, 80);
    const utmCampaign = normalizeText(body.utmCampaign, 120);
    const userAgent = normalizeText(req.headers.get('user-agent'), 300);

    let courseId: string | null = null;
    let categoryId: string | null = null;
    const mCourse = /^\/courses\/([^/?#]+)$/.exec(path) || /^\/courses\/([^/?#]+)\//.exec(path);
    if (mCourse?.[1]) {
      const slug = decodeURIComponent(mCourse[1]);
      const course = await prisma.course.findUnique({
        where: { slug },
        select: { id: true, categoryId: true },
      });
      if (course) {
        courseId = String(course.id);
        categoryId = course.categoryId ? String(course.categoryId) : null;
      }
    }

    let productId: string | null = null;
    let vendorId: string | null = null;

    const mProduct = /^\/shop\/products\/([^/?#]+)$/.exec(path) || /^\/shop\/products\/([^/?#]+)\//.exec(path);
    if (mProduct?.[1]) {
      const idOrSlug = decodeURIComponent(mProduct[1]);
      const product = await prisma.product.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        select: { id: true, vendorId: true },
      });
      if (product) {
        productId = String(product.id);
        vendorId = product.vendorId ? String(product.vendorId) : null;
      }
    }

    if (!vendorId) {
      const mVendor = /^\/vendor\/([^/?#]+)$/.exec(path) || /^\/vendor\/([^/?#]+)\//.exec(path) || /^\/shop\/vendors\/public\/([^/?#]+)$/.exec(path) || /^\/shop\/vendors\/public\/([^/?#]+)\//.exec(path);
      if (mVendor?.[1]) {
        const slug = decodeURIComponent(mVendor[1]);
        const vendor = await prisma.shopVendor.findUnique({ where: { slug }, select: { id: true } });
        if (vendor?.id) vendorId = String(vendor.id);
      }
    }

    await db.pageView.create({
      data: {
        path,
        sessionId,
        userId,
        referrer,
        referrerHost,
        utmSource,
        utmMedium,
        utmCampaign,
        userAgent,
        courseId,
        categoryId,
        productId,
        vendorId,
      },
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    if (shouldSetCookie) {
      res.cookies.set('pv_sid', sessionId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 60 });
    }
    return res;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
