"use client";

import { useMemo, useState } from 'react';
import Cards from '../../components/Cards';
import Table from '../../components/Tables';
import Link from 'next/link';
import { SimpleAreaChart, SimpleBarChart, SimpleLineChart } from '../../components/Charts';

type AffiliateRange = '7d' | '30d' | '90d' | 'all';

interface MentorAffiliateProps {
  summary: {
    affiliates: number;
    activeLinks: number;
    clicks: number;
    conversions: number;
    orders: number;
    grossSales: number;
    affiliateFee: number;
  };
  affiliates: any[];
  links: any[];
  trendDaily: Array<{
    day: string;
    clicks: number;
    conversions: number;
    orders: number;
    grossSales: number;
    affiliateFee: number;
  }>;
  initialRange: AffiliateRange;
  rangeLabel: string;
}

function formatIdr(value: number) {
  return `IDR ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;
}

function formatDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function roleBadge(role: unknown) {
  const raw = String(role || '').toUpperCase();
  if (raw === 'MENTOR') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (raw === 'STUDENT') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (raw === 'ADMIN') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function MentorAffiliate({ summary, affiliates, links, trendDaily, initialRange, rangeLabel }: MentorAffiliateProps) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'MENTOR' | 'ADMIN'>('ALL');
  const [linkFilter, setLinkFilter] = useState<'ALL' | 'COURSE' | 'PRODUCT'>('ALL');

  const metrics = [
    { label: 'Total Affiliator', value: Number(summary.affiliates || 0), description: 'Siswa / mentor yang mempromosikan aset Anda' },
    { label: 'Link Aktif', value: Number(summary.activeLinks || 0), description: 'Link affiliate untuk kursus & produk Anda' },
    { label: 'Klik Referral', value: Number(summary.clicks || 0), description: 'Total klik pada link affiliate' },
    { label: 'Konversi', value: Number(summary.conversions || 0), description: 'Referral yang berhasil menjadi pembelian' },
    { label: 'Order Affiliate', value: Number(summary.orders || 0), description: 'Order yang datang dari affiliate' },
    { label: 'Penjualan Affiliate', value: formatIdr(Number(summary.grossSales || 0)), description: 'Nilai penjualan yang dibawa affiliate' },
    { label: 'Fee Affiliate', value: formatIdr(Number(summary.affiliateFee || 0)), description: 'Komisi yang dibayarkan ke affiliator' },
  ];

  const affiliateRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return affiliates.filter((row) => {
      const haystack = `${row.userName || ''} ${row.userEmail || ''} ${row.role || ''}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (roleFilter !== 'ALL' && String(row.role || '').toUpperCase() !== roleFilter) return false;
      return true;
    });
  }, [affiliates, query, roleFilter]);

  const linkRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter((row) => {
      const haystack = `${row.itemTitle || ''} ${row.affiliateName || ''} ${row.affiliateEmail || ''} ${row.kind || ''}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (roleFilter !== 'ALL' && String(row.affiliateRole || '').toUpperCase() !== roleFilter) return false;
      if (linkFilter !== 'ALL' && String(row.kind || '').toUpperCase() !== linkFilter) return false;
      return true;
    });
  }, [links, query, roleFilter, linkFilter]);

  const topAffiliates = useMemo(
    () =>
      [...affiliateRows]
        .sort((a, b) => {
          const salesDiff = Number(b.grossSales || 0) - Number(a.grossSales || 0);
          if (salesDiff !== 0) return salesDiff;
          const orderDiff = Number(b.orders || 0) - Number(a.orders || 0);
          if (orderDiff !== 0) return orderDiff;
          return Number(b.clicks || 0) - Number(a.clicks || 0);
        })
        .slice(0, 5),
    [affiliateRows]
  );

  const topItems = useMemo(() => {
    const grouped = new Map<string, any>();
    for (const row of linkRows) {
      const key = `${String(row.kind || '')}::${String(row.itemTitle || '-')}`;
      const current = grouped.get(key) || {
        itemTitle: row.itemTitle || '-',
        kind: row.kind || '-',
        clicks: 0,
        conversions: 0,
        orders: 0,
        grossSales: 0,
        affiliateFee: 0,
      };
      current.clicks += Number(row.clicks || 0);
      current.conversions += Number(row.conversions || 0);
      current.orders += Number(row.orders || 0);
      current.grossSales += Number(row.grossSales || 0);
      current.affiliateFee += Number(row.affiliateFee || 0);
      grouped.set(key, current);
    }
    return Array.from(grouped.values())
      .sort((a, b) => {
        const salesDiff = Number(b.grossSales || 0) - Number(a.grossSales || 0);
        if (salesDiff !== 0) return salesDiff;
        const orderDiff = Number(b.orders || 0) - Number(a.orders || 0);
        if (orderDiff !== 0) return orderDiff;
        return Number(b.clicks || 0) - Number(a.clicks || 0);
      })
      .slice(0, 5);
  }, [linkRows]);

  const affiliateColumns = [
    {
      header: 'Affiliator',
      accessorKey: 'userName',
      cell: (_: any, row: any) => (
        <div className="min-w-0">
          <div className="font-extrabold text-slate-900 truncate">{row.userName}</div>
          <div className="text-xs text-slate-500 truncate">{row.userEmail || '-'}</div>
        </div>
      ),
      className: 'min-w-[220px]',
    },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${roleBadge(value)}`}>
          {String(value || '-')}
        </span>
      ),
      className: 'whitespace-nowrap',
    },
    { header: 'Link Aktif', accessorKey: 'activeLinks', className: 'whitespace-nowrap' },
    { header: 'Klik', accessorKey: 'clicks', className: 'whitespace-nowrap' },
    { header: 'Konversi', accessorKey: 'conversions', className: 'whitespace-nowrap' },
    { header: 'Order', accessorKey: 'orders', className: 'whitespace-nowrap' },
    { header: 'Penjualan', accessorKey: 'grossSales', cell: (value: number) => formatIdr(value), className: 'whitespace-nowrap' },
    { header: 'Fee Affiliate', accessorKey: 'affiliateFee', cell: (value: number) => formatIdr(value), className: 'whitespace-nowrap' },
    { header: 'Aktivitas Terakhir', accessorKey: 'lastActivityAt', cell: (value: string) => formatDate(value), className: 'min-w-[170px]' },
  ];

  const linkColumns = [
    {
      header: 'Item',
      accessorKey: 'itemTitle',
      cell: (_: any, row: any) => (
        <div className="min-w-0">
          <div className="font-extrabold text-slate-900 truncate">{row.itemTitle}</div>
          <div className="text-xs text-slate-500 mt-1">{String(row.kind || '-')} • {row.isActive ? 'Aktif' : 'Nonaktif'}</div>
        </div>
      ),
      className: 'min-w-[240px]',
    },
    {
      header: 'Affiliator',
      accessorKey: 'affiliateName',
      cell: (_: any, row: any) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{row.affiliateName}</div>
          <div className="text-xs text-slate-500 truncate">{row.affiliateEmail || '-'}</div>
        </div>
      ),
      className: 'min-w-[220px]',
    },
    {
      header: 'Role',
      accessorKey: 'affiliateRole',
      cell: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${roleBadge(value)}`}>
          {String(value || '-')}
        </span>
      ),
      className: 'whitespace-nowrap',
    },
    { header: 'Klik', accessorKey: 'clicks', className: 'whitespace-nowrap' },
    { header: 'Konversi', accessorKey: 'conversions', className: 'whitespace-nowrap' },
    { header: 'Order', accessorKey: 'orders', className: 'whitespace-nowrap' },
    { header: 'Penjualan', accessorKey: 'grossSales', cell: (value: number) => formatIdr(value), className: 'whitespace-nowrap' },
    { header: 'Fee Affiliate', accessorKey: 'affiliateFee', cell: (value: number) => formatIdr(value), className: 'whitespace-nowrap' },
    { header: 'Dibuat', accessorKey: 'createdAt', cell: (value: string) => formatDate(value), className: 'min-w-[170px]' },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Affiliate Dashboard Mentor</h1>
          <p className="text-sm text-slate-600 mt-1">
            Pantau siswa atau mentor lain yang menjadi affiliate untuk kursus dan produk Anda. Periode aktif: {rangeLabel}.
          </p>
        </div>
        <Link
          href="/dashboard/student/affiliate"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
        >
          Saya Ingin Jadi Affiliator
        </Link>
      </div>

      <Cards metrics={metrics} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Tren Klik & Konversi</h3>
          <div className="text-sm text-slate-500 mb-4">Pergerakan traffic affiliate pada {rangeLabel.toLowerCase()}.</div>
          {trendDaily.length > 0 ? (
            <SimpleLineChart data={trendDaily.map((row) => ({ day: row.day, value: row.clicks }))} xKey="day" yKey="value" name="Klik" />
          ) : (
            <div className="text-sm text-slate-600">Belum ada data klik pada periode ini.</div>
          )}
          {trendDaily.length > 0 ? (
            <div className="mt-4">
              <SimpleAreaChart data={trendDaily.map((row) => ({ day: row.day, value: row.conversions }))} xKey="day" yKey="value" name="Konversi" />
            </div>
          ) : null}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Tren Order & Penjualan Affiliate</h3>
          <div className="text-sm text-slate-500 mb-4">Pantau order yang masuk dan nilai penjualan affiliate pada {rangeLabel.toLowerCase()}.</div>
          {trendDaily.length > 0 ? (
            <SimpleLineChart data={trendDaily.map((row) => ({ day: row.day, value: row.orders }))} xKey="day" yKey="value" name="Order" />
          ) : (
            <div className="text-sm text-slate-600">Belum ada order affiliate pada periode ini.</div>
          )}
          {trendDaily.length > 0 ? (
            <div className="mt-4">
              <SimpleAreaChart data={trendDaily.map((row) => ({ day: row.day, value: row.grossSales }))} xKey="day" yKey="value" name="Penjualan" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Affiliator Teratas</h3>
          <div className="text-sm text-slate-500 mb-4">Affiliator dengan kontribusi penjualan terbesar pada {rangeLabel.toLowerCase()}.</div>
          {topAffiliates.length > 0 ? (
            <>
              <SimpleBarChart
                data={topAffiliates.map((row) => ({
                  name: String(row.userName || row.userEmail || 'Affiliate').slice(0, 18),
                  value: Number(row.grossSales || 0),
                }))}
                xKey="name"
                yKey="value"
                name="Penjualan"
              />
              <div className="mt-4 space-y-3">
                {topAffiliates.map((row, index) => (
                  <div key={String(row.id || index)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">
                        {index + 1}. {row.userName || row.userEmail || 'Affiliate'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.orders} order • {row.clicks} klik • {row.conversions} konversi
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-slate-900">{formatIdr(Number(row.grossSales || 0))}</div>
                      <div className="text-xs text-slate-500">Fee {formatIdr(Number(row.affiliateFee || 0))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-600">Belum ada affiliator aktif pada periode ini.</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Item Terlaris dari Affiliate</h3>
          <div className="text-sm text-slate-500 mb-4">Lihat kursus atau produk yang paling kuat dikonversi lewat affiliate pada {rangeLabel.toLowerCase()}.</div>
          {topItems.length > 0 ? (
            <>
              <SimpleBarChart
                data={topItems.map((row) => ({
                  name: String(row.itemTitle || '-').slice(0, 18),
                  value: Number(row.grossSales || 0),
                }))}
                xKey="name"
                yKey="value"
                name="Penjualan"
              />
              <div className="mt-4 space-y-3">
                {topItems.map((row, index) => (
                  <div key={`${String(row.kind || '-')}-${String(row.itemTitle || index)}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">
                        {index + 1}. {row.itemTitle || '-'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {String(row.kind || '-')} • {row.orders} order • {row.clicks} klik
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-slate-900">{formatIdr(Number(row.grossSales || 0))}</div>
                      <div className="text-xs text-slate-500">Fee {formatIdr(Number(row.affiliateFee || 0))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-600">Belum ada item affiliate yang menghasilkan penjualan pada periode ini.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col gap-3 mb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: '7d', label: '7 Hari' },
                { id: '30d', label: '30 Hari' },
                { id: '90d', label: '90 Hari' },
                { id: 'all', label: 'Semua Waktu' },
              ] as const
            ).map((item) => (
              <Link
                key={item.id}
                href={item.id === 'all' ? '/dashboard/mentor/marketing/affiliate' : `/dashboard/mentor/marketing/affiliate?range=${item.id}`}
                className={[
                  'inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-extrabold border transition-colors',
                  initialRange === item.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            Ringkasan performa affiliate untuk <span className="font-extrabold text-slate-700">{rangeLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari affiliator / email / item..."
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium"
          >
            <option value="ALL">Semua role affiliate</option>
            <option value="STUDENT">Siswa</option>
            <option value="MENTOR">Mentor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select
            value={linkFilter}
            onChange={(e) => setLinkFilter(e.target.value as any)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium"
          >
            <option value="ALL">Semua item</option>
            <option value="COURSE">Kursus</option>
            <option value="PRODUCT">Produk</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 mt-3">
          Menampilkan <span className="font-extrabold text-slate-700">{affiliateRows.length}</span> affiliator dan{' '}
          <span className="font-extrabold text-slate-700">{linkRows.length}</span> link affiliate.
        </div>
      </div>

      <div className="space-y-8 pb-12">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-extrabold text-slate-900">Affiliator Terdaftar</h2>
          </div>
          <Table columns={affiliateColumns} data={affiliateRows} isLoading={false} />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-extrabold text-slate-900">Performa Link Affiliate</h2>
          </div>
          <Table columns={linkColumns} data={linkRows} isLoading={false} />
        </div>
      </div>
    </div>
  );
}
