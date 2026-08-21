"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type CourseOption = { id: string; title: string };

type AssignmentRow = {
  id: string;
  title: string;
  passingGrade: number;
  timeLimit: number | null;
  maxFileSize: number;
  createdAt: string;
  updatedAt: string;
  course: { id: string; title: string; slug: string };
  lesson: { id: string; title: string };
  submissionsCount: number;
  lastSubmittedAt: string | null;
};

type AssignmentSubmissionRow = {
  id: string;
  status: 'PENDING' | 'GRADED' | 'REJECTED';
  grade: number | null;
  feedback: string | null;
  notes: string | null;
  submittedAt: string;
  gradedAt: string | null;
  downloadUrl: string;
  student: { id: string; name: string; email: string };
  course: { id: string; title: string; slug: string };
  assignment: { id: string; title: string; passingGrade: number; timeLimit: number | null };
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

function formatDuration(minutes: number | null) {
  if (!minutes) return 'No Limit';
  if (minutes < 60) return `${minutes} m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} j ${m} m` : `${h} j`;
}

export default function AdminAssignments({ courses }: { courses: CourseOption[] }) {
  const [view, setView] = useState<'assignments' | 'submissions'>('assignments');

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignmentsNextCursor, setAssignmentsNextCursor] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmissionRow[]>([]);
  const [submissionsNextCursor, setSubmissionsNextCursor] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'PENDING' | 'GRADED' | 'REJECTED'>('ALL');
  const [courseId, setCourseId] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [assignmentId, setAssignmentId] = useState<string>('');

  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmissionRow | null>(null);
  const [gradingStatus, setGradingStatus] = useState<'GRADED' | 'REJECTED'>('GRADED');
  const [gradingGrade, setGradingGrade] = useState('');
  const [gradingFeedback, setGradingFeedback] = useState('');
  const [isGrading, setIsGrading] = useState(false);

  const courseOptions = useMemo(() => courses, [courses]);

  const fetchAssignments = async (args: { reset: boolean }) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL('/api/dashboard/admin/assignments', window.location.origin);
      url.searchParams.set('limit', '20');
      if (courseId && courseId !== 'ALL') url.searchParams.set('courseId', courseId);
      if (search.trim()) url.searchParams.set('q', search.trim());
      const cursor = args.reset ? null : assignmentsNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat daftar tugas');
      const list = Array.isArray(data?.assignments) ? data.assignments : [];
      const mapped: AssignmentRow[] = list.map((a: any) => ({
        id: String(a.id),
        title: String(a.title || 'Tugas'),
        passingGrade: Number(a.passingGrade) || 0,
        timeLimit: a.timeLimit === null || a.timeLimit === undefined ? null : Number(a.timeLimit) || 0,
        maxFileSize: Number(a.maxFileSize) || 5,
        createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date(a.createdAt).toISOString(),
        updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : new Date(a.updatedAt).toISOString(),
        course: { id: String(a.course?.id || ''), title: String(a.course?.title || ''), slug: String(a.course?.slug || '') },
        lesson: { id: String(a.lesson?.id || ''), title: String(a.lesson?.title || '') },
        submissionsCount: Number(a.submissionsCount) || 0,
        lastSubmittedAt: a.lastSubmittedAt ? (typeof a.lastSubmittedAt === 'string' ? a.lastSubmittedAt : new Date(a.lastSubmittedAt).toISOString()) : null,
      }));
      setAssignments((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setAssignmentsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat daftar tugas');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async (args: { reset: boolean }) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL('/api/dashboard/admin/assignments/submissions', window.location.origin);
      url.searchParams.set('limit', '20');
      if (courseId && courseId !== 'ALL') url.searchParams.set('courseId', courseId);
      if (assignmentId) url.searchParams.set('assignmentId', assignmentId);
      if (status !== 'ALL') url.searchParams.set('status', status);
      if (search.trim()) url.searchParams.set('q', search.trim());
      if (fromDate) url.searchParams.set('from', toIsoStart(fromDate));
      if (toDate) url.searchParams.set('to', toIsoEnd(toDate));
      const cursor = args.reset ? null : submissionsNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat submission tugas');
      const list = Array.isArray(data?.submissions) ? data.submissions : [];
      const mapped: AssignmentSubmissionRow[] = list.map((s: any) => ({
        id: String(s.id),
        status: String(s.status || 'PENDING'),
        grade: typeof s.grade === 'number' ? s.grade : null,
        feedback: typeof s.feedback === 'string' ? s.feedback : null,
        notes: typeof s.notes === 'string' ? s.notes : null,
        submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
        gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
        downloadUrl: String(s.downloadUrl || ''),
        student: {
          id: String(s.student?.id || ''),
          name: String(s.student?.name || ''),
          email: String(s.student?.email || ''),
        },
        course: {
          id: String(s.course?.id || ''),
          title: String(s.course?.title || ''),
          slug: String(s.course?.slug || ''),
        },
        assignment: {
          id: String(s.assignment?.id || ''),
          title: String(s.assignment?.title || 'Tugas'),
          passingGrade: Number(s.assignment?.passingGrade) || 0,
          timeLimit: s.assignment?.timeLimit === null || s.assignment?.timeLimit === undefined ? null : Number(s.assignment.timeLimit) || 0,
        },
      }));
      setSubmissions((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setSubmissionsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat submission tugas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAssignments({ reset: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openGradeModal = (s: AssignmentSubmissionRow) => {
    setGradingSubmission(s);
    setGradingStatus(s.status === 'REJECTED' ? 'REJECTED' : 'GRADED');
    setGradingGrade(typeof s.grade === 'number' ? String(s.grade) : '');
    setGradingFeedback(typeof s.feedback === 'string' ? s.feedback : '');
    setGradeModalOpen(true);
  };

  const closeGradeModal = () => {
    setGradeModalOpen(false);
    setGradingSubmission(null);
    setIsGrading(false);
  };

  const submitGrade = async () => {
    if (!gradingSubmission) return;
    if (isGrading) return;
    const gradeValue =
      gradingStatus === 'GRADED'
        ? (() => {
            const trimmed = gradingGrade.trim();
            if (!trimmed) return null;
            const n = Number(trimmed);
            if (!Number.isFinite(n)) return NaN;
            return n;
          })()
        : null;
    if (gradingStatus === 'GRADED') {
      if (gradeValue === null) {
        toast.error('Nilai wajib diisi');
        return;
      }
      if (!Number.isFinite(gradeValue) || gradeValue < 0 || gradeValue > 100) {
        toast.error('Nilai harus angka 0 - 100');
        return;
      }
    }
    setIsGrading(true);
    try {
      const res = await fetch(`/api/assignments/submissions/${encodeURIComponent(gradingSubmission.id)}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: gradingStatus,
          grade: gradingStatus === 'GRADED' ? gradeValue : undefined,
          feedback: gradingFeedback,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan penilaian');
      const updated = data?.submission;
      setSubmissions((prev) =>
        prev.map((x) =>
          x.id === gradingSubmission.id
            ? {
                ...x,
                status:
                  updated?.status === 'PENDING' || updated?.status === 'GRADED' || updated?.status === 'REJECTED'
                    ? updated.status
                    : x.status,
                grade: typeof updated.grade === 'number' ? updated.grade : null,
                feedback: typeof updated.feedback === 'string' ? updated.feedback : null,
                gradedAt: updated.gradedAt ? (typeof updated.gradedAt === 'string' ? updated.gradedAt : new Date(updated.gradedAt).toISOString()) : null,
              }
            : x
        )
      );
      toast.success('Penilaian tersimpan');
      closeGradeModal();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan penilaian');
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tugas</h1>
          <p className="text-slate-500 text-sm mt-1">Daftar tugas dan submission tugas siswa dari semua kursus.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setView('assignments');
            setAssignmentId('');
            setStatus('ALL');
            setFromDate('');
            setToDate('');
            setError(null);
            setAssignments([]);
            setAssignmentsNextCursor(null);
            fetchAssignments({ reset: true });
          }}
          className={twMerge(
            'px-3 py-2 rounded-xl text-xs font-extrabold',
            view === 'assignments' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          )}
        >
          Daftar Tugas
        </button>
        <button
          onClick={() => {
            setView('submissions');
            setError(null);
            setSubmissions([]);
            setSubmissionsNextCursor(null);
            fetchSubmissions({ reset: true });
          }}
          className={twMerge(
            'px-3 py-2 rounded-xl text-xs font-extrabold',
            view === 'submissions' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          )}
        >
          Submission
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className={twMerge('grid grid-cols-1 gap-3 items-center', view === 'submissions' ? 'lg:grid-cols-[1fr_auto_auto]' : 'lg:grid-cols-[1fr_auto]')}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={view === 'submissions' ? 'Cari tugas / course / siswa...' : 'Cari tugas / course...'}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
          />
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full lg:w-72 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
          >
            <option value="ALL">Semua Kursus</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {view === 'submissions' ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full lg:w-48 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">PENDING</option>
              <option value="GRADED">GRADED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          ) : null}
        </div>

        {view === 'submissions' ? (
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
            <button
              onClick={() => fetchSubmissions({ reset: true })}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Terapkan
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() => fetchAssignments({ reset: true })}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Terapkan
            </button>
          </div>
        )}
      </div>

      {error ? <div className="text-sm text-rose-700">{error}</div> : null}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                {view === 'assignments' ? (
                  <>
                    <th className="px-4 py-3 font-extrabold">Tugas</th>
                    <th className="px-4 py-3 font-extrabold whitespace-nowrap">Passing</th>
                    <th className="px-4 py-3 font-extrabold">Durasi</th>
                    <th className="px-4 py-3 font-extrabold whitespace-nowrap">Update</th>
                    <th className="px-4 py-3 font-extrabold whitespace-nowrap">Submission</th>
                    <th className="px-4 py-3 font-extrabold whitespace-nowrap">Last Submit</th>
                    <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-extrabold">Assignment</th>
                    <th className="px-4 py-3 font-extrabold">Student</th>
                    <th className="px-4 py-3 font-extrabold whitespace-nowrap">Passing</th>
                    <th className="px-4 py-3 font-extrabold">Durasi</th>
                    <th className="px-4 py-3 font-extrabold">Tanggal</th>
                    <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {view === 'assignments' ? (
                assignments.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-600">
                      Tidak ada tugas ditemukan.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} className="text-slate-700">
                      <td className="px-4 py-3 min-w-[320px]">
                        <div className="font-extrabold text-slate-900">{a.title}</div>
                        <div className="text-xs text-slate-500">
                          Course: {a.course.title} ({a.course.slug})
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Lesson: {a.lesson.title}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{a.passingGrade}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(a.timeLimit)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(a.updatedAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{a.submissionsCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(a.lastSubmittedAt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setView('submissions');
                            setAssignmentId(a.id);
                            setError(null);
                            setSubmissions([]);
                            setSubmissionsNextCursor(null);
                            fetchSubmissions({ reset: true });
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700"
                        >
                          Lihat Submission
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : submissions.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                    Belum ada submission.
                  </td>
                </tr>
              ) : (
                submissions.map((r) => (
                  <tr key={r.id} className="text-slate-700">
                    <td className="px-4 py-3 min-w-[280px]">
                      <div className="font-extrabold text-slate-900">{r.assignment.title}</div>
                      <div className="text-xs text-slate-500">
                        Course: {r.course.title} ({r.course.slug})
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        <span
                          className={twMerge(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold border',
                            r.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : r.status === 'GRADED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          )}
                        >
                          {r.status}
                          {typeof r.grade === 'number' ? ` • ${r.grade}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="font-bold text-slate-900">{r.student.name}</div>
                      <div className="text-xs text-slate-500">{r.student.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.assignment.passingGrade}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDuration(r.assignment.timeLimit)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.submittedAt)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={r.downloadUrl}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                        <button
                          onClick={() => openGradeModal(r)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700"
                        >
                          <Check className="w-4 h-4" />
                          Evaluate
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
            onClick={() => (view === 'assignments' ? fetchAssignments({ reset: false }) : fetchSubmissions({ reset: false }))}
            disabled={view === 'assignments' ? !assignmentsNextCursor || isLoading : !submissionsNextCursor || isLoading}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Muat lebih banyak
          </button>
        </div>
      </div>

      {gradeModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeGradeModal();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="text-sm text-slate-500">Evaluate</div>
              <div className="text-lg font-extrabold text-slate-900 truncate">{gradingSubmission?.assignment.title || 'Tugas'}</div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {gradingSubmission?.student.name || ''} • {gradingSubmission?.course.title || ''}
              </div>
            </div>

            {!gradingSubmission ? (
              <div className="p-6 text-slate-600 text-sm">Submission tidak tersedia.</div>
            ) : (
              <div className="p-4 space-y-4">
                {gradingSubmission.notes ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-extrabold text-slate-600">Catatan Siswa</div>
                    <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{gradingSubmission.notes}</div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-700 mb-1">Status</div>
                    <select
                      value={gradingStatus}
                      onChange={(e) => setGradingStatus(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                    >
                      <option value="GRADED">GRADED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-700 mb-1">Nilai (0 - 100)</div>
                    <input
                      value={gradingGrade}
                      onChange={(e) => setGradingGrade(e.target.value)}
                      disabled={gradingStatus !== 'GRADED'}
                      inputMode="numeric"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder={gradingStatus === 'GRADED' ? 'Contoh: 80' : '-'}
                    />
                    <div className="text-xs text-slate-500 mt-1">Passing: {gradingSubmission.assignment.passingGrade}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-1">Feedback</div>
                  <textarea
                    value={gradingFeedback}
                    onChange={(e) => setGradingFeedback(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                    placeholder="Tambahkan feedback (opsional)..."
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <a
                    href={gradingSubmission.downloadUrl}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </a>
                  <button
                    onClick={submitGrade}
                    disabled={isGrading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isGrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Simpan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
