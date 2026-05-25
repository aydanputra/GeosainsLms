"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type CourseOption = { id: string; title: string };

type AttemptRow = {
  id: string;
  score: number;
  startedAt: string;
  completedAt: string | null;
  student: { id: string; name: string; email: string };
  course: { id: string; title: string; slug: string };
  quiz: { id: string; passingGrade: number; lessonId: string | null; lessonTitle: string };
  totalQuestions: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  earnedMarks: number;
  earnedText: string;
  passed: boolean;
  result: 'PASSED' | 'FAILED' | 'INCOMPLETE';
};

type AttemptDetail = {
  id: string;
  score: number;
  passed: boolean;
  passingGrade: number;
  startedAt: string;
  completedAt: string | null;
  student: { id: string; name: string; email: string };
  quiz: { id: string; lessonId: string | null; lessonTitle: string };
  questions: Array<{
    id: string;
    order: number;
    text: string;
    points: number;
    submittedText: string[];
    correctText: string[];
    isCorrect: boolean;
  }>;
};

function toIsoStart(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

function toIsoEnd(dateValue: string) {
  return new Date(`${dateValue}T23:59:59.999Z`).toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function badgeClass(result: AttemptRow['result']) {
  if (result === 'PASSED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (result === 'FAILED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function badgeText(result: AttemptRow['result']) {
  if (result === 'PASSED') return 'Lulus';
  if (result === 'FAILED') return 'Gagal';
  return 'Belum selesai';
}

export default function AdminQuizAttempts({ courses }: { courses: CourseOption[] }) {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('ALL');
  const [status, setStatus] = useState<'ALL' | 'PASSED' | 'FAILED' | 'INCOMPLETE'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'RESET_ATTEMPTS'>('RESET_ATTEMPTS');
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const [attemptDetailOpen, setAttemptDetailOpen] = useState(false);
  const [attemptDetailId, setAttemptDetailId] = useState<string | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);
  const [attemptDetailError, setAttemptDetailError] = useState<string | null>(null);
  const [isLoadingAttemptDetail, setIsLoadingAttemptDetail] = useState(false);

  const courseOptions = useMemo(() => courses, [courses]);

  const fetchAttempts = async (args: { reset: boolean }) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL('/api/dashboard/admin/quiz-attempts', window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('status', status);
      if (courseId !== 'ALL') url.searchParams.set('courseId', courseId);
      if (search.trim()) url.searchParams.set('q', search.trim());
      if (fromDate) url.searchParams.set('from', toIsoStart(fromDate));
      if (toDate) url.searchParams.set('to', toIsoEnd(toDate));
      const cursor = args.reset ? null : nextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat percobaan kuis');

      const list = Array.isArray(data?.attempts) ? data.attempts : [];
      const mapped: AttemptRow[] = list.map((a: any) => ({
        id: String(a.id),
        score: Number(a.score) || 0,
        startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
        completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
        student: { id: String(a.student?.id || ''), name: String(a.student?.name || a.student?.email || ''), email: String(a.student?.email || '') },
        course: { id: String(a.course?.id || ''), title: String(a.course?.title || ''), slug: String(a.course?.slug || '') },
        quiz: {
          id: String(a.quiz?.id || ''),
          passingGrade: Number(a.quiz?.passingGrade) || 80,
          lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
          lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
        },
        totalQuestions: Number(a.totalQuestions) || 0,
        totalMarks: Number(a.totalMarks) || 0,
        correctCount: Number(a.correctCount) || 0,
        incorrectCount: Number(a.incorrectCount) || 0,
        earnedMarks: Number(a.earnedMarks) || 0,
        earnedText: String(a.earnedText || ''),
        passed: Boolean(a.passed),
        result: a.result === 'PASSED' || a.result === 'FAILED' || a.result === 'INCOMPLETE' ? a.result : 'INCOMPLETE',
      }));

      setRows((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat percobaan kuis');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts({ reset: true });
  }, []);

  const toggleAllOnPage = () => {
    const allIds = rows.map((r) => r.id);
    const next = new Set(selectedIds);
    const allSelected = allIds.length > 0 && allIds.every((id) => next.has(id));
    if (allSelected) {
      for (const id of allIds) next.delete(id);
    } else {
      for (const id of allIds) next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const resetAttempt = async (attemptId: string) => {
    try {
      const res = await fetch(`/api/quizzes/attempts/${encodeURIComponent(attemptId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal reset attempt');
      toast.success('Attempt di-reset');
      setRows((prev) => prev.filter((x) => x.id !== attemptId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(attemptId);
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal reset attempt');
    }
  };

  const applyBulk = async () => {
    if (isBulkWorking) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Pilih minimal 1 data');
      return;
    }
    const ok = window.confirm(`Reset ${ids.length} attempt terpilih?`);
    if (!ok) return;
    setIsBulkWorking(true);
    try {
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await resetAttempt(id);
      }
      setSelectedIds(new Set());
    } finally {
      setIsBulkWorking(false);
    }
  };

  const closeAttemptDetail = () => {
    setAttemptDetailOpen(false);
    setAttemptDetailId(null);
    setAttemptDetail(null);
    setAttemptDetailError(null);
    setIsLoadingAttemptDetail(false);
  };

  const openAttemptDetail = async (attemptId: string) => {
    if (isLoadingAttemptDetail) return;
    setAttemptDetailOpen(true);
    setAttemptDetailId(attemptId);
    setAttemptDetail(null);
    setAttemptDetailError(null);
    setIsLoadingAttemptDetail(true);
    try {
      const res = await fetch(`/api/reports/quiz-attempts/${encodeURIComponent(attemptId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat detail attempt');
      const a = data?.attempt;
      const mapped: AttemptDetail = {
        id: String(a.id),
        score: Number(a.score) || 0,
        passed: Boolean(a.passed),
        passingGrade: Number(a.passingGrade) || 80,
        startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
        completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
        student: { id: String(a.student?.id || ''), name: String(a.student?.name || a.student?.email || ''), email: String(a.student?.email || '') },
        quiz: { id: String(a.quiz?.id || ''), lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null, lessonTitle: String(a.quiz?.lessonTitle || 'Quiz') },
        questions: Array.isArray(a.questions)
          ? a.questions.map((q: any) => ({
              id: String(q.id || ''),
              order: Number(q.order) || 0,
              text: String(q.text || ''),
              points: Number(q.points) || 0,
              submittedText: Array.isArray(q.submittedText) ? q.submittedText.map(String) : [],
              correctText: Array.isArray(q.correctText) ? q.correctText.map(String) : [],
              isCorrect: Boolean(q.isCorrect),
            }))
          : [],
      };
      setAttemptDetail(mapped);
    } catch (e: any) {
      setAttemptDetailError(e?.message || 'Gagal memuat detail attempt');
    } finally {
      setIsLoadingAttemptDetail(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Percobaan Kuis</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola percobaan kuis siswa dari semua kursus.</p>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kuis / course / siswa..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
            />
          </div>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full lg:w-80 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
          >
            <option value="ALL">Semua Kursus</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full lg:w-56 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
          >
            <option value="ALL">Semua Status</option>
            <option value="PASSED">Lulus</option>
            <option value="FAILED">Gagal</option>
            <option value="INCOMPLETE">Belum selesai</option>
          </select>
          <button
            onClick={() => {
              setSelectedIds(new Set());
              setRows([]);
              setNextCursor(null);
              fetchAttempts({ reset: true });
            }}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Terapkan
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
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

          <div className="flex items-center justify-end gap-2">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as any)}
              className="w-full sm:w-64 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
            >
              <option value="RESET_ATTEMPTS">Reset Attempt</option>
            </select>
            <button
              onClick={applyBulk}
              disabled={isBulkWorking}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center"
            >
              {isBulkWorking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Apply
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-rose-700">{error}</div> : null}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-extrabold w-10">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                    onChange={toggleAllOnPage}
                  />
                </th>
                <th className="px-4 py-3 font-extrabold min-w-[340px]">Info Kuis</th>
                <th className="px-4 py-3 font-extrabold min-w-[240px]">Kursus</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Pertanyaan</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Total Poin</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Benar</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Salah</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Skor</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Hasil</th>
                <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-600">
                    Tidak ada data percobaan kuis.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="text-slate-700">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 font-extrabold">{formatDateTime(r.completedAt || r.startedAt)}</div>
                      <div className="font-extrabold text-slate-900 mt-1">{r.quiz.lessonTitle}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Siswa: <span className="font-bold text-slate-700">{r.student.name}</span> ({r.student.email})
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/admin/courses/${encodeURIComponent(r.course.id)}`}
                        className="font-extrabold text-slate-900 hover:text-indigo-700 hover:underline"
                      >
                        {r.course.title}
                      </Link>
                      <div className="text-xs text-slate-500">{r.course.slug}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.totalQuestions}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.totalMarks}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.result === 'INCOMPLETE' ? '-' : r.correctCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.result === 'INCOMPLETE' ? '-' : r.incorrectCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.result === 'INCOMPLETE' ? `${r.score}%` : r.earnedText}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={twMerge('inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border', badgeClass(r.result))}>
                        {badgeText(r.result)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openAttemptDetail(r.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => {
                            const ok = window.confirm('Reset attempt ini? Data attempt akan dihapus.');
                            if (!ok) return;
                            resetAttempt(r.id);
                          }}
                          aria-label="Reset"
                          title="Reset"
                          className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const ok = window.confirm('Hapus attempt ini?');
                            if (!ok) return;
                            resetAttempt(r.id);
                          }}
                          aria-label="Delete"
                          title="Delete"
                          className="inline-flex items-center justify-center p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
            onClick={() => fetchAttempts({ reset: false })}
            disabled={!nextCursor || isLoading}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Muat lebih banyak
          </button>
        </div>
      </div>

      {attemptDetailOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeAttemptDetail();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Detail Attempt</div>
                <div className="text-lg font-extrabold text-slate-900">{attemptDetail?.quiz.lessonTitle || 'Quiz'}</div>
                {attemptDetail ? (
                  <div className="text-xs text-slate-500 mt-1">
                    {attemptDetail.student.name} ({attemptDetail.student.email})
                  </div>
                ) : null}
              </div>
              <button onClick={closeAttemptDetail} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
              {attemptDetailError ? <div className="text-sm text-rose-700">{attemptDetailError}</div> : null}
              {isLoadingAttemptDetail ? (
                <div className="p-8 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat detail...
                </div>
              ) : attemptDetail ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs font-extrabold text-slate-500">Skor</div>
                      <div className="text-xl font-extrabold text-slate-900">{attemptDetail.score}%</div>
                      <div className="text-xs text-slate-500 mt-1">Passing: {attemptDetail.passingGrade}%</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs font-extrabold text-slate-500">Mulai</div>
                      <div className="font-extrabold text-slate-900">{formatDateTime(attemptDetail.startedAt)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs font-extrabold text-slate-500">Selesai</div>
                      <div className="font-extrabold text-slate-900">{formatDateTime(attemptDetail.completedAt)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700">Pertanyaan</div>
                    <div className="divide-y divide-slate-200">
                      {attemptDetail.questions.length === 0 ? (
                        <div className="p-4 text-sm text-slate-600">Tidak ada data pertanyaan.</div>
                      ) : (
                        attemptDetail.questions.map((q) => (
                          <div key={q.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-slate-900">
                                  {q.order + 1}. {q.text}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Poin: {q.points}</div>
                              </div>
                              <span
                                className={twMerge(
                                  'shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border',
                                  q.isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                                )}
                              >
                                {q.isCorrect ? 'Benar' : 'Salah'}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="rounded-xl border border-slate-200 p-3">
                                <div className="text-xs font-extrabold text-slate-500 mb-1">Jawaban Siswa</div>
                                {q.submittedText.length > 0 ? (
                                  <div className="text-slate-900">{q.submittedText.join(', ')}</div>
                                ) : (
                                  <div className="text-slate-500">-</div>
                                )}
                              </div>
                              <div className="rounded-xl border border-slate-200 p-3">
                                <div className="text-xs font-extrabold text-slate-500 mb-1">Jawaban Benar</div>
                                {q.correctText.length > 0 ? (
                                  <div className="text-slate-900">{q.correctText.join(', ')}</div>
                                ) : (
                                  <div className="text-slate-500">-</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-white">
              <button
                onClick={closeAttemptDetail}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-extrabold text-sm hover:bg-slate-50"
              >
                Tutup
              </button>
              {attemptDetailId ? (
                <button
                  onClick={() => {
                    const ok = window.confirm('Reset attempt ini? Data attempt akan dihapus.');
                    if (!ok) return;
                    resetAttempt(attemptDetailId);
                    closeAttemptDetail();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-sm hover:bg-rose-700 inline-flex items-center"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

