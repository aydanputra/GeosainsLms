import { CommissionType, Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/utils/prisma';

type VendorConfig = {
  id: string;
  commissionType: CommissionType;
  commissionRate: number;
};

type MentorScope = {
  courseIds: string[];
  vendorIds: string[];
  vendorConfigs: VendorConfig[];
  productIds: string[];
};

type RevenueRow = {
  itemId: string | null;
  sold: number;
  sellerGross: number;
  buyerPaid: number;
  affiliateFee: number;
};

type ProductRevenueRow = RevenueRow & {
  vendorId: string | null;
};

type DateRange = {
  gte?: Date;
  lt?: Date;
};

type CourseRevenueSettings = {
  platformFeePercent: number;
  mentorRevenuePercent: number;
};

type DashboardUserSnapshot = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  isSuperAdmin: boolean;
} | null;

type VendorMenuState = {
  mode: 'NONE' | 'PENDING' | 'ACTIVE';
  isOwner: boolean;
};

function toNumber(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function safeSqlIn(column: string, values: string[]) {
  if (!values.length) return Prisma.sql`FALSE`;
  return Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(values)})`;
}

const getCachedCoursePlatformFeePercent = unstable_cache(
  async () => {
    const settingsPage = await prisma.page.findUnique({
      where: { slug: '__course_settings__' },
      select: { content: true },
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = typeof settingsPage?.content === 'string' ? JSON.parse(settingsPage.content) : {};
    } catch {
      parsed = {};
    }

    const enableRevenueSharing = parsed.enableRevenueSharing === true;
    const rawPercent = Number(parsed.adminRevenueSharePercent || 0);
    const adminRevenueSharePercent = Number.isFinite(rawPercent) ? Math.max(0, Math.min(100, Math.trunc(rawPercent))) : 0;
    return enableRevenueSharing ? adminRevenueSharePercent : 0;
  },
  ['dashboard-course-platform-fee'],
  { revalidate: 300 }
);

const getCachedMentorScope = unstable_cache(
  async (userId: string): Promise<MentorScope> => {
    const [ownedCourses, coInstructorRows, approvedVendors] = await Promise.all([
      prisma.course.findMany({
        where: { instructorId: userId, deletedAt: null },
        select: { id: true },
      }),
      prisma.courseCoInstructor.findMany({
        where: { userId },
        select: { courseId: true },
      }),
      prisma.shopVendor.findMany({
        where: { status: 'APPROVED', OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        select: { id: true, commissionType: true, commissionRate: true },
      }),
    ]);

    const courseIds = Array.from(new Set([...ownedCourses.map((row) => row.id), ...coInstructorRows.map((row) => row.courseId)]));
    const vendorConfigs = approvedVendors.map((vendor) => ({
      id: String(vendor.id),
      commissionType: vendor.commissionType,
      commissionRate: Number(vendor.commissionRate || 0),
    }));
    const vendorIds = vendorConfigs.map((vendor) => vendor.id);
    const productIds = vendorIds.length
      ? (
          await prisma.product.findMany({
            where: { vendorId: { in: vendorIds } },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [];

    return { courseIds, vendorIds, vendorConfigs, productIds };
  },
  ['dashboard-mentor-scope'],
  { revalidate: 60 }
);

const getCachedDashboardUserSnapshot = unstable_cache(
  async (userId: string): Promise<DashboardUserSnapshot> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        isSuperAdmin: true,
      },
    });

    if (!user?.id || !user?.email || !user?.role) return null;

    const normalizedRole = String(user.role).toUpperCase();
    const allowed = new Set(['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR']);
    const role = (allowed.has(normalizedRole) ? normalizedRole : 'STUDENT') as 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';

    return {
      id: String(user.id),
      name: typeof user.name === 'string' && user.name.trim() ? user.name.trim() : String(user.email).split('@')[0],
      email: String(user.email),
      avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null,
      role,
      isSuperAdmin: Boolean(user.isSuperAdmin),
    };
  },
  ['dashboard-user-snapshot'],
  { revalidate: 60 }
);

async function queryCourseRevenueRows(courseIds: string[]): Promise<RevenueRow[]> {
  return queryCourseRevenueRowsInRange(courseIds);
}

async function queryCourseRevenueRowsInRange(courseIds: string[], dateRange?: DateRange): Promise<RevenueRow[]> {
  if (!courseIds.length) return [];
  const rangeSql =
    dateRange?.gte && dateRange?.lt
      ? Prisma.sql` AND o."createdAt" >= ${dateRange.gte} AND o."createdAt" < ${dateRange.lt}`
      : Prisma.empty;
  return prisma.$queryRaw<RevenueRow[]>`
    SELECT
      oi."courseId"::text AS "itemId",
      COALESCE(SUM(oi."quantity"), 0)::int AS "sold",
      COALESCE(SUM(
        GREATEST(
          (oi."price" * oi."quantity")
          - CASE
              WHEN oi."discountStoreAmount" = 0 AND oi."discountMarketplaceAmount" = 0 THEN oi."discountAmount"
              ELSE oi."discountStoreAmount"
            END
          - oi."refundAmount",
          0
        )
      ), 0)::double precision AS "sellerGross",
      COALESCE(SUM(
        GREATEST(
          (oi."price" * oi."quantity")
          - CASE
              WHEN oi."discountStoreAmount" = 0 AND oi."discountMarketplaceAmount" = 0 THEN oi."discountAmount"
              ELSE oi."discountStoreAmount" + oi."discountMarketplaceAmount"
            END
          - oi."refundAmount",
          0
        )
      ), 0)::double precision AS "buyerPaid",
      COALESCE(SUM(
        CASE
          WHEN c."id" IS NULL OR o."total" <= 0 OR c."amount" <= 0 OR UPPER(COALESCE(c."status", '')) LIKE '%REVERSED%' THEN 0
          ELSE (
            GREATEST(
              (oi."price" * oi."quantity")
              - CASE
                  WHEN oi."discountStoreAmount" = 0 AND oi."discountMarketplaceAmount" = 0 THEN oi."discountAmount"
                  ELSE oi."discountStoreAmount" + oi."discountMarketplaceAmount"
                END
              - oi."refundAmount",
              0
            ) / NULLIF(o."total", 0)
          ) * c."amount"
        END
      ), 0)::double precision AS "affiliateFee"
    FROM "OrderItem" oi
    INNER JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Commission" c ON c."orderId" = o."id"
    WHERE o."status" = 'PAID'
      AND ${safeSqlIn('oi."courseId"', courseIds)}
      ${rangeSql}
    GROUP BY oi."courseId"
  `;
}

async function queryProductRevenueRows(vendorIds: string[]): Promise<ProductRevenueRow[]> {
  return queryProductRevenueRowsInRange(vendorIds);
}

async function queryProductRevenueRowsInRange(vendorIds: string[], dateRange?: DateRange): Promise<ProductRevenueRow[]> {
  if (!vendorIds.length) return [];
  const rangeSql =
    dateRange?.gte && dateRange?.lt
      ? Prisma.sql` AND o."createdAt" >= ${dateRange.gte} AND o."createdAt" < ${dateRange.lt}`
      : Prisma.empty;
  return prisma.$queryRaw<ProductRevenueRow[]>`
    SELECT
      oi."productId"::text AS "itemId",
      p."vendorId"::text AS "vendorId",
      COALESCE(SUM(oi."quantity"), 0)::int AS "sold",
      COALESCE(SUM(
        GREATEST(
          (oi."price" * oi."quantity")
          - CASE
              WHEN oi."discountStoreAmount" = 0 AND oi."discountMarketplaceAmount" = 0 THEN oi."discountAmount"
              ELSE oi."discountStoreAmount"
            END
          - oi."refundAmount",
          0
        )
      ), 0)::double precision AS "sellerGross",
      COALESCE(SUM(
        GREATEST(
          (oi."price" * oi."quantity")
          - CASE
              WHEN oi."discountStoreAmount" = 0 AND oi."discountMarketplaceAmount" = 0 THEN oi."discountAmount"
              ELSE oi."discountStoreAmount" + oi."discountMarketplaceAmount"
            END
          - oi."refundAmount",
          0
        )
      ), 0)::double precision AS "buyerPaid",
      COALESCE(SUM(
        CASE
          WHEN c."id" IS NULL OR o."total" <= 0 OR c."amount" <= 0 OR UPPER(COALESCE(c."status", '')) LIKE '%REVERSED%' THEN 0
          ELSE (
            GREATEST(
              (oi."price" * oi."quantity")
              - CASE
                  WHEN oi."discountStoreAmount" = 0 AND oi."discountMarketplaceAmount" = 0 THEN oi."discountAmount"
                  ELSE oi."discountStoreAmount" + oi."discountMarketplaceAmount"
                END
              - oi."refundAmount",
              0
            ) / NULLIF(o."total", 0)
          ) * c."amount"
        END
      ), 0)::double precision AS "affiliateFee"
    FROM "OrderItem" oi
    INNER JOIN "Order" o ON o."id" = oi."orderId"
    INNER JOIN "Product" p ON p."id" = oi."productId"
    LEFT JOIN "Commission" c ON c."orderId" = o."id"
    WHERE o."status" = 'PAID'
      AND ${safeSqlIn('p."vendorId"', vendorIds)}
      ${rangeSql}
    GROUP BY oi."productId", p."vendorId"
  `;
}

const getCachedCourseRevenueSettings = unstable_cache(
  async (): Promise<CourseRevenueSettings> => {
    const settingsPage = await prisma.page.findUnique({
      where: { slug: '__course_settings__' },
      select: { content: true },
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = typeof settingsPage?.content === 'string' ? JSON.parse(settingsPage.content) : {};
    } catch {
      parsed = {};
    }

    const enableRevenueSharing = parsed.enableRevenueSharing === true;
    const rawAdminPercent = Number(parsed.adminRevenueSharePercent || 0);
    const rawInstructorPercent = Number(parsed.instructorRevenueSharePercent || 90);
    const platformFeePercent = enableRevenueSharing && Number.isFinite(rawAdminPercent) ? Math.max(0, Math.min(100, Math.trunc(rawAdminPercent))) : 0;
    const mentorRevenuePercent = enableRevenueSharing && Number.isFinite(rawInstructorPercent) ? Math.max(0, Math.min(100, Math.trunc(rawInstructorPercent))) : 100;

    return {
      platformFeePercent,
      mentorRevenuePercent,
    };
  },
  ['dashboard-course-revenue-settings'],
  { revalidate: 300 }
);

const getCachedMentorRevenueSummary = unstable_cache(
  async (userId: string) => {
    const [scope, platformFeePercent] = await Promise.all([getCachedMentorScope(userId), getCachedCoursePlatformFeePercent()]);
    const [courseRows, productRows] = await Promise.all([
      queryCourseRevenueRows(scope.courseIds),
      queryProductRevenueRows(scope.vendorIds),
    ]);

    const courseSellerGross = courseRows.reduce((sum, row) => sum + toNumber(row.sellerGross), 0);
    const courseAffiliateFee = courseRows.reduce((sum, row) => sum + toNumber(row.affiliateFee), 0);
    const coursePlatformFee = Math.max(0, (courseSellerGross * platformFeePercent) / 100);
    const courseEarning = Math.max(0, courseSellerGross - coursePlatformFee - courseAffiliateFee);

    const vendorById = new Map(scope.vendorConfigs.map((vendor) => [vendor.id, vendor] as const));
    let productsSold = 0;
    let productSellerGross = 0;
    let productPlatformFee = 0;
    let productAffiliateFee = 0;
    let productEarning = 0;

    for (const row of productRows) {
      const sold = toNumber(row.sold);
      const sellerGross = toNumber(row.sellerGross);
      const affiliateFee = toNumber(row.affiliateFee);
      const vendor = row.vendorId ? vendorById.get(String(row.vendorId)) : null;
      const commissionRate = toNumber(vendor?.commissionRate);
      const platformFee =
        vendor?.commissionType === 'FLAT' ? Math.max(0, commissionRate * sold) : Math.max(0, (sellerGross * commissionRate) / 100);

      productsSold += sold;
      productSellerGross += sellerGross;
      productPlatformFee += platformFee;
      productAffiliateFee += affiliateFee;
      productEarning += Math.max(0, sellerGross - platformFee - affiliateFee);
    }

    const affiliateFeeTotal = Math.max(0, courseAffiliateFee + productAffiliateFee);
    const platformFeeTotal = Math.max(0, coursePlatformFee + productPlatformFee);
    const totalEarning = Math.max(0, courseEarning + productEarning);

    return {
      productsSold,
      platformFeeTotal,
      affiliateFeeTotal,
      totalEarning,
      scope,
    };
  },
  ['dashboard-mentor-revenue-summary'],
  { revalidate: 60 }
);

const getCachedVendorRevenueSummary = unstable_cache(
  async (scopeKey: string, vendorIds: string[], vendorConfigs: VendorConfig[]) => {
    const productRows = await queryProductRevenueRows(vendorIds);
    const vendorById = new Map(vendorConfigs.map((vendor) => [vendor.id, vendor] as const));

    let totalNet = 0;
    let totalPlatformFee = 0;
    let totalAffiliateFee = 0;
    let totalSoldPaid = 0;

    for (const row of productRows) {
      const sold = toNumber(row.sold);
      const sellerGross = toNumber(row.sellerGross);
      const affiliateFee = toNumber(row.affiliateFee);
      const vendor = row.vendorId ? vendorById.get(String(row.vendorId)) : null;
      const commissionRate = toNumber(vendor?.commissionRate);
      const platformFee =
        vendor?.commissionType === 'FLAT' ? Math.max(0, commissionRate * sold) : Math.max(0, (sellerGross * commissionRate) / 100);
      const net = Math.max(0, sellerGross - platformFee - affiliateFee);

      totalSoldPaid += sold;
      totalPlatformFee += platformFee;
      totalAffiliateFee += affiliateFee;
      totalNet += net;
    }

    return {
      totalNet,
      totalPlatformFee,
      totalAffiliateFee,
      totalSoldPaid,
      scopeKey,
    };
  },
  ['dashboard-vendor-revenue-summary'],
  { revalidate: 60 }
);

const getCachedDashboardUnreadCounts = unstable_cache(
  async (userId: string) => {
    const messageConditions = [
      'Admin%',
      'Kebijakan%',
      'Program%',
      'Promo%',
      'Diskon%',
      'Pesan dari%',
      'Direct Message%',
      'DM%',
      'Pesan Kursus%',
      'Pesan Produk%',
      'Komentar%',
      'Q&A%',
      'Balasan dari%',
      'Tugas%',
      'Pelajaran%',
      'Materi%',
    ];

    const [notificationRows, dmRows] = await Promise.all([
      prisma.$queryRaw<Array<{ qaCount: number; alertCount: number }>>`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN n."title" LIKE ANY (ARRAY[${Prisma.join(messageConditions)}])
              THEN 1 ELSE 0
            END
          ), 0)::int AS "qaCount",
          COALESCE(SUM(
            CASE
              WHEN NOT (n."title" LIKE ANY (ARRAY[${Prisma.join(messageConditions)}]))
              THEN 1 ELSE 0
            END
          ), 0)::int AS "alertCount"
        FROM "Notification" n
        WHERE n."userId" = ${userId} AND n."read" = false
      `,
      prisma.$queryRaw<Array<{ unreadTotal: number }>>`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN dt."userAId" = ${userId} THEN COALESCE(dt."unreadCountA", 0)
              WHEN dt."userBId" = ${userId} THEN COALESCE(dt."unreadCountB", 0)
              ELSE 0
            END
          ), 0)::int AS "unreadTotal"
        FROM "DirectThread" dt
        WHERE dt."userAId" = ${userId} OR dt."userBId" = ${userId}
      `,
    ]);

    const qaCount = toNumber(notificationRows[0]?.qaCount);
    const alertCount = toNumber(notificationRows[0]?.alertCount);
    const dmUnreadCount = toNumber(dmRows[0]?.unreadTotal);

    return {
      qaUnansweredCount: qaCount + dmUnreadCount,
      notificationUnreadCount: alertCount,
      dmUnreadCount,
    };
  },
  ['dashboard-unread-counts'],
  { revalidate: 30 }
);

const getCachedDashboardSiteLogoUrl = unstable_cache(
  async () => {
    const settingsPage = await prisma.page.findUnique({
      where: { slug: '__site_settings__' },
      select: { content: true },
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = typeof settingsPage?.content === 'string' ? JSON.parse(settingsPage.content) : {};
    } catch {
      parsed = {};
    }

    return typeof parsed.logoUrl === 'string' ? parsed.logoUrl : '';
  },
  ['dashboard-site-logo-url'],
  { revalidate: 300 }
);

export async function getCoursePlatformFeePercent() {
  return getCachedCoursePlatformFeePercent();
}

export async function getCourseRevenueSettings() {
  return getCachedCourseRevenueSettings();
}

export async function getMentorScope(userId: string) {
  return getCachedMentorScope(userId);
}

export async function getMentorRevenueSummary(userId: string) {
  return getCachedMentorRevenueSummary(userId);
}

export async function getVendorRevenueSummary(vendorIds: string[], vendorConfigs: VendorConfig[]) {
  if (!vendorIds.length || !vendorConfigs.length) {
    return {
      totalNet: 0,
      totalPlatformFee: 0,
      totalAffiliateFee: 0,
      totalSoldPaid: 0,
    };
  }

  const scopeKey = vendorIds.slice().sort().join(',');
  return getCachedVendorRevenueSummary(scopeKey, vendorIds.slice().sort(), vendorConfigs);
}

export async function getDashboardUserSnapshot(userId: string) {
  return getCachedDashboardUserSnapshot(userId);
}

export async function getVendorMenuState(userId: string): Promise<VendorMenuState> {
  const vendors = await prisma.shopVendor.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: {
      ownerId: true,
      status: true,
    },
  });

  const mode = vendors.length === 0 ? 'NONE' : vendors.some((vendor) => String(vendor.status || '') === 'APPROVED') ? 'ACTIVE' : 'PENDING';
  const isOwner = vendors.some((vendor) => String(vendor.ownerId || '') === userId);

  return { mode, isOwner };
}

export async function getDashboardUnreadCounts(userId: string) {
  return getCachedDashboardUnreadCounts(userId);
}

export async function getDashboardSiteLogoUrl() {
  return getCachedDashboardSiteLogoUrl();
}

export async function getCourseRevenueRows(courseIds: string[], dateRange?: DateRange) {
  return queryCourseRevenueRowsInRange(courseIds, dateRange);
}

export async function getProductRevenueRows(vendorIds: string[], dateRange?: DateRange) {
  return queryProductRevenueRowsInRange(vendorIds, dateRange);
}
