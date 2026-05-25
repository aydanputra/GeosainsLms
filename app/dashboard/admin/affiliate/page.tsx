import { prisma } from '@/utils/prisma';
import AdminAffiliate from '@/modules/dashboard/pages/admin/AdminAffiliate';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'ADMIN') return <div>Access Denied</div>;
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  const isSuperAdmin = Boolean(actor?.isSuperAdmin);

  const settingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
  const settings = (() => {
    try {
      return settingsPage?.content ? (JSON.parse(settingsPage.content) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  })();

  const affiliateSettings = {
    affiliateDefaultCommissionPercent:
      typeof settings.affiliateDefaultCommissionPercent === 'number' ? settings.affiliateDefaultCommissionPercent : 10,
    affiliateMarketplaceSharePercent:
      typeof settings.affiliateMarketplaceSharePercent === 'number' ? settings.affiliateMarketplaceSharePercent : 20,
    affiliateHoldDays: typeof settings.affiliateHoldDays === 'number' ? settings.affiliateHoldDays : 7,
  };

  const holdDays = Math.max(0, Math.min(30, Number(affiliateSettings.affiliateHoldDays || 0)));
  if (holdDays > 0) {
    const holdMs = holdDays * 24 * 60 * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - holdMs);
    await prisma.$transaction(async (tx) => {
      const profiles = await tx.affiliateProfile.findMany({ select: { id: true, pendingBalance: true } });
      if (profiles.length === 0) return;
      const pendingById = new Map(profiles.map((p) => [p.id, Math.max(0, Math.round(Number(p.pendingBalance || 0)))] as const));

      const eligible = await tx.commission.groupBy({
        by: ['affiliateId'],
        where: { status: 'EARNED', createdAt: { lte: cutoff } },
        _sum: { amount: true },
      });
      for (const row of eligible) {
        const affiliateId = String(row.affiliateId);
        const sum = Math.max(0, Math.round(Number(row._sum.amount || 0)));
        if (sum <= 0) continue;
        const pending = pendingById.get(affiliateId) ?? 0;
        const dec = Math.min(sum, pending);

        await tx.commission.updateMany({
          where: { affiliateId, status: 'EARNED', createdAt: { lte: cutoff } },
          data: { status: 'AVAILABLE' },
        });
        await tx.affiliateProfile.update({
          where: { id: affiliateId },
          data: {
            balance: { increment: sum },
            pendingBalance: { decrement: dec },
          },
        });
      }
    });
  }

  const affiliates = await prisma.affiliateProfile.findMany({
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { links: true, referrals: true, commissions: true, withdrawals: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const affiliateIds = affiliates.map((a) => a.id);

  const activeLinks =
    affiliateIds.length > 0
      ? await prisma.affiliateLink.groupBy({
          by: ['affiliateId'],
          where: { affiliateId: { in: affiliateIds }, isActive: true },
          _count: { _all: true },
        })
      : [];
  const activeLinksByAffiliateId = new Map(activeLinks.map((r) => [r.affiliateId, Number(r._count._all || 0)] as const));

  const pendingWithdrawals =
    affiliateIds.length > 0
      ? await prisma.withdrawal.groupBy({
          by: ['affiliateId'],
          where: { affiliateId: { in: affiliateIds }, status: 'PENDING' },
          _count: { _all: true },
          _sum: { amount: true },
        })
      : [];
  const pendingWithdrawalsByAffiliateId = new Map(
    pendingWithdrawals.map((r) => [
      r.affiliateId,
      { count: Number(r._count._all || 0), amount: Number(r._sum.amount || 0) },
    ])
  );

  const commissionByStatus =
    affiliateIds.length > 0
      ? await prisma.commission.groupBy({
          by: ['affiliateId', 'status'],
          where: { affiliateId: { in: affiliateIds } },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : [];

  const commissionSummaryByAffiliateId = new Map<string, { pending: number; available: number; reversed: number; total: number }>();
  for (const row of commissionByStatus) {
    const id = String(row.affiliateId);
    const status = String(row.status || '').toUpperCase();
    const sum = Number(row._sum.amount || 0);
    const current = commissionSummaryByAffiliateId.get(id) || { pending: 0, available: 0, reversed: 0, total: 0 };
    current.total += sum;
    if (status === 'EARNED') current.pending += sum;
    else if (status === 'AVAILABLE') current.available += sum;
    else if (status === 'REVERSED') current.reversed += sum;
    commissionSummaryByAffiliateId.set(id, current);
  }

  const formattedAffiliates = affiliates.map((a) => {
    const userName = a.user?.name || a.user?.email || 'Unknown';
    const userEmail = a.user?.email || '';
    const activeLinksCount = activeLinksByAffiliateId.get(a.id) ?? 0;
    const pendingW = pendingWithdrawalsByAffiliateId.get(a.id) || { count: 0, amount: 0 };
    const comm = commissionSummaryByAffiliateId.get(a.id) || { pending: 0, available: 0, reversed: 0, total: 0 };
    return {
      ...a,
      userName,
      userEmail,
      activeLinksCount,
      pendingWithdrawalsCount: pendingW.count,
      pendingWithdrawalsAmount: pendingW.amount,
      commissionPendingAmount: comm.pending,
      commissionAvailableAmount: comm.available,
      commissionReversedAmount: comm.reversed,
      commissionTotalAmount: comm.total,
    };
  });

  const totals = formattedAffiliates.reduce(
    (acc, a: any) => {
      acc.affiliates += 1;
      acc.available += Number(a.balance || 0);
      acc.pending += Number(a.pendingBalance || 0);
      acc.clicks += Number(a.clicks || 0);
      acc.conversions += Number(a.conversions || 0);
      acc.activeLinks += Number(a.activeLinksCount || 0);
      acc.pendingWithdrawals += Number(a.pendingWithdrawalsCount || 0);
      acc.pendingWithdrawalsAmount += Number(a.pendingWithdrawalsAmount || 0);
      return acc;
    },
    {
      affiliates: 0,
      available: 0,
      pending: 0,
      clicks: 0,
      conversions: 0,
      activeLinks: 0,
      pendingWithdrawals: 0,
      pendingWithdrawalsAmount: 0,
    }
  );

  return <AdminAffiliate affiliates={formattedAffiliates} totals={totals} settings={affiliateSettings} isSuperAdmin={isSuperAdmin} />;
}
