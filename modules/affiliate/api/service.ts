import { prisma } from '@/utils/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

const SETTINGS_SLUG = '__site_settings__';

// Schemas
export const WithdrawalSchema = z.object({
  amount: z.number().min(50000), // Minimum withdrawal IDR 50,000
  note: z.string().optional(),
});

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function getAffiliateSettings() {
  const page = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
  const data = safeParse(page?.content);
  const toInt = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  };
  const defaultCommission = toInt((data as any).affiliateDefaultCommissionPercent);
  const marketplaceShare = toInt((data as any).affiliateMarketplaceSharePercent);
  const holdDays = toInt((data as any).affiliateHoldDays);
  return {
    defaultCommissionPercent: Math.max(0, Math.min(100, defaultCommission ?? 10)),
    marketplaceSharePercent: Math.max(0, Math.min(100, marketplaceShare ?? 20)),
    holdDays: Math.max(0, Math.min(30, holdDays ?? 7)),
  };
}

async function settleAffiliateBalance(userId: string) {
  const settings = await getAffiliateSettings();
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    select: { id: true, pendingBalance: true },
  });
  if (!profile?.id) return;

  const holdMs = settings.holdDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - holdMs);
  const eligible = await prisma.commission.aggregate({
    where: {
      affiliateId: profile.id,
      status: 'EARNED',
      createdAt: { lte: cutoff },
    },
    _sum: { amount: true },
  });
  const sum = Math.max(0, Math.round(Number(eligible._sum.amount || 0)));
  if (sum <= 0) return;

  await prisma.$transaction([
    prisma.commission.updateMany({
      where: { affiliateId: profile.id, status: 'EARNED', createdAt: { lte: cutoff } },
      data: { status: 'AVAILABLE' },
    }),
    prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        balance: { increment: sum },
        pendingBalance: { decrement: Math.min(sum, Math.round(Number(profile.pendingBalance || 0))) },
      },
    }),
  ]);
}

// Services
export const generateReferralCode = async (userId: string) => {
  let profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    // Generate unique code
    const makeCode = () => randomBytes(8).toString('hex').slice(0, 8).toUpperCase();
    let code = makeCode();
    let exists = await prisma.affiliateProfile.findUnique({ where: { code } });
    while (exists) {
      code = makeCode();
      exists = await prisma.affiliateProfile.findUnique({ where: { code } });
    }

    profile = await prisma.affiliateProfile.create({
      data: {
        userId,
        code,
      },
    });
  }

  return profile;
};

type TrackClickOptions = {
  affiliateLinkId?: string;
  landingPath?: string;
};

export const trackClick = async (code: string, ip?: string, opts?: TrackClickOptions) => {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { code },
  });

  if (!profile) return null;

  const affiliateLinkIdRaw = typeof opts?.affiliateLinkId === 'string' ? opts.affiliateLinkId.trim() : '';
  const affiliateLinkId =
    affiliateLinkIdRaw && affiliateLinkIdRaw.length <= 64
      ? await prisma.affiliateLink
          .findFirst({
            where: { id: affiliateLinkIdRaw, affiliateId: profile.id, isActive: true },
            select: { id: true },
          })
          .then((x) => x?.id || null)
      : null;

  const landingPathRaw = typeof opts?.landingPath === 'string' ? opts.landingPath.trim() : '';
  const landingPath = landingPathRaw && landingPathRaw.length <= 400 ? landingPathRaw : null;

  const now = new Date();
  const windowMs = 30 * 60 * 1000;

  const recent =
    ip && ip.length <= 64
      ? await prisma.referral.findFirst({
          where: {
            affiliateId: profile.id,
            ...(affiliateLinkId ? { affiliateLinkId } : {}),
            visitorIp: ip,
            userId: null,
            createdAt: { gte: new Date(now.getTime() - windowMs) },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

  if (recent?.id) {
    await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { clicks: { increment: 1 } },
    });
    if ((affiliateLinkId && recent.affiliateLinkId !== affiliateLinkId) || (landingPath && recent.landingPath !== landingPath)) {
      await prisma.referral.update({
        where: { id: recent.id },
        data: {
          ...(affiliateLinkId ? { affiliateLinkId } : {}),
          ...(landingPath ? { landingPath } : {}),
        },
      });
    }
    return recent;
  }

  // Record click and create referral in transaction
  const [, referral] = await prisma.$transaction([
    prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { clicks: { increment: 1 } },
    }),
    prisma.referral.create({
      data: {
        affiliateId: profile.id,
        ...(affiliateLinkId ? { affiliateLinkId } : {}),
        ...(landingPath ? { landingPath } : {}),
        visitorIp: ip && ip.length <= 64 ? ip : undefined,
      },
    }),
  ]);

  return referral;
};

export const processCommission = async (orderId: string, affiliateCode: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order || order.status !== 'PAID') return;

  const profile = await prisma.affiliateProfile.findUnique({
    where: { code: affiliateCode },
  });

  if (!profile) return;

  // Avoid duplicate commission
  const existing = await prisma.commission.findUnique({
    where: { orderId },
  });
  if (existing) return;

  const settings = await getAffiliateSettings();
  const commissionRate = Math.max(0, Math.min(100, Number(settings.defaultCommissionPercent || 0))) / 100;
  const amount = Math.max(0, Math.round(Number(order.total || 0) * commissionRate));

  await prisma.$transaction([
    prisma.commission.create({
      data: {
        affiliateId: profile.id,
        orderId: order.id,
        amount,
        status: 'EARNED',
      },
    }),
    prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        pendingBalance: { increment: amount },
        conversions: { increment: 1 },
      },
    }),
    prisma.referral.updateMany({
       where: { affiliateId: profile.id, userId: order.userId },
       data: { converted: true }
    })
  ]);
};

export const requestWithdrawal = async (userId: string, amount: number, note?: string) => {
  await settleAffiliateBalance(userId);
  return prisma.$transaction(async (tx) => {
    const profile = await tx.affiliateProfile.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });

    if (!profile) throw new Error('Affiliate profile not found');

    const updated = await tx.affiliateProfile.updateMany({
      where: {
        id: profile.id,
        balance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
      },
    });

    if (updated.count === 0) throw new Error('Insufficient balance');

    return tx.withdrawal.create({
      data: {
        affiliateId: profile.id,
        amount,
        status: 'PENDING',
        note,
      },
    });
  });
};

export const getAffiliateStats = async (userId: string) => {
  await settleAffiliateBalance(userId);
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: {
      withdrawals: { orderBy: { createdAt: 'desc' }, take: 5 },
      commissions: { orderBy: { createdAt: 'desc' }, take: 5 },
      links: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, title: true, slug: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!profile?.id) return profile;

  const clickStats = await prisma.$queryRaw<{ linkId: string; clicks: bigint; conversions: bigint }[]>(
    Prisma.sql`
      SELECT
        "affiliateLinkId" AS "linkId",
        COUNT(*) AS "clicks",
        COUNT(*) FILTER (WHERE "converted" = true) AS "conversions"
      FROM "Referral"
      WHERE "affiliateId" = ${profile.id}
        AND "affiliateLinkId" IS NOT NULL
      GROUP BY "affiliateLinkId"
    `
  );
  const clickByLinkId = new Map(
    clickStats
      .filter((r) => r.linkId)
      .map((r) => [String(r.linkId), { clicks: Number(r.clicks || 0), conversions: Number(r.conversions || 0) }] as const)
  );

  const commissionStats = await prisma.$queryRaw<
    { linkId: string; total: bigint; pending: bigint; available: bigint }[]
  >(
    Prisma.sql`
      SELECT
        r."affiliateLinkId" AS "linkId",
        COALESCE(SUM(c."amount"), 0) AS "total",
        COALESCE(SUM(CASE WHEN c."status" = 'EARNED' THEN c."amount" ELSE 0 END), 0) AS "pending",
        COALESCE(SUM(CASE WHEN c."status" = 'AVAILABLE' THEN c."amount" ELSE 0 END), 0) AS "available"
      FROM "Commission" c
      JOIN "Order" o ON o."id" = c."orderId"
      JOIN "Referral" r ON r."id" = o."affiliateReferralId"
      WHERE c."affiliateId" = ${profile.id}
        AND r."affiliateLinkId" IS NOT NULL
      GROUP BY r."affiliateLinkId"
    `
  );
  const commissionByLinkId = new Map(
    commissionStats
      .filter((r) => r.linkId)
      .map((r) => [
        String(r.linkId),
        {
          total: Number(r.total || 0),
          pending: Number(r.pending || 0),
          available: Number(r.available || 0),
        },
      ] as const)
  );

  const linksWithStats = (profile as any).links.map((l: any) => {
    const clicks = clickByLinkId.get(String(l.id))?.clicks ?? 0;
    const conversions = clickByLinkId.get(String(l.id))?.conversions ?? 0;
    const commission = commissionByLinkId.get(String(l.id)) ?? { total: 0, pending: 0, available: 0 };
    return { ...l, clicks, conversions, commission };
  });

  return { ...(profile as any), links: linksWithStats };
};

export const listAffiliateLinks = async (userId: string) => {
  const stats = await getAffiliateStats(userId);
  return (stats as any)?.links || [];
};

export const createAffiliateLink = async (
  userId: string,
  input: { kind: 'COURSE' | 'PRODUCT'; courseId?: string; productId?: string }
) => {
  const profile = await generateReferralCode(userId);
  if (!profile?.id) throw new Error('Affiliate profile not found');

  const kind = input.kind;
  if (kind === 'COURSE') {
    const courseId = typeof input.courseId === 'string' ? input.courseId.trim() : '';
    if (!courseId) throw new Error('courseId wajib');
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, slug: true, status: true, deletedAt: true } });
    if (!course || course.deletedAt) throw new Error('Kursus tidak ditemukan');
    const link = await prisma.affiliateLink.create({
      data: {
        affiliateId: profile.id,
        kind: 'COURSE',
        title: course.title,
        path: `/courses/${course.slug}`,
        courseId: course.id,
      },
      include: { course: { select: { id: true, title: true, slug: true } }, product: { select: { id: true, name: true, slug: true } } },
    });
    return link;
  }

  const productId = typeof input.productId === 'string' ? input.productId.trim() : '';
  if (!productId) throw new Error('productId wajib');
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, slug: true } });
  if (!product) throw new Error('Produk tidak ditemukan');
  const path = product.slug ? `/shop/products/${product.slug}` : `/shop/products/${product.id}`;
  const link = await prisma.affiliateLink.create({
    data: {
      affiliateId: profile.id,
      kind: 'PRODUCT',
      title: product.name,
      path,
      productId: product.id,
    },
    include: { course: { select: { id: true, title: true, slug: true } }, product: { select: { id: true, name: true, slug: true } } },
  });
  return link;
};

export const deactivateAffiliateLink = async (userId: string, linkId: string) => {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile?.id) throw new Error('Affiliate profile not found');
  const id = String(linkId || '').trim();
  if (!id) throw new Error('Link tidak valid');

  const link = await prisma.affiliateLink.findFirst({ where: { id, affiliateId: profile.id }, select: { id: true } });
  if (!link?.id) throw new Error('Link tidak ditemukan');

  await prisma.affiliateLink.update({ where: { id }, data: { isActive: false } });
  return { ok: true };
};

export const getAllAffiliates = async () => {
  return prisma.affiliateProfile.findMany({
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { balance: 'desc' },
  });
};
