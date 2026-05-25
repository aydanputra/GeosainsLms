"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Cards from '../../components/Cards';
import { SimpleBarChart, SimpleLineChart, SimpleAreaChart } from '../../components/Charts';
import Table from '../../components/Tables';
import { toast } from 'sonner';
import { Calendar, Download, Eye, FileText, GraduationCap, Loader2, RotateCcw, Users, X } from 'lucide-react';

type CourseOption = { id: string; title: string; slug: string; status: string };

type AdminReportsMode = 'reports' | 'gradebook' | 'evaluations';
type AdminReportsProps = { mode?: AdminReportsMode };

type AnalyticsResponse = {
  range: '7d' | '30d' | '90d';
  from: string;
  to: string;
  totals: { pageviews: number; uniqueSessions: number; newUsers: number; newStudents: number; pagesPerSession: number };
  previousTotals: { pageviews: number; uniqueSessions: number; newUsers: number; newStudents: number; pagesPerSession: number };
  daily: Array<{ day: string; pageviews: number; sessions: number }>;
  topCourses: Array<{ id: string; title: string; slug: string; views: number }>;
  topCategories: Array<{ id: string; name: string; slug: string; views: number }>;
  topReferrers: Array<{ host: string; views: number }>;
  topPages: Array<{ path: string; views: number }>;
  landingPages: Array<{ path: string; sessions: number }>;
  utmSources: Array<{ value: string; views: number }>;
  utmMediums: Array<{ value: string; views: number }>;
  utmCampaigns: Array<{ value: string; views: number }>;
  topProducts: Array<{ id: string; name: string; slug: string | null; views: number; vendor: { id: string; name: string; slug: string } | null }>;
  topVendors: Array<{ id: string; name: string; slug: string; views: number }>;
  topMentors: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    courseViews: number;
    vendorViews: number;
    totalViews: number;
    students: number;
  }>;
};

type GradebookRow = {
  userId: string;
  name: string;
  email: string;
  enrolledAt: string;
  progressPercent: number;
  quizTotal: number;
  quizAttempted: number;
  quizPassed: number;
  quizBestAvg: number;
  assignmentTotal: number;
  assignmentGraded: number;
  assignmentPassed: number;
  assignmentBestAvg: number;
};

type QuizAttemptRow = {
  id: string;
  score: number;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
  quiz: { id: string; lessonTitle: string; passingGrade: number; lessonId: string | null };
};

type InboxAttemptRow = QuizAttemptRow & {
  student: { id: string; name: string; email: string };
};

type AttemptDetail = {
  id: string;
  score: number;
  passed: boolean;
  passingGrade: number;
  startedAt: string;
  completedAt: string | null;
  quiz: { id: string; lessonTitle: string; lessonId: string | null };
  questions: Array<{
    id: string;
    order: number;
    text: string;
    type: string;
    points: number;
    explanation: string | null;
    submitted: number[];
    submittedText: string[];
    correct: number[];
    correctText: string[];
    isCorrect: boolean;
  }>;
};

type SubmissionRow = {
  id: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  notes: string | null;
  submittedAt: string;
  gradedAt: string | null;
  downloadUrl: string;
  assignment: { id: string; lessonTitle: string; passingGrade: number; lessonId: string | null };
};

type InboxSubmissionRow = SubmissionRow & {
  student: { id: string; name: string; email: string };
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function toCsv(rows: GradebookRow[]) {
  const headers = [
    'Nama',
    'Email',
    'Enrolled',
    'ProgressPercent',
    'QuizPassed',
    'QuizTotal',
    'QuizAttempted',
    'QuizBestAvg',
    'AssignmentPassed',
    'AssignmentTotal',
    'AssignmentGraded',
    'AssignmentBestAvg',
  ];
  const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.name,
        r.email,
        r.enrolledAt,
        r.progressPercent,
        r.quizPassed,
        r.quizTotal,
        r.quizAttempted,
        r.quizBestAvg,
        r.assignmentPassed,
        r.assignmentTotal,
        r.assignmentGraded,
        r.assignmentBestAvg,
      ]
        .map(escape)
        .join(',')
    ),
  ];
  return lines.join('\n');
}

export default function AdminReports({ mode = 'reports' }: AdminReportsProps) {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [rows, setRows] = useState<GradebookRow[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingGradebook, setIsLoadingGradebook] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<InboxSubmissionRow[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<InboxAttemptRow[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [submissionsNextCursor, setSubmissionsNextCursor] = useState<string | null>(null);
  const [attemptsNextCursor, setAttemptsNextCursor] = useState<string | null>(null);
  const [submissionsPageCursors, setSubmissionsPageCursors] = useState<(string | null)[]>([null]);
  const [submissionsPageIndex, setSubmissionsPageIndex] = useState(0);
  const [attemptsPageCursors, setAttemptsPageCursors] = useState<(string | null)[]>([null]);
  const [attemptsPageIndex, setAttemptsPageIndex] = useState(0);
  const [isLoadingMoreSubmissions, setIsLoadingMoreSubmissions] = useState(false);
  const [isLoadingMoreAttempts, setIsLoadingMoreAttempts] = useState(false);
  const [assignmentPendingOnly, setAssignmentPendingOnly] = useState(true);
  const [quizFailedOnly, setQuizFailedOnly] = useState(true);
  const [includeIncompleteAttempts, setIncludeIncompleteAttempts] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
  const [evaluationListMode, setEvaluationListMode] = useState<'INBOX' | 'ALL'>('INBOX');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'ALL' | 'PENDING' | 'GRADED' | 'REJECTED'>('ALL');
  const [quizStatusFilter, setQuizStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'INCOMPLETE'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [bulkGradeValue, setBulkGradeValue] = useState<string>('');
  const [bulkFeedbackValue, setBulkFeedbackValue] = useState<string>('');
  const [isBulkGrading, setIsBulkGrading] = useState(false);
  const [isBulkResettingAttempts, setIsBulkResettingAttempts] = useState(false);

  const [analyticsRange, setAnalyticsRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId]);

  useEffect(() => {
    if (mode !== 'evaluations') return;
    const q = (searchParams.get('q') || '').trim();
    if (!q) return;
    setInboxSearch((prev) => (prev ? prev : q));
  }, [mode, searchParams]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'quiz' | 'assignment'>('quiz');
  const [selectedStudent, setSelectedStudent] = useState<GradebookRow | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);
  const [isLoadingAttemptDetail, setIsLoadingAttemptDetail] = useState(false);

  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionRow | null>(null);
  const [gradingGrade, setGradingGrade] = useState<string>('');
  const [gradingStatus, setGradingStatus] = useState<'GRADED' | 'REJECTED'>('GRADED');
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isGrading, setIsGrading] = useState(false);
  const [isExportingSubmissions, setIsExportingSubmissions] = useState(false);
  const [isExportingAttempts, setIsExportingAttempts] = useState(false);

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);
    try {
      const res = await fetch('/api/reports/gradebook', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat daftar kursus');
      const list = Array.isArray(data?.courses) ? data.courses : [];
      const normalized = list.map((c: any) => ({
        id: String(c.id),
        title: String(c.title || ''),
        slug: String(c.slug || ''),
        status: String(c.status || ''),
      }));
      setCourses(normalized);
      if (normalized.length) setCourseId((prev) => prev || normalized[0].id);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat daftar kursus');
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/analytics/pageview?range=${encodeURIComponent(analyticsRange)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as AnalyticsResponse | null;
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal memuat analytics');
      if (!data) throw new Error('Gagal memuat analytics');
      setAnalytics(data);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat analytics');
      setAnalytics(null);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [analyticsRange]);

  const loadGradebook = useCallback(async (id: string) => {
    if (!id) return;
    setIsLoadingGradebook(true);
    try {
      const res = await fetch(`/api/reports/gradebook?courseId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat gradebook');
      const list = Array.isArray(data?.rows) ? data.rows : [];
      setRows(
        list.map((r: any) => ({
          userId: String(r.userId),
          name: String(r.name || ''),
          email: String(r.email || ''),
          enrolledAt: typeof r.enrolledAt === 'string' ? r.enrolledAt : new Date(r.enrolledAt).toISOString(),
          progressPercent: Number(r.progressPercent) || 0,
          quizTotal: Number(r.quizTotal) || 0,
          quizAttempted: Number(r.quizAttempted) || 0,
          quizPassed: Number(r.quizPassed) || 0,
          quizBestAvg: Number(r.quizBestAvg) || 0,
          assignmentTotal: Number(r.assignmentTotal) || 0,
          assignmentGraded: Number(r.assignmentGraded) || 0,
          assignmentPassed: Number(r.assignmentPassed) || 0,
          assignmentBestAvg: Number(r.assignmentBestAvg) || 0,
        }))
      );
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat gradebook');
    } finally {
      setIsLoadingGradebook(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'reports') return;
    loadCourses();
  }, [mode, loadCourses]);

  useEffect(() => {
    if (mode !== 'reports') return;
    loadAnalytics();
  }, [mode, loadAnalytics]);

  useEffect(() => {
    if (mode !== 'gradebook') return;
    if (courseId) loadGradebook(courseId);
  }, [mode, courseId, loadGradebook]);

  const makeStudentRow = (student: { id: string; name: string; email: string }): GradebookRow => ({
    userId: student.id,
    name: student.name,
    email: student.email,
    enrolledAt: new Date().toISOString(),
    progressPercent: 0,
    quizTotal: 0,
    quizAttempted: 0,
    quizPassed: 0,
    quizBestAvg: 0,
    assignmentTotal: 0,
    assignmentGraded: 0,
    assignmentPassed: 0,
    assignmentBestAvg: 0,
  });

  const buildSubmissionsQuery = useCallback(
    (args: { courseId: string; cursor?: string | null }) => {
      const params = new URLSearchParams({ courseId: args.courseId });
      params.set('limit', mode === 'gradebook' ? '20' : '20');
      if (args.cursor) params.set('cursor', args.cursor);
      if (mode === 'gradebook') {
        params.set('pendingOnly', '1');
      } else {
        if (inboxSearch.trim()) params.set('q', inboxSearch.trim());
        if (fromDate) params.set('from', new Date(`${fromDate}T00:00:00.000Z`).toISOString());
        if (toDate) params.set('to', new Date(`${toDate}T23:59:59.999Z`).toISOString());
        if (mode === 'evaluations' && evaluationListMode === 'ALL') {
          if (assignmentStatusFilter !== 'ALL') params.set('status', assignmentStatusFilter);
        } else {
          if (assignmentPendingOnly) params.set('pendingOnly', '1');
        }
      }
      return params.toString();
    },
    [assignmentPendingOnly, assignmentStatusFilter, evaluationListMode, fromDate, inboxSearch, mode, toDate]
  );

  const buildAttemptsQuery = useCallback(
    (args: { courseId: string; cursor?: string | null }) => {
      const params = new URLSearchParams({ courseId: args.courseId });
      params.set('limit', mode === 'gradebook' ? '20' : '20');
      if (args.cursor) params.set('cursor', args.cursor);

      if (mode === 'gradebook') {
        params.set('failedOnly', '1');
        params.set('limit', '20');
        return params.toString();
      }

      if (inboxSearch.trim()) params.set('q', inboxSearch.trim());
      if (fromDate) params.set('from', new Date(`${fromDate}T00:00:00.000Z`).toISOString());
      if (toDate) params.set('to', new Date(`${toDate}T23:59:59.999Z`).toISOString());

      if (mode === 'evaluations' && evaluationListMode === 'ALL') {
        params.set('status', quizStatusFilter);
      } else {
        if (includeIncompleteAttempts && quizFailedOnly) {
          params.set('includeIncomplete', '1');
          params.set('failedOnly', '1');
          params.set('status', 'ALL');
        } else if (includeIncompleteAttempts && !quizFailedOnly) {
          params.set('includeIncomplete', '1');
          params.set('status', 'ALL');
        } else if (!includeIncompleteAttempts && quizFailedOnly) {
          params.set('status', 'FAILED');
        } else {
          params.set('status', 'ALL');
        }
      }

      return params.toString();
    },
    [evaluationListMode, fromDate, includeIncompleteAttempts, inboxSearch, mode, quizFailedOnly, quizStatusFilter, toDate]
  );

  const loadInbox = useCallback(async (id: string) => {
    if (!id) return;
    setIsLoadingInbox(true);
    try {
      setSubmissionsNextCursor(null);
      setAttemptsNextCursor(null);
      setSelectedSubmissionIds([]);
      setSelectedAttemptIds([]);
      setSubmissionsPageCursors([null]);
      setSubmissionsPageIndex(0);
      setAttemptsPageCursors([null]);
      setAttemptsPageIndex(0);

      const [subsRes, attemptsRes] = await Promise.all([
        fetch(`/api/reports/assignment-submissions?${buildSubmissionsQuery({ courseId: id })}`, { cache: 'no-store' }),
        fetch(`/api/reports/quiz-attempts?${buildAttemptsQuery({ courseId: id })}`, { cache: 'no-store' }),
      ]);

      const subsData = await subsRes.json().catch(() => null);
      const attemptsData = await attemptsRes.json().catch(() => null);

      if (!subsRes.ok) throw new Error(subsData?.error || 'Gagal memuat inbox tugas');
      if (!attemptsRes.ok) throw new Error(attemptsData?.error || 'Gagal memuat inbox quiz');

      const subsList = Array.isArray(subsData?.submissions) ? subsData.submissions : [];
      setSubmissionsNextCursor(typeof subsData?.nextCursor === 'string' ? subsData.nextCursor : null);
      setPendingSubmissions(
        subsList.map((s: any) => ({
          id: String(s.id),
          status: String(s.status || 'PENDING'),
          grade: typeof s.grade === 'number' ? s.grade : null,
          feedback: typeof s.feedback === 'string' ? s.feedback : null,
          notes: typeof s.notes === 'string' ? s.notes : null,
          submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
          gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
          downloadUrl: String(s.downloadUrl || ''),
          assignment: {
            id: String(s.assignment?.id || ''),
            lessonTitle: String(s.assignment?.lessonTitle || 'Tugas'),
            passingGrade: Number(s.assignment?.passingGrade) || 0,
            lessonId: s.assignment?.lessonId ? String(s.assignment.lessonId) : null,
          },
          student: {
            id: String(s.student?.id || ''),
            name: String(s.student?.name || s.student?.email || ''),
            email: String(s.student?.email || ''),
          },
        }))
      );

      const attemptsList = Array.isArray(attemptsData?.attempts) ? attemptsData.attempts : [];
      setAttemptsNextCursor(typeof attemptsData?.nextCursor === 'string' ? attemptsData.nextCursor : null);
      setFailedAttempts(
        attemptsList.map((a: any) => ({
          id: String(a.id),
          score: Number(a.score) || 0,
          passed: Boolean(a.passed),
          startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
          completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
          quiz: {
            id: String(a.quiz?.id || ''),
            lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
            passingGrade: Number(a.quiz?.passingGrade) || 80,
            lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
          },
          student: {
            id: String(a.student?.id || ''),
            name: String(a.student?.name || a.student?.email || ''),
            email: String(a.student?.email || ''),
          },
        }))
      );
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat inbox evaluasi');
      setPendingSubmissions([]);
      setFailedAttempts([]);
      setSubmissionsNextCursor(null);
      setAttemptsNextCursor(null);
    } finally {
      setIsLoadingInbox(false);
    }
  }, [buildAttemptsQuery, buildSubmissionsQuery]);

  const toggleSubmissionSelection = useCallback((id: string) => {
    setSelectedSubmissionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleAllSubmissions = useCallback(() => {
    const ids = pendingSubmissions.map((s) => s.id);
    setSelectedSubmissionIds((prev) => (prev.length === ids.length ? [] : ids));
  }, [pendingSubmissions]);

  const toggleAttemptSelection = useCallback((id: string) => {
    setSelectedAttemptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleAllAttempts = useCallback(() => {
    const ids = failedAttempts.map((a) => a.id);
    setSelectedAttemptIds((prev) => (prev.length === ids.length ? [] : ids));
  }, [failedAttempts]);

  const bulkResetSelectedAttempts = useCallback(async () => {
    if (isBulkResettingAttempts) return;
    if (!courseId) return;
    if (selectedAttemptIds.length === 0) return;
    const ok = window.confirm(
      `Reset ${selectedAttemptIds.length} attempt terpilih? Attempt akan dihapus dan progres quiz bisa ikut di-reset.`
    );
    if (!ok) return;
    setIsBulkResettingAttempts(true);
    const failed: string[] = [];
    try {
      for (const id of selectedAttemptIds) {
        try {
          const res = await fetch(`/api/quizzes/attempts/${encodeURIComponent(id)}`, { method: 'DELETE' });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || 'Gagal');
        } catch {
          failed.push(id);
        }
      }
      setAttemptDetail(null);
      await loadInbox(courseId);
      if (failed.length) {
        toast.error(`Sebagian gagal: ${failed.length}/${selectedAttemptIds.length}`);
      } else {
        toast.success('Attempt terpilih berhasil di-reset');
      }
    } finally {
      setIsBulkResettingAttempts(false);
    }
  }, [courseId, isBulkResettingAttempts, loadInbox, selectedAttemptIds]);

  const bulkRejectSelectedSubmissions = useCallback(async () => {
    if (isBulkRejecting) return;
    if (!courseId) return;
    if (selectedSubmissionIds.length === 0) return;
    const ok = window.confirm(`Reject ${selectedSubmissionIds.length} submission terpilih?`);
    if (!ok) return;
    setIsBulkRejecting(true);
    const failed: string[] = [];
    try {
      for (const id of selectedSubmissionIds) {
        try {
          const res = await fetch(`/api/assignments/submissions/${encodeURIComponent(id)}/grade`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'REJECTED' }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || 'Gagal');
        } catch {
          failed.push(id);
        }
      }
      await loadInbox(courseId);
      if (failed.length) {
        toast.error(`Sebagian gagal: ${failed.length}/${selectedSubmissionIds.length}`);
      } else {
        toast.success('Submission terpilih berhasil di-reject');
      }
    } finally {
      setIsBulkRejecting(false);
    }
  }, [courseId, isBulkRejecting, loadInbox, selectedSubmissionIds]);

  const bulkGradeSelectedSubmissions = useCallback(async () => {
    if (isBulkGrading) return;
    if (!courseId) return;
    if (selectedSubmissionIds.length === 0) return;

    const parsed = Number(bulkGradeValue);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error('Nilai bulk harus 0-100');
      return;
    }
    const grade = Math.round(parsed);
    const feedback = bulkFeedbackValue.trim();

    const ok = window.confirm(`Nilai ${selectedSubmissionIds.length} submission terpilih dengan nilai ${grade}?`);
    if (!ok) return;

    setIsBulkGrading(true);
    const failed: string[] = [];
    try {
      for (const id of selectedSubmissionIds) {
        try {
          const res = await fetch(`/api/assignments/submissions/${encodeURIComponent(id)}/grade`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'GRADED', grade, feedback: feedback || undefined }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || 'Gagal');
        } catch {
          failed.push(id);
        }
      }
      setBulkGradeValue('');
      setBulkFeedbackValue('');
      await loadInbox(courseId);
      if (failed.length) {
        toast.error(`Sebagian gagal: ${failed.length}/${selectedSubmissionIds.length}`);
      } else {
        toast.success('Submission terpilih berhasil dinilai');
      }
    } finally {
      setIsBulkGrading(false);
    }
  }, [bulkFeedbackValue, bulkGradeValue, courseId, isBulkGrading, loadInbox, selectedSubmissionIds]);

  const loadMoreSubmissions = useCallback(async () => {
    if (!courseId) return;
    if (!submissionsNextCursor) return;
    if (isLoadingMoreSubmissions) return;
    setIsLoadingMoreSubmissions(true);
    try {
      const res = await fetch(
        `/api/reports/assignment-submissions?${buildSubmissionsQuery({ courseId, cursor: submissionsNextCursor })}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat inbox tugas');
      const list = Array.isArray(data?.submissions) ? data.submissions : [];
      setSubmissionsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
      setPendingSubmissions((prev) => [
        ...prev,
        ...list.map((s: any) => ({
          id: String(s.id),
          status: String(s.status || 'PENDING'),
          grade: typeof s.grade === 'number' ? s.grade : null,
          feedback: typeof s.feedback === 'string' ? s.feedback : null,
          notes: typeof s.notes === 'string' ? s.notes : null,
          submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
          gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
          downloadUrl: String(s.downloadUrl || ''),
          assignment: {
            id: String(s.assignment?.id || ''),
            lessonTitle: String(s.assignment?.lessonTitle || 'Tugas'),
            passingGrade: Number(s.assignment?.passingGrade) || 0,
            lessonId: s.assignment?.lessonId ? String(s.assignment.lessonId) : null,
          },
          student: {
            id: String(s.student?.id || ''),
            name: String(s.student?.name || s.student?.email || ''),
            email: String(s.student?.email || ''),
          },
        })),
      ]);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat inbox tugas');
    } finally {
      setIsLoadingMoreSubmissions(false);
    }
  }, [buildSubmissionsQuery, courseId, isLoadingMoreSubmissions, submissionsNextCursor]);

  const loadMoreAttempts = useCallback(async () => {
    if (!courseId) return;
    if (!attemptsNextCursor) return;
    if (isLoadingMoreAttempts) return;
    setIsLoadingMoreAttempts(true);
    try {
      const res = await fetch(`/api/reports/quiz-attempts?${buildAttemptsQuery({ courseId, cursor: attemptsNextCursor })}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat inbox quiz');
      const list = Array.isArray(data?.attempts) ? data.attempts : [];
      setAttemptsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
      setFailedAttempts((prev) => [
        ...prev,
        ...list.map((a: any) => ({
          id: String(a.id),
          score: Number(a.score) || 0,
          passed: Boolean(a.passed),
          startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
          completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
          quiz: {
            id: String(a.quiz?.id || ''),
            lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
            passingGrade: Number(a.quiz?.passingGrade) || 80,
            lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
          },
          student: {
            id: String(a.student?.id || ''),
            name: String(a.student?.name || a.student?.email || ''),
            email: String(a.student?.email || ''),
          },
        })),
      ]);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat inbox quiz');
    } finally {
      setIsLoadingMoreAttempts(false);
    }
  }, [attemptsNextCursor, buildAttemptsQuery, courseId, isLoadingMoreAttempts]);

  const fetchSubmissionsPage = useCallback(
    async (cursor: string | null) => {
      if (!courseId) return false;
      if (isLoadingMoreSubmissions) return false;
      setIsLoadingMoreSubmissions(true);
      try {
        const res = await fetch(`/api/reports/assignment-submissions?${buildSubmissionsQuery({ courseId, cursor })}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat inbox tugas');
        const list = Array.isArray(data?.submissions) ? data.submissions : [];
        setSubmissionsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
        setPendingSubmissions(
          list.map((s: any) => ({
            id: String(s.id),
            status: String(s.status || 'PENDING'),
            grade: typeof s.grade === 'number' ? s.grade : null,
            feedback: typeof s.feedback === 'string' ? s.feedback : null,
            notes: typeof s.notes === 'string' ? s.notes : null,
            submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
            gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
            downloadUrl: String(s.downloadUrl || ''),
            assignment: {
              id: String(s.assignment?.id || ''),
              lessonTitle: String(s.assignment?.lessonTitle || 'Tugas'),
              passingGrade: Number(s.assignment?.passingGrade) || 0,
              lessonId: s.assignment?.lessonId ? String(s.assignment.lessonId) : null,
            },
            student: {
              id: String(s.student?.id || ''),
              name: String(s.student?.name || s.student?.email || ''),
              email: String(s.student?.email || ''),
            },
          }))
        );
        return true;
      } catch (e: any) {
        toast.error(e?.message || 'Gagal memuat inbox tugas');
        return false;
      } finally {
        setIsLoadingMoreSubmissions(false);
      }
    },
    [buildSubmissionsQuery, courseId, isLoadingMoreSubmissions]
  );

  const fetchAttemptsPage = useCallback(
    async (cursor: string | null) => {
      if (!courseId) return false;
      if (isLoadingMoreAttempts) return false;
      setIsLoadingMoreAttempts(true);
      try {
        const res = await fetch(`/api/reports/quiz-attempts?${buildAttemptsQuery({ courseId, cursor })}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat inbox quiz');
        const list = Array.isArray(data?.attempts) ? data.attempts : [];
        setAttemptsNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
        setFailedAttempts(
          list.map((a: any) => ({
            id: String(a.id),
            score: Number(a.score) || 0,
            passed: Boolean(a.passed),
            startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
            completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
            quiz: {
              id: String(a.quiz?.id || ''),
              lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
              passingGrade: Number(a.quiz?.passingGrade) || 80,
              lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
            },
            student: {
              id: String(a.student?.id || ''),
              name: String(a.student?.name || a.student?.email || ''),
              email: String(a.student?.email || ''),
            },
          }))
        );
        return true;
      } catch (e: any) {
        toast.error(e?.message || 'Gagal memuat inbox quiz');
        return false;
      } finally {
        setIsLoadingMoreAttempts(false);
      }
    },
    [buildAttemptsQuery, courseId, isLoadingMoreAttempts]
  );

  const goPrevSubmissionsPage = useCallback(async () => {
    if (submissionsPageIndex <= 0) return;
    const nextIndex = submissionsPageIndex - 1;
    const cursor = submissionsPageCursors[nextIndex] ?? null;
    setSelectedSubmissionIds([]);
    const ok = await fetchSubmissionsPage(cursor);
    if (ok) setSubmissionsPageIndex(nextIndex);
  }, [fetchSubmissionsPage, submissionsPageCursors, submissionsPageIndex]);

  const goNextSubmissionsPage = useCallback(async () => {
    const nextIndex = submissionsPageIndex + 1;
    const stored = submissionsPageCursors[nextIndex];
    const cursor = stored !== undefined ? stored : submissionsNextCursor;
    if (!cursor) return;
    setSelectedSubmissionIds([]);
    const ok = await fetchSubmissionsPage(cursor);
    if (!ok) return;
    if (stored === undefined) setSubmissionsPageCursors((prev) => [...prev, cursor]);
    setSubmissionsPageIndex(nextIndex);
  }, [fetchSubmissionsPage, submissionsNextCursor, submissionsPageCursors, submissionsPageIndex]);

  const goPrevAttemptsPage = useCallback(async () => {
    if (attemptsPageIndex <= 0) return;
    const nextIndex = attemptsPageIndex - 1;
    const cursor = attemptsPageCursors[nextIndex] ?? null;
    setSelectedAttemptIds([]);
    const ok = await fetchAttemptsPage(cursor);
    if (ok) setAttemptsPageIndex(nextIndex);
  }, [attemptsPageCursors, attemptsPageIndex, fetchAttemptsPage]);

  const goNextAttemptsPage = useCallback(async () => {
    const nextIndex = attemptsPageIndex + 1;
    const stored = attemptsPageCursors[nextIndex];
    const cursor = stored !== undefined ? stored : attemptsNextCursor;
    if (!cursor) return;
    setSelectedAttemptIds([]);
    const ok = await fetchAttemptsPage(cursor);
    if (!ok) return;
    if (stored === undefined) setAttemptsPageCursors((prev) => [...prev, cursor]);
    setAttemptsPageIndex(nextIndex);
  }, [attemptsNextCursor, attemptsPageCursors, attemptsPageIndex, fetchAttemptsPage]);

  const loadInboxRef = useRef(loadInbox);
  const evaluationsDidInitRef = useRef(false);
  useEffect(() => {
    loadInboxRef.current = loadInbox;
  }, [loadInbox]);

  useEffect(() => {
    if (mode === 'reports') return;
    if (courseId) loadInboxRef.current(courseId);
  }, [mode, courseId]);

  useEffect(() => {
    if (mode === 'gradebook') {
      setAssignmentPendingOnly(true);
      setQuizFailedOnly(true);
      setIncludeIncompleteAttempts(false);
      setInboxSearch('');
      setEvaluationListMode('INBOX');
      setAssignmentStatusFilter('ALL');
      setQuizStatusFilter('ALL');
      setFromDate('');
      setToDate('');
      setSubmissionsPageCursors([null]);
      setSubmissionsPageIndex(0);
      setAttemptsPageCursors([null]);
      setAttemptsPageIndex(0);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'evaluations') return;
    if (!courseId) return;
    if (!evaluationsDidInitRef.current) {
      evaluationsDidInitRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      loadInboxRef.current(courseId);
    }, 400);
    return () => clearTimeout(t);
  }, [
    assignmentPendingOnly,
    assignmentStatusFilter,
    courseId,
    evaluationListMode,
    fromDate,
    includeIncompleteAttempts,
    inboxSearch,
    mode,
    quizFailedOnly,
    quizStatusFilter,
    toDate,
  ]);

  const openAttemptFromInbox = async (attempt: InboxAttemptRow) => {
    if (!courseId) return;
    const row = makeStudentRow(attempt.student);
    setSelectedStudent(row);
    setDetailsTab('quiz');
    setAttemptDetail(null);
    setDetailsOpen(true);
    await loadDetails({ courseId, userId: row.userId });
    await viewAttemptDetail(attempt.id);
  };

  const loadDetails = useCallback(async (args: { courseId: string; userId: string }) => {
    setIsLoadingDetails(true);
    try {
      const [attemptsRes, submissionsRes] = await Promise.all([
        fetch(
          `/api/reports/quiz-attempts?courseId=${encodeURIComponent(args.courseId)}&userId=${encodeURIComponent(args.userId)}`,
          { cache: 'no-store' }
        ),
        fetch(
          `/api/reports/assignment-submissions?courseId=${encodeURIComponent(args.courseId)}&userId=${encodeURIComponent(args.userId)}`,
          { cache: 'no-store' }
        ),
      ]);

      const attemptsData = await attemptsRes.json().catch(() => null);
      const submissionsData = await submissionsRes.json().catch(() => null);

      if (!attemptsRes.ok) throw new Error(attemptsData?.error || 'Gagal memuat quiz attempts');
      if (!submissionsRes.ok) throw new Error(submissionsData?.error || 'Gagal memuat submission tugas');

      const attemptsList = Array.isArray(attemptsData?.attempts) ? attemptsData.attempts : [];
      setQuizAttempts(
        attemptsList.map((a: any) => ({
          id: String(a.id),
          score: Number(a.score) || 0,
          passed: Boolean(a.passed),
          startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
          completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
          quiz: {
            id: String(a.quiz?.id || ''),
            lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
            passingGrade: Number(a.quiz?.passingGrade) || 80,
            lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
          },
        }))
      );

      const submissionsList = Array.isArray(submissionsData?.submissions) ? submissionsData.submissions : [];
      setSubmissions(
        submissionsList.map((s: any) => ({
          id: String(s.id),
          status: String(s.status || 'PENDING'),
          grade: typeof s.grade === 'number' ? s.grade : null,
          feedback: typeof s.feedback === 'string' ? s.feedback : null,
          notes: typeof s.notes === 'string' ? s.notes : null,
          submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
          gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
          downloadUrl: String(s.downloadUrl || ''),
          assignment: {
            id: String(s.assignment?.id || ''),
            lessonTitle: String(s.assignment?.lessonTitle || 'Tugas'),
            passingGrade: Number(s.assignment?.passingGrade) || 0,
            lessonId: s.assignment?.lessonId ? String(s.assignment.lessonId) : null,
          },
        }))
      );
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat detail siswa');
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const openStudentDetails = async (row: GradebookRow, tab: 'quiz' | 'assignment') => {
    if (!courseId) return;
    setSelectedStudent(row);
    setDetailsTab(tab);
    setAttemptDetail(null);
    setDetailsOpen(true);
    await loadDetails({ courseId, userId: row.userId });
  };

  const closeStudentDetails = () => {
    setDetailsOpen(false);
    setSelectedStudent(null);
    setQuizAttempts([]);
    setSubmissions([]);
    setAttemptDetail(null);
    setGradeModalOpen(false);
    setGradingSubmission(null);
  };

  const viewAttemptDetail = async (attemptId: string) => {
    setIsLoadingAttemptDetail(true);
    setAttemptDetail(null);
    try {
      const res = await fetch(`/api/reports/quiz-attempts/${encodeURIComponent(attemptId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat detail attempt');
      const a = data?.attempt;
      setAttemptDetail({
        id: String(a.id),
        score: Number(a.score) || 0,
        passed: Boolean(a.passed),
        passingGrade: Number(a.passingGrade) || 80,
        startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
        completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
        quiz: {
          id: String(a.quiz?.id || ''),
          lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
          lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
        },
        questions: Array.isArray(a.questions) ? a.questions : [],
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat detail attempt');
    } finally {
      setIsLoadingAttemptDetail(false);
    }
  };

  const resetAttempt = async (attemptId: string) => {
    if (!courseId) return;
    const ok = window.confirm('Reset attempt ini? Attempt akan dihapus dan progres quiz bisa ikut di-reset.');
    if (!ok) return;
    try {
      const res = await fetch(`/api/quizzes/attempts/${encodeURIComponent(attemptId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal reset attempt');
      setAttemptDetail(null);
      await loadInbox(courseId);
      toast.success('Attempt di-reset');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal reset attempt');
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
    if (isGrading) return;
    setIsGrading(true);
    try {
      const res = await fetch(`/api/assignments/submissions/${encodeURIComponent(gradingSubmission.id)}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: gradingStatus,
          grade: gradingStatus === 'GRADED' ? gradingGrade : undefined,
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

      setGradeModalOpen(false);
      setGradingSubmission(null);
      if (mode !== 'reports' && courseId) {
        await Promise.all([
          loadInbox(courseId),
          detailsOpen && selectedStudent ? loadDetails({ courseId, userId: selectedStudent.userId }) : Promise.resolve(),
        ]);
      }
      toast.success('Penilaian tersimpan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan penilaian');
    } finally {
      setIsGrading(false);
    }
  };

  const exportGradebook = () => {
    if (!selectedCourse) return;
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gradebook-${selectedCourse.slug || selectedCourse.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const downloadCsv = (args: { filename: string; csv: string }) => {
    const blob = new Blob([args.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = args.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportEvaluationsSubmissions = useCallback(async () => {
    if (mode !== 'evaluations') return;
    if (!selectedCourse) return;
    if (!courseId) return;
    if (isExportingSubmissions) return;
    setIsExportingSubmissions(true);
    try {
      const limit = 100;
      const maxPages = 50;
      let cursor: string | null = null;
      const all: InboxSubmissionRow[] = [];

      for (let i = 0; i < maxPages; i++) {
        const queryParams: URLSearchParams = new URLSearchParams(buildSubmissionsQuery({ courseId, cursor }));
        queryParams.set('limit', String(limit));
        const res = await fetch(`/api/reports/assignment-submissions?${queryParams.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal export submissions');

        const list = Array.isArray(data?.submissions) ? data.submissions : [];
        all.push(
          ...list.map((s: any) => ({
            id: String(s.id),
            status: String(s.status || 'PENDING'),
            grade: typeof s.grade === 'number' ? s.grade : null,
            feedback: typeof s.feedback === 'string' ? s.feedback : null,
            notes: typeof s.notes === 'string' ? s.notes : null,
            submittedAt: typeof s.submittedAt === 'string' ? s.submittedAt : new Date(s.submittedAt).toISOString(),
            gradedAt: s.gradedAt ? (typeof s.gradedAt === 'string' ? s.gradedAt : new Date(s.gradedAt).toISOString()) : null,
            downloadUrl: String(s.downloadUrl || ''),
            assignment: {
              id: String(s.assignment?.id || ''),
              lessonTitle: String(s.assignment?.lessonTitle || 'Tugas'),
              passingGrade: Number(s.assignment?.passingGrade) || 0,
              lessonId: s.assignment?.lessonId ? String(s.assignment.lessonId) : null,
            },
            student: {
              id: String(s.student?.id || ''),
              name: String(s.student?.name || s.student?.email || ''),
              email: String(s.student?.email || ''),
            },
          }))
        );

        cursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
        if (!cursor) break;
      }

      const lines = [
        ['submissionId', 'status', 'grade', 'submittedAt', 'gradedAt', 'studentName', 'studentEmail', 'assignmentTitle', 'passingGrade', 'downloadUrl']
          .map(escapeCsv)
          .join(','),
        ...all.map((s) =>
          [
            s.id,
            s.status,
            s.grade ?? '',
            s.submittedAt,
            s.gradedAt ?? '',
            s.student.name,
            s.student.email,
            s.assignment.lessonTitle,
            s.assignment.passingGrade,
            s.downloadUrl,
          ]
            .map(escapeCsv)
            .join(',')
        ),
      ];

      downloadCsv({
        filename: `evaluations-submissions-${selectedCourse.slug || selectedCourse.id}.csv`,
        csv: lines.join('\n'),
      });

      toast.success(`Export submissions: ${all.length} baris`);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal export submissions');
    } finally {
      setIsExportingSubmissions(false);
    }
  }, [buildSubmissionsQuery, courseId, isExportingSubmissions, mode, selectedCourse]);

  const exportEvaluationsAttempts = useCallback(async () => {
    if (mode !== 'evaluations') return;
    if (!selectedCourse) return;
    if (!courseId) return;
    if (isExportingAttempts) return;
    setIsExportingAttempts(true);
    try {
      const limit = 100;
      const maxPages = 50;
      let cursor: string | null = null;
      const all: InboxAttemptRow[] = [];

      for (let i = 0; i < maxPages; i++) {
        const queryParams: URLSearchParams = new URLSearchParams(buildAttemptsQuery({ courseId, cursor }));
        queryParams.set('limit', String(limit));
        const res = await fetch(`/api/reports/quiz-attempts?${queryParams.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal export attempts');

        const list = Array.isArray(data?.attempts) ? data.attempts : [];
        all.push(
          ...list.map((a: any) => ({
            id: String(a.id),
            score: Number(a.score) || 0,
            passed: Boolean(a.passed),
            startedAt: typeof a.startedAt === 'string' ? a.startedAt : new Date(a.startedAt).toISOString(),
            completedAt: a.completedAt ? (typeof a.completedAt === 'string' ? a.completedAt : new Date(a.completedAt).toISOString()) : null,
            quiz: {
              id: String(a.quiz?.id || ''),
              lessonTitle: String(a.quiz?.lessonTitle || 'Quiz'),
              passingGrade: Number(a.quiz?.passingGrade) || 80,
              lessonId: a.quiz?.lessonId ? String(a.quiz.lessonId) : null,
            },
            student: {
              id: String(a.student?.id || ''),
              name: String(a.student?.name || a.student?.email || ''),
              email: String(a.student?.email || ''),
            },
          }))
        );

        cursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
        if (!cursor) break;
      }

      const lines = [
        ['attemptId', 'score', 'passed', 'startedAt', 'completedAt', 'studentName', 'studentEmail', 'quizTitle', 'passingGrade']
          .map(escapeCsv)
          .join(','),
        ...all.map((a) =>
          [a.id, a.score, a.passed ? 'true' : 'false', a.startedAt, a.completedAt ?? '', a.student.name, a.student.email, a.quiz.lessonTitle, a.quiz.passingGrade]
            .map(escapeCsv)
            .join(',')
        ),
      ];

      downloadCsv({
        filename: `evaluations-attempts-${selectedCourse.slug || selectedCourse.id}.csv`,
        csv: lines.join('\n'),
      });

      toast.success(`Export attempts: ${all.length} baris`);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal export attempts');
    } finally {
      setIsExportingAttempts(false);
    }
  }, [buildAttemptsQuery, courseId, isExportingAttempts, mode, selectedCourse]);

  const rangeLabel = analyticsRange === '7d' ? '7 hari terakhir' : analyticsRange === '90d' ? '90 hari terakhir' : '30 hari terakhir';

  const overviewMetrics = useMemo(() => {
    const totals = analytics?.totals ?? null;
    const prev = analytics?.previousTotals ?? null;
    const trend = (cur: number, prevValue: number) => {
      if (!Number.isFinite(cur) || !Number.isFinite(prevValue) || prevValue <= 0) return undefined;
      const pct = Math.round(((cur - prevValue) / prevValue) * 100);
      return { value: pct, isPositive: pct >= 0 };
    };
    const pagesPerSessionLabel = totals ? (Number(totals.pagesPerSession) || 0).toFixed(2) : '0.00';
    return [
      {
        label: 'Pageviews',
        value: totals?.pageviews ?? 0,
        color: 'bg-indigo-500',
        description: rangeLabel,
        icon: Eye,
        trend: totals && prev ? trend(Number(totals.pageviews) || 0, Number(prev.pageviews) || 0) : undefined,
      },
      {
        label: 'Sesi Unik',
        value: totals?.uniqueSessions ?? 0,
        color: 'bg-blue-500',
        description: rangeLabel,
        icon: RotateCcw,
        trend: totals && prev ? trend(Number(totals.uniqueSessions) || 0, Number(prev.uniqueSessions) || 0) : undefined,
      },
      {
        label: 'Halaman/Sesi',
        value: pagesPerSessionLabel,
        color: 'bg-sky-500',
        description: rangeLabel,
        icon: FileText,
        trend: totals && prev ? trend(Number(totals.pagesPerSession) || 0, Number(prev.pagesPerSession) || 0) : undefined,
      },
      {
        label: 'User Baru',
        value: totals?.newUsers ?? 0,
        color: 'bg-green-500',
        description: rangeLabel,
        icon: Users,
        trend: totals && prev ? trend(Number(totals.newUsers) || 0, Number(prev.newUsers) || 0) : undefined,
      },
      {
        label: 'Siswa Baru',
        value: totals?.newStudents ?? 0,
        color: 'bg-yellow-500',
        description: rangeLabel,
        icon: GraduationCap,
        trend: totals && prev ? trend(Number(totals.newStudents) || 0, Number(prev.newStudents) || 0) : undefined,
      },
    ];
  }, [analytics, analyticsRange, rangeLabel]);

  const dailyChart = useMemo(() => {
    const list = Array.isArray(analytics?.daily) ? analytics!.daily : [];
    return list.map((d) => ({
      day: formatDate(d.day),
      pageviews: Number(d.pageviews) || 0,
      sessions: Number(d.sessions) || 0,
    }));
  }, [analytics]);

  const topCoursesChart = useMemo(() => {
    const list = Array.isArray(analytics?.topCourses) ? analytics!.topCourses : [];
    return list.map((c) => ({
      name: c.title.length > 18 ? `${c.title.slice(0, 18)}…` : c.title,
      views: Number(c.views) || 0,
    }));
  }, [analytics]);

  const topCategoriesChart = useMemo(() => {
    const list = Array.isArray(analytics?.topCategories) ? analytics!.topCategories : [];
    return list.map((c) => ({
      name: c.name.length > 18 ? `${c.name.slice(0, 18)}…` : c.name,
      views: Number(c.views) || 0,
    }));
  }, [analytics]);

  const topProductsChart = useMemo(() => {
    const list = Array.isArray(analytics?.topProducts) ? analytics!.topProducts : [];
    return list.map((p) => ({
      name: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
      views: Number(p.views) || 0,
    }));
  }, [analytics]);

  const topVendorsChart = useMemo(() => {
    const list = Array.isArray(analytics?.topVendors) ? analytics!.topVendors : [];
    return list.map((v) => ({
      name: v.name.length > 18 ? `${v.name.slice(0, 18)}…` : v.name,
      views: Number(v.views) || 0,
    }));
  }, [analytics]);

  const mentorRows = useMemo(() => {
    const list = Array.isArray(analytics?.topMentors) ? analytics!.topMentors : [];
    return list.map((m) => ({
      name: m.name || m.email,
      email: m.email,
      totalViews: Number(m.totalViews) || 0,
      courseViews: Number(m.courseViews) || 0,
      vendorViews: Number(m.vendorViews) || 0,
      students: Number(m.students) || 0,
    }));
  }, [analytics]);

  const referrerRows = useMemo(() => {
    const list = Array.isArray(analytics?.topReferrers) ? analytics!.topReferrers : [];
    return list.map((r) => ({ host: r.host, views: Number(r.views) || 0 }));
  }, [analytics]);

  const topPagesRows = useMemo(() => {
    const list = Array.isArray(analytics?.topPages) ? analytics!.topPages : [];
    return list.map((r) => ({ path: r.path, views: Number(r.views) || 0 }));
  }, [analytics]);

  const landingPagesRows = useMemo(() => {
    const list = Array.isArray(analytics?.landingPages) ? analytics!.landingPages : [];
    return list.map((r) => ({ path: r.path, sessions: Number(r.sessions) || 0 }));
  }, [analytics]);

  const utmSourceRows = useMemo(() => {
    const list = Array.isArray(analytics?.utmSources) ? analytics!.utmSources : [];
    return list.map((r) => ({ value: r.value, views: Number(r.views) || 0 }));
  }, [analytics]);

  const utmMediumRows = useMemo(() => {
    const list = Array.isArray(analytics?.utmMediums) ? analytics!.utmMediums : [];
    return list.map((r) => ({ value: r.value, views: Number(r.views) || 0 }));
  }, [analytics]);

  const utmCampaignRows = useMemo(() => {
    const list = Array.isArray(analytics?.utmCampaigns) ? analytics!.utmCampaigns : [];
    return list.map((r) => ({ value: r.value, views: Number(r.views) || 0 }));
  }, [analytics]);

  const gradebookColumns = [
    { header: 'Nama', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Enrolled', accessorKey: 'enrolledAt', cell: (v: string) => formatDate(v) },
    {
      header: 'Progress',
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
      header: 'Quiz',
      accessorKey: 'quizPassed',
      cell: (_: any, row: GradebookRow) => (
        <div className="text-sm">
          <div className="font-bold text-slate-900">
            {row.quizPassed}/{row.quizTotal}
          </div>
          <div className="text-xs text-slate-500">Attempted: {row.quizAttempted}</div>
        </div>
      ),
    },
    {
      header: 'Rata2 Quiz',
      accessorKey: 'quizBestAvg',
      cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
    },
    {
      header: 'Tugas',
      accessorKey: 'assignmentPassed',
      cell: (_: any, row: GradebookRow) => (
        <div className="text-sm">
          <div className="font-bold text-slate-900">
            {row.assignmentPassed}/{row.assignmentTotal}
          </div>
          <div className="text-xs text-slate-500">Graded: {row.assignmentGraded}</div>
        </div>
      ),
    },
    {
      header: 'Rata2 Tugas',
      accessorKey: 'assignmentBestAvg',
      cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
    },
  ];

  return (
    <div className={mode === 'reports' ? 'space-y-8 pb-12' : 'space-y-5 pb-12'}>
      {mode === 'reports' ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
              <p className="text-slate-500 text-sm mt-1">Pantau traffic, pertumbuhan user baru, dan konten yang paling banyak dilihat.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm">
                <Calendar className="w-4 h-4" />
                <select
                  value={analyticsRange}
                  onChange={(e) => setAnalyticsRange(e.target.value as any)}
                  className="bg-transparent outline-none"
                >
                  <option value="7d">7 hari</option>
                  <option value="30d">30 hari</option>
                  <option value="90d">90 hari</option>
                </select>
              </div>
              <button
                onClick={loadAnalytics}
                disabled={isLoadingAnalytics}
                className="flex items-center justify-center gap-2 bg-indigo-600 disabled:opacity-70 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
              >
                {isLoadingAnalytics ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Refresh
              </button>
            </div>
          </div>

          <Cards metrics={overviewMetrics} isLoading={isLoadingAnalytics} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Tren Pageviews</h3>
              <SimpleLineChart data={dailyChart} xKey="day" yKey="pageviews" name="Pageviews" />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Tren Sesi Unik</h3>
              <SimpleAreaChart data={dailyChart} xKey="day" yKey="sessions" name="Sesi Unik" />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Top Kursus (Views)</h3>
              <SimpleBarChart data={topCoursesChart} xKey="name" yKey="views" name="Views" />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Top Kategori (Views)</h3>
              <SimpleBarChart data={topCategoriesChart} xKey="name" yKey="views" name="Views" />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Top Produk (Views)</h3>
              <SimpleBarChart data={topProductsChart} xKey="name" yKey="views" name="Views" />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Top Vendor (Views)</h3>
              <SimpleBarChart data={topVendorsChart} xKey="name" yKey="views" name="Views" />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Top Referrer</h3>
              <Table
                isLoading={isLoadingAnalytics}
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

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Mentor Terpopuler (Kursus + Produk)</h3>
              <Table
                isLoading={isLoadingAnalytics}
                data={mentorRows}
                columns={[
                  { header: 'Mentor', accessorKey: 'name' },
                  {
                    header: 'Total Siswa',
                    accessorKey: 'students',
                    className: 'text-right',
                    cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
                  },
                  {
                    header: 'Total Views',
                    accessorKey: 'totalViews',
                    className: 'text-right',
                    cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
                  },
                  {
                    header: 'Views Kursus',
                    accessorKey: 'courseViews',
                    className: 'text-right',
                    cell: (v: number) => <span className="font-bold text-slate-700">{Number(v) || 0}</span>,
                  },
                  {
                    header: 'Views Produk',
                    accessorKey: 'vendorViews',
                    className: 'text-right',
                    cell: (v: number) => <span className="font-bold text-slate-700">{Number(v) || 0}</span>,
                  },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Top Halaman</h3>
              <Table
                isLoading={isLoadingAnalytics}
                data={topPagesRows}
                columns={[
                  { header: 'Path', accessorKey: 'path' },
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
              <h3 className="text-lg font-bold text-slate-900 mb-4">Landing Pages</h3>
              <Table
                isLoading={isLoadingAnalytics}
                data={landingPagesRows}
                columns={[
                  { header: 'Path', accessorKey: 'path' },
                  {
                    header: 'Sesi',
                    accessorKey: 'sessions',
                    className: 'text-right',
                    cell: (v: number) => <span className="font-bold text-slate-900">{Number(v) || 0}</span>,
                  },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">UTM Source</h3>
              <Table
                isLoading={isLoadingAnalytics}
                data={utmSourceRows}
                columns={[
                  { header: 'Source', accessorKey: 'value' },
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
              <h3 className="text-lg font-bold text-slate-900 mb-4">UTM Medium</h3>
              <Table
                isLoading={isLoadingAnalytics}
                data={utmMediumRows}
                columns={[
                  { header: 'Medium', accessorKey: 'value' },
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
              <h3 className="text-lg font-bold text-slate-900 mb-4">UTM Campaign</h3>
              <Table
                isLoading={isLoadingAnalytics}
                data={utmCampaignRows}
                columns={[
                  { header: 'Campaign', accessorKey: 'value' },
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
        </>
      ) : null}

      {mode === 'gradebook' ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gradebook</h1>
              <p className="text-slate-500 text-sm mt-1">Rekap nilai quiz & tugas per kursus.</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Gradebook</h3>
            <p className="text-slate-500 text-sm mt-1">Rekap nilai quiz & tugas per kursus.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                disabled={isLoadingCourses}
                className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
              >
                {isLoadingCourses ? <option value="">Memuat kursus...</option> : null}
                {!isLoadingCourses && courses.length === 0 ? <option value="">Belum ada kursus</option> : null}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.status})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={exportGradebook}
              disabled={!selectedCourse || rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              Export Gradebook
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-900">Inbox Tugas</div>
                <div className="text-xs text-slate-500 truncate">Submission yang belum dinilai (PENDING)</div>
              </div>
              <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {pendingSubmissions.length}
              </span>
            </div>
            {isLoadingInbox ? (
              <div className="p-6 flex items-center justify-center text-slate-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Memuat...
              </div>
            ) : pendingSubmissions.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">Tidak ada tugas yang menunggu penilaian.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {pendingSubmissions.slice(0, 6).map((s) => (
                  <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 truncate">{s.assignment.lessonTitle}</div>
                      <div className="text-sm text-slate-700 truncate">{s.student.name}</div>
                      <div className="text-xs text-slate-500 mt-1">Submit: {formatDateTime(s.submittedAt)}</div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <a
                        href={s.downloadUrl}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                      <button
                        onClick={() => openGradeModal(s)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700"
                      >
                        Nilai
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-900">Inbox Quiz</div>
                <div className="text-xs text-slate-500 truncate">Attempt terbaru yang tidak lulus</div>
              </div>
              <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {failedAttempts.length}
              </span>
            </div>
            {isLoadingInbox ? (
              <div className="p-6 flex items-center justify-center text-slate-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Memuat...
              </div>
            ) : failedAttempts.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">Tidak ada attempt quiz yang gagal.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {failedAttempts.slice(0, 6).map((a) => (
                  <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 truncate">{a.quiz.lessonTitle}</div>
                      <div className="text-sm text-slate-700 truncate">{a.student.name}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Skor {a.score} (≥ {a.quiz.passingGrade})
                        </span>
                        <span className="text-xs text-slate-500">
                          {a.completedAt ? formatDateTime(a.completedAt) : formatDateTime(a.startedAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => openAttemptFromInbox(a)}
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                    >
                      <Eye className="w-4 h-4" />
                      Detail
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          {isLoadingGradebook ? (
            <div className="p-10 flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Memuat gradebook...
            </div>
          ) : (
            <Table
              columns={gradebookColumns}
              data={rows}
              isLoading={false}
              actions={(row) => (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => openStudentDetails(row as GradebookRow, 'quiz')}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    <GraduationCap className="w-4 h-4" />
                    Quiz
                  </button>
                  <button
                    onClick={() => openStudentDetails(row as GradebookRow, 'assignment')}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4" />
                    Tugas
                  </button>
                </div>
              )}
            />
          )}
        </div>
      </div>
        </>
      ) : null}

      {mode === 'evaluations' ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Evaluasi</h1>
              <p className="text-slate-500 text-sm mt-1">Antrian pekerjaan untuk menilai tugas dan meninjau quiz.</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div className="w-full max-w-xl">
                <div className="text-xs font-extrabold text-slate-700 mb-1">Kursus</div>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  disabled={isLoadingCourses}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                >
                  {isLoadingCourses ? <option value="">Memuat kursus...</option> : null}
                  {!isLoadingCourses && courses.length === 0 ? <option value="">Belum ada kursus</option> : null}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => (courseId ? loadInbox(courseId) : null)}
                  disabled={!courseId || isLoadingInbox}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
                >
                  {isLoadingInbox ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-sm font-extrabold text-slate-900">Filter</div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEvaluationListMode('INBOX')}
                      className={`px-3 py-2 rounded-xl text-xs font-extrabold ${
                        evaluationListMode === 'INBOX'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Inbox
                    </button>
                    <button
                      onClick={() => setEvaluationListMode('ALL')}
                      className={`px-3 py-2 rounded-xl text-xs font-extrabold ${
                        evaluationListMode === 'ALL'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Semua
                    </button>
                  </div>
                  <input
                    value={inboxSearch}
                    onChange={(e) => setInboxSearch(e.target.value)}
                    placeholder="Cari siswa / email / judul..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                  />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={exportEvaluationsSubmissions}
                      disabled={!courseId || isLoadingInbox || isExportingSubmissions}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isExportingSubmissions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Export Tugas (CSV)
                    </button>
                    <button
                      onClick={exportEvaluationsAttempts}
                      disabled={!courseId || isLoadingInbox || isExportingAttempts}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isExportingAttempts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Export Quiz (CSV)
                    </button>
                  </div>
                  {evaluationListMode === 'INBOX' ? (
                    <>
                      <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
                        <input
                          type="checkbox"
                          checked={assignmentPendingOnly}
                          onChange={(e) => setAssignmentPendingOnly(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Tugas: hanya PENDING
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
                        <input
                          type="checkbox"
                          checked={quizFailedOnly}
                          onChange={(e) => setQuizFailedOnly(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Quiz: hanya gagal
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
                        <input
                          type="checkbox"
                          checked={includeIncompleteAttempts}
                          onChange={(e) => setIncludeIncompleteAttempts(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Quiz: tampilkan yang belum selesai
                      </label>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs font-extrabold text-slate-700 mb-1">Status Tugas</div>
                        <select
                          value={assignmentStatusFilter}
                          onChange={(e) => setAssignmentStatusFilter(e.target.value as any)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                        >
                          <option value="ALL">Semua</option>
                          <option value="PENDING">PENDING</option>
                          <option value="GRADED">GRADED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-slate-700 mb-1">Status Quiz</div>
                        <select
                          value={quizStatusFilter}
                          onChange={(e) => setQuizStatusFilter(e.target.value as any)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                        >
                          <option value="ALL">Semua</option>
                          <option value="FAILED">FAILED</option>
                          <option value="PASSED">PASSED</option>
                          <option value="INCOMPLETE">INCOMPLETE</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-sm font-extrabold text-slate-900">Ringkasan</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">{evaluationListMode === 'INBOX' ? 'Inbox Tugas' : 'Daftar Tugas'}</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{pendingSubmissions.length}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-500">{evaluationListMode === 'INBOX' ? 'Inbox Quiz' : 'Daftar Quiz'}</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{failedAttempts.length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">{evaluationListMode === 'INBOX' ? 'Inbox Tugas' : 'Daftar Tugas'}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {evaluationListMode === 'INBOX' ? 'Submission tugas sesuai filter.' : 'Semua submission tugas sesuai filter.'}
                    </div>
                  </div>
                  <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {pendingSubmissions.length}
                  </span>
                </div>
                <div className="p-3 border-b border-slate-200 bg-slate-50 grid grid-cols-1 gap-3 sm:grid-cols-[auto,1fr] sm:items-center lg:grid-cols-[auto,1fr,auto]">
                  <label className="flex items-center gap-2 text-xs text-slate-700 font-extrabold shrink-0">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={pendingSubmissions.length > 0 && selectedSubmissionIds.length === pendingSubmissions.length}
                      onChange={toggleAllSubmissions}
                      disabled={pendingSubmissions.length === 0 || isLoadingInbox}
                    />
                    Pilih semua
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                    <input
                      value={bulkGradeValue}
                      onChange={(e) => setBulkGradeValue(e.target.value)}
                      placeholder="Nilai (0-100)"
                      inputMode="numeric"
                      className="w-full sm:w-32 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold"
                      disabled={isLoadingInbox || isBulkGrading}
                    />
                    <input
                      value={bulkFeedbackValue}
                      onChange={(e) => setBulkFeedbackValue(e.target.value)}
                      placeholder="Feedback (opsional)"
                      className="w-full sm:flex-1 sm:min-w-64 lg:max-w-xl px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold"
                      disabled={isLoadingInbox || isBulkGrading}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 lg:justify-end">
                    <button
                      onClick={bulkGradeSelectedSubmissions}
                      disabled={selectedSubmissionIds.length === 0 || isLoadingInbox || isBulkGrading}
                      className="w-full sm:w-auto px-3 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center whitespace-nowrap"
                    >
                      {isBulkGrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Nilai terpilih ({selectedSubmissionIds.length})
                    </button>
                    <button
                      onClick={bulkRejectSelectedSubmissions}
                      disabled={selectedSubmissionIds.length === 0 || isLoadingInbox || isBulkRejecting || isBulkGrading}
                      className="w-full sm:w-auto px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60 inline-flex items-center justify-center whitespace-nowrap"
                    >
                      {isBulkRejecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Reject terpilih
                    </button>
                  </div>
                </div>
                {isLoadingInbox ? (
                  <div className="p-6 flex items-center justify-center text-slate-500 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Memuat...
                  </div>
                ) : pendingSubmissions.length === 0 ? (
                  <div className="p-6 text-sm text-slate-600">Tidak ada tugas sesuai filter.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {pendingSubmissions.map((s) => (
                      <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={selectedSubmissionIds.includes(s.id)}
                            onChange={() => toggleSubmissionSelection(s.id)}
                          />
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{s.assignment.lessonTitle}</div>
                            <div className="text-sm text-slate-700 truncate">{s.student.name}</div>
                            <div className="text-xs text-slate-500 mt-1">Submit: {formatDateTime(s.submittedAt)}</div>
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center items-end gap-2">
                          <a
                            href={s.downloadUrl}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                          <button
                            onClick={() => openGradeModal(s)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700"
                          >
                            Nilai
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3 border-t border-slate-200 flex items-center justify-end">
                  {mode === 'evaluations' && evaluationListMode === 'ALL' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={goPrevSubmissionsPage}
                        disabled={submissionsPageIndex === 0 || isLoadingMoreSubmissions || isLoadingInbox}
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                      >
                        {isLoadingMoreSubmissions ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Sebelumnya
                      </button>
                      <button
                        onClick={goNextSubmissionsPage}
                        disabled={
                          (submissionsPageIndex >= submissionsPageCursors.length - 1 && !submissionsNextCursor) ||
                          isLoadingMoreSubmissions ||
                          isLoadingInbox
                        }
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                      >
                        {isLoadingMoreSubmissions ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Berikutnya
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={loadMoreSubmissions}
                      disabled={!submissionsNextCursor || isLoadingMoreSubmissions || isLoadingInbox}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                    >
                      {isLoadingMoreSubmissions ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Muat lebih banyak
                    </button>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">{evaluationListMode === 'INBOX' ? 'Inbox Quiz' : 'Daftar Quiz'}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {evaluationListMode === 'INBOX' ? 'Attempt quiz sesuai filter.' : 'Semua attempt quiz sesuai filter.'}
                    </div>
                  </div>
                  <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {failedAttempts.length}
                  </span>
                </div>
                <div className="p-3 border-b border-slate-200 bg-slate-50 grid grid-cols-1 gap-3 sm:grid-cols-[auto,1fr,auto] sm:items-center">
                  <label className="flex items-center gap-2 text-xs text-slate-700 font-extrabold shrink-0">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={failedAttempts.length > 0 && selectedAttemptIds.length === failedAttempts.length}
                      onChange={toggleAllAttempts}
                      disabled={failedAttempts.length === 0 || isLoadingInbox || isBulkResettingAttempts}
                    />
                    Pilih semua
                  </label>
                  <div className="text-xs text-slate-500">
                    {selectedAttemptIds.length ? `${selectedAttemptIds.length} dipilih` : 'Pilih attempt untuk di-reset.'}
                  </div>
                  <button
                    onClick={bulkResetSelectedAttempts}
                    disabled={selectedAttemptIds.length === 0 || isLoadingInbox || isBulkResettingAttempts}
                    className="w-full sm:w-auto px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60 inline-flex items-center justify-center whitespace-nowrap"
                  >
                    {isBulkResettingAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Reset terpilih ({selectedAttemptIds.length})
                  </button>
                </div>
                {isLoadingInbox ? (
                  <div className="p-6 flex items-center justify-center text-slate-500 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Memuat...
                  </div>
                ) : failedAttempts.length === 0 ? (
                  <div className="p-6 text-sm text-slate-600">Tidak ada attempt quiz sesuai filter.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {failedAttempts.map((a) => (
                      <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={selectedAttemptIds.includes(a.id)}
                            onChange={() => toggleAttemptSelection(a.id)}
                            disabled={isLoadingInbox || isBulkResettingAttempts}
                          />
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{a.quiz.lessonTitle}</div>
                            <div className="text-sm text-slate-700 truncate">{a.student.name}</div>
                            <div className="mt-2 flex items-center gap-2">
                              <span
                                className={`text-xs font-extrabold px-2 py-1 rounded-full border ${
                                  a.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                Skor {a.score} (≥ {a.quiz.passingGrade})
                              </span>
                              <span className="text-xs text-slate-500">
                                {a.completedAt ? formatDateTime(a.completedAt) : formatDateTime(a.startedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center items-end gap-2">
                          <button
                            onClick={() => openAttemptFromInbox(a)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                          >
                            <Eye className="w-4 h-4" />
                            Detail
                          </button>
                          <button
                            onClick={() => resetAttempt(a.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3 border-t border-slate-200 flex items-center justify-end">
                  {mode === 'evaluations' && evaluationListMode === 'ALL' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={goPrevAttemptsPage}
                        disabled={attemptsPageIndex === 0 || isLoadingMoreAttempts || isLoadingInbox}
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                      >
                        {isLoadingMoreAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Sebelumnya
                      </button>
                      <button
                        onClick={goNextAttemptsPage}
                        disabled={
                          (attemptsPageIndex >= attemptsPageCursors.length - 1 && !attemptsNextCursor) ||
                          isLoadingMoreAttempts ||
                          isLoadingInbox
                        }
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                      >
                        {isLoadingMoreAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Berikutnya
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={loadMoreAttempts}
                      disabled={!attemptsNextCursor || isLoadingMoreAttempts || isLoadingInbox}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
                    >
                      {isLoadingMoreAttempts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Muat lebih banyak
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {mode !== 'reports' && detailsOpen && selectedStudent ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button onClick={closeStudentDetails} className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-500">Detail Siswa</div>
                <div className="text-lg font-extrabold text-slate-900 truncate">{selectedStudent.name}</div>
                <div className="text-sm text-slate-600 truncate">{selectedStudent.email}</div>
                <div className="text-xs text-slate-500 mt-1 truncate">{selectedCourse?.title || ''}</div>
              </div>
              <button
                onClick={closeStudentDetails}
                className="shrink-0 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <button
                onClick={() => setDetailsTab('quiz')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold inline-flex items-center gap-2 ${
                  detailsTab === 'quiz' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Quiz Attempts
              </button>
              <button
                onClick={() => setDetailsTab('assignment')}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold inline-flex items-center gap-2 ${
                  detailsTab === 'assignment'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Tugas
              </button>

              <div className="flex-1" />
              <button
                onClick={() => (selectedStudent ? loadDetails({ courseId, userId: selectedStudent.userId }) : null)}
                disabled={isLoadingDetails}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-auto">
              {isLoadingDetails ? (
                <div className="p-10 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat detail...
                </div>
              ) : detailsTab === 'quiz' ? (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="divide-y divide-slate-200">
                      {quizAttempts.length === 0 ? (
                        <div className="p-6 text-sm text-slate-600">Belum ada attempt quiz.</div>
                      ) : (
                        quizAttempts.map((a) => (
                          <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-900 truncate">{a.quiz.lessonTitle}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {a.completedAt ? `Selesai: ${formatDateTime(a.completedAt)}` : `Mulai: ${formatDateTime(a.startedAt)}`}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                  Skor: {a.score}
                                </span>
                                <span
                                  className={`text-xs font-extrabold px-2 py-1 rounded-full border ${
                                    a.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {a.passed ? 'LULUS' : 'BELUM LULUS'} (≥ {a.quiz.passingGrade})
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => viewAttemptDetail(a.id)}
                              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                            >
                              <Eye className="w-4 h-4" />
                              Detail
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                      <div className="font-extrabold text-slate-900">Detail Attempt</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-500">{attemptDetail ? `Skor ${attemptDetail.score}` : ''}</div>
                        {attemptDetail ? (
                          <button
                            onClick={() => resetAttempt(attemptDetail.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {isLoadingAttemptDetail ? (
                      <div className="p-8 flex items-center justify-center text-slate-500 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Memuat...
                      </div>
                    ) : !attemptDetail ? (
                      <div className="p-6 text-sm text-slate-600">Klik “Detail” pada attempt untuk melihat jawaban.</div>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {attemptDetail.questions.map((q, idx) => (
                          <div key={q.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-slate-900">
                                  {idx + 1}. {q.text}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {q.type} • {q.points} poin
                                </div>
                              </div>
                              <span
                                className={`text-xs font-extrabold px-2 py-1 rounded-full border shrink-0 ${
                                  q.isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {q.isCorrect ? 'BENAR' : 'SALAH'}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="text-xs font-extrabold text-slate-700">Jawaban Siswa</div>
                                <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">
                                  {q.submittedText.length ? q.submittedText.join(', ') : q.submitted.length ? q.submitted.join(', ') : '-'}
                                </div>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="text-xs font-extrabold text-slate-700">Kunci Jawaban</div>
                                <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">
                                  {q.correctText.length ? q.correctText.join(', ') : q.correct.length ? q.correct.join(', ') : '-'}
                                </div>
                              </div>
                            </div>

                            {q.explanation ? (
                              <div className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{q.explanation}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-slate-200">
                    {submissions.length === 0 ? (
                      <div className="p-6 text-sm text-slate-600">Belum ada submission tugas.</div>
                    ) : (
                      submissions.map((s) => (
                        <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{s.assignment.lessonTitle}</div>
                            <div className="text-xs text-slate-500 mt-1">Submit: {formatDateTime(s.submittedAt)}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {s.status}
                              </span>
                              <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                Nilai: {typeof s.grade === 'number' ? s.grade : '-'} (≥ {s.assignment.passingGrade})
                              </span>
                              {s.gradedAt ? (
                                <span className="text-xs text-slate-500">Dinilai: {formatDateTime(s.gradedAt)}</span>
                              ) : null}
                            </div>
                            {s.notes ? <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{s.notes}</div> : null}
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <a
                              href={s.downloadUrl}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                            <button
                              onClick={() => openGradeModal(s)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700"
                            >
                              Nilai
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {mode !== 'reports' && gradeModalOpen && gradingSubmission ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            onClick={() => (isGrading ? null : (setGradeModalOpen(false), setGradingSubmission(null)))}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-500">Penilaian Tugas</div>
                <div className="text-lg font-extrabold text-slate-900 truncate">{gradingSubmission.assignment.lessonTitle}</div>
              </div>
              <button
                onClick={() => (isGrading ? null : (setGradeModalOpen(false), setGradingSubmission(null)))}
                className="shrink-0 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-1">Status</div>
                  <select
                    value={gradingStatus}
                    onChange={(e) => setGradingStatus(e.target.value === 'REJECTED' ? 'REJECTED' : 'GRADED')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold"
                  >
                    <option value="GRADED">GRADED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-1">
                    Nilai {gradingStatus === 'GRADED' ? '(0-100)' : ''}
                  </div>
                  <input
                    value={gradingGrade}
                    onChange={(e) => setGradingGrade(e.target.value)}
                    disabled={gradingStatus !== 'GRADED'}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold disabled:opacity-60"
                    placeholder="contoh: 85"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold text-slate-700 mb-1">Feedback</div>
                <textarea
                  value={gradingFeedback}
                  onChange={(e) => setGradingFeedback(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                  placeholder="Catatan untuk siswa..."
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => (isGrading ? null : (setGradeModalOpen(false), setGradingSubmission(null)))}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
                  disabled={isGrading}
                >
                  Batal
                </button>
                <button
                  onClick={submitGrade}
                  disabled={isGrading}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center"
                >
                  {isGrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
