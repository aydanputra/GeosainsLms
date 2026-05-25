import Link from 'next/link';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';

function formatIdr(n: number) {
  return `IDR ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
}

function formatDate(value: any) {
  const d = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  const setAffiliateLinkStatus = async (formData: FormData) => {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyToken(token);
    if (!payload?.id || payload.role !== 'ADMIN') return;
    const actorId = String(payload.id);

    const linkId = String(formData.get('linkId') || '');
    const affiliateId = String(formData.get('affiliateId') || '');
    const nextActive = String(formData.get('isActive') || '').toLowerCase() === 'true';
    if (!linkId || !affiliateId) return;

    const existing = await prisma.affiliateLink.findFirst({
      where: { id: linkId, affiliateId },
      select: { id: true, affiliateId: true, isActive: true },
    });
    if (!existing) return;

    await prisma.$transaction(async (tx) => {
      await tx.affiliateLink.update({ where: { id: linkId }, data: { isActive: nextActive } });
      await tx.auditLog.create({
        data: {
          actorId,
          actorRole: payload.role,
          action: 'AFFILIATE_LINK_TOGGLE',
          entityType: 'AffiliateLink',
          entityId: linkId,
          metadata: { affiliateId, from: existing.isActive, to: nextActive } as any,
        },
      });
    });
  };

  const markAffiliateWithdrawal = async (formData: FormData) => {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyToken(token);
    if (!payload?.id || payload.role !== 'ADMIN') return;
    const actorId = String(payload.id);

    const withdrawalId = String(formData.get('id') || '');
    const affiliateId = String(formData.get('affiliateId') || '');
    const nextStatus = String(formData.get('status') || '').toUpperCase();
    if (!withdrawalId || !affiliateId) return;
    if (nextStatus !== 'SUCCESS' && nextStatus !== 'FAILED') return;

    const existing = await prisma.withdrawal.findFirst({
      where: { id: withdrawalId, affiliateId },
      select: { id: true, amount: true, status: true, affiliateId: true, affiliate: { select: { userId: true } } },
    });
    if (!existing) return;
    const prevStatus = String(existing.status || '').toUpperCase();
    if (prevStatus === 'SUCCESS' || prevStatus === 'FAILED') return;

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({ where: { id: withdrawalId }, data: { status: nextStatus } });
      if (nextStatus === 'FAILED') {
        await tx.affiliateProfile.update({
          where: { id: existing.affiliateId },
          data: { balance: { increment: Number(existing.amount || 0) } },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          actorRole: payload.role,
          action: 'AFFILIATE_WITHDRAW_MARK',
          entityType: 'Withdrawal',
          entityId: withdrawalId,
          metadata: { status: nextStatus, amount: Number(existing.amount || 0) } as any,
        },
      });
    });

    const targetUserId = existing.affiliate?.userId ? String(existing.affiliate.userId) : '';
    if (targetUserId) {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: nextStatus === 'SUCCESS' ? 'Withdraw Affiliate Selesai' : 'Withdraw Affiliate Gagal',
          message: [`Jumlah: ${formatIdr(Number(existing.amount || 0))}`, `Status: ${nextStatus}`, 'LINK:/dashboard/student/affiliate'].join('\n'),
          read: false,
        },
      });
    }
  };

  const profile = await prisma.affiliateProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      links: {
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, title: true, slug: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!profile) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-lg font-extrabold text-slate-900">Affiliate tidak ditemukan</div>
          <div className="text-sm text-slate-600 mt-1">ID: {id}</div>
          <div className="mt-4">
            <Link href="/dashboard/admin/affiliate" className="text-indigo-600 font-extrabold">
              Kembali
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const affiliateId = profile.id;

  const headerList = await headers();
  const protocol = headerList.get('x-forwarded-proto') || (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || process.env.HOST || 'localhost:3000';
  const origin = `${protocol}://${host}`;

  const linkClickStats = await prisma.$queryRaw<{ linkId: string; clicks: bigint; conversions: bigint }[]>(
    Prisma.sql`
      SELECT
        "affiliateLinkId" AS "linkId",
        COUNT(*) AS "clicks",
        COUNT(*) FILTER (WHERE "converted" = true) AS "conversions"
      FROM "Referral"
      WHERE "affiliateId" = ${affiliateId}
        AND "affiliateLinkId" IS NOT NULL
      GROUP BY "affiliateLinkId"
    `
  );
  const clicksByLinkId = new Map(
    linkClickStats
      .filter((r) => r.linkId)
      .map((r) => [String(r.linkId), { clicks: Number(r.clicks || 0), conversions: Number(r.conversions || 0) }] as const)
  );

  const linkCommissionStats = await prisma.$queryRaw<
    { linkId: string; total: bigint; pending: bigint; available: bigint; reversed: bigint }[]
  >(
    Prisma.sql`
      SELECT
        r."affiliateLinkId" AS "linkId",
        COALESCE(SUM(c."amount"), 0) AS "total",
        COALESCE(SUM(CASE WHEN c."status" = 'EARNED' THEN c."amount" ELSE 0 END), 0) AS "pending",
        COALESCE(SUM(CASE WHEN c."status" = 'AVAILABLE' THEN c."amount" ELSE 0 END), 0) AS "available",
        COALESCE(SUM(CASE WHEN c."status" = 'REVERSED' THEN c."amount" ELSE 0 END), 0) AS "reversed"
      FROM "Commission" c
      JOIN "Order" o ON o."id" = c."orderId"
      JOIN "Referral" r ON r."id" = o."affiliateReferralId"
      WHERE c."affiliateId" = ${affiliateId}
        AND r."affiliateLinkId" IS NOT NULL
      GROUP BY r."affiliateLinkId"
    `
  );
  const commissionByLinkId = new Map(
    linkCommissionStats
      .filter((r) => r.linkId)
      .map((r) => [
        String(r.linkId),
        {
          total: Number(r.total || 0),
          pending: Number(r.pending || 0),
          available: Number(r.available || 0),
          reversed: Number(r.reversed || 0),
        },
      ] as const)
  );

  const commissions = await prisma.commission.findMany({
    where: { affiliateId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, orderId: true, amount: true, status: true, createdAt: true },
  });

  const withdrawals = await prisma.withdrawal.findMany({
    where: { affiliateId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const pendingWithdrawals = await prisma.withdrawal.findMany({
    where: { affiliateId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const userName = profile.user?.name || profile.user?.email || 'Unknown';
  const userEmail = profile.user?.email || '';
  const totalLinks = profile.links.length;
  const activeLinks = profile.links.filter((l) => l.isActive).length;

  const kpi = [
    { label: 'Saldo Tersedia', value: formatIdr(profile.balance) },
    { label: 'Saldo Pending', value: formatIdr(profile.pendingBalance) },
    { label: 'Klik', value: String(profile.clicks) },
    { label: 'Konversi', value: String(profile.conversions) },
    { label: 'Links (Aktif/Total)', value: `${activeLinks}/${totalLinks}` },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-slate-600">
            <Link href="/dashboard/admin/affiliate" className="text-indigo-600 font-extrabold hover:text-indigo-800">
              Affiliate
            </Link>{' '}
            <span className="text-slate-400">/</span> Detail
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">{userName}</h1>
          <div className="text-sm text-slate-600 mt-1">
            {userEmail ? <span className="font-semibold">{userEmail}</span> : null}
            <span className="text-slate-400"> • </span>
            Code: <span className="font-extrabold text-slate-900">{profile.code}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpi.map((x) => (
          <div key={x.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="text-xs font-extrabold text-slate-600">{x.label}</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{x.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Laporan Link Fokus</div>
            <div className="text-xs text-slate-600 mt-1">Klik, konversi, dan komisi per produk/kursus yang dipromosikan</div>
          </div>
        </div>

        {profile.links.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Tipe</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Share</th>
                  <th className="py-2 pr-4">Klik</th>
                  <th className="py-2 pr-4">Konversi</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Pending</th>
                  <th className="py-2 pr-4">Tersedia</th>
                  <th className="py-2">Path</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {profile.links.map((l) => {
                  const title = l.course?.title || l.product?.name || l.title || '-';
                  const stats = clicksByLinkId.get(l.id) || { clicks: 0, conversions: 0 };
                  const comm = commissionByLinkId.get(l.id) || { total: 0, pending: 0, available: 0, reversed: 0 };
                  const shareUrl = `${origin}${l.path}${l.path.includes('?') ? '&' : '?'}ref=${encodeURIComponent(
                    String(profile.code || '')
                  )}&al=${encodeURIComponent(String(l.id))}`;
                  return (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-900 font-extrabold">{title}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{l.kind}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                            l.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {l.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <a href={shareUrl} className="text-indigo-600 hover:text-indigo-800 font-extrabold text-xs" target="_blank" rel="noreferrer">
                          Buka
                        </a>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{stats.clicks}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{stats.conversions}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(comm.total)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(comm.pending)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(comm.available)}</td>
                      <td className="py-2 text-slate-600 whitespace-nowrap">{l.path}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <form action={setAffiliateLinkStatus} className="inline-flex">
                          <input type="hidden" name="affiliateId" value={affiliateId} />
                          <input type="hidden" name="linkId" value={l.id} />
                          <input type="hidden" name="isActive" value={String(!l.isActive)} />
                          <button
                            type="submit"
                            className={
                              l.isActive
                                ? 'px-3 py-2 rounded-xl border border-slate-200 bg-white text-rose-700 font-extrabold text-xs hover:bg-rose-50'
                                : 'px-3 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700'
                            }
                          >
                            {l.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-600">Belum ada link fokus untuk affiliate ini.</div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Withdraw Pending</div>
            <div className="text-xs text-slate-600 mt-1">Permintaan withdraw affiliate yang perlu diproses</div>
          </div>
          <Link
            href="/dashboard/admin/sales/withdraw"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
          >
            Lihat Semua
          </Link>
        </div>

        {pendingWithdrawals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Jumlah</th>
                  <th className="py-2 pr-4">Catatan</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pendingWithdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(w.createdAt)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(w.amount)}</td>
                    <td className="py-2 pr-4 text-slate-700">{w.note || '-'}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <form action={markAffiliateWithdrawal}>
                          <input type="hidden" name="id" value={w.id} />
                          <input type="hidden" name="affiliateId" value={affiliateId} />
                          <input type="hidden" name="status" value="SUCCESS" />
                          <button type="submit" className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700">
                            Selesai
                          </button>
                        </form>
                        <form action={markAffiliateWithdrawal}>
                          <input type="hidden" name="id" value={w.id} />
                          <input type="hidden" name="affiliateId" value={affiliateId} />
                          <input type="hidden" name="status" value="FAILED" />
                          <button
                            type="submit"
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-rose-700 font-extrabold text-xs hover:bg-rose-50"
                          >
                            Gagal
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-600">Tidak ada withdraw pending untuk affiliate ini.</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-extrabold text-slate-900 mb-4">Komisi Terbaru</div>
          {commissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Tanggal</th>
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">Jumlah</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(c.createdAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{String(c.orderId || '-').slice(0, 12)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(c.amount)}</td>
                      <td className="py-2 whitespace-nowrap text-slate-700 font-extrabold">{String(c.status || '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Belum ada komisi.</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-extrabold text-slate-900 mb-4">Withdraw Terbaru</div>
          {withdrawals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Tanggal</th>
                    <th className="py-2 pr-4">Jumlah</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(w.createdAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(w.amount)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-700 font-extrabold">{String(w.status || '-')}</td>
                      <td className="py-2 text-slate-700">{w.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Belum ada riwayat withdraw.</div>
          )}
        </div>
      </div>
    </div>
  );
}
