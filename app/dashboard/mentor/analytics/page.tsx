'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Cards from '@/modules/dashboard/components/Cards';
import Table from '@/modules/dashboard/components/Tables';
import { SimpleAreaChart, SimpleBarChart, SimpleLineChart } from '@/modules/dashboard/components/Charts';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookOpen, Calendar, Eye, GraduationCap, Loader2, RotateCcw, ShoppingBag, Users } from 'lucide-react';

type MentorAnalyticsResponse = {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  archivedCourses: number;
  enrolledStudents: number;
  lessonsTotal: number;
  quizzesTotal: number;
  assignmentsTotal: number;
  pendingSubmissions: number;
  totalBundles: number;
  totalProducts: number;
  productsSold: number;
  totalEarning: number;
  publishedPosts: number;
  platformFeeTotal: number;
  analytics: {
    range: '7d' | '30d' | '90d';
    from: string;
    to: string;
    totals: {
      courseViews: number;
      shopViews: number;
      totalViews: number;
      uniqueSessions: number;
      newEnrollments: number;
      newStudents: number;
      totalStudents: number;
    };
    previousTotals: {
      courseViews: number;
      shopViews: number;
      totalViews: number;
      uniqueSessions: number;
      newEnrollments: number;
    };
    daily: Array<{ day: string; courseViews: number; shopViews: number }>;
    dailyEnrollments: Array<{ day: string; enrollments: number; students: number }>;
    topCourses: Array<{ id: string; title: string; slug: string; views: number }>;
    topProducts: Array<{ id: string; name: string; slug: string | null; views: number }>;
    topReferrers: Array<{ host: string; views: number }>;
  };
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

export default function Page() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<MentorAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/stats/mentor?analytics=1&range=${encodeURIComponent(range)}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat analytics');
      setData(json as MentorAnalyticsResponse);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat analytics');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const rangeLabel = range === '7d' ? '7 hari terakhir' : range === '90d' ? '90 hari terakhir' : '30 hari terakhir';

  const metrics = useMemo(() => {
    const t = data?.analytics?.totals;
    const prev = data?.analytics?.previousTotals;
    const trend = (cur: number, prevValue: number) => {
      if (!Number.isFinite(cur) || !Number.isFinite(prevValue) || prevValue <= 0) return undefined;
      const pct = Math.round(((cur - prevValue) / prevValue) * 100);
      return { value: pct, isPositive: pct >= 0 };
    };
    return [
      {
        label: 'Total Views',
        value: t?.totalViews ?? 0,
        color: 'bg-indigo-500',
        description: rangeLabel,
        icon: Eye,
        trend: t && prev ? trend(Number(t.totalViews) || 0, Number(prev.totalViews) || 0) : undefined,
      },
      {
        label: 'Views Kursus',
        value: t?.courseViews ?? 0,
        color: 'bg-blue-500',
        description: rangeLabel,
        icon: BookOpen,
        trend: t && prev ? trend(Number(t.courseViews) || 0, Number(prev.courseViews) || 0) : undefined,
      },
      {
        label: 'Views Produk',
        value: t?.shopViews ?? 0,
        color: 'bg-sky-500',
        description: rangeLabel,
        icon: ShoppingBag,
        trend: t && prev ? trend(Number(t.shopViews) || 0, Number(prev.shopViews) || 0) : undefined,
      },
      {
        label: 'Sesi Unik',
        value: t?.uniqueSessions ?? 0,
        color: 'bg-violet-500',
        description: rangeLabel,
        icon: RotateCcw,
        trend: t && prev ? trend(Number(t.uniqueSessions) || 0, Number(prev.uniqueSessions) || 0) : undefined,
      },
      { label: 'Pendaftaran Baru', value: t?.newEnrollments ?? 0, color: 'bg-green-500', description: rangeLabel, icon: GraduationCap },
      { label: 'Total Siswa', value: t?.totalStudents ?? 0, color: 'bg-yellow-500', description: 'Akumulasi kursus', icon: Users },
    ];
  }, [data, rangeLabel]);

  const dailyCourseViews = useMemo(() => {
    const list = Array.isArray(data?.analytics?.daily) ? data!.analytics.daily : [];
    return list.map((d) => ({ day: formatDate(d.day), value: Number(d.courseViews) || 0 }));
  }, [data]);

  const dailyShopViews = useMemo(() => {
    const list = Array.isArray(data?.analytics?.daily) ? data!.analytics.daily : [];
    return list.map((d) => ({ day: formatDate(d.day), value: Number(d.shopViews) || 0 }));
  }, [data]);

  const dailyEnrollments = useMemo(() => {
    const list = Array.isArray(data?.analytics?.dailyEnrollments) ? data!.analytics.dailyEnrollments : [];
    return list.map((d) => ({ day: formatDate(d.day), value: Number(d.enrollments) || 0 }));
  }, [data]);

  const topCoursesChart = useMemo(() => {
    const list = Array.isArray(data?.analytics?.topCourses) ? data!.analytics.topCourses : [];
    return list.map((c) => ({ name: c.title.length > 18 ? `${c.title.slice(0, 18)}…` : c.title, views: Number(c.views) || 0 }));
  }, [data]);

  const topProductsChart = useMemo(() => {
    const list = Array.isArray(data?.analytics?.topProducts) ? data!.analytics.topProducts : [];
    return list.map((p) => ({ name: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name, views: Number(p.views) || 0 }));
  }, [data]);

  const referrerRows = useMemo(() => {
    const list = Array.isArray(data?.analytics?.topReferrers) ? data!.analytics.topReferrers : [];
    return list.map((r) => ({ host: r.host, views: Number(r.views) || 0 }));
  }, [data]);

  const topCoursesRows = useMemo(() => (Array.isArray(data?.analytics?.topCourses) ? data!.analytics.topCourses : []), [data]);
  const topProductsRows = useMemo(() => (Array.isArray(data?.analytics?.topProducts) ? data!.analytics.topProducts : []), [data]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Pantau traffic kursus, traffic produk, dan tren pendaftaran siswa.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm">
            <Calendar className="w-4 h-4" />
            <select value={range} onChange={(e) => setRange(e.target.value as any)} className="bg-transparent outline-none">
              <option value="7d">7 hari</option>
              <option value="30d">30 hari</option>
              <option value="90d">90 hari</option>
            </select>
          </div>
          <button
            onClick={load}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 bg-indigo-600 disabled:opacity-70 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      <Cards metrics={metrics} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Tren Views Kursus</h3>
          <SimpleLineChart data={dailyCourseViews} xKey="day" yKey="value" name="Views Kursus" />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Tren Views Produk</h3>
          <SimpleAreaChart data={dailyShopViews} xKey="day" yKey="value" name="Views Produk" />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Tren Pendaftaran</h3>
          <SimpleLineChart data={dailyEnrollments} xKey="day" yKey="value" name="Pendaftaran" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Top Kursus (Views)</h3>
          <SimpleBarChart data={topCoursesChart} xKey="name" yKey="views" name="Views" />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Top Produk (Views)</h3>
          <SimpleBarChart data={topProductsChart} xKey="name" yKey="views" name="Views" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Top Referrer</h3>
          <Table
            isLoading={isLoading}
            data={referrerRows}
            columns={[
              { header: 'Host', accessorKey: 'host' },
              {
                header: 'Views',
                accessorKey: 'views',
                className: 'text-right',
                cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
              },
            ]}
          />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Daftar Top Kursus</h3>
          <Table
            isLoading={isLoading}
            data={topCoursesRows}
            columns={[
              {
                header: 'Kursus',
                accessorKey: 'title',
                cell: (_: any, row: any) => (
                  <Link href={`/courses/${encodeURIComponent(String(row.slug || ''))}`} className="font-extrabold text-slate-900 hover:text-indigo-700">
                    {String(row.title || '')}
                  </Link>
                ),
              },
              {
                header: 'Views',
                accessorKey: 'views',
                className: 'text-right',
                cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
              },
            ]}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Daftar Top Produk</h3>
        <Table
          isLoading={isLoading}
          data={topProductsRows}
          columns={[
            {
              header: 'Produk',
              accessorKey: 'name',
              cell: (_: any, row: any) => (
                <Link href={`/shop/products/${encodeURIComponent(String(row.slug || row.id || ''))}`} className="font-extrabold text-slate-900 hover:text-indigo-700">
                  {String(row.name || '')}
                </Link>
              ),
            },
            {
              header: 'Views',
              accessorKey: 'views',
              className: 'text-right',
              cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
