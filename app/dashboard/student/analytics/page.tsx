'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Cards from '@/modules/dashboard/components/Cards';
import Table from '@/modules/dashboard/components/Tables';
import { SimpleAreaChart, SimpleBarChart, SimpleLineChart } from '@/modules/dashboard/components/Charts';
import Link from 'next/link';
import { toast } from 'sonner';
import { Award, BookOpen, Calendar, GraduationCap, Loader2, RotateCcw } from 'lucide-react';

type StudentAnalyticsResponse = {
  range: '7d' | '30d' | '90d';
  from: string;
  to: string;
  completedCourses: number;
  inProgressCourses: number;
  totalScore: number;
  totals: {
    enrolledCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    certificates: number;
    avgQuizScore: number;
    quizzesCompleted: number;
    assignmentsPending: number;
  };
  daily: Array<{ day: string; lessonsCompleted: number; quizzesCompleted: number }>;
  courses: Array<{
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    totalLessons: number;
    completedLessons: number;
    progressPercent: number;
    status: string;
    lastActivityAt: string | null;
    enrolledAt: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

export default function Page() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<StudentAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/stats/student?range=${encodeURIComponent(range)}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat analytics');
      setData(json as StudentAnalyticsResponse);
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
    const t = data?.totals;
    return [
      { label: 'Kursus Diikuti', value: t?.enrolledCourses ?? 0, color: 'bg-indigo-500', description: rangeLabel, icon: BookOpen },
      { label: 'Kursus Selesai', value: t?.completedCourses ?? 0, color: 'bg-green-500', description: rangeLabel, icon: GraduationCap },
      { label: 'Sertifikat', value: t?.certificates ?? 0, color: 'bg-yellow-500', description: rangeLabel, icon: Award },
      { label: 'Rata-rata Skor Quiz', value: t?.avgQuizScore ?? 0, color: 'bg-sky-500', description: rangeLabel, icon: RotateCcw },
    ];
  }, [data, rangeLabel]);

  const dailyLessons = useMemo(() => {
    const list = Array.isArray(data?.daily) ? data!.daily : [];
    return list.map((d) => ({ day: formatDate(d.day), value: Number(d.lessonsCompleted) || 0 }));
  }, [data]);

  const dailyQuizzes = useMemo(() => {
    const list = Array.isArray(data?.daily) ? data!.daily : [];
    return list.map((d) => ({ day: formatDate(d.day), value: Number(d.quizzesCompleted) || 0 }));
  }, [data]);

  const topCourses = useMemo(() => {
    const list = Array.isArray(data?.courses) ? data!.courses.slice() : [];
    list.sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
    return list.slice(0, 8).map((c) => ({ name: c.title.length > 18 ? `${c.title.slice(0, 18)}…` : c.title, views: c.progressPercent || 0 }));
  }, [data]);

  const courseRows = useMemo(() => (Array.isArray(data?.courses) ? data!.courses : []), [data]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Pantau progres belajar dan aktivitas kursus Anda.</p>
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
          <h3 className="text-lg font-bold text-slate-900 mb-4">Pelajaran Diselesaikan</h3>
          <SimpleLineChart data={dailyLessons} xKey="day" yKey="value" name="Pelajaran" />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Quiz Diselesaikan</h3>
          <SimpleAreaChart data={dailyQuizzes} xKey="day" yKey="value" name="Quiz" />
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Progres Kursus (Top)</h3>
          <SimpleBarChart data={topCourses} xKey="name" yKey="views" name="Progres (%)" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Kursus Saya</h3>
        <Table
          isLoading={isLoading}
          data={courseRows}
          columns={[
            {
              header: 'Kursus',
              accessorKey: 'title',
              cell: (_: any, row: any) => (
                <div className="min-w-0">
                  <Link href={`/courses/${encodeURIComponent(String(row.slug || ''))}/learn`} className="font-extrabold text-slate-900 hover:text-indigo-700">
                    {String(row.title || '')}
                  </Link>
                  <div className="text-xs text-slate-500 mt-1">Terakhir aktif: {formatDate(row.lastActivityAt)}</div>
                </div>
              ),
            },
            {
              header: 'Progres',
              accessorKey: 'progressPercent',
              cell: (v: number) => (
                <div className="flex items-center gap-2">
                  <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, Math.max(0, Number(v) || 0))}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{Number(v) || 0}%</span>
                </div>
              ),
            },
            {
              header: 'Status',
              accessorKey: 'status',
              cell: (v: string) => (
                <span
                  className={`px-2 py-1 rounded-full text-xs font-bold border ${
                    v === 'Selesai'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : v === 'Sedang Berjalan'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {String(v || '')}
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
