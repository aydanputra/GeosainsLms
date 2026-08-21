import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorAffiliate from '@/modules/dashboard/pages/mentor/MentorAffiliate';
import { getMentorScope } from '@/modules/dashboard/api/performance';

export const dynamic = 'force-dynamic';

type AffiliateRange = '7d' | '30d' | '90d' | 'all';

function getTotalDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  const fallbackTotal = Number(it?.discountAmount || 0);
  if (store === 0 && marketplace === 0) return fallbackTotal;
  return store + marketplace;
}

function normalizeRange(input: unknown): AffiliateRange {
  const raw = typeof input === 'string' ? input.trim().toLowerCase() : '';
  return raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all' ? raw : '30d';
}

function getRangeStart(range: AffiliateRange) {
  const now = new Date();
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (range === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return null;
}

function getRangeLabel(range: AffiliateRange) {
  if (range === '7d') return '7 hari terakhir';
  if (range === '30d') return '30 hari terakhir';
  if (range === '90d') return '90 hari terakhir';
  return 'Semua waktu';
}

function getJakartaDayKey(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
}

function formatJakartaDayLabel(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return dayKey;
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const sp = searchParams ? await searchParams : {};
  const range = normalizeRange(sp?.range);
  const rangeStart = getRangeStart(range);
  const rangeLabel = getRangeLabel(range);

  const mentorScope = await getMentorScope(userId);
  const courseIds = mentorScope.courseIds;
  const productIds = mentorScope.productIds;

  const links =
    courseIds.length || productIds.length
      ? await prisma.affiliateLink.findMany({
          where: {
            OR: [
              ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
              ...(productIds.length ? [{ productId: { in: productIds } }] : []),
            ],
          },
          include: {
            affiliate: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, role: true },
                },
              },
            },
            course: { select: { id: true, title: true, slug: true } },
            product: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

  const linkIds = links.map((link) => link.id);
  const linkById = new Map(links.map((link) => [String(link.id), link] as const));

  const referrals =
    linkIds.length > 0
      ? await prisma.referral.groupBy({
          by: ['affiliateLinkId', 'converted'],
          where: {
            affiliateLinkId: { in: linkIds },
            ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
          },
          _count: { _all: true },
        })
      : [];

  const rawReferrals =
    linkIds.length > 0
      ? await prisma.referral.findMany({
          where: {
            affiliateLinkId: { in: linkIds },
            ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
          },
          select: {
            affiliateLinkId: true,
            converted: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

  const referralStatsByLinkId = new Map<string, { clicks: number; conversions: number }>();
  for (const row of referrals) {
    const linkId = typeof row.affiliateLinkId === 'string' ? row.affiliateLinkId : '';
    if (!linkId) continue;
    const current = referralStatsByLinkId.get(linkId) || { clicks: 0, conversions: 0 };
    const count = Number(row._count._all || 0);
    current.clicks += count;
    if (row.converted) current.conversions += count;
    referralStatsByLinkId.set(linkId, current);
  }

  const orders =
    linkIds.length > 0
      ? await prisma.order.findMany({
          where: {
            status: 'PAID',
            affiliateReferral: { is: { affiliateLinkId: { in: linkIds } } },
            ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
          },
          select: {
            id: true,
            total: true,
            createdAt: true,
            affiliateReferral: { select: { affiliateLinkId: true } },
            commission: { select: { amount: true } },
            items: {
              select: {
                courseId: true,
                productId: true,
                quantity: true,
                price: true,
                discountAmount: true,
                discountStoreAmount: true,
                discountMarketplaceAmount: true,
                refundAmount: true,
              },
            },
          },
        })
      : [];

  const orderSummaries: Array<{ createdAt: Date; linkId: string; matchedGross: number; affiliateFee: number }> = [];
  const ordersByLinkId = new Map<string, { orders: number; grossSales: number; affiliateFee: number }>();
  for (const order of orders) {
    const linkId = typeof order.affiliateReferral?.affiliateLinkId === 'string' ? order.affiliateReferral.affiliateLinkId : '';
    if (!linkId) continue;
    const link = linkById.get(linkId);
    if (!link) continue;

    const matchedGross = (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => {
      const courseMatch = link.courseId && item.courseId === link.courseId;
      const productMatch = link.productId && item.productId === link.productId;
      if (!courseMatch && !productMatch) return sum;

      const qty = Number(item.quantity || 0);
      const lineSubtotal = Number(item.price || 0) * qty;
      const discountTotal = Math.max(0, getTotalDiscountAmount(item));
      const refund = Math.max(0, Number(item.refundAmount || 0));
      return sum + Math.max(0, lineSubtotal - discountTotal - refund);
    }, 0);

    const orderTotal = Math.max(0, Number(order.total || 0));
    const commissionAmount = Math.max(0, Number(order.commission?.amount || 0));
    const orderShare = orderTotal > 0 ? Math.max(0, Math.min(1, matchedGross / orderTotal)) : 0;
    const affiliateFee = Math.max(0, commissionAmount * orderShare);
    orderSummaries.push({ createdAt: order.createdAt, linkId, matchedGross, affiliateFee });

    const current = ordersByLinkId.get(linkId) || { orders: 0, grossSales: 0, affiliateFee: 0 };
    current.orders += 1;
    current.grossSales += matchedGross;
    current.affiliateFee += affiliateFee;
    ordersByLinkId.set(linkId, current);
  }

  const affiliateMap = new Map<string, any>();
  const linkRowsRaw = links.map((link) => {
    const stats = referralStatsByLinkId.get(link.id) || { clicks: 0, conversions: 0 };
    const orderStats = ordersByLinkId.get(link.id) || { orders: 0, grossSales: 0, affiliateFee: 0 };
    const affiliateId = String(link.affiliate?.id || '');
    const affiliateUser = link.affiliate?.user;
    const createdAtIso = link.createdAt.toISOString();
    const updatedAtIso = link.updatedAt.toISOString();
    const itemTitle = link.course?.title || link.product?.name || link.title || link.path || '-';

    if (affiliateId) {
      const current = affiliateMap.get(affiliateId) || {
        id: affiliateId,
        userName: affiliateUser?.name || affiliateUser?.email || 'Affiliate',
        userEmail: affiliateUser?.email || '',
        role: affiliateUser?.role || '-',
        activeLinks: 0,
        clicks: 0,
        conversions: 0,
        orders: 0,
        grossSales: 0,
        affiliateFee: 0,
        lastActivityAt: createdAtIso,
      };
      current.activeLinks += link.isActive ? 1 : 0;
      current.clicks += stats.clicks;
      current.conversions += stats.conversions;
      current.orders += orderStats.orders;
      current.grossSales += orderStats.grossSales;
      current.affiliateFee += orderStats.affiliateFee;

      const candidateTimes = [current.lastActivityAt, createdAtIso, updatedAtIso];
      current.lastActivityAt = candidateTimes
        .filter(Boolean)
        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0];

      affiliateMap.set(affiliateId, current);
    }

    return {
      id: link.id,
      itemTitle,
      kind: String(link.kind || ''),
      isActive: Boolean(link.isActive),
      affiliateName: affiliateUser?.name || affiliateUser?.email || 'Affiliate',
      affiliateEmail: affiliateUser?.email || '',
      affiliateRole: affiliateUser?.role || '-',
      clicks: stats.clicks,
      conversions: stats.conversions,
      orders: orderStats.orders,
      grossSales: orderStats.grossSales,
      affiliateFee: orderStats.affiliateFee,
      createdAt: createdAtIso,
    };
  });

  const linkRows =
    range === 'all'
      ? linkRowsRaw
      : linkRowsRaw.filter((row) => {
          if (Number(row.clicks || 0) > 0) return true;
          if (Number(row.conversions || 0) > 0) return true;
          if (Number(row.orders || 0) > 0) return true;
          if (Number(row.grossSales || 0) > 0) return true;
          if (Number(row.affiliateFee || 0) > 0) return true;
          const createdAt = new Date(String(row.createdAt || ''));
          return Boolean(rangeStart && !Number.isNaN(createdAt.getTime()) && createdAt >= rangeStart);
        });

  const affiliateRows = Array.from(affiliateMap.values())
    .filter((row) => {
      if (range === 'all') return true;
      if (Number(row.clicks || 0) > 0) return true;
      if (Number(row.conversions || 0) > 0) return true;
      if (Number(row.orders || 0) > 0) return true;
      if (Number(row.grossSales || 0) > 0) return true;
      if (Number(row.affiliateFee || 0) > 0) return true;
      const lastActivity = new Date(String(row.lastActivityAt || ''));
      return Boolean(rangeStart && !Number.isNaN(lastActivity.getTime()) && lastActivity >= rangeStart);
    })
    .sort((a, b) => new Date(String(b.lastActivityAt || 0)).getTime() - new Date(String(a.lastActivityAt || 0)).getTime());

  const summary = affiliateRows.reduce(
    (acc, row) => {
      acc.affiliates += 1;
      acc.clicks += Number(row.clicks || 0);
      acc.conversions += Number(row.conversions || 0);
      acc.orders += Number(row.orders || 0);
      acc.grossSales += Number(row.grossSales || 0);
      acc.affiliateFee += Number(row.affiliateFee || 0);
      return acc;
    },
    {
      affiliates: 0,
      activeLinks: linkRows.filter((row) => row.isActive).length,
      clicks: 0,
      conversions: 0,
      orders: 0,
      grossSales: 0,
      affiliateFee: 0,
    }
  );

  const trendMap = new Map<string, { day: string; clicks: number; conversions: number; orders: number; grossSales: number; affiliateFee: number }>();
  for (const referral of rawReferrals) {
    const dayKey = getJakartaDayKey(referral.createdAt);
    if (!dayKey) continue;
    const current = trendMap.get(dayKey) || {
      day: formatJakartaDayLabel(dayKey),
      clicks: 0,
      conversions: 0,
      orders: 0,
      grossSales: 0,
      affiliateFee: 0,
    };
    current.clicks += 1;
    if (referral.converted) current.conversions += 1;
    trendMap.set(dayKey, current);
  }

  for (const summaryRow of orderSummaries) {
    const dayKey = getJakartaDayKey(summaryRow.createdAt);
    if (!dayKey) continue;
    const current = trendMap.get(dayKey) || {
      day: formatJakartaDayLabel(dayKey),
      clicks: 0,
      conversions: 0,
      orders: 0,
      grossSales: 0,
      affiliateFee: 0,
    };
    current.orders += 1;
    current.grossSales += summaryRow.matchedGross;
    current.affiliateFee += summaryRow.affiliateFee;
    trendMap.set(dayKey, current);
  }

  const trendDaily = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);

  return (
    <MentorAffiliate
      summary={summary}
      affiliates={affiliateRows}
      links={linkRows}
      trendDaily={trendDaily}
      initialRange={range}
      rangeLabel={rangeLabel}
    />
  );
}
