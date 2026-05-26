"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCourseProgress, useUpdateLessonProgress } from '../api/progress';
import LessonViewer from '../components/LessonViewer';
import QuizPlayer from '../components/QuizPlayer';
import ProgressTracker from '../components/ProgressTracker';
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, FileText, Lock, MessageSquare, Play, Send, Undo2 } from 'lucide-react';

type OutlineLessonStatus = {
  isLocked: boolean;
  unlockDate: string | null;
  lockReason: string | null;
};

type QAThreadSummary = {
  id: string;
  courseId: string;
  lessonId: string | null;
  lessonTitle: string | null;
  title: string;
  question: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  author: { id: string; name: string; role: string };
  replyCount: number;
  lastReplyAt: string | null;
};

type QAReply = {
  id: string;
  message: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
};

type QAThreadDetail = {
  id: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  title: string;
  question: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  author: { id: string; name: string; role: string };
  replies: QAReply[];
};

function lockReasonText(lockReason: string | null) {
  if (lockReason === 'DRIP_LOCKED') return 'Materi ini masih terkunci (drip).';
  if (lockReason === 'SCHEDULE_LOCKED') return 'Materi ini belum dibuka sesuai jadwal.';
  if (lockReason === 'SEQUENTIAL_LOCKED') return 'Selesaikan materi sebelumnya terlebih dahulu.';
  if (lockReason === 'ENROLLMENT_EXPIRED') return 'Akses kursus sudah berakhir.';
  if (lockReason === 'NOT_ENROLLED') return 'Anda belum terdaftar pada kursus ini.';
  return 'Materi ini masih terkunci.';
}

function lockReasonChip(lockReason: string | null) {
  if (lockReason === 'DRIP_LOCKED') return 'DRIP';
  if (lockReason === 'SCHEDULE_LOCKED') return 'JADWAL';
  if (lockReason === 'SEQUENTIAL_LOCKED') return 'URUT';
  if (lockReason === 'ENROLLMENT_EXPIRED') return 'EXPIRED';
  if (lockReason === 'NOT_ENROLLED') return 'LOCK';
  return 'LOCK';
}

function formatUnlockDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('id-ID');
}

function formatQaDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CoursePlayerPage({
  courseId,
  autoLoadNextCourseContent,
  courseRetakeEnabled,
}: {
  courseId?: string;
  autoLoadNextCourseContent?: boolean;
  courseRetakeEnabled?: boolean;
}) {
  const params = useParams<{ id?: string }>();
  const id = courseId || params?.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [qaSelectedThreadId, setQaSelectedThreadId] = useState<string | null>(null);
  const [qaScope, setQaScope] = useState<'LESSON' | 'COURSE'>('LESSON');
  const [qaTitle, setQaTitle] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaReplyMessage, setQaReplyMessage] = useState('');
  const [qaSubmitting, setQaSubmitting] = useState(false);
  const qaRef = useRef<HTMLDivElement | null>(null);
  const [didAutoScroll, setDidAutoScroll] = useState(false);
  const [expandedModuleIds, setExpandedModuleIds] = useState<string[]>([]);
  const [didInitSidebar, setDidInitSidebar] = useState(false);
  const didCompletionRedirectRef = useRef(false);

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${id}`);
      if (!res.ok) throw new Error('Failed to fetch course');
      return res.json();
    },
    enabled: !!id,
  });

  const { data: outline } = useQuery({
    queryKey: ['courseOutline', course?.slug],
    queryFn: async () => {
      const res = await fetch(`/api/courses/slug/${course.slug}/outline`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch outline');
      return res.json();
    },
    enabled: Boolean(course?.slug),
  });

  // Fetch user progress
  const { data: progress, isLoading: progressLoading } = useCourseProgress(id || '');

  // Mutation to update progress
  const updateProgress = useUpdateLessonProgress(id || '');

  // Flatten lessons from modules
  const allLessons = course?.modules?.flatMap((m: any) => m.lessons) || [];
  const completedLessonIds: string[] = progress?.completedLessonIds || [];
  const preferredLessonId =
    allLessons.find((lesson: any) => !completedLessonIds.includes(lesson.id))?.id || allLessons[0]?.id || null;

  const activeLessonId =
    selectedLessonId && allLessons.some((l: any) => l.id === selectedLessonId) ? selectedLessonId : preferredLessonId;

  const currentLessonIndex = activeLessonId ? allLessons.findIndex((l: any) => l.id === activeLessonId) : 0;
  const currentLesson = allLessons[Math.max(0, currentLessonIndex)] || allLessons[0] || null;
  const currentLessonId = currentLesson?.id;
  const isCompleted = currentLessonId ? completedLessonIds.includes(currentLessonId) : false;
  const completedLessonsCount = completedLessonIds.length || 0;

  const replaceQueryParams = (next: Record<string, string | null>) => {
    const qs = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) qs.delete(k);
      else qs.set(k, v);
    }
    const query = qs.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  useEffect(() => {
    if (didInitSidebar) return;
    const modules = course?.modules;
    if (!Array.isArray(modules) || modules.length === 0) return;
    const currentModuleId =
      currentLessonId && modules.find((m: any) => Array.isArray(m.lessons) && m.lessons.some((l: any) => l?.id === currentLessonId))?.id;
    const fallbackId = modules[0]?.id;
    const first = (currentModuleId || fallbackId) ? [String(currentModuleId || fallbackId)] : [];
    setExpandedModuleIds(first);
    setDidInitSidebar(true);
  }, [course?.modules, currentLessonId, didInitSidebar]);

  const lockByLessonId = useMemo(() => {
    const map = new Map<string, OutlineLessonStatus>();
    const modules = outline?.course?.modules;
    if (!Array.isArray(modules)) return map;

    for (const m of modules) {
      if (!m?.lessons) continue;
      for (const l of m.lessons) {
        if (!l?.id) continue;
        map.set(String(l.id), {
          isLocked: Boolean(l.isLocked),
          unlockDate: typeof l.unlockDate === 'string' ? l.unlockDate : null,
          lockReason: typeof l.lockReason === 'string' ? l.lockReason : null,
        });
      }
    }
    return map;
  }, [outline]);

  const lessonStatus = currentLessonId ? lockByLessonId.get(currentLessonId) : null;
  const isLessonLocked = Boolean(lessonStatus?.isLocked);
  const qaEnabled = Boolean(course?.enableQA);
  const autoLoadNext = autoLoadNextCourseContent !== false;

  const handleRetake = async () => {
    if (!id) return;
    if (retaking) return;
    const ok = window.confirm('Mulai ulang kursus ini? Progress (pelajaran/kuis/tugas) akan di-reset dan Anda mulai dari awal.');
    if (!ok) return;
    setRetaking(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(String(id))}/retake`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memulai ulang kursus');
      setSelectedLessonId(null);
      replaceQueryParams({ lessonId: null, threadId: null, scope: null });
      await queryClient.invalidateQueries({ queryKey: ['courseProgress', id] });
      await queryClient.invalidateQueries({ queryKey: ['courseOutline', course?.slug] });
      await queryClient.invalidateQueries({ queryKey: ['lesson', id] });
      toast.success('Progress kursus di-reset. Anda bisa mulai dari awal.');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memulai ulang kursus');
    } finally {
      setRetaking(false);
    }
  };

  useEffect(() => {
    setQaReplyMessage('');
    const deepThreadId = searchParams.get('threadId');
    if (!deepThreadId) setQaSelectedThreadId(null);
  }, [currentLessonId, searchParams]);

  useEffect(() => {
    const deepScope = searchParams.get('scope');
    if (deepScope === 'course') setQaScope('COURSE');
  }, [searchParams]);

  const {
    data: lessonDetails,
    isLoading: lessonLoading,
    error: lessonError,
  } = useQuery({
    queryKey: ['lesson', id, currentLessonId],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${id}/lessons/${currentLessonId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err: any = new Error(data?.error || 'Failed to fetch lesson');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    enabled: Boolean(id && currentLessonId),
  });

  const buildLockMapFromOutline = (outlineData: any) => {
    const map = new Map<string, OutlineLessonStatus>();
    const modules = outlineData?.course?.modules;
    if (!Array.isArray(modules)) return map;
    for (const m of modules) {
      if (!m?.lessons) continue;
      for (const l of m.lessons) {
        if (!l?.id) continue;
        map.set(String(l.id), {
          isLocked: Boolean(l.isLocked),
          unlockDate: typeof l.unlockDate === 'string' ? l.unlockDate : null,
          lockReason: typeof l.lockReason === 'string' ? l.lockReason : null,
        });
      }
    }
    return map;
  };

  const redirectAfterCourseCompleted = async () => {
    if (didCompletionRedirectRef.current) return;
    didCompletionRedirectRef.current = true;

    const certificatesHref = '/dashboard/student/certificates';
    if (!id) {
      router.push(certificatesHref);
      return;
    }

    const reviewsEnabled = (course as any)?.reviewsEnabled !== false;
    if (!reviewsEnabled) {
      router.push(certificatesHref);
      return;
    }

    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(String(id))}/rating`, { cache: 'no-store' as any });
      const data = await res.json().catch(() => ({}));
      const myRating = typeof (data as any)?.myRating === 'number' ? (data as any).myRating : null;
      if (!myRating) {
        const next = encodeURIComponent(certificatesHref);
        router.push(`/dashboard/student/courses?reviewCourseId=${encodeURIComponent(String(id))}&next=${next}`);
        return;
      }
    } catch {}

    router.push(certificatesHref);
  };

  const handleNext = (overrideLockMap?: Map<string, OutlineLessonStatus>) => {
    const lockMap = overrideLockMap || lockByLessonId;
    const idx = currentLessonIndex >= 0 ? currentLessonIndex : 0;
    if (idx < allLessons.length - 1) {
      for (let i = idx + 1; i < allLessons.length; i++) {
        const candidateId = String(allLessons[i].id);
        const status = lockMap.get(candidateId);
        if (status?.isLocked) continue;
        setSelectedLessonId(candidateId);
        replaceQueryParams({ lessonId: candidateId, threadId: null, scope: null });
        return;
      }
      const nextLesson = allLessons[idx + 1];
      const nextStatus = nextLesson ? lockMap.get(String(nextLesson.id)) : null;
      const unlockAt = nextStatus?.unlockDate ? formatUnlockDate(nextStatus.unlockDate) : null;
      if (nextStatus?.isLocked) {
        toast.error([lockReasonText(nextStatus.lockReason), unlockAt ? `Buka: ${unlockAt}` : null].filter(Boolean).join(' '));
        return;
      }
      toast.error('Semua materi berikutnya masih terkunci.');
      return;
    } else {
      const expectedCompleted = completedLessonsCount + (isCompleted ? 0 : 1);
      if (expectedCompleted >= allLessons.length && allLessons.length > 0) {
        redirectAfterCourseCompleted();
        return;
      }
      toast.success('Pelajaran selesai! Lanjutkan ke materi berikutnya.');
    }
  };

  const onLessonComplete = async () => {
    try {
      if (!currentLessonId) return;
      if (!isCompleted) {
        await updateProgress.mutateAsync({ lessonId: currentLessonId, completed: true });
      }
      const outlineKey = ['courseOutline', course?.slug] as const;
      await queryClient.refetchQueries({ queryKey: outlineKey });
      const latest = queryClient.getQueryData(outlineKey);
      const lockMap = buildLockMapFromOutline(latest);
      if (autoLoadNext) {
        handleNext(lockMap);
      } else {
        const expectedCompleted = completedLessonsCount + (isCompleted ? 0 : 1);
        if (expectedCompleted >= allLessons.length && allLessons.length > 0) {
          redirectAfterCourseCompleted();
          return;
        }
        toast.success('Pelajaran selesai.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan progress pelajaran';
      toast.error(message);
    }
  };

  const onQuizComplete = async ({ passed }: { score: number; passed: boolean }) => {
    if (passed) {
      if (!currentLessonId) return;
      if (!isCompleted) {
        await updateProgress.mutateAsync({ lessonId: currentLessonId, completed: true });
      }
      const outlineKey = ['courseOutline', course?.slug] as const;
      await queryClient.refetchQueries({ queryKey: outlineKey });
      const latest = queryClient.getQueryData(outlineKey);
      const lockMap = buildLockMapFromOutline(latest);
      if (autoLoadNext) {
        setTimeout(() => handleNext(lockMap), 300);
      } else {
        const expectedCompleted = completedLessonsCount + (isCompleted ? 0 : 1);
        if (expectedCompleted >= allLessons.length && allLessons.length > 0) {
          redirectAfterCourseCompleted();
        }
      }
    }
  };

  useEffect(() => {
    const deepThreadId = searchParams.get('threadId');
    if (deepThreadId && qaSelectedThreadId !== deepThreadId) {
      setQaSelectedThreadId(deepThreadId);
    }
  }, [qaSelectedThreadId, searchParams]);

  useEffect(() => {
    const deepLessonId = searchParams.get('lessonId');
    if (!deepLessonId) return;
    if (!Array.isArray(allLessons) || allLessons.length === 0) return;
    if (!allLessons.some((l: any) => String(l.id) === String(deepLessonId))) return;
    if (selectedLessonId !== deepLessonId) setSelectedLessonId(deepLessonId);
    setQaScope('LESSON');
  }, [allLessons, searchParams, selectedLessonId]);

  const { data: qaList, isLoading: qaListLoading, error: qaListError } = useQuery({
    queryKey: ['qaThreads', id, qaScope, qaScope === 'LESSON' ? currentLessonId : null],
    queryFn: async () => {
      const qs = qaScope === 'LESSON' && currentLessonId ? `?lessonId=${encodeURIComponent(String(currentLessonId))}` : '';
      const res = await fetch(`/api/courses/${id}/qa${qs}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err: any = new Error(data?.error || 'Gagal memuat Q&A');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data as { threads: QAThreadSummary[] };
    },
    enabled: Boolean(id && qaEnabled && !isLessonLocked),
  });

  const { data: qaThreadDetail, isLoading: qaThreadLoading, error: qaThreadError } = useQuery({
    queryKey: ['qaThread', qaSelectedThreadId],
    queryFn: async () => {
      const res = await fetch(`/api/qa/${qaSelectedThreadId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err: any = new Error(data?.error || 'Gagal memuat thread');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data as { thread: QAThreadDetail };
    },
    enabled: Boolean(qaSelectedThreadId),
  });

  useEffect(() => {
    const deepThreadId = searchParams.get('threadId');
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (!qaRef.current) return;
    if (didAutoScroll) return;
    if (deepThreadId || hash === '#qa') {
      qaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setDidAutoScroll(true);
    }
  }, [didAutoScroll, searchParams]);

  useEffect(() => {
    const deepThreadId = searchParams.get('threadId');
    if (!deepThreadId) return;
    const thread = qaThreadDetail?.thread;
    if (!thread) return;
    if (!thread.lessonId) setQaScope('COURSE');
    else setQaScope('LESSON');
    if (thread.lessonId) {
      if (!Array.isArray(allLessons) || allLessons.length === 0) return;
      if (!allLessons.some((l: any) => String(l.id) === String(thread.lessonId))) return;
      if (selectedLessonId !== thread.lessonId) setSelectedLessonId(thread.lessonId);
      replaceQueryParams({ lessonId: String(thread.lessonId) });
    }
  }, [allLessons, qaThreadDetail?.thread, searchParams, selectedLessonId]);

  const onCreateThread = async () => {
    if (!id || !qaEnabled || isLessonLocked) return;
    if (qaSubmitting) return;
    setQaSubmitting(true);
    try {
      const res = await fetch(`/api/courses/${id}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: qaTitle,
          question: qaQuestion,
          lessonId: qaScope === 'LESSON' ? currentLessonId || null : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal membuat pertanyaan');
      toast.success('Pertanyaan dibuat');
      setQaTitle('');
      setQaQuestion('');
      await queryClient.invalidateQueries({ queryKey: ['qaThreads', id] });
      if (data?.thread?.id) setQaSelectedThreadId(String(data.thread.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat pertanyaan';
      toast.error(message);
    } finally {
      setQaSubmitting(false);
    }
  };

  const onReplyThread = async () => {
    const threadId = qaSelectedThreadId;
    if (!threadId) return;
    const message = qaReplyMessage.trim();
    if (message.length < 2) {
      toast.error('Pesan minimal 2 karakter');
      return;
    }
    if (qaSubmitting) return;
    setQaSubmitting(true);
    try {
      const res = await fetch(`/api/qa/${threadId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim balasan');
      setQaReplyMessage('');
      await queryClient.invalidateQueries({ queryKey: ['qaThread', threadId] });
      await queryClient.invalidateQueries({ queryKey: ['qaThreads', id] });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Gagal mengirim balasan';
      toast.error(messageText);
    } finally {
      setQaSubmitting(false);
    }
  };

  const onToggleResolved = async () => {
    const threadId = qaSelectedThreadId;
    const current = qaThreadDetail?.thread;
    if (!threadId || !current) return;
    if (qaSubmitting) return;
    setQaSubmitting(true);
    try {
      const nextStatus = current.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED';
      const res = await fetch(`/api/qa/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal mengubah status');
      toast.success(nextStatus === 'RESOLVED' ? 'Thread ditandai selesai' : 'Thread dibuka kembali');
      await queryClient.invalidateQueries({ queryKey: ['qaThread', threadId] });
      await queryClient.invalidateQueries({ queryKey: ['qaThreads', id] });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Gagal mengubah status';
      toast.error(messageText);
    } finally {
      setQaSubmitting(false);
    }
  };

  if (!id) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Kursus Tidak Ditemukan</h1>
          <p className="text-slate-700">ID kursus tidak tersedia.</p>
        </div>
      </div>
    );
  }

  if (courseLoading || progressLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-700 font-medium">Memuat konten kursus...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Kursus Tidak Ditemukan</h1>
          <p className="text-slate-700">Maaf, kami tidak dapat menemukan kursus yang Anda cari.</p>
          <button
            onClick={() => router.push('/dashboard/student/courses')}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (allLessons.length === 0) {
    return <div className="p-8 text-center text-slate-700">Kursus ini belum memiliki materi.</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-80 bg-white border-r p-6 overflow-y-auto lg:h-screen lg:sticky lg:top-0">
        <h2 className="text-xl font-extrabold mb-6 text-slate-900">{course.title}</h2>
        
        <ProgressTracker 
          completedLessons={completedLessonsCount}
          totalLessons={allLessons.length}
          currentLessonTitle={currentLesson?.title || ''}
        />

        {courseRetakeEnabled ? (
          <div className="mt-5">
            <button
              onClick={handleRetake}
              disabled={retaking}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Undo2 className="w-4 h-4" />
              {retaking ? 'Memproses...' : 'Mulai Ulang Kursus'}
            </button>
          </div>
        ) : null}

        <div className="space-y-4 mt-6">
          {course.modules.map((module: any) => {
            const moduleId = String(module.id);
            const expanded = expandedModuleIds.includes(moduleId);
            const lessons = Array.isArray(module.lessons) ? module.lessons : [];
            const videoCount = lessons.filter((l: any) => String(l?.type) === 'VIDEO').length;
            const totalMinutes = lessons.reduce((sum: number, l: any) => sum + (typeof l?.duration === 'number' ? Math.max(0, l.duration) : 0), 0);
            const subtitleParts = [
              `${videoCount} video${videoCount === 1 ? '' : ''}`,
              totalMinutes > 0 ? `(${totalMinutes} menit)` : null,
            ].filter(Boolean);

            return (
              <div key={moduleId} className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedModuleIds((prev) =>
                      prev.includes(moduleId) ? prev.filter((x) => x !== moduleId) : [...prev, moduleId]
                    )
                  }
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 truncate">{module.title}</div>
                    <div className="text-xs text-slate-700 font-medium mt-0.5">{subtitleParts.length ? subtitleParts.join(' ') : `${lessons.length} materi`}</div>
                  </div>
                  <div className="shrink-0 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {expanded ? (
                  <div className="mt-3 space-y-2">
                    {lessons.map((lesson: any) => {
                      const isLessonCompleted = progress?.completedLessonIds?.includes(lesson.id);
                      const isActive = lesson.id === currentLesson.id;
                      const status = lockByLessonId.get(lesson.id);
                      const isLocked = Boolean(status?.isLocked);
                      const unlockText = formatUnlockDate(status?.unlockDate || null);
                      const durationText =
                        typeof lesson?.duration === 'number' && lesson.duration > 0 ? `${lesson.duration} menit` : null;

                      const Icon =
                        String(lesson?.type) === 'VIDEO'
                          ? Play
                          : String(lesson?.type) === 'QUIZ'
                            ? ClipboardList
                            : FileText;

                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => {
                            if (isLocked) {
                              const unlock = formatUnlockDate(status?.unlockDate || null);
                              const base = lockReasonText(status?.lockReason || null);
                              toast.error(unlock ? `${base} Dibuka pada: ${unlock}` : base);
                              return;
                            }
                            setSelectedLessonId(lesson.id);
                            replaceQueryParams({ lessonId: String(lesson.id), threadId: null, scope: null });
                          }}
                          disabled={isLocked}
                          className={[
                            'w-full rounded-2xl border px-3 py-3 flex items-center gap-3 transition-colors',
                            isActive ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50',
                            isLocked ? 'opacity-60 cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          <div
                            className={[
                              'w-9 h-9 rounded-full flex items-center justify-center shrink-0 border',
                              isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-700',
                            ].join(' ')}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className={['font-bold truncate', isActive ? 'text-indigo-900' : 'text-slate-900'].join(' ')}>
                              {lesson.title}
                            </div>
                            <div className="text-xs text-slate-700 font-medium mt-0.5 flex items-center gap-2">
                              {durationText ? <span>{durationText}</span> : null}
                              {isLocked ? (
                                <span
                                  className="text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide border border-slate-200"
                                  title={unlockText ? `Dibuka pada: ${unlockText}` : lockReasonText(status?.lockReason || null)}
                                >
                                  {lockReasonChip(status?.lockReason || null)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {isLocked ? <Lock className="w-4 h-4 text-slate-400 shrink-0" /> : null}
                            {isLessonCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-10">
        <div className="max-w-4xl mx-auto">
          {lessonLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-700 font-medium">Memuat materi...</p>
              </div>
            </div>
          ) : lessonError && (lessonError as any)?.status === 403 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-slate-900">Materi Terkunci</div>
                  <div className="text-sm text-slate-700 mt-1">
                    {lockReasonText(lessonStatus?.lockReason || (lessonError as any)?.data?.lockReason || null)}
                  </div>
                  {formatUnlockDate(lessonStatus?.unlockDate || (lessonError as any)?.data?.unlockDate || null) ? (
                    <div className="text-sm text-slate-700 mt-2">
                      Dibuka pada:{' '}
                      {formatUnlockDate(lessonStatus?.unlockDate || (lessonError as any)?.data?.unlockDate || null)}
                    </div>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => {
                        if (course?.slug) router.push(`/courses/${course.slug}`);
                        else router.push('/courses');
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm"
                    >
                      Kembali
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : lessonDetails?.quiz ? (
            <QuizPlayer courseId={id} quiz={lessonDetails.quiz} onComplete={onQuizComplete} />
          ) : lessonDetails ? (
            <LessonViewer lesson={lessonDetails} onComplete={onLessonComplete} courseId={id} courseSlug={course.slug} />
          ) : isLessonLocked ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-slate-900">Materi Terkunci</div>
                  <div className="text-sm text-slate-700 mt-1">{lockReasonText(lessonStatus?.lockReason || null)}</div>
                  {formatUnlockDate(lessonStatus?.unlockDate || null) ? (
                    <div className="text-sm text-slate-700 mt-2">Dibuka pada: {formatUnlockDate(lessonStatus?.unlockDate || null)}</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-700">Materi tidak tersedia.</div>
          )}

          {qaEnabled ? (
            <div ref={qaRef} className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-slate-900 truncate">Q&amp;A</div>
                    <div className="text-sm text-slate-700 truncate">{currentLesson?.title ? `Materi: ${currentLesson.title}` : 'Tanya jawab untuk materi ini'}</div>
                  </div>
                </div>
                {qaSelectedThreadId ? (
                  <button
                    onClick={() => setQaSelectedThreadId(null)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm shrink-0"
                  >
                    <Undo2 className="w-4 h-4" />
                    Kembali
                  </button>
                ) : null}
              </div>

              {isLessonLocked ? (
                <div className="mt-4 text-sm text-slate-700">
                  Q&amp;A tersedia setelah materi terbuka.
                </div>
              ) : qaSelectedThreadId ? (
                qaThreadLoading ? (
                  <div className="mt-6 text-sm text-slate-700">Memuat thread...</div>
                ) : qaThreadError ? (
                  <div className="mt-6 text-sm text-rose-600">{(qaThreadError as any)?.message || 'Gagal memuat thread'}</div>
                ) : qaThreadDetail?.thread ? (
                  <div className="mt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-bold text-slate-900">{qaThreadDetail.thread.title}</div>
                        <div className="text-xs text-slate-700 mt-1 font-medium">
                          {qaThreadDetail.thread.author.name} • {formatQaDate(qaThreadDetail.thread.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={onToggleResolved}
                        disabled={qaSubmitting}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border shrink-0 ${
                          qaThreadDetail.thread.status === 'RESOLVED'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {qaThreadDetail.thread.status === 'RESOLVED' ? 'Buka Lagi' : 'Selesai'}
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{qaThreadDetail.thread.question}</div>
                      </div>
                      {qaThreadDetail.thread.replies.map((r) => (
                        <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-bold text-slate-700 truncate">{r.author.name}</div>
                            <div className="text-xs text-slate-700 shrink-0 font-medium">{formatQaDate(r.createdAt)}</div>
                          </div>
                          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{r.message}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={qaReplyMessage}
                          onChange={(e) => setQaReplyMessage(e.target.value)}
                          placeholder="Tulis balasan..."
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={onReplyThread}
                            disabled={qaSubmitting}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm disabled:opacity-60"
                          >
                            <Send className="w-4 h-4" />
                            Kirim
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 text-sm text-slate-700">Thread tidak ditemukan.</div>
                )
              ) : (
                <div className="mt-6">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <button
                      onClick={() => setQaScope('LESSON')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                        qaScope === 'LESSON'
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Materi Ini
                    </button>
                    <button
                      onClick={() => setQaScope('COURSE')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                        qaScope === 'COURSE'
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Semua Materi
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-bold text-slate-900">Buat pertanyaan</div>
                    <div className="mt-3 grid gap-2">
                      <input
                        value={qaTitle}
                        onChange={(e) => setQaTitle(e.target.value)}
                        placeholder="Judul pertanyaan"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <textarea
                        value={qaQuestion}
                        onChange={(e) => setQaQuestion(e.target.value)}
                        placeholder="Tuliskan pertanyaan Anda..."
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={onCreateThread}
                          disabled={qaSubmitting}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm disabled:opacity-60"
                        >
                          <Send className="w-4 h-4" />
                          Kirim
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-bold text-slate-900">Diskusi</div>
                    {qaListLoading ? (
                      <div className="mt-2 text-sm text-slate-700">Memuat...</div>
                    ) : qaListError ? (
                      <div className="mt-2 text-sm text-rose-600">{(qaListError as any)?.message || 'Gagal memuat Q&A'}</div>
                    ) : qaList?.threads?.length ? (
                      <div className="mt-3 space-y-2">
                        {qaList.threads.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setQaSelectedThreadId(t.id)}
                            className="w-full text-left rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">{t.title}</div>
                                <div className="text-xs text-slate-700 mt-1 font-medium">
                                  {t.author.name} • {formatQaDate(t.createdAt)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wide ${
                                    t.status === 'RESOLVED'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {t.status === 'RESOLVED' ? 'Selesai' : 'Terbuka'}
                                </span>
                                <span className="text-xs text-slate-600">{t.replyCount} balasan</span>
                              </div>
                            </div>
                            {t.lastReplyAt ? (
                              <div className="mt-2 text-xs text-slate-700 font-medium">Balasan terakhir: {formatQaDate(t.lastReplyAt)}</div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-700">Belum ada pertanyaan untuk materi ini.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
