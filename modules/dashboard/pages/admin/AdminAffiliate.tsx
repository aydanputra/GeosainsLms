"use client";

import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface AdminAffiliateProps {
  affiliates: any[];
  totals: {
    affiliates: number;
    available: number;
    pending: number;
    clicks: number;
    conversions: number;
    activeLinks: number;
    pendingWithdrawals: number;
    pendingWithdrawalsAmount: number;
  };
  settings: {
    affiliateDefaultCommissionPercent: number;
    affiliateMarketplaceSharePercent: number;
    affiliateHoldDays: number;
  };
  isSuperAdmin: boolean;
}

export default function AdminAffiliate({ affiliates, totals, settings, isSuperAdmin }: AdminAffiliateProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'WITH_BALANCE' | 'WITH_PENDING' | 'WITH_WITHDRAW_PENDING'>('ALL');
  const [sortKey, setSortKey] = useState<
    'createdAt' | 'balance' | 'pendingBalance' | 'clicks' | 'conversions' | 'activeLinksCount' | 'pendingWithdrawalsAmount'
  >('createdAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const formatIdr = (n: number) => `IDR ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
  const formatDate = (value: any) => {
    const d = value instanceof Date ? value : new Date(String(value || ''));
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = affiliates.filter((a) => {
      const text = `${a.userName || ''} ${a.userEmail || ''} ${a.code || ''}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (filter === 'WITH_BALANCE' && Number(a.balance || 0) <= 0) return false;
      if (filter === 'WITH_PENDING' && Number(a.pendingBalance || 0) <= 0) return false;
      if (filter === 'WITH_WITHDRAW_PENDING' && Number(a.pendingWithdrawalsCount || 0) <= 0) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const av = a?.[sortKey];
      const bv = b?.[sortKey];
      const an = typeof av === 'number' ? av : Number(av || 0);
      const bn = typeof bv === 'number' ? bv : Number(bv || 0);

      if (sortKey === 'createdAt') {
        const at = new Date(String(a.createdAt || 0)).getTime();
        const bt = new Date(String(b.createdAt || 0)).getTime();
        return (at - bt) * dir;
      }
      return (an - bn) * dir;
    });
    return sorted;
  }, [affiliates, query, filter, sortKey, sortDir]);

  const metrics = [
    { label: 'Total Affiliator', value: totals.affiliates, description: 'Jumlah affiliate profile' },
    { label: 'Saldo Tersedia', value: formatIdr(totals.available), description: 'Bisa withdraw' },
    { label: 'Saldo Pending', value: formatIdr(totals.pending), description: `Hold ${settings.affiliateHoldDays} hari` },
    { label: 'Withdraw Pending', value: totals.pendingWithdrawals, description: formatIdr(totals.pendingWithdrawalsAmount) },
    { label: 'Klik', value: totals.clicks, description: 'Total klik referral' },
    { label: 'Konversi', value: totals.conversions, description: 'Total konversi' },
  ];

  const columns = [
    {
      header: 'User',
      accessorKey: 'userName',
      cell: (_: any, row: any) => (
        <div className="min-w-0">
          <div className="font-extrabold text-slate-900 truncate">{row.userName}</div>
          <div className="text-xs text-slate-500 truncate">{row.userEmail || '-'}</div>
        </div>
      ),
      className: 'min-w-[220px]',
    },
    { header: 'Code', accessorKey: 'code' },
    { header: 'Saldo Tersedia', accessorKey: 'balance', cell: (val: number) => formatIdr(val) },
    { header: 'Saldo Pending', accessorKey: 'pendingBalance', cell: (val: number) => formatIdr(val) },
    {
      header: 'Links (Aktif/Total)',
      accessorKey: 'activeLinksCount',
      cell: (_: any, row: any) => `${Number(row.activeLinksCount || 0)}/${Number(row._count?.links || 0)}`,
    },
    { header: 'Clicks', accessorKey: 'clicks' },
    { header: 'Conversions', accessorKey: 'conversions' },
    {
      header: 'Withdraw Pending',
      accessorKey: 'pendingWithdrawalsCount',
      cell: (_: any, row: any) =>
        Number(row.pendingWithdrawalsCount || 0) > 0
          ? `${row.pendingWithdrawalsCount} • ${formatIdr(row.pendingWithdrawalsAmount)}`
          : '-',
      className: 'min-w-[170px]',
    },
    { header: 'Aktivitas', accessorKey: 'updatedAt', cell: (val: any) => formatDate(val), className: 'min-w-[170px]' },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Affiliate Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin/sales/withdraw"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
          >
            Withdraw
          </Link>
          {isSuperAdmin ? (
            <Link
              href="/dashboard/admin/settings?tab=affiliate"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
            >
              Pengaturan Affiliate
            </Link>
          ) : null}
        </div>
      </div>

      <Cards metrics={metrics} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari user / email / code..."
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium"
          >
            <option value="ALL">Semua</option>
            <option value="WITH_BALANCE">Ada saldo tersedia</option>
            <option value="WITH_PENDING">Ada saldo pending</option>
            <option value="WITH_WITHDRAW_PENDING">Ada withdraw pending</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium"
          >
            <option value="createdAt">Urut: Terbaru</option>
            <option value="balance">Urut: Saldo tersedia</option>
            <option value="pendingBalance">Urut: Saldo pending</option>
            <option value="clicks">Urut: Klik</option>
            <option value="conversions">Urut: Konversi</option>
            <option value="activeLinksCount">Urut: Link aktif</option>
            <option value="pendingWithdrawalsAmount">Urut: Withdraw pending</option>
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as any)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 mt-3">
          Menampilkan <span className="font-extrabold text-slate-700">{rows.length}</span> data
        </div>
      </div>

      <Table 
        columns={columns} 
        data={rows} 
        isLoading={false}
        actions={(row) => (
          <Link href={`/dashboard/admin/affiliate/${encodeURIComponent(String(row.id))}`} className="text-indigo-600 hover:text-indigo-800 text-sm font-extrabold">
            View
          </Link>
        )}
      />
    </div>
  );
}
