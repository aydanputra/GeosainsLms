"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import Table from '../../components/Tables';
import { BookOpen, Check, Download, Eye, Loader2, RotateCcw, Search, Trash2, Users, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

type StudentCourseRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  enrolledAt: string;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  registeredAt: string;
  totalCourses: number;
  lastEnrolledAt: string | null;
  courses: StudentCourseRow[];
};

interface AdminCourseStudentsProps {
  students: StudentRow[];
}

type StudentDetailCourseRow = {
  course: { id: string; title: string; slug: string; status: string };
  enrolledAt: string;
  lessons: { total: number; completed: number };
  quizzes: { total: number; attempted: number; passed: number; bestAvg: number };
  assignments: { total: number; graded: number; passed: number; bestAvg: number };
  progressPercent: number;
};

type StudentDetail = {
  student: { id: string; name: string; email: string; registeredAt: string; role: string };
  totals: {
    enrolledCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    reviewsPlaced: number;
    totalLessons: number;
    completedLessons: number;
    totalQuizzes: number;
    quizzesTaken: number;
    totalAssignments: number;
    assignmentsSubmitted: number;
    questions: number;
  };
  courses: StudentDetailCourseRow[];
};

type DetailTab = 'courses' | 'attempts' | 'submissions' | 'qa' | 'reviews';

type AttemptRow = {
  id: string;
  score: number;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
  course: { id: string; title: string; slug: string };
  quiz: { id: string; lessonId: string | null; lessonTitle: string; passingGrade: number };
};

type SubmissionRow = {
  id: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  notes: string | null;
  submittedAt: string;
  gradedAt: string | null;
  course: { id: string; title: string; slug: string };
  assignment: { id: string; lessonId: string | null; lessonTitle: string; passingGrade: number };
  downloadUrl: string;
};

type QaThreadRow = {
  id: string;
  title: string;
  question: string;
  status: string;
  createdAt: string;
  repliesCount: number;
  course: { id: string; title: string; slug: string };
  lesson: { id: string; title: string } | null;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  course: { id: string; title: string; slug: string };
};

type AttemptDetail = {
  id: string;
  score: number;
  passed: boolean;
  passingGrade: number;
  startedAt: string;
  completedAt: string | null;
  quiz: { id: string; lessonId: string | null; lessonTitle: string };
  questions: Array<{
    id: string;
    order: number;
    text: string;
    points: number;
    explanation: string | null;
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

function escapeCsv(value: unknown) {
  const s = value === null || value === undefined ? '' : String(value);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadCsv(args: { filename: string; csv: string }) {
  const blob = new Blob([args.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = args.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export default function AdminCourseStudents({ students }: AdminCourseStudentsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [studentRows, setStudentRows] = useState<StudentRow[]>(students || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('courses');
  const lastDismissedStudentIdRef = useRef<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkUnenrolling, setIsBulkUnenrolling] = useState(false);
  const pageSize = 20;
  const [listLimit, setListLimit] = useState(pageSize);

  useEffect(() => {
    setStudentRows(students || []);
    setSelectedStudentIds([]);
    setListLimit(pageSize);
  }, [students]);

  useEffect(() => {
    setSelectedStudentIds([]);
    setListLimit(pageSize);
  }, [courseFilter, searchQuery]);

  const updateUrl = useCallback(
    (next: { studentId?: string | null; tab?: DetailTab | null }, mode: 'push' | 'replace' = 'push') => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.studentId === null) params.delete('studentId');
      else if (typeof next.studentId === 'string' && next.studentId.trim()) params.set('studentId', next.studentId.trim());
      if (next.tab === null) params.delete('tab');
      else if (typeof next.tab === 'string' && next.tab.trim()) params.set('tab', next.tab);
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      if (mode === 'replace') router.replace(nextUrl);
      else router.push(nextUrl);
    },
    [pathname, router, searchParams]
  );

  const openStudentDetail = useCallback(
    (student: StudentRow, tab: DetailTab = 'courses') => {
      updateUrl({ studentId: student.id, tab }, 'push');
      setSelectedStudent(student);
      setDetailTab(tab);
    },
    [updateUrl]
  );

  const goDetailTab = useCallback(
    (tab: DetailTab) => {
      setDetailTab(tab);
      if (selectedStudent?.id) updateUrl({ studentId: selectedStudent.id, tab }, 'replace');
    },
    [selectedStudent?.id, updateUrl]
  );

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsNextCursor, setAttemptsNextCursor] = useState<string | null>(null);
  const [attemptsStatus, setAttemptsStatus] = useState<'ALL' | 'PASSED' | 'FAILED' | 'INCOMPLETE'>('ALL');
  const [attemptsSearch, setAttemptsSearch] = useState('');
  const [attemptsFromDate, setAttemptsFromDate] = useState('');
  const [attemptsToDate, setAttemptsToDate] = useState('');
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [isExportingAttempts, setIsExportingAttempts] = useState(false);
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [isBulkResettingAttempts, setIsBulkResettingAttempts] = useState(false);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [submissionsNextCursor, setSubmissionsNextCursor] = useState<string | null>(null);
  const [submissionsStatus, setSubmissionsStatus] = useState<'ALL' | 'PENDING' | 'GRADED' | 'REJECTED'>('ALL');
  const [submissionsSearch, setSubmissionsSearch] = useState('');
  const [submissionsFromDate, setSubmissionsFromDate] = useState('');
  const [submissionsToDate, setSubmissionsToDate] = useState('');
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isExportingSubmissions, setIsExportingSubmissions] = useState(false);

  const [qaThreads, setQaThreads] = useState<QaThreadRow[]>([]);
  const [qaNextCursor, setQaNextCursor] = useState<string | null>(null);
  const [qaStatus, setQaStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [qaSearch, setQaSearch] = useState('');
  const [qaFromDate, setQaFromDate] = useState('');
  const [qaToDate, setQaToDate] = useState('');
  const [qaError, setQaError] = useState<string | null>(null);
  const [isLoadingQa, setIsLoadingQa] = useState(false);
  const [isExportingQa, setIsExportingQa] = useState(false);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsNextCursor, setReviewsNextCursor] = useState<string | null>(null);
  const [reviewsSearch, setReviewsSearch] = useState('');
  const [reviewsFromDate, setReviewsFromDate] = useState('');
  const [reviewsToDate, setReviewsToDate] = useState('');
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isExportingReviews, setIsExportingReviews] = useState(false);

  const [attemptDetailOpen, setAttemptDetailOpen] = useState(false);
  const [attemptDetailId, setAttemptDetailId] = useState<string | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);
  const [attemptDetailError, setAttemptDetailError] = useState<string | null>(null);
  const [isLoadingAttemptDetail, setIsLoadingAttemptDetail] = useState(false);
  const [resettingAttemptId, setResettingAttemptId] = useState<string | null>(null);

  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionRow | null>(null);
  const [gradingStatus, setGradingStatus] = useState<'GRADED' | 'REJECTED'>('GRADED');
  const [gradingGrade, setGradingGrade] = useState('');
  const [gradingFeedback, setGradingFeedback] = useState('');
  const [isGradingSubmission, setIsGradingSubmission] = useState(false);

  const courseOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const s of studentRows) {
      for (const c of s.courses) {
        if (!map.has(c.id)) map.set(c.id, { id: c.id, title: c.title });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [studentRows]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studentRows.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.courses.some((c) => c.title.toLowerCase().includes(q));
      const matchesCourse = courseFilter === 'ALL' ? true : s.courses.some((c) => c.id === courseFilter);
      return matchesSearch && matchesCourse;
    });
  }, [courseFilter, searchQuery, studentRows]);

  const pagedStudents = useMemo(() => filteredStudents.slice(0, Math.max(1, listLimit)), [filteredStudents, listLimit]);

  const visibleStudentIds = useMemo(() => pagedStudents.map((s) => s.id), [pagedStudents]);
  const isAllVisibleStudentsSelected = useMemo(() => {
    if (visibleStudentIds.length === 0) return false;
    const set = new Set(selectedStudentIds);
    return visibleStudentIds.every((id) => set.has(id));
  }, [selectedStudentIds, visibleStudentIds]);

  // Stable enough for this table config; memo churn here is acceptable and localized.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Stable enough for this table config; memo churn here is acceptable and localized.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleAllVisibleStudents = () => {
    setSelectedStudentIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleStudentIds.length > 0 && visibleStudentIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleStudentIds.includes(id));
      for (const id of visibleStudentIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  };

  const metrics = useMemo(() => {
    const totalEnrollments = studentRows.reduce((acc, s) => acc + s.courses.length, 0);
    const uniqueCourses = new Set(courseOptions.map((c) => c.id)).size;
    const activeStudents = studentRows.filter((s) => s.courses.length > 0).length;
    return [
      { label: 'Total Siswa', value: studentRows.length, color: 'bg-indigo-500', icon: Users },
      { label: 'Siswa Enrolled', value: activeStudents, color: 'bg-emerald-500', icon: Users },
      { label: 'Total Enrollment', value: totalEnrollments, color: 'bg-blue-500', icon: BookOpen },
      { label: 'Kursus Aktif', value: uniqueCourses, color: 'bg-slate-500', icon: BookOpen },
    ];
  }, [courseOptions, studentRows]);

  const resolveEnrollmentId = async (args: { courseId: string; studentId: string; studentEmail: string }) => {
    const url = new URL('/api/dashboard/admin/enrollments', window.location.origin);
    url.searchParams.set('limit', '20');
    url.searchParams.set('courseId', args.courseId);
    url.searchParams.set('q', args.studentEmail);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Gagal memuat pendaftaran');
    const enrollments = Array.isArray(data?.enrollments) ? data.enrollments : [];
    const match = enrollments.find((e: any) => String(e?.student?.id || '') === args.studentId && String(e?.course?.id || '') === args.courseId);
    return match ? String(match.id) : null;
  };

  const applyUnenrollLocal = (args: { studentId: string; courseId: string }) => {
    setStudentRows((prev) =>
      prev.map((s) => {
        if (s.id !== args.studentId) return s;
        const nextCourses = s.courses.filter((c) => c.id !== args.courseId);
        const lastEnrolledAt =
          nextCourses.length === 0
            ? null
            : nextCourses
                .map((c) => c.enrolledAt)
                .filter(Boolean)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
        return { ...s, courses: nextCourses, totalCourses: nextCourses.length, lastEnrolledAt };
      })
    );
  };

  // Stable enough for this table config; memo churn here is acceptable and localized.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const unenrollStudentFromSelectedCourse = async (student: StudentRow) => {
    if (courseFilter === 'ALL') {
      toast.info('Pilih kursus dulu untuk menghapus pendaftaran.');
      return;
    }
    if (!student.courses.some((c) => c.id === courseFilter)) {
      toast.info('Siswa ini tidak terdaftar di kursus yang dipilih.');
      return;
    }

    const ok = window.confirm(`Hapus pendaftaran ${student.name} dari kursus ini?`);
    if (!ok) return;

    try {
      const enrollmentId = await resolveEnrollmentId({ courseId: courseFilter, studentId: student.id, studentEmail: student.email });
      if (!enrollmentId) throw new Error('Pendaftaran tidak ditemukan');
      const res = await fetch(`/api/dashboard/admin/enrollments/${encodeURIComponent(enrollmentId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus pendaftaran');
      applyUnenrollLocal({ studentId: student.id, courseId: courseFilter });
      setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
      toast.success('Pendaftaran dihapus');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus pendaftaran');
    }
  };

  const bulkUnenrollSelectedStudents = async () => {
    if (courseFilter === 'ALL') {
      toast.info('Pilih kursus dulu untuk menghapus pendaftaran.');
      return;
    }
    const selected = selectedStudentIds
      .map((id) => studentRows.find((s) => s.id === id))
      .filter(Boolean) as StudentRow[];
    const targets = selected.filter((s) => s.courses.some((c) => c.id === courseFilter));

    if (targets.length === 0) {
      toast.info('Pilih minimal 1 siswa yang terdaftar di kursus ini.');
      return;
    }
    const ok = window.confirm(`Hapus pendaftaran ${targets.length} siswa dari kursus ini?`);
    if (!ok) return;

    setIsBulkUnenrolling(true);
    let failed = 0;
    try {
      for (const s of targets) {
        try {
          const enrollmentId = await resolveEnrollmentId({ courseId: courseFilter, studentId: s.id, studentEmail: s.email });
          if (!enrollmentId) {
            failed += 1;
            continue;
          }
          const res = await fetch(`/api/dashboard/admin/enrollments/${encodeURIComponent(enrollmentId)}`, { method: 'DELETE' });
          if (!res.ok) {
            failed += 1;
            continue;
          }
          applyUnenrollLocal({ studentId: s.id, courseId: courseFilter });
        } catch {
          failed += 1;
        }
      }

      if (failed === 0) toast.success(`Berhasil menghapus pendaftaran ${targets.length} siswa`);
      else toast.error(`${failed} siswa gagal dihapus pendaftarannya`);

      setSelectedStudentIds((prev) => prev.filter((id) => !targets.some((s) => s.id === id)));
    } finally {
      setIsBulkUnenrolling(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/40"
              checked={isAllVisibleStudentsSelected}
              onChange={toggleAllVisibleStudents}
              disabled={visibleStudentIds.length === 0 || isBulkUnenrolling}
              aria-label="Pilih semua siswa"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-14',
        cell: (_val: unknown, row: StudentRow) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={selectedStudentIds.includes(row.id)}
              onChange={() => toggleStudentSelection(row.id)}
              disabled={isBulkUnenrolling}
              aria-label={`Pilih siswa ${row.name}`}
            />
          </div>
        ),
      },
      {
        header: 'Siswa',
        accessorKey: 'name',
        cell: (val: string, row: StudentRow) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
              {(val || row.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-slate-900 truncate">{val}</div>
              <div className="text-xs text-slate-500 truncate md:hidden">{row.email}</div>
            </div>
          </div>
        ),
      },
      {
        header: 'Email',
        accessorKey: 'email',
        cell: (val: string) => <div className="text-slate-600 text-sm hidden md:block">{val}</div>,
      },
      {
        header: 'Tanggal Daftar',
        accessorKey: 'registeredAt',
        cell: (val: string) => <div className="text-slate-700 text-sm">{formatDate(val)}</div>,
      },
      {
        header: 'Kursus Diikuti',
        accessorKey: 'totalCourses',
        className: 'w-40',
        cell: (val: number) => (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {val}
          </span>
        ),
      },
      {
        header: 'Terakhir Enroll',
        accessorKey: 'lastEnrolledAt',
        cell: (val: string | null) => <div className="text-slate-700 text-sm">{formatDateTime(val)}</div>,
      },
      {
        header: 'Aksi',
        accessorKey: 'id',
        className: 'w-40',
        cell: (_id: string, row: StudentRow) => (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => openStudentDetail(row, 'courses')}
              className={twMerge(
                'inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50'
              )}
            >
              <Eye className="w-4 h-4" />
              Detail
            </button>
            <button
              onClick={() => {
                if (courseFilter === 'ALL') {
                  toast.info('Pilih kursus dulu untuk menghapus pendaftaran.');
                  return;
                }
                void unenrollStudentFromSelectedCourse(row);
              }}
              disabled={isBulkUnenrolling}
              className={twMerge(
                'inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-xs disabled:opacity-60',
                courseFilter === 'ALL'
                  ? 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                  : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              )}
              title={courseFilter === 'ALL' ? 'Pilih kursus dulu' : 'Hapus pendaftaran dari kursus ini'}
              aria-label="Hapus pendaftaran"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </div>
        ),
      },
    ],
    [
      courseFilter,
      isAllVisibleStudentsSelected,
      isBulkUnenrolling,
      openStudentDetail,
      selectedStudentIds,
      toggleAllVisibleStudents,
      toggleStudentSelection,
      unenrollStudentFromSelectedCourse,
      visibleStudentIds.length,
    ]
  );

  useEffect(() => {
    const id = (searchParams.get('studentId') || '').trim();
    if (!id) return;
    if (selectedStudent?.id === id) return;
    if (!selectedStudent && lastDismissedStudentIdRef.current === id) return;
    const found = studentRows.find((s) => s.id === id);
    if (!found) return;
    setSelectedStudent(found);
  }, [searchParams, selectedStudent, studentRows]);

  useEffect(() => {
    const id = (searchParams.get('studentId') || '').trim();
    if (!id) {
      lastDismissedStudentIdRef.current = null;
      return;
    }
    if (lastDismissedStudentIdRef.current && lastDismissedStudentIdRef.current !== id) {
      lastDismissedStudentIdRef.current = null;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedStudent?.id) return;
    const tab = (searchParams.get('tab') || '').trim();
    if (!tab) return;
    if (tab === 'courses' || tab === 'attempts' || tab === 'submissions' || tab === 'qa' || tab === 'reviews') {
      setDetailTab(tab);
    }
  }, [searchParams, selectedStudent?.id]);

  useEffect(() => {
    if (!selectedStudent?.id) return;
    let active = true;
    const controller = new AbortController();
    setIsLoadingDetail(true);
    setDetail(null);
    setDetailError(null);
    setDetailTab('courses');
    setAttempts([]);
    setAttemptsNextCursor(null);
    setAttemptsStatus('ALL');
    setAttemptsSearch('');
    setAttemptsFromDate('');
    setAttemptsToDate('');
    setAttemptsError(null);
    setSelectedAttemptIds([]);
    setIsBulkResettingAttempts(false);
    setSubmissions([]);
    setSubmissionsNextCursor(null);
    setSubmissionsStatus('ALL');
    setSubmissionsSearch('');
    setSubmissionsFromDate('');
    setSubmissionsToDate('');
    setSubmissionsError(null);
    setQaThreads([]);
    setQaNextCursor(null);
    setQaStatus('ALL');
    setQaSearch('');
    setQaFromDate('');
    setQaToDate('');
    setQaError(null);
    setReviews([]);
    setReviewsNextCursor(null);
    setReviewsSearch('');
    setReviewsFromDate('');
    setReviewsToDate('');
    setReviewsError(null);
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat detail siswa');
        if (!active) return;
        setDetail(data as StudentDetail);
      } catch (e: any) {
        if (!active) return;
        if (e?.name === 'AbortError') return;
        setDetailError(e?.message || 'Gagal memuat detail siswa');
      } finally {
        if (!active) return;
        setIsLoadingDetail(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedStudent?.id]);

  const closeDetail = () => {
    lastDismissedStudentIdRef.current = selectedStudent?.id || null;
    updateUrl({ studentId: null, tab: null }, 'replace');
    setSelectedStudent(null);
    setDetail(null);
    setDetailError(null);
    setIsLoadingDetail(false);
    setAttemptDetailOpen(false);
    setAttemptDetailId(null);
    setAttemptDetail(null);
    setAttemptDetailError(null);
    setIsLoadingAttemptDetail(false);
    setResettingAttemptId(null);
    setSelectedAttemptIds([]);
    setIsBulkResettingAttempts(false);
    setGradeModalOpen(false);
    setGradingSubmission(null);
    setIsGradingSubmission(false);
  };

  const closeAttemptDetail = () => {
    setAttemptDetailOpen(false);
    setAttemptDetailId(null);
    setAttemptDetail(null);
    setAttemptDetailError(null);
    setIsLoadingAttemptDetail(false);
  };

  const closeGradeModal = () => {
    setGradeModalOpen(false);
    setGradingSubmission(null);
    setIsGradingSubmission(false);
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
        quiz: {
          id: String(a.quiz?.id || ''),
          lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
          lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
        },
        questions: Array.isArray(a.questions)
          ? a.questions.map((q: any) => ({
              id: String(q.id || ''),
              order: Number(q.order) || 0,
              text: String(q.text || ''),
              points: Number(q.points) || 0,
              explanation: typeof q.explanation === 'string' ? q.explanation : null,
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

  const resetAttempt = async (attemptId: string) => {
    if (resettingAttemptId) return;
    const ok = window.confirm('Reset attempt ini? Attempt akan dihapus dan progres quiz bisa ikut di-reset.');
    if (!ok) return;
    setResettingAttemptId(attemptId);
    try {
      const res = await fetch(`/api/quizzes/attempts/${encodeURIComponent(attemptId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal reset attempt');
      setAttempts((prev) => prev.filter((x) => x.id !== attemptId));
      setSelectedAttemptIds((prev) => prev.filter((id) => id !== attemptId));
      if (attemptDetailId === attemptId) {
        setAttemptDetailOpen(false);
        setAttemptDetailId(null);
        setAttemptDetail(null);
        setAttemptDetailError(null);
      }
      toast.success('Attempt di-reset');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal reset attempt');
    } finally {
      setResettingAttemptId(null);
    }
  };

  const isAllAttemptsSelected = useMemo(() => {
    if (attempts.length === 0) return false;
    const set = new Set(selectedAttemptIds);
    return attempts.every((a) => set.has(a.id));
  }, [attempts, selectedAttemptIds]);

  const toggleAttemptSelection = (attemptId: string) => {
    setSelectedAttemptIds((prev) => (prev.includes(attemptId) ? prev.filter((id) => id !== attemptId) : [...prev, attemptId]));
  };

  const toggleAllAttemptsSelection = () => {
    setSelectedAttemptIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = attempts.length > 0 && attempts.every((a) => prevSet.has(a.id));
      if (allSelected) return prev.filter((id) => !attempts.some((a) => a.id === id));
      for (const a of attempts) prevSet.add(a.id);
      return Array.from(prevSet);
    });
  };

  const bulkResetAttempts = async () => {
    const ids = selectedAttemptIds.filter((id) => attempts.some((a) => a.id === id));
    if (ids.length === 0) {
      toast.info('Pilih minimal 1 attempt');
      return;
    }
    if (!confirm(`Reset ${ids.length} attempt terpilih? Attempt akan dihapus dan progres quiz bisa ikut di-reset.`)) return;

    setIsBulkResettingAttempts(true);
    let failed = 0;
    try {
      for (const attemptId of ids) {
        const res = await fetch(`/api/quizzes/attempts/${encodeURIComponent(attemptId)}`, { method: 'DELETE' });
        if (!res.ok) failed += 1;
      }

      if (failed === 0) toast.success(`Berhasil reset ${ids.length} attempt`);
      else toast.error(`${failed} attempt gagal di-reset`);

      setAttempts((prev) => prev.filter((a) => !ids.includes(a.id)));
      setSelectedAttemptIds((prev) => prev.filter((id) => !ids.includes(id)));
      if (attemptDetailId && ids.includes(attemptDetailId)) closeAttemptDetail();
    } catch {
      toast.error('Gagal reset attempt terpilih');
    } finally {
      setIsBulkResettingAttempts(false);
    }
  };

  const openGradeModal = (s: SubmissionRow) => {
    setGradingSubmission(s);
    setGradingStatus(s.status === 'REJECTED' ? 'REJECTED' : 'GRADED');
    setGradingGrade(typeof s.grade === 'number' ? String(s.grade) : '');
    setGradingFeedback(typeof s.feedback === 'string' ? s.feedback : '');
    setGradeModalOpen(true);
  };

  const submitGrade = async () => {
    if (!gradingSubmission) return;
    if (isGradingSubmission) return;
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
    setIsGradingSubmission(true);
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
        prev.map((s) =>
          s.id === gradingSubmission.id
            ? {
                ...s,
                status: String(updated.status),
                grade: typeof updated.grade === 'number' ? updated.grade : null,
                feedback: typeof updated.feedback === 'string' ? updated.feedback : null,
                gradedAt: updated.gradedAt ? (typeof updated.gradedAt === 'string' ? updated.gradedAt : new Date(updated.gradedAt).toISOString()) : null,
              }
            : s
        )
      );
      closeGradeModal();
      toast.success('Penilaian tersimpan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan penilaian');
    } finally {
      setIsGradingSubmission(false);
    }
  };

  const fetchAttempts = async (args: { reset: boolean }) => {
    if (!selectedStudent?.id) return;
    if (isLoadingAttempts) return;
    setIsLoadingAttempts(true);
    setAttemptsError(null);
    try {
      if (args.reset) setSelectedAttemptIds([]);
      const url = new URL(`/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/quiz-attempts`, window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('status', attemptsStatus);
      if (attemptsSearch.trim()) url.searchParams.set('q', attemptsSearch.trim());
      if (attemptsFromDate) url.searchParams.set('from', toIsoStart(attemptsFromDate));
      if (attemptsToDate) url.searchParams.set('to', toIsoEnd(attemptsToDate));
      const cursor = args.reset ? null : attemptsNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat quiz attempts');
      const list = Array.isArray(data?.attempts) ? data.attempts : [];
      const mapped: AttemptRow[] = list.map((a: any) => ({
        id: String(a.id),
        score: Number(a.score) || 0,
        passed: Boolean(a.passed),
        startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
        completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
        course: { id: String(a.course?.id || ''), title: String(a.course?.title || ''), slug: String(a.course?.slug || '') },
        quiz: {
          id: String(a.quiz?.id || ''),
          lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
          lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
          passingGrade: Number(a.quiz?.passingGrade) || 80,
        },
      }));
      setAttempts((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setAttemptsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setAttemptsError(e?.message || 'Gagal memuat quiz attempts');
    } finally {
      setIsLoadingAttempts(false);
    }
  };

  const fetchSubmissions = async (args: { reset: boolean }) => {
    if (!selectedStudent?.id) return;
    if (isLoadingSubmissions) return;
    setIsLoadingSubmissions(true);
    setSubmissionsError(null);
    try {
      const url = new URL(
        `/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/assignment-submissions`,
        window.location.origin
      );
      url.searchParams.set('limit', '20');
      url.searchParams.set('status', submissionsStatus);
      if (submissionsSearch.trim()) url.searchParams.set('q', submissionsSearch.trim());
      if (submissionsFromDate) url.searchParams.set('from', toIsoStart(submissionsFromDate));
      if (submissionsToDate) url.searchParams.set('to', toIsoEnd(submissionsToDate));
      const cursor = args.reset ? null : submissionsNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat assignment submissions');
      const list = Array.isArray(data?.submissions) ? data.submissions : [];
      const mapped: SubmissionRow[] = list.map((s: any) => ({
        id: String(s.id),
        status: String(s.status || 'PENDING'),
        grade: typeof s.grade === 'number' ? s.grade : null,
        feedback: typeof s.feedback === 'string' ? s.feedback : null,
        notes: typeof s.notes === 'string' ? s.notes : null,
        submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
        gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
        course: { id: String(s.course?.id || ''), title: String(s.course?.title || ''), slug: String(s.course?.slug || '') },
        assignment: {
          id: String(s.assignment?.id || ''),
          lessonId: s.assignment?.lessonId ? String(s.assignment.lessonId) : null,
          lessonTitle: String(s.assignment?.lessonTitle || 'Tugas'),
          passingGrade: Number(s.assignment?.passingGrade) || 0,
        },
        downloadUrl: String(s.downloadUrl || ''),
      }));
      setSubmissions((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setSubmissionsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setSubmissionsError(e?.message || 'Gagal memuat assignment submissions');
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const fetchQa = async (args: { reset: boolean }) => {
    if (!selectedStudent?.id) return;
    if (isLoadingQa) return;
    setIsLoadingQa(true);
    setQaError(null);
    try {
      const url = new URL(`/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/qa-threads`, window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('status', qaStatus);
      if (qaSearch.trim()) url.searchParams.set('q', qaSearch.trim());
      if (qaFromDate) url.searchParams.set('from', toIsoStart(qaFromDate));
      if (qaToDate) url.searchParams.set('to', toIsoEnd(qaToDate));
      const cursor = args.reset ? null : qaNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat Q&A');
      const list = Array.isArray(data?.threads) ? data.threads : [];
      const mapped: QaThreadRow[] = list.map((t: any) => ({
        id: String(t.id),
        title: String(t.title || ''),
        question: String(t.question || ''),
        status: String(t.status || 'OPEN'),
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date(t.createdAt).toISOString(),
        repliesCount: Number(t.repliesCount) || 0,
        course: { id: String(t.course?.id || ''), title: String(t.course?.title || ''), slug: String(t.course?.slug || '') },
        lesson: t.lesson ? { id: String(t.lesson.id || ''), title: String(t.lesson.title || '') } : null,
      }));
      setQaThreads((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setQaNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setQaError(e?.message || 'Gagal memuat Q&A');
    } finally {
      setIsLoadingQa(false);
    }
  };

  const fetchReviews = async (args: { reset: boolean }) => {
    if (!selectedStudent?.id) return;
    if (isLoadingReviews) return;
    setIsLoadingReviews(true);
    setReviewsError(null);
    try {
      const url = new URL(`/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/reviews`, window.location.origin);
      url.searchParams.set('limit', '20');
      if (reviewsSearch.trim()) url.searchParams.set('q', reviewsSearch.trim());
      if (reviewsFromDate) url.searchParams.set('from', toIsoStart(reviewsFromDate));
      if (reviewsToDate) url.searchParams.set('to', toIsoEnd(reviewsToDate));
      const cursor = args.reset ? null : reviewsNextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat reviews');
      const list = Array.isArray(data?.reviews) ? data.reviews : [];
      const mapped: ReviewRow[] = list.map((r: any) => ({
        id: String(r.id),
        rating: Number(r.rating) || 0,
        comment: typeof r.comment === 'string' ? r.comment : null,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
        course: { id: String(r.course?.id || ''), title: String(r.course?.title || ''), slug: String(r.course?.slug || '') },
      }));
      setReviews((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setReviewsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setReviewsError(e?.message || 'Gagal memuat reviews');
    } finally {
      setIsLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (!selectedStudent?.id) return;
    if (detailTab === 'attempts' && attempts.length === 0 && !isLoadingAttempts) {
      fetchAttempts({ reset: true });
    }
    if (detailTab === 'submissions' && submissions.length === 0 && !isLoadingSubmissions) {
      fetchSubmissions({ reset: true });
    }
    if (detailTab === 'qa' && qaThreads.length === 0 && !isLoadingQa) {
      fetchQa({ reset: true });
    }
    if (detailTab === 'reviews' && reviews.length === 0 && !isLoadingReviews) {
      fetchReviews({ reset: true });
    }
  }, [detailTab, selectedStudent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportAttemptsCsv = async () => {
    if (!selectedStudent?.id) return;
    if (isExportingAttempts) return;
    setIsExportingAttempts(true);
    try {
      const limit = 100;
      const maxPages = 50;
      let cursor: string | null = null;
      const rows: AttemptRow[] = [];
      for (let i = 0; i < maxPages; i++) {
        const url = new URL(`/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/quiz-attempts`, window.location.origin);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('status', attemptsStatus);
        if (attemptsSearch.trim()) url.searchParams.set('q', attemptsSearch.trim());
        if (attemptsFromDate) url.searchParams.set('from', toIsoStart(attemptsFromDate));
        if (attemptsToDate) url.searchParams.set('to', toIsoEnd(attemptsToDate));
        if (cursor) url.searchParams.set('cursor', cursor);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal export attempts');
        const list = Array.isArray(data?.attempts) ? data.attempts : [];
        rows.push(
          ...list.map((a: any) => ({
            id: String(a.id),
            score: Number(a.score) || 0,
            passed: Boolean(a.passed),
            startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
            completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
            course: { id: String(a.course?.id || ''), title: String(a.course?.title || ''), slug: String(a.course?.slug || '') },
            quiz: {
              id: String(a.quiz?.id || ''),
              lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
              lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
              passingGrade: Number(a.quiz?.passingGrade) || 80,
            },
          }))
        );
        cursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
        if (!cursor) break;
      }
      const lines = [
        ['attemptId', 'courseTitle', 'courseSlug', 'quizTitle', 'score', 'passed', 'passingGrade', 'startedAt', 'completedAt']
          .map(escapeCsv)
          .join(','),
        ...rows.map((a) =>
          [
            a.id,
            a.course.title,
            a.course.slug,
            a.quiz.lessonTitle,
            a.score,
            a.passed ? 'true' : 'false',
            a.quiz.passingGrade,
            a.startedAt,
            a.completedAt ?? '',
          ]
            .map(escapeCsv)
            .join(',')
        ),
      ];
      downloadCsv({ filename: `student-${selectedStudent.id}-quiz-attempts.csv`, csv: lines.join('\n') });
    } catch (e: any) {
      setAttemptsError(e?.message || 'Gagal export attempts');
    } finally {
      setIsExportingAttempts(false);
    }
  };

  const exportSubmissionsCsv = async () => {
    if (!selectedStudent?.id) return;
    if (isExportingSubmissions) return;
    setIsExportingSubmissions(true);
    try {
      const limit = 100;
      const maxPages = 50;
      let cursor: string | null = null;
      const rows: SubmissionRow[] = [];
      for (let i = 0; i < maxPages; i++) {
        const url = new URL(
          `/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/assignment-submissions`,
          window.location.origin
        );
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('status', submissionsStatus);
        if (submissionsSearch.trim()) url.searchParams.set('q', submissionsSearch.trim());
        if (submissionsFromDate) url.searchParams.set('from', toIsoStart(submissionsFromDate));
        if (submissionsToDate) url.searchParams.set('to', toIsoEnd(submissionsToDate));
        if (cursor) url.searchParams.set('cursor', cursor);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal export submissions');
        const list = Array.isArray(data?.submissions) ? data.submissions : [];
        rows.push(
          ...list.map((s: any) => ({
            id: String(s.id),
            status: String(s.status || 'PENDING'),
            grade: typeof s.grade === 'number' ? s.grade : null,
            feedback: typeof s.feedback === 'string' ? s.feedback : null,
            notes: typeof s.notes === 'string' ? s.notes : null,
            submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
            gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
            course: { id: String(s.course?.id || ''), title: String(s.course?.title || ''), slug: String(s.course?.slug || '') },
            assignment: {
              id: String(s.assignment?.id || ''),
              lessonId: s.assignment?.lessonId ? String(s.assignment.lessonId) : null,
              lessonTitle: String(s.assignment?.lessonTitle || 'Tugas'),
              passingGrade: Number(s.assignment?.passingGrade) || 0,
            },
            downloadUrl: String(s.downloadUrl || ''),
          }))
        );
        cursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
        if (!cursor) break;
      }
      const lines = [
        ['submissionId', 'courseTitle', 'courseSlug', 'assignmentTitle', 'status', 'grade', 'passingGrade', 'submittedAt', 'gradedAt', 'downloadUrl']
          .map(escapeCsv)
          .join(','),
        ...rows.map((s) =>
          [
            s.id,
            s.course.title,
            s.course.slug,
            s.assignment.lessonTitle,
            s.status,
            s.grade ?? '',
            s.assignment.passingGrade,
            s.submittedAt,
            s.gradedAt ?? '',
            s.downloadUrl,
          ]
            .map(escapeCsv)
            .join(',')
        ),
      ];
      downloadCsv({ filename: `student-${selectedStudent.id}-assignment-submissions.csv`, csv: lines.join('\n') });
    } catch (e: any) {
      setSubmissionsError(e?.message || 'Gagal export submissions');
    } finally {
      setIsExportingSubmissions(false);
    }
  };

  const exportQaCsv = async () => {
    if (!selectedStudent?.id) return;
    if (isExportingQa) return;
    setIsExportingQa(true);
    try {
      const limit = 100;
      const maxPages = 50;
      let cursor: string | null = null;
      const rows: QaThreadRow[] = [];
      for (let i = 0; i < maxPages; i++) {
        const url = new URL(`/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/qa-threads`, window.location.origin);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('status', qaStatus);
        if (qaSearch.trim()) url.searchParams.set('q', qaSearch.trim());
        if (qaFromDate) url.searchParams.set('from', toIsoStart(qaFromDate));
        if (qaToDate) url.searchParams.set('to', toIsoEnd(qaToDate));
        if (cursor) url.searchParams.set('cursor', cursor);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal export Q&A');
        const list = Array.isArray(data?.threads) ? data.threads : [];
        rows.push(
          ...list.map((t: any) => ({
            id: String(t.id),
            title: String(t.title || ''),
            question: String(t.question || ''),
            status: String(t.status || 'OPEN'),
            createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date(t.createdAt).toISOString(),
            repliesCount: Number(t.repliesCount) || 0,
            course: { id: String(t.course?.id || ''), title: String(t.course?.title || ''), slug: String(t.course?.slug || '') },
            lesson: t.lesson ? { id: String(t.lesson.id || ''), title: String(t.lesson.title || '') } : null,
          }))
        );
        cursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
        if (!cursor) break;
      }
      const lines = [
        ['threadId', 'courseTitle', 'courseSlug', 'lessonTitle', 'status', 'repliesCount', 'createdAt', 'title', 'question'].map(escapeCsv).join(','),
        ...rows.map((t) =>
          [t.id, t.course.title, t.course.slug, t.lesson?.title ?? '', t.status, t.repliesCount, t.createdAt, t.title, t.question]
            .map(escapeCsv)
            .join(',')
        ),
      ];
      downloadCsv({ filename: `student-${selectedStudent.id}-qa.csv`, csv: lines.join('\n') });
    } catch (e: any) {
      setQaError(e?.message || 'Gagal export Q&A');
    } finally {
      setIsExportingQa(false);
    }
  };

  const exportReviewsCsv = async () => {
    if (!selectedStudent?.id) return;
    if (isExportingReviews) return;
    setIsExportingReviews(true);
    try {
      const limit = 100;
      const maxPages = 50;
      let cursor: string | null = null;
      const rows: ReviewRow[] = [];
      for (let i = 0; i < maxPages; i++) {
        const url = new URL(`/api/dashboard/admin/course-students/${encodeURIComponent(selectedStudent.id)}/reviews`, window.location.origin);
        url.searchParams.set('limit', String(limit));
        if (reviewsSearch.trim()) url.searchParams.set('q', reviewsSearch.trim());
        if (reviewsFromDate) url.searchParams.set('from', toIsoStart(reviewsFromDate));
        if (reviewsToDate) url.searchParams.set('to', toIsoEnd(reviewsToDate));
        if (cursor) url.searchParams.set('cursor', cursor);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal export reviews');
        const list = Array.isArray(data?.reviews) ? data.reviews : [];
        rows.push(
          ...list.map((r: any) => ({
            id: String(r.id),
            rating: Number(r.rating) || 0,
            comment: typeof r.comment === 'string' ? r.comment : null,
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
            course: { id: String(r.course?.id || ''), title: String(r.course?.title || ''), slug: String(r.course?.slug || '') },
          }))
        );
        cursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
        if (!cursor) break;
      }
      const lines = [
        ['reviewId', 'courseTitle', 'courseSlug', 'rating', 'createdAt', 'comment'].map(escapeCsv).join(','),
        ...rows.map((r) => [r.id, r.course.title, r.course.slug, r.rating, r.createdAt, r.comment ?? ''].map(escapeCsv).join(',')),
      ];
      downloadCsv({ filename: `student-${selectedStudent.id}-reviews.csv`, csv: lines.join('\n') });
    } catch (e: any) {
      setReviewsError(e?.message || 'Gagal export reviews');
    } finally {
      setIsExportingReviews(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Students</h1>
          <p className="text-slate-500 text-sm mt-1">Daftar siswa dari semua kursus.</p>
        </div>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari siswa / email / kursus..."
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between lg:justify-end">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium"
          >
            <option value="ALL">Semua Kursus</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={isAllVisibleStudentsSelected}
                onChange={toggleAllVisibleStudents}
                disabled={visibleStudentIds.length === 0 || isBulkUnenrolling}
              />
              Pilih semua
            </label>
            <div className="text-xs text-slate-500 font-medium">
              {selectedStudentIds.length
                ? `${selectedStudentIds.length} dipilih`
                : `${Math.min(pagedStudents.length, filteredStudents.length)}/${filteredStudents.length} ditampilkan`}
            </div>
            <button
              type="button"
              onClick={bulkUnenrollSelectedStudents}
              disabled={selectedStudentIds.length === 0 || isBulkUnenrolling || courseFilter === 'ALL'}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Pendaftaran
            </button>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        {filteredStudents.length > 0 ? (
          <Table columns={columns} data={pagedStudents} isLoading={false} />
        ) : (
          <EmptyState
            icon={Users}
            title="Tidak ada siswa ditemukan"
            description={searchQuery ? `Tidak ada hasil untuk pencarian \"${searchQuery}\"` : 'Belum ada data siswa.'}
          />
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filteredStudents.length === 0 ? (
          <EmptyState icon={Users} title="Tidak ada siswa" description="Belum ada data siswa untuk ditampilkan." />
        ) : (
          pagedStudents.map((s) => (
            <div key={s.id} className="w-full text-left bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 mt-1"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={() => toggleStudentSelection(s.id)}
                    disabled={isBulkUnenrolling}
                    aria-label={`Pilih siswa ${s.name}`}
                  />
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                      {(s.name || s.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{s.name}</div>
                      <div className="text-xs text-slate-500 truncate">{s.email}</div>
                    </div>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {s.totalCourses}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <div className="text-slate-500 font-bold">Daftar</div>
                  <div className="text-slate-700">{formatDate(s.registeredAt)}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold">Terakhir Enroll</div>
                  <div className="text-slate-700">{formatDateTime(s.lastEnrolledAt)}</div>
                </div>
              </div>
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => openStudentDetail(s, 'courses')}
                  className="text-xs font-extrabold text-slate-700 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (courseFilter === 'ALL') {
                      toast.info('Pilih kursus dulu untuk menghapus pendaftaran.');
                      return;
                    }
                    void unenrollStudentFromSelectedCourse(s);
                  }}
                  disabled={isBulkUnenrolling}
                  className={twMerge(
                    'text-xs font-extrabold px-3 py-2 rounded-xl border disabled:opacity-60 inline-flex items-center gap-2',
                    courseFilter === 'ALL'
                      ? 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                      : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {pagedStudents.length < filteredStudents.length ? (
        <div className="flex items-center justify-center pt-2">
          <button
            type="button"
            onClick={() => setListLimit((prev) => prev + pageSize)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
          >
            Muat lebih banyak
          </button>
        </div>
      ) : null}

      {selectedStudent ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeDetail();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-extrabold text-base shrink-0">
                  {(selectedStudent.name || selectedStudent.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-slate-500">Detail Siswa</div>
                  <div className="text-lg font-extrabold text-slate-900 truncate">{selectedStudent.name}</div>
                  <div className="text-sm text-slate-600 truncate">{selectedStudent.email}</div>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <div className="px-1 text-xs font-extrabold text-slate-500 select-none">Profile Siswa</div>
                <button onClick={closeDetail} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isLoadingDetail ? (
              <div className="p-10 flex items-center justify-center text-slate-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Memuat detail siswa...
              </div>
            ) : detailError ? (
              <div className="p-6">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 font-semibold text-sm">
                  {detailError}
                </div>
              </div>
            ) : !detail ? (
              <div className="p-6 text-slate-600 text-sm">Detail tidak tersedia.</div>
            ) : (
              <>
                <div className="px-4 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => goDetailTab('courses')}
                      className={twMerge(
                        'px-3 py-2 rounded-xl text-xs font-extrabold',
                        detailTab === 'courses' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Courses
                    </button>
                    <button
                      onClick={() => goDetailTab('attempts')}
                      className={twMerge(
                        'px-3 py-2 rounded-xl text-xs font-extrabold',
                        detailTab === 'attempts' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Quiz Attempts
                    </button>
                    <button
                      onClick={() => goDetailTab('submissions')}
                      className={twMerge(
                        'px-3 py-2 rounded-xl text-xs font-extrabold',
                        detailTab === 'submissions' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Assignment Submissions
                    </button>
                    <button
                      onClick={() => goDetailTab('qa')}
                      className={twMerge(
                        'px-3 py-2 rounded-xl text-xs font-extrabold',
                        detailTab === 'qa' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Q&amp;A
                    </button>
                    <button
                      onClick={() => goDetailTab('reviews')}
                      className={twMerge(
                        'px-3 py-2 rounded-xl text-xs font-extrabold',
                        detailTab === 'reviews' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Reviews
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Enrolled Courses</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.enrolledCourses}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Completed Courses</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.completedCourses}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">In Progress Courses</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.inProgressCourses}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Reviews Placed</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.reviewsPlaced}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Total Lessons</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.totalLessons}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Selesai {detail.totals.completedLessons}/{detail.totals.totalLessons}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Quizzes Taken</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.quizzesTaken}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Total {detail.totals.totalQuizzes}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Assignments</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.assignmentsSubmitted}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Total {detail.totals.totalAssignments}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Questions</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{detail.totals.questions}</div>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  {detailTab === 'courses' ? (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">Kursus</div>
                          <div className="text-xs text-slate-500 mt-1">Terdaftar: {formatDate(detail.student.registeredAt)}</div>
                        </div>
                        <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {detail.courses.length}
                        </span>
                      </div>
                      {detail.courses.length === 0 ? (
                        <div className="p-6 text-sm text-slate-600">Siswa ini belum memiliki enrollment.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr className="text-left text-slate-600">
                                <th className="px-4 py-3 font-extrabold">Course</th>
                                <th className="px-4 py-3 font-extrabold">Enroll Date</th>
                                <th className="px-4 py-3 font-extrabold">Lesson</th>
                                <th className="px-4 py-3 font-extrabold">Quiz</th>
                                <th className="px-4 py-3 font-extrabold">Assignment</th>
                                <th className="px-4 py-3 font-extrabold">Progress</th>
                                <th className="px-4 py-3 font-extrabold">Status</th>
                                <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {detail.courses.map((r) => (
                                <tr key={r.course.id} className="text-slate-700">
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{r.course.title}</div>
                                    <div className="text-xs text-slate-500">{r.course.slug}</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.enrolledAt)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {r.lessons.completed}/{r.lessons.total}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="font-bold text-slate-900">
                                      {r.quizzes.passed}/{r.quizzes.attempted}
                                    </div>
                                    <div className="text-xs text-slate-500">Total {r.quizzes.total} • Avg {r.quizzes.bestAvg}%</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="font-bold text-slate-900">
                                      {r.assignments.passed}/{r.assignments.graded}
                                    </div>
                                    <div className="text-xs text-slate-500">Total {r.assignments.total} • Avg {r.assignments.bestAvg}%</div>
                                  </td>
                                  <td className="px-4 py-3 min-w-48">
                                    <div className="flex items-center gap-3">
                                      <div className="h-2 w-32 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                        <div
                                          className="h-full bg-indigo-600"
                                          style={{ width: `${Math.max(0, Math.min(100, r.progressPercent))}%` }}
                                        />
                                      </div>
                                      <div className="text-xs font-extrabold text-slate-700">{formatPercent(r.progressPercent)}</div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {r.lessons.total > 0 && r.progressPercent === 100 ? (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Completed
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                        In Progress
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Link
                                      href={`/dashboard/admin/courses/${r.course.id}`}
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                                    >
                                      <Eye className="w-4 h-4" />
                                      Buka
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : detailTab === 'attempts' ? (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b border-slate-200 space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
                          <input
                            value={attemptsSearch}
                            onChange={(e) => setAttemptsSearch(e.target.value)}
                            placeholder="Cari quiz / course..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                          />
                          <select
                            value={attemptsStatus}
                            onChange={(e) => setAttemptsStatus(e.target.value as any)}
                            className="w-full lg:w-56 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                          >
                            <option value="ALL">Semua</option>
                            <option value="PASSED">PASSED</option>
                            <option value="FAILED">FAILED</option>
                            <option value="INCOMPLETE">INCOMPLETE</option>
                          </select>
                          <button
                            onClick={() => fetchAttempts({ reset: true })}
                            disabled={isLoadingAttempts}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isLoadingAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Terapkan
                          </button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Dari</div>
                              <input
                                type="date"
                                value={attemptsFromDate}
                                onChange={(e) => setAttemptsFromDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Sampai</div>
                              <input
                                type="date"
                                value={attemptsToDate}
                                onChange={(e) => setAttemptsToDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:items-end">
                            <button
                              onClick={exportAttemptsCsv}
                              disabled={isExportingAttempts}
                              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center"
                            >
                              {isExportingAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Export CSV
                            </button>
                            <button
                              onClick={bulkResetAttempts}
                              disabled={selectedAttemptIds.length === 0 || isBulkResettingAttempts}
                              className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-sm hover:bg-rose-100 disabled:opacity-60 inline-flex items-center justify-center"
                            >
                              {isBulkResettingAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                              Reset Terpilih ({selectedAttemptIds.length})
                            </button>
                          </div>
                        </div>
                      </div>
                      {attemptsError ? <div className="p-6 text-sm text-rose-700">{attemptsError}</div> : null}
                      {attempts.length === 0 && !isLoadingAttempts ? (
                        <div className="p-6 text-sm text-slate-600">Tidak ada quiz attempts.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr className="text-left text-slate-600">
                                <th className="px-4 py-3 font-extrabold w-10">
                                  <input
                                    type="checkbox"
                                    checked={isAllAttemptsSelected}
                                    onChange={toggleAllAttemptsSelection}
                                    disabled={attempts.length === 0 || isBulkResettingAttempts}
                                    className="h-4 w-4 rounded border-slate-300"
                                    aria-label="Pilih semua attempt"
                                  />
                                </th>
                                <th className="px-4 py-3 font-extrabold">Course</th>
                                <th className="px-4 py-3 font-extrabold">Quiz</th>
                                <th className="px-4 py-3 font-extrabold">Skor</th>
                                <th className="px-4 py-3 font-extrabold">Waktu</th>
                                <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {attempts.map((a) => (
                                <tr key={a.id} className="text-slate-700">
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedAttemptIds.includes(a.id)}
                                      onChange={() => toggleAttemptSelection(a.id)}
                                      disabled={isBulkResettingAttempts}
                                      className="h-4 w-4 rounded border-slate-300"
                                      aria-label={`Pilih attempt ${a.quiz.lessonTitle}`}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{a.course.title}</div>
                                    <div className="text-xs text-slate-500">{a.course.slug}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{a.quiz.lessonTitle}</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span
                                      className={twMerge(
                                        'inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border',
                                        a.completedAt
                                          ? a.passed
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                      )}
                                    >
                                      {a.completedAt ? `${a.score}% (≥ ${a.quiz.passingGrade})` : 'INCOMPLETE'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(a.completedAt || a.startedAt)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        onClick={() => openAttemptDetail(a.id)}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                                      >
                                        <Eye className="w-4 h-4" />
                                        Detail
                                      </button>
                                      <button
                                        onClick={() => resetAttempt(a.id)}
                                        disabled={resettingAttemptId === a.id}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 disabled:opacity-60"
                                      >
                                        {resettingAttemptId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                        Reset
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="p-3 border-t border-slate-200 flex items-center justify-end">
                        <button
                          onClick={() => fetchAttempts({ reset: false })}
                          disabled={!attemptsNextCursor || isLoadingAttempts}
                          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                        >
                          {isLoadingAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Muat lebih banyak
                        </button>
                      </div>
                    </div>
                  ) : detailTab === 'submissions' ? (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b border-slate-200 space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
                          <input
                            value={submissionsSearch}
                            onChange={(e) => setSubmissionsSearch(e.target.value)}
                            placeholder="Cari tugas / course..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                          />
                          <select
                            value={submissionsStatus}
                            onChange={(e) => setSubmissionsStatus(e.target.value as any)}
                            className="w-full lg:w-56 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                          >
                            <option value="ALL">Semua</option>
                            <option value="PENDING">PENDING</option>
                            <option value="GRADED">GRADED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                          <button
                            onClick={() => fetchSubmissions({ reset: true })}
                            disabled={isLoadingSubmissions}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isLoadingSubmissions ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Terapkan
                          </button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Dari</div>
                              <input
                                type="date"
                                value={submissionsFromDate}
                                onChange={(e) => setSubmissionsFromDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Sampai</div>
                              <input
                                type="date"
                                value={submissionsToDate}
                                onChange={(e) => setSubmissionsToDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                          </div>
                          <button
                            onClick={exportSubmissionsCsv}
                            disabled={isExportingSubmissions}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isExportingSubmissions ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Export CSV
                          </button>
                        </div>
                      </div>
                      {submissionsError ? <div className="p-6 text-sm text-rose-700">{submissionsError}</div> : null}
                      {submissions.length === 0 && !isLoadingSubmissions ? (
                        <div className="p-6 text-sm text-slate-600">Tidak ada assignment submissions.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr className="text-left text-slate-600">
                                <th className="px-4 py-3 font-extrabold">Course</th>
                                <th className="px-4 py-3 font-extrabold">Tugas</th>
                                <th className="px-4 py-3 font-extrabold">Status</th>
                                <th className="px-4 py-3 font-extrabold">Submit</th>
                                <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {submissions.map((s) => (
                                <tr key={s.id} className="text-slate-700">
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{s.course.title}</div>
                                    <div className="text-xs text-slate-500">{s.course.slug}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{s.assignment.lessonTitle}</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                      {s.status}
                                      {typeof s.grade === 'number' ? ` • ${s.grade}` : ''}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.submittedAt)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <a
                                        href={s.downloadUrl}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                                      >
                                        <Download className="w-4 h-4" />
                                        Download
                                      </a>
                                      <button
                                        onClick={() => openGradeModal(s)}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700"
                                      >
                                        <Check className="w-4 h-4" />
                                        Nilai
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="p-3 border-t border-slate-200 flex items-center justify-end">
                        <button
                          onClick={() => fetchSubmissions({ reset: false })}
                          disabled={!submissionsNextCursor || isLoadingSubmissions}
                          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                        >
                          {isLoadingSubmissions ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Muat lebih banyak
                        </button>
                      </div>
                    </div>
                  ) : detailTab === 'qa' ? (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b border-slate-200 space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
                          <input
                            value={qaSearch}
                            onChange={(e) => setQaSearch(e.target.value)}
                            placeholder="Cari judul / course..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                          />
                          <select
                            value={qaStatus}
                            onChange={(e) => setQaStatus(e.target.value as any)}
                            className="w-full lg:w-56 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                          >
                            <option value="ALL">Semua</option>
                            <option value="OPEN">OPEN</option>
                            <option value="RESOLVED">RESOLVED</option>
                          </select>
                          <button
                            onClick={() => fetchQa({ reset: true })}
                            disabled={isLoadingQa}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isLoadingQa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Terapkan
                          </button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Dari</div>
                              <input
                                type="date"
                                value={qaFromDate}
                                onChange={(e) => setQaFromDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Sampai</div>
                              <input
                                type="date"
                                value={qaToDate}
                                onChange={(e) => setQaToDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                          </div>
                          <button
                            onClick={exportQaCsv}
                            disabled={isExportingQa}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isExportingQa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Export CSV
                          </button>
                        </div>
                      </div>
                      {qaError ? <div className="p-6 text-sm text-rose-700">{qaError}</div> : null}
                      {qaThreads.length === 0 && !isLoadingQa ? (
                        <div className="p-6 text-sm text-slate-600">Tidak ada Q&amp;A.</div>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {qaThreads.map((t) => (
                            <div key={t.id} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900 truncate">{t.title}</div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {t.course.title}
                                    {t.lesson ? ` • ${t.lesson.title}` : ''}
                                  </div>
                                  <div className="text-sm text-slate-700 mt-2">{t.question}</div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-flex">
                                    {t.status}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-2">{formatDateTime(t.createdAt)}</div>
                                  <div className="text-xs text-slate-500 mt-1">{t.repliesCount} balasan</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-3 border-t border-slate-200 flex items-center justify-end">
                        <button
                          onClick={() => fetchQa({ reset: false })}
                          disabled={!qaNextCursor || isLoadingQa}
                          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                        >
                          {isLoadingQa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Muat lebih banyak
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b border-slate-200 space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                          <input
                            value={reviewsSearch}
                            onChange={(e) => setReviewsSearch(e.target.value)}
                            placeholder="Cari course / komentar..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                          />
                          <button
                            onClick={() => fetchReviews({ reset: true })}
                            disabled={isLoadingReviews}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isLoadingReviews ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Terapkan
                          </button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Dari</div>
                              <input
                                type="date"
                                value={reviewsFromDate}
                                onChange={(e) => setReviewsFromDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-700 mb-1">Sampai</div>
                              <input
                                type="date"
                                value={reviewsToDate}
                                onChange={(e) => setReviewsToDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                              />
                            </div>
                          </div>
                          <button
                            onClick={exportReviewsCsv}
                            disabled={isExportingReviews}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center"
                          >
                            {isExportingReviews ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Export CSV
                          </button>
                        </div>
                      </div>
                      {reviewsError ? <div className="p-6 text-sm text-rose-700">{reviewsError}</div> : null}
                      {reviews.length === 0 && !isLoadingReviews ? (
                        <div className="p-6 text-sm text-slate-600">Tidak ada reviews.</div>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {reviews.map((r) => (
                            <div key={r.id} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900 truncate">{r.course.title}</div>
                                  <div className="text-xs text-slate-500 mt-1">{formatDateTime(r.createdAt)}</div>
                                  <div className="text-sm text-slate-700 mt-2">{r.comment || '-'}</div>
                                </div>
                                <div className="shrink-0">
                                  <div className="text-xs font-extrabold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex">
                                    {r.rating}/5
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-3 border-t border-slate-200 flex items-center justify-end">
                        <button
                          onClick={() => fetchReviews({ reset: false })}
                          disabled={!reviewsNextCursor || isLoadingReviews}
                          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                        >
                          {isLoadingReviews ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Muat lebih banyak
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedStudent && attemptDetailOpen ? (
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
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-500">Attempt Detail</div>
                <div className="text-lg font-extrabold text-slate-900 truncate">{attemptDetail?.quiz.lessonTitle || 'Quiz'}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {attemptDetailId ? (
                  <button
                    onClick={() => resetAttempt(attemptDetailId)}
                    disabled={resettingAttemptId === attemptDetailId}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
                  >
                    {resettingAttemptId === attemptDetailId ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Reset
                  </button>
                ) : null}
                <button onClick={closeAttemptDetail} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isLoadingAttemptDetail ? (
              <div className="p-10 flex items-center justify-center text-slate-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Memuat detail attempt...
              </div>
            ) : attemptDetailError ? (
              <div className="p-6">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 font-semibold text-sm">
                  {attemptDetailError}
                </div>
              </div>
            ) : !attemptDetail ? (
              <div className="p-6 text-slate-600 text-sm">Detail attempt tidak tersedia.</div>
            ) : (
              <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Skor</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{attemptDetail.score}%</div>
                    <div className="text-xs text-slate-500 mt-1">Passing ≥ {attemptDetail.passingGrade}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Status</div>
                    <div className="mt-2">
                      {attemptDetail.completedAt ? (
                        attemptDetail.passed ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            PASSED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                            FAILED
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                          INCOMPLETE
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">Waktu</div>
                    <div className="text-sm text-slate-700 mt-2">
                      <div>Mulai: {formatDateTime(attemptDetail.startedAt)}</div>
                      <div>Selesai: {formatDateTime(attemptDetail.completedAt)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                    <div className="text-sm font-extrabold text-slate-900">Jawaban</div>
                    <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {attemptDetail.questions.length}
                    </span>
                  </div>
                  {attemptDetail.questions.length === 0 ? (
                    <div className="p-6 text-sm text-slate-600">Tidak ada pertanyaan.</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {attemptDetail.questions
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((q) => (
                          <div key={q.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-slate-500">
                                  Q{q.order} • {q.points} poin
                                </div>
                                <div className="font-extrabold text-slate-900 mt-1">{q.text}</div>
                              </div>
                              <div className="shrink-0">
                                {q.isCorrect ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Benar
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                    Salah
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-extrabold text-slate-600">Jawaban Siswa</div>
                                <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">
                                  {q.submittedText.length > 0 ? q.submittedText.join('\n') : '-'}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                <div className="text-xs font-extrabold text-slate-600">Jawaban Benar</div>
                                <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">
                                  {q.correctText.length > 0 ? q.correctText.join('\n') : '-'}
                                </div>
                              </div>
                            </div>

                            {q.explanation ? (
                              <div className="rounded-2xl border border-slate-200 bg-white p-3 mt-3">
                                <div className="text-xs font-extrabold text-slate-600">Penjelasan</div>
                                <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{q.explanation}</div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedStudent && gradeModalOpen ? (
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
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-500">Penilaian Tugas</div>
                <div className="text-lg font-extrabold text-slate-900 truncate">{gradingSubmission?.assignment.lessonTitle || 'Tugas'}</div>
                <div className="text-xs text-slate-500 mt-1 truncate">{gradingSubmission?.course.title || ''}</div>
              </div>
              <button onClick={closeGradeModal} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!gradingSubmission ? (
              <div className="p-6 text-slate-600 text-sm">Submission tidak tersedia.</div>
            ) : (
              <div className="p-4 space-y-4">
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

                {gradingSubmission.notes ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-extrabold text-slate-600">Catatan Siswa</div>
                    <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{gradingSubmission.notes}</div>
                  </div>
                ) : null}

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
                    disabled={isGradingSubmission}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isGradingSubmission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
