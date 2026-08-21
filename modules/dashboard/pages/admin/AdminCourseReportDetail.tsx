"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink, GraduationCap, Loader2, Star, Users } from 'lucide-react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type OverviewStats = {
  lessons: number;
  quizzes: number;
  assignments: number;
  students: number;
  coursesCompleted: number;
  coursesInProgress: number;
  averageRating: number;
  totalReviews: number;
};

type Range = {
  from: string;
  to: string;
  totalEarning: number;
  courseEnrolled: number;
  totalRefund: number | null;
  totalDiscount: number | null;
};

type EarningsPoint = { date: string; totalEarning: number };
type ChartPoint = { date: string; value: number };

type StudentRow = {
  enrollmentId: string;
  enrolledAt: string;
  student: { id: string; name: string; email: string };
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  student: { id: string; name: string; email: string };
};

type RangePreset = '7D' | '30D' | '90D' | 'CUSTOM';

function toIsoStart(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

function toIsoEnd(dateValue: string) {
  return new Date(`${dateValue}T23:59:59.999Z`).toISOString();
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `Rp${n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateInputValueUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getPresetDates(preset: Exclude<RangePreset, 'CUSTOM'>) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = preset === '7D' ? 7 : preset === '90D' ? 90 : 30;
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  return { from: toDateInputValueUtc(start), to: toDateInputValueUtc(end) };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function AdminCourseReportDetail({ courseId, courseTitle, courseSlug }: { courseId: string; courseTitle: string; courseSlug: string }) {
  const [chartTab, setChartTab] = useState<'earning' | 'enrolled' | 'refund' | 'discount'>('earning');
  const [rangePreset, setRangePreset] = useState<RangePreset>('30D');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [series, setSeries] = useState<EarningsPoint[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  const [chartSeries, setChartSeries] = useState<ChartPoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsNextCursor, setStudentsNextCursor] = useState<string | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsNextCursor, setReviewsNextCursor] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const presetLabel = useMemo(() => {
    if (rangePreset === 'CUSTOM') return 'Custom';
    if (rangePreset === '7D') return '7 Hari';
    if (rangePreset === '90D') return '90 Hari';
    return '30 Hari';
  }, [rangePreset]);

  const buildOverviewUrl = (presetOverride?: RangePreset) => {
    const presetToUse = presetOverride ?? rangePreset;
    const url = new URL(`/api/dashboard/admin/course-reports/${encodeURIComponent(courseId)}`, window.location.origin);
    url.searchParams.set('tab', 'overview');
    if (presetToUse !== 'CUSTOM') {
      const preset = getPresetDates(presetToUse);
      url.searchParams.set('from', toIsoStart(preset.from));
      url.searchParams.set('to', toIsoEnd(preset.to));
    } else {
      if (fromDate) url.searchParams.set('from', toIsoStart(fromDate));
      if (toDate) url.searchParams.set('to', toIsoEnd(toDate));
    }
    return url.toString();
  };

  const buildChartUrl = (metric: 'enrolled' | 'refund' | 'discount', presetOverride?: RangePreset) => {
    const presetToUse = presetOverride ?? rangePreset;
    const url = new URL(`/api/dashboard/admin/course-reports/${encodeURIComponent(courseId)}`, window.location.origin);
    url.searchParams.set('tab', 'chart');
    url.searchParams.set('metric', metric);
    if (presetToUse !== 'CUSTOM') {
      const preset = getPresetDates(presetToUse);
      url.searchParams.set('from', toIsoStart(preset.from));
      url.searchParams.set('to', toIsoEnd(preset.to));
    } else {
      if (fromDate) url.searchParams.set('from', toIsoStart(fromDate));
      if (toDate) url.searchParams.set('to', toIsoEnd(toDate));
    }
    return url.toString();
  };

  const loadChart = async (metric: 'enrolled' | 'refund' | 'discount', presetOverride?: RangePreset) => {
    if (isLoadingChart) return;
    setIsLoadingChart(true);
    setChartError(null);
    try {
      const res = await fetch(buildChartUrl(metric, presetOverride), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat grafik');
      const points = Array.isArray(data?.chart?.series) ? data.chart.series : [];
      setChartSeries(points.map((p: any) => ({ date: String(p.date || ''), value: Number(p.value) || 0 })).filter((p: ChartPoint) => Boolean(p.date)));
    } catch (e: any) {
      setChartError(e?.message || 'Gagal memuat grafik');
      setChartSeries([]);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const loadOverview = async (presetOverride?: RangePreset) => {
    if (isLoadingOverview) return;
    setIsLoadingOverview(true);
    setOverviewError(null);
    try {
      const res = await fetch(buildOverviewUrl(presetOverride), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat laporan kursus');

      const s = data?.stats;
      setStats({
        lessons: Number(s?.lessons) || 0,
        quizzes: Number(s?.quizzes) || 0,
        assignments: Number(s?.assignments) || 0,
        students: Number(s?.students) || 0,
        coursesCompleted: Number(s?.coursesCompleted) || 0,
        coursesInProgress: Number(s?.coursesInProgress) || 0,
        averageRating: Number(s?.averageRating) || 0,
        totalReviews: Number(s?.totalReviews) || 0,
      });
      setAvgRating(Number(s?.averageRating) || 0);
      setTotalReviews(Number(s?.totalReviews) || 0);

      const r = data?.range;
      if (r) {
        setRange({
          from: typeof r.from === 'string' ? r.from : new Date(r.from).toISOString(),
          to: typeof r.to === 'string' ? r.to : new Date(r.to).toISOString(),
          totalEarning: Number(r.totalEarning) || 0,
          courseEnrolled: Number(r.courseEnrolled) || 0,
          totalRefund: r.totalRefund === null || typeof r.totalRefund === 'number' ? r.totalRefund : null,
          totalDiscount: r.totalDiscount === null || typeof r.totalDiscount === 'number' ? r.totalDiscount : null,
        });
      } else {
        setRange(null);
      }

      const points = Array.isArray(data?.earningsSeries) ? data.earningsSeries : [];
      setSeries(points.map((p: any) => ({ date: String(p.date || ''), totalEarning: Number(p.totalEarning) || 0 })).filter((p: EarningsPoint) => Boolean(p.date)));
    } catch (e: any) {
      setOverviewError(e?.message || 'Gagal memuat laporan kursus');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const loadStudents = async (args: { reset: boolean }) => {
    if (isLoadingStudents) return;
    setIsLoadingStudents(true);
    setStudentsError(null);
    try {
      const url = new URL(`/api/dashboard/admin/course-reports/${encodeURIComponent(courseId)}`, window.location.origin);
      url.searchParams.set('tab', 'students');
      url.searchParams.set('limit', '20');
      const cursor = args.reset ? null : studentsNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat siswa');
      const list = Array.isArray(data?.students) ? data.students : [];
      const mapped: StudentRow[] = list.map((x: any) => ({
        enrollmentId: String(x.enrollmentId),
        enrolledAt: typeof x.enrolledAt === 'string' ? x.enrolledAt : new Date(x.enrolledAt).toISOString(),
        student: { id: String(x.student?.id || ''), name: String(x.student?.name || ''), email: String(x.student?.email || '') },
        totalLessons: Number(x.totalLessons) || 0,
        completedLessons: Number(x.completedLessons) || 0,
        progressPercent: Number(x.progressPercent) || 0,
      }));
      setStudents((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setStudentsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setStudentsError(e?.message || 'Gagal memuat siswa');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const loadReviews = async (args: { reset: boolean }) => {
    if (isLoadingReviews) return;
    setIsLoadingReviews(true);
    setReviewsError(null);
    try {
      const url = new URL(`/api/dashboard/admin/course-reports/${encodeURIComponent(courseId)}`, window.location.origin);
      url.searchParams.set('tab', 'reviews');
      url.searchParams.set('limit', '10');
      const cursor = args.reset ? null : reviewsNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat ulasan');
      const list = Array.isArray(data?.reviews) ? data.reviews : [];
      const mapped: ReviewRow[] = list.map((x: any) => ({
        id: String(x.id),
        rating: Number(x.rating) || 0,
        comment: x.comment === null || typeof x.comment === 'string' ? x.comment : null,
        createdAt: typeof x.createdAt === 'string' ? x.createdAt : new Date(x.createdAt).toISOString(),
        student: { id: String(x.student?.id || ''), name: String(x.student?.name || ''), email: String(x.student?.email || '') },
      }));
      setReviews((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setReviewsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setReviewsError(e?.message || 'Gagal memuat ulasan');
    } finally {
      setIsLoadingReviews(false);
    }
  };

  useEffect(() => {
    const preset = getPresetDates('30D');
    setFromDate(preset.from);
    setToDate(preset.to);
    void loadOverview('30D');
    void loadStudents({ reset: true });
    void loadReviews({ reset: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetProgress = async (enrollmentId: string) => {
    try {
      const res = await fetch(`/api/dashboard/admin/enrollments/${encodeURIComponent(enrollmentId)}/reset-progress`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal reset progress');
      toast.success('Progress di-reset');
      setStudents((prev) => prev.map((s) => (s.enrollmentId === enrollmentId ? { ...s, completedLessons: 0, progressPercent: 0 } : s)));
    } catch (e: any) {
      toast.error(e?.message || 'Gagal reset progress');
    }
  };

  const unenroll = async (enrollmentId: string) => {
    try {
      const res = await fetch(`/api/dashboard/admin/enrollments/${encodeURIComponent(enrollmentId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus pendaftaran');
      toast.success('Pendaftaran dihapus');
      setStudents((prev) => prev.filter((s) => s.enrollmentId !== enrollmentId));
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus pendaftaran');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold text-slate-500">Laporan / Kursus</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{courseTitle}</h1>
          <div className="text-xs text-slate-500 mt-1">{courseSlug}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/admin/courses/${encodeURIComponent(courseId)}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
          >
            Edit Kursus
          </Link>
          <Link
            href={`/dashboard/admin/courses/${encodeURIComponent(courseId)}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
          >
            Detail Admin
          </Link>
          <Link
            href={courseSlug ? `/courses/${encodeURIComponent(courseSlug)}` : '#'}
            target="_blank"
            rel="noreferrer"
            className={twMerge(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border font-extrabold text-sm',
              courseSlug ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            )}
            onClick={(e) => {
              if (!courseSlug) e.preventDefault();
            }}
          >
            <ExternalLink className="w-4 h-4" />
            Lihat Kursus
          </Link>
        </div>
      </div>

      {overviewError ? <div className="text-sm text-rose-700">{overviewError}</div> : null}
      {isLoadingOverview ? (
        <div className="p-8 flex items-center justify-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-100">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Memuat...
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: 'Lesson', value: stats.lessons, Icon: GraduationCap },
            { label: 'Kuis', value: stats.quizzes, Icon: BarChart3 },
            { label: 'Tugas', value: stats.assignments, Icon: BarChart3 },
            { label: 'Siswa', value: stats.students, Icon: Users },
            { label: 'Selesai', value: stats.coursesCompleted, Icon: Users },
            { label: 'Proses', value: stats.coursesInProgress, Icon: Users },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                <m.Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900 leading-none">{m.value}</div>
                <div className="text-xs text-slate-500 font-bold mt-1">{m.label}</div>
              </div>
            </div>
          ))}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between gap-3 lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900 leading-none">{avgRating.toFixed(2)}</div>
                <div className="text-xs text-slate-500 font-bold mt-1">Rating ({totalReviews})</div>
              </div>
            </div>
            <div className="text-xs text-slate-500">{courseSlug ? 'Publik' : 'Draft'}</div>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">
              {chartTab === 'earning'
                ? 'Grafik Pendapatan'
                : chartTab === 'enrolled'
                  ? 'Grafik Pendaftaran'
                  : chartTab === 'refund'
                    ? 'Grafik Total Refund'
                    : 'Grafik Total Diskon'}
            </div>
            <div className="text-xs text-slate-500 mt-1">{range ? `${formatDate(range.from)} - ${formatDate(range.to)}` : '-'}</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={rangePreset}
              onChange={(e) => {
                const value = e.target.value as RangePreset;
                setRangePreset(value);
                if (value !== 'CUSTOM') {
                  const preset = getPresetDates(value);
                  setFromDate(preset.from);
                  setToDate(preset.to);
                  loadOverview(value);
                  if (chartTab !== 'earning') loadChart(chartTab, value);
                }
              }}
              className="w-full sm:w-64 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
            >
              <option value="7D">7 Hari Terakhir</option>
              <option value="30D">30 Hari Terakhir</option>
              <option value="90D">90 Hari Terakhir</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <button
              onClick={() => {
                loadOverview();
                if (chartTab !== 'earning') loadChart(chartTab);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 inline-flex items-center justify-center"
            >
              Terapkan
            </button>
          </div>
        </div>

        {rangePreset === 'CUSTOM' ? (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-extrabold text-slate-700 mb-1">Dari</div>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
              />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-700 mb-1">Sampai</div>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
              />
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            {
              key: 'earning' as const,
              label: 'Total Pendapatan',
              value: range ? formatCurrency(range.totalEarning) : '-',
            },
            {
              key: 'enrolled' as const,
              label: 'Pendaftaran',
              value: range ? range.courseEnrolled.toLocaleString('id-ID') : '-',
            },
            {
              key: 'refund' as const,
              label: 'Total Refund',
              value: range?.totalRefund === null ? '-' : formatCurrency(range?.totalRefund || 0),
            },
            {
              key: 'discount' as const,
              label: 'Total Diskon',
              value: range?.totalDiscount === null ? '-' : formatCurrency(range?.totalDiscount || 0),
            },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setChartTab(m.key);
                setChartError(null);
                if (m.key === 'earning') {
                  setChartSeries([]);
                  return;
                }
                loadChart(m.key);
              }}
              className={twMerge(
                'rounded-2xl border p-3 text-left',
                chartTab === m.key ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
              )}
            >
              <div className="text-xs text-slate-500 font-bold">{m.label}</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">{m.value}</div>
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <div className="mt-4 h-56 rounded-2xl border border-slate-200 bg-white p-3">
            {chartTab !== 'earning' && chartError ? <div className="h-full flex items-center justify-center text-sm text-rose-700">{chartError}</div> : null}
            {chartTab !== 'earning' && isLoadingChart ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Memuat grafik...
              </div>
            ) : (
              (() => {
                const points: ChartPoint[] =
                  chartTab === 'earning'
                    ? series.map((p) => ({ date: p.date, value: p.totalEarning }))
                    : chartSeries;
                if (points.length === 0) {
                  return (
                    <div className="h-full flex items-center justify-center text-sm text-slate-500">
                      {chartTab === 'earning' ? 'Tidak ada data pendapatan.' : 'Tidak ada data.'}
                    </div>
                  );
                }
                const max = Math.max(...points.map((p) => p.value), 1);
                return (
                  <div className="h-full flex items-end gap-[2px]">
                    {points.map((p) => {
                      const height = Math.max(2, Math.round((p.value / max) * 100));
                      const title =
                        chartTab === 'earning' || chartTab === 'refund' || chartTab === 'discount'
                          ? `${p.date}: ${formatCurrency(p.value)}`
                          : `${p.date}: ${p.value.toLocaleString('id-ID')}`;
                      return (
                        <div
                          key={p.date}
                          title={title}
                          className="flex-1 min-w-[2px] bg-indigo-600/80 rounded-sm"
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {presetLabel}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="text-base font-extrabold text-slate-900">Students</div>
        </div>
        {studentsError ? <div className="px-4 pb-4 text-sm text-rose-700">{studentsError}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-extrabold">Student</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Tanggal Daftar</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Lesson</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Tugas</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Progress</th>
                <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {students.length === 0 && !isLoadingStudents ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                    Tidak ada siswa terdaftar.
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const progress = clampPercent(s.progressPercent);
                  return (
                    <tr key={s.enrollmentId} className="text-slate-700">
                      <td className="px-4 py-3 min-w-[260px]">
                        <div className="font-extrabold text-slate-900">{s.student.name}</div>
                        <div className="text-xs text-slate-500">{s.student.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.enrolledAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.completedLessons}/{s.totalLessons}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{stats ? stats.assignments : '-'}</td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-36 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="text-xs font-extrabold text-slate-700">{progress}%</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => resetProgress(s.enrollmentId)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                          >
                            Reset
                          </button>
                          <Link
                            href={`/dashboard/admin/courses/students?studentId=${encodeURIComponent(s.student.id)}&tab=courses`}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 font-bold text-xs hover:bg-indigo-50"
                          >
                            Detail
                          </Link>
                          <button
                            onClick={() => {
                              const ok = window.confirm('Hapus pendaftaran siswa ini?');
                              if (!ok) return;
                              unenroll(s.enrollmentId);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100"
                          >
                            Unenroll
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={() => loadStudents({ reset: false })}
            disabled={!studentsNextCursor || isLoadingStudents}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
          >
            {isLoadingStudents ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Muat lebih banyak
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="text-base font-extrabold text-slate-900">Reviews</div>
        </div>
        {reviewsError ? <div className="px-4 pb-4 text-sm text-rose-700">{reviewsError}</div> : null}
        <div className="divide-y divide-slate-200">
          {reviews.length === 0 && !isLoadingReviews ? (
            <div className="p-8 text-center text-slate-600 text-sm">No data available in this section</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-slate-900">{r.student.name}</div>
                    <div className="text-xs text-slate-500">{r.student.email}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatDateTime(r.createdAt)}</div>
                  </div>
                  <div className="text-sm font-extrabold text-amber-700">{r.rating} / 5</div>
                </div>
                <div className="text-sm text-slate-700 mt-2">{r.comment || '-'}</div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={() => loadReviews({ reset: false })}
            disabled={!reviewsNextCursor || isLoadingReviews}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
          >
            {isLoadingReviews ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Muat lebih banyak
          </button>
        </div>
      </div>
    </div>
  );
}
