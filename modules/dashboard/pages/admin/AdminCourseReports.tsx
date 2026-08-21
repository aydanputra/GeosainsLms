"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, ClipboardList, ExternalLink, GraduationCap, HelpCircle, Loader2, Search, Star, UserRound, Users } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type CourseOption = { id: string; title: string };

type Overview = {
  publishedCourses: number;
  courseEnrolled: number;
  lessons: number;
  quizzes: number;
  questions: number;
  instructors: number;
  students: number;
  reviews: number;
  revenue: number;
};

type OverviewRange = {
  from: string;
  to: string;
  totalEarning: number;
  courseEnrolled: number;
  totalRefund: number | null;
  totalDiscount: number | null;
};

type EarningsPoint = { date: string; totalEarning: number; courseEnrolled: number };

type CourseReportRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  instructor: { id: string; name: string; email: string };
  lessons: number;
  assignments: number;
  totalLearners: number;
  earnings: number;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  student: { id: string; name: string; email: string };
  course: { id: string; title: string; slug: string };
};

type SaleRow = {
  id: string;
  orderId: string;
  course: { id: string; title: string; slug: string };
  instructor: { id: string; name: string; email: string };
  date: string;
  status: string;
  price: number;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  courseTaken: number;
};

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

type RangePreset = '7D' | '30D' | '90D' | 'CUSTOM';

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

export default function AdminCourseReports({ courses }: { courses: CourseOption[] }) {
  const [tab, setTab] = useState<'overview' | 'courses' | 'reviews' | 'sales' | 'students'>('overview');

  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset>('30D');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewRange, setOverviewRange] = useState<OverviewRange | null>(null);
  const [earningsSeries, setEarningsSeries] = useState<EarningsPoint[]>([]);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  const [coursesRows, setCoursesRows] = useState<CourseReportRow[]>([]);
  const [coursesNextCursor, setCoursesNextCursor] = useState<string | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  const [reviewsRows, setReviewsRows] = useState<ReviewRow[]>([]);
  const [reviewsNextCursor, setReviewsNextCursor] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  const [salesRows, setSalesRows] = useState<SaleRow[]>([]);
  const [salesNextCursor, setSalesNextCursor] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [isLoadingSales, setIsLoadingSales] = useState(false);

  const [studentsRows, setStudentsRows] = useState<StudentRow[]>([]);
  const [studentsNextCursor, setStudentsNextCursor] = useState<string | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const courseOptions = useMemo(() => courses, [courses]);

  const buildUrl = (args: { tab: string; cursor?: string | null }) => {
    const url = new URL('/api/dashboard/admin/course-reports', window.location.origin);
    url.searchParams.set('tab', args.tab);
    url.searchParams.set('limit', '20');
    if (courseId !== 'ALL') url.searchParams.set('courseId', courseId);
    if (search.trim()) url.searchParams.set('q', search.trim());
    if (fromDate) url.searchParams.set('from', toIsoStart(fromDate));
    if (toDate) url.searchParams.set('to', toIsoEnd(toDate));
    if (args.cursor) url.searchParams.set('cursor', args.cursor);
    return url.toString();
  };

  const loadOverview = async (presetOverride?: RangePreset) => {
    if (isLoadingOverview) return;
    const presetToUse = presetOverride ?? rangePreset;
    setIsLoadingOverview(true);
    setOverviewError(null);
    try {
      const url = new URL('/api/dashboard/admin/course-reports', window.location.origin);
      url.searchParams.set('tab', 'overview');
      if (presetToUse !== 'CUSTOM') {
        const preset = getPresetDates(presetToUse);
        url.searchParams.set('from', toIsoStart(preset.from));
        url.searchParams.set('to', toIsoEnd(preset.to));
      } else {
        if (fromDate) url.searchParams.set('from', toIsoStart(fromDate));
        if (toDate) url.searchParams.set('to', toIsoEnd(toDate));
      }

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat laporan');
      const o = data?.overview;
      setOverview({
        publishedCourses: Number(o?.publishedCourses) || 0,
        courseEnrolled: Number(o?.courseEnrolled) || 0,
        lessons: Number(o?.lessons) || 0,
        quizzes: Number(o?.quizzes) || 0,
        questions: Number(o?.questions) || 0,
        instructors: Number(o?.instructors) || 0,
        students: Number(o?.students) || 0,
        reviews: Number(o?.reviews) || 0,
        revenue: Number(o?.revenue) || 0,
      });
      const r = data?.range;
      if (r) {
        setOverviewRange({
          from: typeof r.from === 'string' ? r.from : new Date(r.from).toISOString(),
          to: typeof r.to === 'string' ? r.to : new Date(r.to).toISOString(),
          totalEarning: Number(r.totalEarning) || 0,
          courseEnrolled: Number(r.courseEnrolled) || 0,
          totalRefund: r.totalRefund === null || typeof r.totalRefund === 'number' ? r.totalRefund : null,
          totalDiscount: r.totalDiscount === null || typeof r.totalDiscount === 'number' ? r.totalDiscount : null,
        });
      } else {
        setOverviewRange(null);
      }
      const series = Array.isArray(data?.earningsSeries) ? data.earningsSeries : [];
      setEarningsSeries(
        series
          .map((p: any) => ({
            date: String(p.date || ''),
            totalEarning: Number(p.totalEarning) || 0,
            courseEnrolled: Number(p.courseEnrolled) || 0,
          }))
          .filter((p: EarningsPoint) => Boolean(p.date))
      );
    } catch (e: any) {
      setOverviewError(e?.message || 'Gagal memuat laporan');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const loadCourses = async (args: { reset: boolean }) => {
    if (isLoadingCourses) return;
    setIsLoadingCourses(true);
    setCoursesError(null);
    try {
      const cursor = args.reset ? null : coursesNextCursor;
      const res = await fetch(buildUrl({ tab: 'courses', cursor }), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat laporan kursus');
      const list = Array.isArray(data?.courses) ? data.courses : [];
      const mapped: CourseReportRow[] = list.map((c: any) => ({
        id: String(c.id),
        title: String(c.title || ''),
        slug: String(c.slug || ''),
        status: String(c.status || ''),
        createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date(c.createdAt).toISOString(),
        instructor: { id: String(c.instructor?.id || ''), name: String(c.instructor?.name || ''), email: String(c.instructor?.email || '') },
        lessons: Number(c.lessons) || 0,
        assignments: Number(c.assignments) || 0,
        totalLearners: Number(c.totalLearners) || 0,
        earnings: Number(c.earnings) || 0,
      }));
      setCoursesRows((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setCoursesNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setCoursesError(e?.message || 'Gagal memuat laporan kursus');
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const loadReviews = async (args: { reset: boolean }) => {
    if (isLoadingReviews) return;
    setIsLoadingReviews(true);
    setReviewsError(null);
    try {
      const cursor = args.reset ? null : reviewsNextCursor;
      const res = await fetch(buildUrl({ tab: 'reviews', cursor }), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat laporan ulasan');
      const list = Array.isArray(data?.reviews) ? data.reviews : [];
      const mapped: ReviewRow[] = list.map((r: any) => ({
        id: String(r.id),
        rating: Number(r.rating) || 0,
        comment: r.comment === null || typeof r.comment === 'string' ? r.comment : null,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
        student: { id: String(r.student?.id || ''), name: String(r.student?.name || ''), email: String(r.student?.email || '') },
        course: { id: String(r.course?.id || ''), title: String(r.course?.title || ''), slug: String(r.course?.slug || '') },
      }));
      setReviewsRows((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setReviewsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setReviewsError(e?.message || 'Gagal memuat laporan ulasan');
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const loadSales = async (args: { reset: boolean }) => {
    if (isLoadingSales) return;
    setIsLoadingSales(true);
    setSalesError(null);
    try {
      const cursor = args.reset ? null : salesNextCursor;
      const res = await fetch(buildUrl({ tab: 'sales', cursor }), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat laporan penjualan');
      const list = Array.isArray(data?.sales) ? data.sales : [];
      const mapped: SaleRow[] = list.map((s: any) => ({
        id: String(s.id),
        orderId: String(s.orderId || ''),
        course: { id: String(s.course?.id || ''), title: String(s.course?.title || ''), slug: String(s.course?.slug || '') },
        instructor: { id: String(s.instructor?.id || ''), name: String(s.instructor?.name || ''), email: String(s.instructor?.email || '') },
        date: typeof s.date === 'string' ? s.date : new Date(s.date).toISOString(),
        status: String(s.status || ''),
        price: Number(s.price) || 0,
      }));
      setSalesRows((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setSalesNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setSalesError(e?.message || 'Gagal memuat laporan penjualan');
    } finally {
      setIsLoadingSales(false);
    }
  };

  const loadStudents = async (args: { reset: boolean }) => {
    if (isLoadingStudents) return;
    setIsLoadingStudents(true);
    setStudentsError(null);
    try {
      const cursor = args.reset ? null : studentsNextCursor;
      const res = await fetch(buildUrl({ tab: 'students', cursor }), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat laporan siswa');
      const list = Array.isArray(data?.students) ? data.students : [];
      const mapped: StudentRow[] = list.map((s: any) => ({
        id: String(s.id),
        name: String(s.name || ''),
        email: String(s.email || ''),
        createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString(),
        courseTaken: Number(s.courseTaken) || 0,
      }));
      setStudentsRows((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setStudentsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setStudentsError(e?.message || 'Gagal memuat laporan siswa');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    const preset = getPresetDates('30D');
    setFromDate(preset.from);
    setToDate(preset.to);
    void loadOverview('30D');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = async () => {
    if (tab === 'overview') await loadOverview();
    if (tab === 'courses') {
      setCoursesRows([]);
      setCoursesNextCursor(null);
      await loadCourses({ reset: true });
    }
    if (tab === 'reviews') {
      setReviewsRows([]);
      setReviewsNextCursor(null);
      await loadReviews({ reset: true });
    }
    if (tab === 'sales') {
      setSalesRows([]);
      setSalesNextCursor(null);
      await loadSales({ reset: true });
    }
    if (tab === 'students') {
      setStudentsRows([]);
      setStudentsNextCursor(null);
      await loadStudents({ reset: true });
    }
  };

  const tabs = [
    { key: 'overview' as const, label: 'Ringkasan' },
    { key: 'courses' as const, label: 'Kursus' },
    { key: 'reviews' as const, label: 'Ulasan' },
    { key: 'sales' as const, label: 'Penjualan' },
    { key: 'students' as const, label: 'Siswa' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Laporan</h1>
        <p className="text-slate-500 text-sm mt-1">Laporan kursus: ringkasan, performa kursus, ulasan, penjualan, dan siswa.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              if (t.key === 'courses' && coursesRows.length === 0) loadCourses({ reset: true });
              if (t.key === 'reviews' && reviewsRows.length === 0) loadReviews({ reset: true });
              if (t.key === 'sales' && salesRows.length === 0) loadSales({ reset: true });
              if (t.key === 'students' && studentsRows.length === 0) loadStudents({ reset: true });
            }}
            className={twMerge(
              'px-3 py-2 rounded-xl text-xs font-extrabold',
              tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-slate-700">Rentang Waktu</div>
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
                onClick={() => loadOverview()}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 inline-flex items-center justify-center"
              >
                Terapkan
              </button>
            </div>
          </div>

          {rangePreset === 'CUSTOM' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
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
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari course / instruktur / siswa..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
              />
            </div>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full lg:w-96 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
            >
              <option value="ALL">Semua Kursus</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              onClick={applyFilters}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 inline-flex items-center justify-center"
            >
              Terapkan
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>
      )}

      {tab === 'overview' ? (
        <div className="space-y-4">
          {overviewError ? <div className="text-sm text-rose-700">{overviewError}</div> : null}
          {isLoadingOverview ? (
            <div className="p-8 flex items-center justify-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-100">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Memuat...
            </div>
          ) : overview ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Kursus Terbit', value: overview.publishedCourses, Icon: GraduationCap },
                  { label: 'Pendaftaran Kursus', value: overview.courseEnrolled, Icon: Users },
                  { label: 'Lesson', value: overview.lessons, Icon: BookOpen },
                  { label: 'Kuis', value: overview.quizzes, Icon: ClipboardList },
                  { label: 'Pertanyaan', value: overview.questions, Icon: HelpCircle },
                  { label: 'Instruktur', value: overview.instructors, Icon: UserRound },
                  { label: 'Siswa', value: overview.students, Icon: Users },
                  { label: 'Ulasan', value: overview.reviews, Icon: Star },
                ].map((m) => (
                  <div key={m.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                      <m.Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900 leading-none">{m.value}</div>
                      <div className="text-xs text-slate-500 font-bold mt-1">{m.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-extrabold text-slate-900">Grafik Pendapatan</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {overviewRange ? `${formatDate(overviewRange.from)} - ${formatDate(overviewRange.to)}` : '-'}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-slate-600">
                    <BarChart3 className="w-4 h-4" />
                    <div className="text-xs font-extrabold">{rangePreset === 'CUSTOM' ? 'Custom' : rangePreset === '7D' ? '7 Hari' : rangePreset === '90D' ? '90 Hari' : '30 Hari'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 border-t border-slate-200">
                  <div className="p-4 lg:col-span-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500 font-bold">Total Pendapatan</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-1">
                        {overviewRange ? formatCurrency(overviewRange.totalEarning) : '-'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500 font-bold">Pendaftaran</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-1">{overviewRange ? overviewRange.courseEnrolled : '-'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500 font-bold">Total Refund</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-1">
                        {overviewRange?.totalRefund === null ? '-' : formatCurrency(overviewRange?.totalRefund || 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500 font-bold">Total Diskon</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-1">
                        {overviewRange?.totalDiscount === null ? '-' : formatCurrency(overviewRange?.totalDiscount || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 lg:col-span-4">
                    <div className="text-sm font-extrabold text-slate-900">Grafik Pendapatan</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {rangePreset === 'CUSTOM' ? 'Custom' : rangePreset === '7D' ? '7 Hari Terakhir' : rangePreset === '90D' ? '90 Hari Terakhir' : '30 Hari Terakhir'}
                    </div>
                    <div className="mt-4 h-48 rounded-2xl border border-slate-200 bg-white p-3">
                      {earningsSeries.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-slate-500">Tidak ada data pendapatan.</div>
                      ) : (
                        <div className="h-full flex items-end gap-[2px]">
                          {(() => {
                            const max = Math.max(...earningsSeries.map((p) => p.totalEarning), 1);
                            return earningsSeries.map((p) => {
                              const height = Math.max(2, Math.round((p.totalEarning / max) * 100));
                              return (
                                <div
                                  key={p.date}
                                  title={`${p.date}: ${formatCurrency(p.totalEarning)}`}
                                  className="flex-1 min-w-[2px] bg-indigo-600/80 rounded-sm"
                                  style={{ height: `${height}%` }}
                                />
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'courses' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {coursesError ? <div className="p-4 text-sm text-rose-700">{coursesError}</div> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-extrabold">Kursus</th>
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">Lesson</th>
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">Tugas</th>
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">Total Peserta</th>
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">Pendapatan</th>
                  <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {coursesRows.length === 0 && !isLoadingCourses ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                      Tidak ada data kursus.
                    </td>
                  </tr>
                ) : (
                  coursesRows.map((r) => (
                    <tr key={r.id} className="text-slate-700">
                      <td className="px-4 py-3 min-w-[360px]">
                        <div className="font-extrabold text-slate-900">{r.title}</div>
                        <div className="text-xs text-slate-500">{r.slug}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.lessons}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.assignments}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.totalLearners}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(r.earnings)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/dashboard/admin/course-reports/${encodeURIComponent(r.id)}`}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 font-bold text-xs hover:bg-indigo-50"
                          >
                            Detail
                          </Link>
                          <Link
                            href={r.slug ? `/courses/${encodeURIComponent(r.slug)}` : '#'}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Buka Kursus"
                            title="Buka Kursus"
                            className={twMerge(
                              'inline-flex items-center justify-center p-2 rounded-xl border bg-white',
                              r.slug ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-slate-200 text-slate-300 cursor-not-allowed'
                            )}
                            onClick={(e) => {
                              if (!r.slug) e.preventDefault();
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-200 flex items-center justify-end">
            <button
              onClick={() => loadCourses({ reset: false })}
              disabled={!coursesNextCursor || isLoadingCourses}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
            >
              {isLoadingCourses ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Muat lebih banyak
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'reviews' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {reviewsError ? <div className="p-4 text-sm text-rose-700">{reviewsError}</div> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-extrabold">Siswa</th>
                  <th className="px-4 py-3 font-extrabold">Tanggal</th>
                  <th className="px-4 py-3 font-extrabold">Kursus</th>
                  <th className="px-4 py-3 font-extrabold">Rating</th>
                  <th className="px-4 py-3 font-extrabold">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reviewsRows.length === 0 && !isLoadingReviews ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-600">
                      Tidak ada ulasan.
                    </td>
                  </tr>
                ) : (
                  reviewsRows.map((r) => (
                    <tr key={r.id} className="text-slate-700">
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="font-extrabold text-slate-900">{r.student.name}</div>
                        <div className="text-xs text-slate-500">{r.student.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                      <td className="px-4 py-3 min-w-[260px]">
                        <div className="font-extrabold text-slate-900">{r.course.title}</div>
                        <div className="text-xs text-slate-500">{r.course.slug}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.rating}</td>
                      <td className="px-4 py-3 min-w-[360px]">{r.comment || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
      ) : null}

      {tab === 'sales' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {salesError ? <div className="p-4 text-sm text-rose-700">{salesError}</div> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">Order ID</th>
                  <th className="px-4 py-3 font-extrabold">Kursus</th>
                  <th className="px-4 py-3 font-extrabold">Instruktur</th>
                  <th className="px-4 py-3 font-extrabold">Tanggal</th>
                  <th className="px-4 py-3 font-extrabold">Status</th>
                  <th className="px-4 py-3 font-extrabold text-right">Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {salesRows.length === 0 && !isLoadingSales ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                      Tidak ada data penjualan.
                    </td>
                  </tr>
                ) : (
                  salesRows.map((s) => (
                    <tr key={s.id} className="text-slate-700">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">#{s.orderId.slice(0, 8)}</td>
                      <td className="px-4 py-3 min-w-[280px]">
                        <div className="font-extrabold text-slate-900">{s.course.title}</div>
                        <div className="text-xs text-slate-500">{s.course.slug}</div>
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="font-extrabold text-slate-900">{s.instructor.name}</div>
                        <div className="text-xs text-slate-500">{s.instructor.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={twMerge(
                            'inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border',
                            s.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">{formatCurrency(s.price)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-200 flex items-center justify-end">
            <button
              onClick={() => loadSales({ reset: false })}
              disabled={!salesNextCursor || isLoadingSales}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
            >
              {isLoadingSales ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Muat lebih banyak
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'students' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {studentsError ? <div className="p-4 text-sm text-rose-700">{studentsError}</div> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-extrabold">Nama</th>
                  <th className="px-4 py-3 font-extrabold">Email</th>
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">Tanggal Daftar</th>
                  <th className="px-4 py-3 font-extrabold whitespace-nowrap">Kursus Diambil</th>
                  <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {studentsRows.length === 0 && !isLoadingStudents ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-600">
                      Tidak ada data siswa.
                    </td>
                  </tr>
                ) : (
                  studentsRows.map((s) => (
                    <tr key={s.id} className="text-slate-700">
                      <td className="px-4 py-3 font-extrabold text-slate-900">{s.name}</td>
                      <td className="px-4 py-3">{s.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{s.courseTaken}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/dashboard/admin/courses/students?studentId=${encodeURIComponent(s.id)}&tab=courses`}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))
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
      ) : null}
    </div>
  );
}
