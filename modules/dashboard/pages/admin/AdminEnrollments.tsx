"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type CourseOption = { id: string; title: string };

type EnrollmentRow = {
  id: string;
  createdAt: string;
  course: { id: string; title: string; slug: string };
  student: { id: string; name: string; email: string };
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

type StudentOption = { id: string; name: string | null; email: string };

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

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function AdminEnrollments({ courses }: { courses: CourseOption[] }) {
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'RESET_PROGRESS' | 'UNENROLL'>('RESET_PROGRESS');
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollCourseId, setEnrollCourseId] = useState<string>(''); 
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const courseOptions = useMemo(() => courses, [courses]);

  const filteredStudents = useMemo(() => {
    const q = studentsSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.name || s.email).toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [students, studentsSearch]);

  const fetchEnrollments = async (args: { reset: boolean }) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL('/api/dashboard/admin/enrollments', window.location.origin);
      url.searchParams.set('limit', '20');
      if (courseId !== 'ALL') url.searchParams.set('courseId', courseId);
      if (search.trim()) url.searchParams.set('q', search.trim());
      if (fromDate) url.searchParams.set('from', toIsoStart(fromDate));
      if (toDate) url.searchParams.set('to', toIsoEnd(toDate));
      const cursor = args.reset ? null : nextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat pendaftaran');
      const list = Array.isArray(data?.enrollments) ? data.enrollments : [];
      const mapped: EnrollmentRow[] = list.map((e: any) => ({
        id: String(e.id),
        createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date(e.createdAt).toISOString(),
        course: { id: String(e.course?.id || ''), title: String(e.course?.title || ''), slug: String(e.course?.slug || '') },
        student: { id: String(e.student?.id || ''), name: String(e.student?.name || e.student?.email || ''), email: String(e.student?.email || '') },
        totalLessons: Number(e.totalLessons) || 0,
        completedLessons: Number(e.completedLessons) || 0,
        progressPercent: Number(e.progressPercent) || 0,
      }));
      setRows((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat pendaftaran');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments({ reset: true });
  }, []);

  const toggleAllOnPage = () => {
    const allIds = rows.map((r) => r.id);
    const next = new Set(selectedIds);
    const allSelected = allIds.every((id) => next.has(id));
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

  const resetProgress = async (enrollmentId: string) => {
    try {
      const res = await fetch(`/api/dashboard/admin/enrollments/${encodeURIComponent(enrollmentId)}/reset-progress`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal reset progress');
      toast.success('Progress di-reset');
      setRows((prev) =>
        prev.map((r) => (r.id === enrollmentId ? { ...r, completedLessons: 0, progressPercent: 0 } : r))
      );
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
      setRows((prev) => prev.filter((r) => r.id !== enrollmentId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(enrollmentId);
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus pendaftaran');
    }
  };

  const applyBulk = async () => {
    if (isBulkWorking) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Pilih minimal 1 data');
      return;
    }
    const ok = window.confirm(`Jalankan aksi "${bulkAction}" untuk ${ids.length} data?`);
    if (!ok) return;
    setIsBulkWorking(true);
    try {
      if (bulkAction === 'RESET_PROGRESS') {
        for (const id of ids) {
          // eslint-disable-next-line no-await-in-loop
          await resetProgress(id);
        }
      } else {
        for (const id of ids) {
          // eslint-disable-next-line no-await-in-loop
          await unenroll(id);
        }
      }
      setSelectedIds(new Set());
    } finally {
      setIsBulkWorking(false);
    }
  };

  const openEnrollModal = () => {
    setEnrollModalOpen(true);
    setEnrollCourseId(courseOptions[0]?.id || '');
    setStudentsSearch('');
    setSelectedStudentIds(new Set());
  };

  useEffect(() => {
    if (!enrollModalOpen) return;
    if (students.length > 0 || isLoadingStudents) return;
    setIsLoadingStudents(true);
    setStudentsError(null);
    (async () => {
      try {
        const res = await fetch('/api/users?role=STUDENT', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat siswa');
        const list = Array.isArray(data) ? data : [];
        setStudents(
          list.map((u: any) => ({ id: String(u.id), name: typeof u.name === 'string' ? u.name : null, email: String(u.email || '') }))
        );
      } catch (e: any) {
        setStudentsError(e?.message || 'Gagal memuat siswa');
      } finally {
        setIsLoadingStudents(false);
      }
    })();
  }, [enrollModalOpen, isLoadingStudents, students.length]);

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const enrollStudents = async () => {
    if (!enrollCourseId) {
      toast.error('Pilih kursus');
      return;
    }
    const userIds = Array.from(selectedStudentIds);
    if (userIds.length === 0) {
      toast.error('Pilih minimal 1 siswa');
      return;
    }
    if (isEnrolling) return;
    setIsEnrolling(true);
    try {
      const res = await fetch('/api/dashboard/admin/enrollments/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: enrollCourseId, userIds }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal mendaftarkan siswa');
      toast.success('Siswa berhasil didaftarkan');
      setEnrollModalOpen(false);
      setSelectedStudentIds(new Set());
      setSelectedIds(new Set());
      setRows([]);
      setNextCursor(null);
      fetchEnrollments({ reset: true });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mendaftarkan siswa');
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pendaftaran</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola siswa yang terdaftar di kursus.</p>
        </div>
        <button
          onClick={openEnrollModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Enroll Students
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari course / siswa / email..."
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
          <button
            onClick={() => {
              setSelectedIds(new Set());
              setRows([]);
              setNextCursor(null);
              fetchEnrollments({ reset: true });
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
              <option value="RESET_PROGRESS">Reset Progress</option>
              <option value="UNENROLL">Hapus Pendaftaran</option>
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
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Date</th>
                <th className="px-4 py-3 font-extrabold">Course</th>
                <th className="px-4 py-3 font-extrabold">Name</th>
                <th className="px-4 py-3 font-extrabold">Status</th>
                <th className="px-4 py-3 font-extrabold">Progress</th>
                <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-600">
                    Tidak ada data pendaftaran.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const progress = clampPercent(r.progressPercent);
                  return (
                    <tr key={r.id} className="text-slate-700">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-900 font-bold">{new Date(r.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-3 min-w-[260px]">
                        <Link
                          href={`/dashboard/admin/courses/${encodeURIComponent(r.course.id)}`}
                          className="font-extrabold text-slate-900 hover:text-indigo-700 hover:underline"
                        >
                          {r.course.title}
                        </Link>
                        <div className="text-xs text-slate-500">{r.course.slug}</div>
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="font-extrabold text-slate-900">{r.student.name}</div>
                        <div className="text-xs text-slate-500">{r.student.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Approved
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-32 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="text-xs font-extrabold text-slate-700">{progress}%</div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {r.completedLessons}/{r.totalLessons} lesson selesai
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => resetProgress(r.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reset Progress
                          </button>
                          <button
                            onClick={() => unenroll(r.id)}
                            aria-label="Delete"
                            title="Delete"
                            className="inline-flex items-center justify-center p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
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
            onClick={() => fetchEnrollments({ reset: false })}
            disabled={!nextCursor || isLoading}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Muat lebih banyak
          </button>
        </div>
      </div>

      {enrollModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEnrollModalOpen(false);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Enroll Students</div>
                <div className="text-lg font-extrabold text-slate-900">Pendaftaran Manual</div>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-extrabold text-slate-700 mb-1">Kursus</div>
                <select
                  value={enrollCourseId}
                  onChange={(e) => setEnrollCourseId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                >
                  {courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    value={studentsSearch}
                    onChange={(e) => setStudentsSearch(e.target.value)}
                    placeholder="Cari siswa / email..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                  />
                </div>
                <div className="text-xs font-extrabold text-slate-600 text-right">
                  Dipilih: {selectedStudentIds.size}
                </div>
              </div>

              {studentsError ? <div className="text-sm text-rose-700">{studentsError}</div> : null}
              {isLoadingStudents ? (
                <div className="p-8 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat siswa...
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[45vh] overflow-auto divide-y divide-slate-200">
                    {filteredStudents.length === 0 ? (
                      <div className="p-6 text-sm text-slate-600">Tidak ada siswa.</div>
                    ) : (
                      filteredStudents.map((s) => (
                        <label key={s.id} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={selectedStudentIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{s.name || s.email}</div>
                            <div className="text-xs text-slate-500 truncate">{s.email}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-white">
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-extrabold text-sm hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={enrollStudents}
                disabled={isEnrolling}
                className={twMerge(
                  'px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 inline-flex items-center',
                  isEnrolling ? 'opacity-60' : ''
                )}
              >
                {isEnrolling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enroll
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
