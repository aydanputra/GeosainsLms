"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Briefcase,
  CheckCircle,
  ChevronDown,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  Link2,
  Lock,
  MapPin,
  MessageSquare,
  MessageCircle,
  Phone,
  Play,
  SendHorizonal,
  Star,
  UserPlus,
  X,
  Loader2,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { normalizeImageUrl } from '@/modules/core/utils/image';
import CourseRatingWidget from './CourseRatingWidget';
import { useCourseDetailAccess } from './CourseDetailAccessProvider';

type CurriculumLesson = {
  id: string;
  title: string;
  type: 'VIDEO' | 'QUIZ' | 'TEXT' | string;
  duration: number;
  isPreview: boolean;
  isLocked: boolean;
  lockLabel: string;
  unlockDateLabel: string | null;
};

type CurriculumModule = {
  id: string;
  title: string;
  order: number;
  lessons: CurriculumLesson[];
};

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAtLabel: string;
  studentName: string;
  studentAvatarUrl: string | null;
};

type QaThreadItem = {
  id: string;
  lessonId: string | null;
  lessonTitle: string | null;
  title: string;
  question: string;
  createdAtLabel: string;
  authorName: string;
  replyCount: number;
  lastReplyAtLabel: string | null;
};

type CommentItem = {
  id: string;
  body: string;
  createdAtLabel: string;
  userName: string;
  userAvatarUrl: string | null;
  replies: Array<{
    id: string;
    body: string;
    createdAtLabel: string;
    userName: string;
    userAvatarUrl: string | null;
    role: string;
  }>;
};

type TabId = 'ABOUT' | 'KEY_POINT' | 'REVIEW' | 'QA' | 'COMMENTS' | 'MENTOR';

export default function CourseInfoTabs({
  slug,
  courseId,
  price,
  subtitle,
  descriptionHtml,
  learningOutcomes,
  totalLessons,
  totalDurationMinutes,
  modules,
  reviewsEnabled,
  ratingAvg,
  ratingCount,
  recentReviews,
  qaEnabled,
  mentor,
}: {
  slug: string;
  courseId: string;
  price: number;
  subtitle: string | null;
  descriptionHtml: string;
  learningOutcomes: string[];
  totalLessons: number;
  totalDurationMinutes: number;
  modules: CurriculumModule[];
  reviewsEnabled: boolean;
  ratingAvg: number;
  ratingCount: number;
  recentReviews: ReviewItem[];
  qaEnabled: boolean;
  mentor: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    profileCoverUrl?: string | null;
    phone?: string | null;
    country?: string | null;
    province?: string | null;
    city?: string | null;
    address?: string | null;
    socialLinks?: unknown;
    mentorJobTitle?: string | null;
    mentorBio?: string | null;
    mentorSkills?: string[];
    mentorEducations?: unknown;
    mentorExperiences?: unknown;
    mentorAttachments?: unknown;
  };
}) {
  const access = useCourseDetailAccess();
  const normalizeAvatarUrl = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (!v) return null;
    const lower = v.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return v;
  };

  const [active, setActive] = useState<TabId>('ABOUT');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCtaLoading, setIsCtaLoading] = useState(false);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [isPostingReply, setIsPostingReply] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [hasLoadedComments, setHasLoadedComments] = useState(false);

  const [followersCount, setFollowersCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [hasLoadedFollow, setHasLoadedFollow] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);
  const [dmModalDraft, setDmModalDraft] = useState('');
  const [isSendingDmModal, setIsSendingDmModal] = useState(false);
  const effectiveModules = access.modules ?? modules;
  const isLoggedIn = access.isLoggedIn;
  const isEnrolled = access.isEnrolled;
  const canRate = access.canRate;
  const canViewQa = access.canViewQa;
  const qaThreads = access.qaThreads;
  const viewer = access.viewer;
  const enrollmentExpired = access.enrollmentExpired;

  const isLoadingCommentsRef = useRef(false);

  const tabs = useMemo(() => {
    const items: Array<{ id: TabId; label: string }> = [
      { id: 'ABOUT', label: 'About' },
      { id: 'KEY_POINT', label: 'Key Point' },
      { id: 'REVIEW', label: 'Review' },
      { id: 'QA', label: 'Q&A' },
      { id: 'COMMENTS', label: 'Komentar' },
      { id: 'MENTOR', label: 'Mentor' },
    ];
    return items.filter((t) => {
      if (t.id === 'REVIEW') return reviewsEnabled;
      if (t.id === 'QA') return qaEnabled;
      return true;
    });
  }, [qaEnabled, reviewsEnabled]);

  const filledStars = useMemo(() => Math.max(0, Math.min(5, Math.round(ratingAvg || 0))), [ratingAvg]);
  const priceLabel = useMemo(() => (Number(price || 0) <= 0 ? 'Gratis' : `Rp ${Number(price || 0).toLocaleString('id-ID')}`), [price]);

  useEffect(() => {
    setOpenModules((prev) => {
      const next = { ...prev };
      for (const m of effectiveModules) {
        if (typeof next[m.id] !== 'boolean') next[m.id] = true;
      }
      return next;
    });
  }, [effectiveModules]);

  useEffect(() => {
    const raw = searchParams.get('tab');
    const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    const map: Record<string, TabId> = {
      about: 'ABOUT',
      key_point: 'KEY_POINT',
      keypoint: 'KEY_POINT',
      review: 'REVIEW',
      qa: 'QA',
      mentor: 'MENTOR',
      komentar: 'COMMENTS',
      comment: 'COMMENTS',
      comments: 'COMMENTS',
      pesan: 'COMMENTS',
      messages: 'COMMENTS',
    };
    const next = map[normalized];
    if (next && next !== active) setActive(next);
  }, [active, searchParams]);

  const loadComments = async (args: { reset: boolean; silent?: boolean }) => {
    if (!isLoggedIn) return;
    if (isLoadingCommentsRef.current) return;
    isLoadingCommentsRef.current = true;
    const silent = Boolean(args.silent);
    if (!silent) setIsLoadingComments(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/messages?limit=50`, { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return;
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal memuat komentar');
      const list = Array.isArray((data as any)?.comments) ? (data as any).comments : [];
      const mapped: CommentItem[] = list.map((c: any) => ({
        id: String(c.id),
        body: String(c.body || ''),
        createdAtLabel: new Date(c.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        userName: String(c.user?.name || c.user?.email || 'User'),
        userAvatarUrl: normalizeAvatarUrl(c.user?.avatarUrl),
        replies: (Array.isArray(c.replies) ? c.replies : []).map((r: any) => ({
          id: String(r.id),
          body: String(r.body || ''),
          createdAtLabel: new Date(r.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
          userName: String(r.user?.name || r.user?.email || 'Mentor'),
          userAvatarUrl: normalizeAvatarUrl(r.user?.avatarUrl),
          role: String(r.user?.role || ''),
        })),
      }));
      setComments((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setHasLoadedComments(true);
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Gagal memuat komentar');
    } finally {
      isLoadingCommentsRef.current = false;
      if (!silent) setIsLoadingComments(false);
    }
  };

  useEffect(() => {
    if (active !== 'COMMENTS') return;
    if (!isLoggedIn) return;
    if (hasLoadedComments) return;
    loadComments({ reset: true });
  }, [active, hasLoadedComments, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (active !== 'MENTOR') return;
    const mentorId = String(mentor.id || '').trim();
    if (!mentorId) return;
    if (hasLoadedFollow) return;
    if (isLoadingFollow) return;
    setIsLoadingFollow(true);
    fetch(`/api/users/${encodeURIComponent(mentorId)}/follow`, { cache: 'no-store', credentials: 'include' })
      .then((res) => res.json().then((d) => ({ ok: res.ok, status: res.status, data: d })))
      .then(({ ok, data }) => {
        if (!ok) return;
        setFollowersCount(Number(data?.followersCount || 0) || 0);
        setIsFollowing(Boolean(data?.isFollowing));
        setHasLoadedFollow(true);
      })
      .catch(() => {})
      .finally(() => setIsLoadingFollow(false));
  }, [active, hasLoadedFollow, isLoadingFollow, mentor.id]);

  const handlePostComment = async () => {
    if (!isLoggedIn) {
      toast.error('Silakan login terlebih dahulu');
      router.push(`/login?redirect=/courses/${encodeURIComponent(slug)}?tab=komentar`);
      return;
    }
    if (isPostingComment) return;
    const msg = commentDraft.trim();
    if (msg.length < 2) {
      toast.error('Komentar minimal 2 karakter');
      return;
    }
    setIsPostingComment(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal mengirim komentar');
      const created = (data as any)?.comment;
      if (created?.id) {
        const nextComment: CommentItem = {
          id: String(created.id),
          body: String(created.body || msg),
          createdAtLabel: created.createdAt
            ? new Date(created.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
            : new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
          userName: String(created.user?.name || created.user?.email || 'User'),
          userAvatarUrl: normalizeAvatarUrl(created.user?.avatarUrl),
          replies: [],
        };
        setComments((prev) => [nextComment, ...prev]);
        setHasLoadedComments(true);
      } else {
        setHasLoadedComments(false);
      }
      setCommentDraft('');
      toast.success('Komentar terkirim');
      setActive('COMMENTS');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim komentar');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handlePostReply = async (commentId: string) => {
    if (!isLoggedIn) {
      toast.error('Silakan login terlebih dahulu');
      router.push(`/login?redirect=/courses/${encodeURIComponent(slug)}?tab=komentar`);
      return;
    }
    if (isPostingReply) return;
    const msg = replyDraft.trim();
    if (msg.length < 2) {
      toast.error('Balasan minimal 2 karakter');
      return;
    }
    setIsPostingReply(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: msg, replyToCommentId: commentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal mengirim balasan');
      const createdReply = (data as any)?.reply;
      if (createdReply?.id) {
        const nextReply = {
          id: String(createdReply.id),
          body: String(createdReply.body || msg),
          createdAtLabel: createdReply.createdAt
            ? new Date(createdReply.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
            : new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
          userName: String(viewer.id === mentor.id ? mentor.name : 'Anda'),
          userAvatarUrl: viewer.id === mentor.id ? normalizeAvatarUrl(mentor.avatarUrl) : null,
          role: viewer.role || '',
        };
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  replies: [...comment.replies, nextReply],
                }
              : comment
          )
        );
        setHasLoadedComments(true);
      }
      setReplyDraft('');
      setReplyToCommentId(null);
      toast.success('Balasan terkirim');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim balasan');
    } finally {
      setIsPostingReply(false);
    }
  };

  const handleEnroll = async () => {
    if (!isLoggedIn) {
      toast.error('Silakan login terlebih dahulu');
      router.push(`/login?redirect=/courses/${encodeURIComponent(slug)}`);
      return;
    }
    if (enrollmentExpired) {
      toast.error('Akses kursus Anda sudah berakhir');
      return;
    }
    setIsCtaLoading(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/enroll`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal mendaftar kursus');
      toast.success((data as any)?.message || 'Berhasil mendaftar kursus!');
      router.refresh();
      const paymentUrl = typeof (data as any)?.paymentUrl === 'string' ? String((data as any).paymentUrl).trim() : '';
      if (paymentUrl) {
        router.push(paymentUrl);
      } else {
        router.push((data as any)?.redirectUrl || `/courses/${encodeURIComponent(slug)}/learn`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mendaftar kursus');
    } finally {
      setIsCtaLoading(false);
    }
  };

  const handleContinue = () => {
    router.push(`/courses/${encodeURIComponent(slug)}/learn`);
  };

  const handleToggleFollow = async () => {
    const mentorId = String(mentor.id || '').trim();
    if (!mentorId) return;
    if (!isLoggedIn) {
      toast.error('Silakan login terlebih dahulu');
      router.push(`/login?redirect=/courses/${encodeURIComponent(slug)}?tab=mentor`);
      return;
    }
    if (viewer.id && viewer.id === mentorId) return;
    if (isTogglingFollow) return;
    setIsTogglingFollow(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(mentorId)}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal memperbarui follow');
      setIsFollowing(Boolean((data as any)?.isFollowing));
      setFollowersCount(Number((data as any)?.followersCount || 0) || 0);
      toast.success(isFollowing ? 'Berhenti mengikuti' : 'Berhasil mengikuti');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memperbarui follow');
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const handleOpenDm = async () => {
    const mentorId = String(mentor.id || '').trim();
    if (!mentorId) return;
    if (!isLoggedIn) {
      toast.error('Silakan login terlebih dahulu');
      router.push(`/login?redirect=/courses/${encodeURIComponent(slug)}?tab=mentor`);
      return;
    }
    if (viewer.id && viewer.id === mentorId) return;
    setDmModalDraft('');
    setIsDmModalOpen(true);
  };

  const handleSendDmFromModal = async () => {
    const mentorId = String(mentor.id || '').trim();
    if (!mentorId) return;
    if (!isLoggedIn) {
      toast.error('Silakan login terlebih dahulu');
      router.push(`/login?redirect=/courses/${encodeURIComponent(slug)}?tab=mentor`);
      return;
    }
    if (viewer.id && viewer.id === mentorId) return;
    if (isSendingDmModal) return;
    const msg = dmModalDraft.trim();
    if (msg.length < 1) {
      toast.error('Pesan tidak boleh kosong');
      return;
    }
    if (msg.length > 4000) {
      toast.error('Pesan terlalu panjang');
      return;
    }
    setIsSendingDmModal(true);
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: mentorId, message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal mengirim pesan');
      setIsDmModalOpen(false);
      setDmModalDraft('');
      toast.success('Pesan terkirim');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim pesan');
    } finally {
      setIsSendingDmModal(false);
    }
  };

  const mentorLocationLabel = useMemo(() => {
    const parts = [mentor.city, mentor.province, mentor.country].filter((v) => typeof v === 'string' && v.trim());
    return parts.join(', ');
  }, [mentor.city, mentor.country, mentor.province]);

  const mentorSocials = useMemo(() => {
    const raw = mentor.socialLinks as any;
    const entries: Array<{ label: string; href: string }> = [];
    const add = (label: string, href: string) => {
      const trimmed = href.trim();
      if (!trimmed) return;
      entries.push({ label, href: trimmed });
    };
    const normHandle = (v: any) => String(v || '').trim().replace(/^@/, '');
    const isUrl = (v: string) => /^https?:\/\//i.test(v);

    const ig = normHandle(raw?.instagram);
    if (ig) add('Instagram', isUrl(ig) ? ig : `https://instagram.com/${ig}`);
    const wa = String(raw?.whatsapp || '').trim();
    if (wa) {
      if (isUrl(wa)) add('WhatsApp', wa);
      else {
        const digits = wa.replace(/[^\d]/g, '');
        add('WhatsApp', digits ? `https://wa.me/${digits}` : wa);
      }
    }
    const fb = String(raw?.facebook || '').trim();
    if (fb) add('Facebook', isUrl(fb) ? fb : `https://facebook.com/${normHandle(fb)}`);
    const li = String(raw?.linkedin || '').trim();
    if (li) add('LinkedIn', isUrl(li) ? li : `https://linkedin.com/in/${normHandle(li)}`);
    const tk = normHandle(raw?.tiktok);
    if (tk) add('TikTok', isUrl(tk) ? tk : `https://tiktok.com/@${tk}`);

    return entries;
  }, [mentor.socialLinks]);

  const mentorEducations = useMemo(() => {
    const list = Array.isArray(mentor.mentorEducations) ? (mentor.mentorEducations as any[]) : [];
    return list
      .filter((v) => v && typeof v === 'object')
      .map((v) => ({
        id: typeof v.id === 'string' ? v.id : '',
        title: typeof v.title === 'string' ? v.title : '',
        subtitle: typeof v.subtitle === 'string' ? v.subtitle : null,
        years: typeof v.years === 'string' ? v.years : null,
        description: typeof v.description === 'string' ? v.description : null,
      }))
      .filter((v) => v.id && v.title);
  }, [mentor.mentorEducations]);

  const mentorExperiences = useMemo(() => {
    const list = Array.isArray(mentor.mentorExperiences) ? (mentor.mentorExperiences as any[]) : [];
    return list
      .filter((v) => v && typeof v === 'object')
      .map((v) => ({
        id: typeof v.id === 'string' ? v.id : '',
        title: typeof v.title === 'string' ? v.title : '',
        subtitle: typeof v.subtitle === 'string' ? v.subtitle : null,
        years: typeof v.years === 'string' ? v.years : null,
        description: typeof v.description === 'string' ? v.description : null,
      }))
      .filter((v) => v.id && v.title);
  }, [mentor.mentorExperiences]);

  const mentorAttachments = useMemo(() => {
    const list = Array.isArray(mentor.mentorAttachments) ? (mentor.mentorAttachments as any[]) : [];
    return list
      .filter((v) => v && typeof v === 'object')
      .map((v) => ({
        id: typeof v.id === 'string' ? v.id : '',
        url: typeof v.url === 'string' ? v.url : '',
        filename: typeof v.filename === 'string' ? v.filename : '',
      }))
      .filter((v) => v.id && v.url);
  }, [mentor.mentorAttachments]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={[
              'px-4 py-2 rounded-xl text-sm font-extrabold transition-colors shrink-0 whitespace-nowrap',
              active === t.id ? 'bg-white text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:bg-white',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'ABOUT' ? (
        <div className="p-6 space-y-4">
          <div className="text-lg font-extrabold text-slate-900">Tentang Kursus</div>
          {subtitle ? <div className="text-sm text-slate-600">{subtitle}</div> : null}
          <div
            className="max-w-none text-slate-700 leading-relaxed [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc [&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_li]:my-1 [&_a]:text-indigo-600 [&_a]:underline [&_a:hover]:text-indigo-700 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600 [&_hr]:my-6 [&_hr]:border-slate-200"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        </div>
      ) : null}

      {active === 'KEY_POINT' ? (
        <div className="p-6 space-y-6">
          <div className="text-lg font-extrabold text-slate-900">Key Point</div>

          {learningOutcomes.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-extrabold text-slate-900">Apa yang akan dipelajari</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {learningOutcomes.map((outcome, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="mt-0.5 bg-emerald-100 p-1 rounded-full shrink-0">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-slate-700 text-sm font-medium">{outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Belum ada key point.</div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">Kurikulum</div>
              <div className="text-xs text-slate-500 font-bold hidden sm:block">
                {modules.length} Modul • {totalLessons} Materi • {Math.round(totalDurationMinutes)} Menit
              </div>
            </div>
            <div className="space-y-3">
              {effectiveModules.map((module) => (
                <div key={module.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenModules((prev) => ({ ...prev, [module.id]: !prev[module.id] }))}
                    className={[
                      'w-full bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-3 text-left px-5 py-3.5',
                    ].join(' ')}
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-800 truncate">{module.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{module.lessons.length} Pelajaran</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-extrabold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                        {module.lessons.length}
                      </span>
                      <ChevronDown
                        className={[
                          'w-4 h-4 text-slate-500 transition-transform',
                          openModules[module.id] ? 'rotate-180' : 'rotate-0',
                        ].join(' ')}
                      />
                    </div>
                  </button>
                  <div
                    className={[
                      'grid transition-[grid-template-rows] duration-300 ease-out',
                      openModules[module.id] ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    ].join(' ')}
                  >
                    <div className="overflow-hidden">
                      <div className="divide-y divide-slate-100">
                        {module.lessons.map((lesson) => (
                          <div key={lesson.id} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-1.5 rounded-lg shrink-0 ${
                              lesson.type === 'VIDEO'
                                ? 'bg-blue-50 text-blue-600'
                                : lesson.type === 'QUIZ'
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {lesson.type === 'VIDEO' ? (
                              <Play className="w-4 h-4" />
                            ) : lesson.type === 'QUIZ' ? (
                              <HelpCircle className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 truncate">{lesson.title}</div>
                            {lesson.isPreview ? (
                              <div className="mt-1">
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wide border border-emerald-200">
                                  Preview
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {lesson.isLocked && !lesson.isPreview ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide border border-slate-200">
                                {lesson.lockLabel}
                              </span>
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              {lesson.unlockDateLabel ? <span className="text-[10px] text-slate-400 hidden sm:inline">{lesson.unlockDateLabel}</span> : null}
                            </div>
                          ) : null}
                          <span className="text-xs text-slate-400 w-12 text-right">{lesson.duration}m</span>
                        </div>
                      </div>
                    ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {active === 'REVIEW' ? (
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-extrabold text-slate-900">Review</div>
            <div className="text-xs text-slate-500 font-bold">{ratingCount} ulasan</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                  <Star className="w-5 h-5" fill="currentColor" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-slate-900 leading-none">{ratingAvg ? ratingAvg.toFixed(1) : '0.0'}</div>
                  <div className="text-xs text-slate-500 font-bold mt-1">Rata-rata rating</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const activeStar = i < filledStars;
                  return (
                    <Star key={i} className={`w-4 h-4 ${activeStar ? 'text-amber-500' : 'text-slate-300'}`} fill={activeStar ? 'currentColor' : 'none'} />
                  );
                })}
              </div>
            </div>
          </div>

          {canRate ? (
            <CourseRatingWidget courseId={courseId} initialRatingAvg={ratingAvg} initialRatingCount={ratingCount} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              {enrollmentExpired ? (
                <div>Akses kursus Anda sudah berakhir, sehingga tidak bisa memberi review.</div>
              ) : (
                <div>Daftar kursus untuk memberikan review.</div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {recentReviews.length === 0 ? (
              <div className="text-sm text-slate-600">Belum ada review.</div>
            ) : (
              recentReviews.map((r) => {
                const initials = String(r.studentName || 'S').trim().slice(0, 1).toUpperCase();
                return (
                  <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-indigo-100 shrink-0 flex items-center justify-center text-indigo-700 font-extrabold">
                          {r.studentAvatarUrl ? (
                            <Image
                              src={normalizeImageUrl(r.studentAvatarUrl)!}
                              alt={r.studentName}
                              width={40}
                              height={40}
                              sizes="40px"
                              quality={60}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">{r.studentName}</div>
                          <div className="mt-1 flex items-center gap-1.5">
                            {Array.from({ length: 5 }).map((_, i) => {
                              const activeStar = i < Math.max(0, Math.min(5, Number(r.rating) || 0));
                              return (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${activeStar ? 'text-amber-500' : 'text-slate-300'}`}
                                  fill={activeStar ? 'currentColor' : 'none'}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 shrink-0">{r.createdAtLabel}</div>
                    </div>
                    {r.comment ? <div className="mt-3 text-sm text-slate-700 whitespace-pre-line">{r.comment}</div> : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {active === 'QA' ? (
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-extrabold text-slate-900">Q&A</div>
            {canViewQa ? (
              <Link href={`/courses/${encodeURIComponent(slug)}/learn#qa`} className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 underline">
                Buka Tanya Jawab
              </Link>
            ) : null}
          </div>

          {canViewQa ? (
            <div className="space-y-3">
              {qaThreads.length === 0 ? (
                <div className="text-sm text-slate-600">Belum ada pertanyaan.</div>
              ) : (
                qaThreads.map((t) => {
                  const initials = String(t.authorName || 'U').trim().slice(0, 1).toUpperCase();
                  return (
                    <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-indigo-100 shrink-0 flex items-center justify-center text-indigo-700 font-extrabold">
                        {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-slate-900 truncate">{t.authorName}</div>
                              <div className="mt-1 text-xs text-slate-500">{t.createdAtLabel}</div>
                            </div>
                            <Link
                              href={`/courses/${encodeURIComponent(slug)}/learn?threadId=${encodeURIComponent(t.id)}${t.lessonId ? `&lessonId=${encodeURIComponent(t.lessonId)}` : ''}#qa`}
                              className="shrink-0 text-xs font-extrabold text-indigo-600 hover:text-indigo-700"
                            >
                              Lihat
                            </Link>
                          </div>

                          <div className="mt-3 text-sm font-extrabold text-slate-900 line-clamp-2">{t.title}</div>
                          <div className="mt-2 text-sm text-slate-700 whitespace-pre-line line-clamp-4">{t.question}</div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold text-slate-600 inline-flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-slate-400" />
                          {t.replyCount} balasan
                        </div>
                        <div className="text-xs text-slate-500 font-bold truncate">
                          {t.lastReplyAtLabel ? `Terakhir dibalas: ${t.lastReplyAtLabel}` : 'Belum ada balasan'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <div>Login dan daftar kursus untuk melihat dan bertanya di Q&A.</div>
            </div>
          )}
        </div>
      ) : null}

      {active === 'COMMENTS' ? (
        <div className="p-6 space-y-5">
          <div>
            <div className="text-lg font-extrabold text-slate-900">Komentar</div>
            <div className="text-sm text-slate-600 mt-1">
              Komentar untuk kursus ini bisa dibuat oleh semua user yang sudah login.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-extrabold text-slate-900">Tulis Komentar</div>
            <div className="mt-3">
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                rows={4}
                placeholder="Tulis komentar Anda..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">Minimal 2 karakter.</div>
              <button
                type="button"
                onClick={handlePostComment}
                disabled={isPostingComment || commentDraft.trim().length < 2}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {isPostingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Kirim Komentar
              </button>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="text-sm text-slate-600">
              Anda belum login.{' '}
              <button
                type="button"
                onClick={() => router.push(`/login?redirect=/courses/${encodeURIComponent(slug)}?tab=komentar`)}
                className="text-indigo-600 font-extrabold hover:text-indigo-700 underline"
              >
                Login untuk melihat & menulis komentar
              </button>
            </div>
          ) : null}

          {isLoggedIn ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-900">Komentar Terbaru</div>
                <button
                  type="button"
                  onClick={() => loadComments({ reset: true })}
                  disabled={isLoadingComments}
                  className="h-9 w-full sm:w-auto px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50 disabled:opacity-60"
                >
                  Refresh
                </button>
              </div>

              {isLoadingComments ? (
                <div className="mt-4 text-sm text-slate-600 inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memuat komentar...
                </div>
              ) : comments.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">Belum ada komentar.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {comments.map((c) => {
                    const initials = String(c.userName || 'U').trim().slice(0, 1).toUpperCase();
                    const isReplying = replyToCommentId === c.id;
                    return (
                      <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                            {c.userAvatarUrl ? (
                              <Image
                                src={normalizeImageUrl(c.userAvatarUrl)!}
                                alt={c.userName}
                                width={40}
                                height={40}
                                sizes="40px"
                                quality={60}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-sm font-extrabold text-slate-600">{initials}</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                              <div className="text-sm font-extrabold text-slate-900 truncate">{c.userName}</div>
                              <div className="text-[11px] text-slate-500 shrink-0">{c.createdAtLabel}</div>
                            </div>
                            <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{c.body}</div>

                            {Array.isArray(c.replies) && c.replies.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {c.replies.map((r) => {
                                  const rInitials = String(r.userName || 'M').trim().slice(0, 1).toUpperCase();
                                  const isMentor = String(r.role || '').toUpperCase().includes('MENTOR');
                                  return (
                                    <div
                                      key={r.id}
                                      className={twMerge(
                                        'rounded-2xl border p-3',
                                        isMentor ? 'bg-emerald-50 border-emerald-200/80' : 'bg-slate-50 border-slate-200'
                                      )}
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="h-9 w-9 rounded-2xl overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center">
                                          {r.userAvatarUrl ? (
                                            <Image
                                              src={normalizeImageUrl(r.userAvatarUrl)!}
                                              alt={r.userName}
                                              width={36}
                                              height={36}
                                              sizes="36px"
                                              quality={60}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <div className="text-xs font-extrabold text-slate-600">{rInitials}</div>
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-xs font-extrabold text-slate-900 truncate">{r.userName}</div>
                                            <div className="text-[11px] text-slate-500 shrink-0">{r.createdAtLabel}</div>
                                          </div>
                                          <div className="mt-1.5 text-sm text-slate-700 whitespace-pre-wrap">{r.body}</div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (replyToCommentId === c.id) {
                                    setReplyToCommentId(null);
                                    setReplyDraft('');
                                  } else {
                                    setReplyToCommentId(c.id);
                                    setReplyDraft('');
                                  }
                                }}
                                className="text-xs font-extrabold text-slate-700 hover:text-slate-900 underline"
                              >
                                {isReplying ? 'Batal' : 'Balas'}
                              </button>
                            </div>

                            {isReplying ? (
                              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <textarea
                                  value={replyDraft}
                                  onChange={(e) => setReplyDraft(e.target.value)}
                                  rows={3}
                                  placeholder="Tulis balasan Anda..."
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyToCommentId(null);
                                      setReplyDraft('');
                                    }}
                                    className="h-10 w-full sm:w-auto px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50"
                                    disabled={isPostingReply}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePostReply(c.id)}
                                    disabled={isPostingReply}
                                    className="h-10 w-full sm:w-auto px-4 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                                  >
                                    {isPostingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Kirim Balasan
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {active === 'MENTOR' ? (
        <div className="p-6 space-y-4">
          <div className="text-lg font-extrabold text-slate-900">Mentor</div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="relative h-32 bg-slate-900">
              {mentor.profileCoverUrl ? (
                <Image
                  src={normalizeImageUrl(mentor.profileCoverUrl)!}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 960px"
                  quality={65}
                  className="object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/30 to-transparent" />
              <div className="absolute -bottom-10 left-5 h-20 w-20 rounded-2xl overflow-hidden border-4 border-white bg-slate-100 flex items-center justify-center shadow-sm">
                {mentor.avatarUrl ? (
                  <Image
                    src={normalizeImageUrl(mentor.avatarUrl)!}
                    alt={mentor.name}
                    width={80}
                    height={80}
                    sizes="80px"
                    quality={60}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-xl font-extrabold text-slate-600">{String(mentor.name || 'M').trim().slice(0, 1).toUpperCase()}</div>
                )}
              </div>
            </div>

            <div className="p-5 pt-14">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-slate-900 truncate">{mentor.name}</div>
                  <div className="text-sm text-slate-600 truncate">{mentor.mentorJobTitle || mentor.email}</div>
                  {mentor.mentorJobTitle ? <div className="text-xs text-slate-500 truncate">{mentor.email}</div> : null}
                  <div className="mt-1 text-xs text-slate-500">{isLoadingFollow ? 'Memuat...' : `${followersCount.toLocaleString('id-ID')} pengikut`}</div>

                  {(mentorLocationLabel || mentor.phone) ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {mentorLocationLabel ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-700">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          {mentorLocationLabel}
                        </div>
                      ) : null}
                      {mentor.phone ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-700">
                          <Phone className="w-4 h-4 text-slate-500" />
                          {mentor.phone}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end sm:items-center">
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={isTogglingFollow || !mentor.id || viewer.id === mentor.id}
                    className={twMerge(
                      'h-10 px-4 rounded-xl text-xs font-extrabold border inline-flex items-center justify-center gap-2 disabled:opacity-60 w-full sm:w-auto',
                      isFollowing ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    {isTogglingFollow ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {isFollowing ? 'Mengikuti' : 'Follow'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenDm}
                    disabled={!mentor.id || viewer.id === mentor.id}
                    className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 inline-flex items-center justify-center gap-2 disabled:opacity-60 w-full sm:w-auto"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Kirim Pesan
                  </button>
                </div>
              </div>

              {mentorSocials.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {mentorSocials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                    >
                      <Link2 className="w-4 h-4 text-slate-500" />
                      {s.label}
                    </a>
                  ))}
                </div>
              ) : null}

              {mentor.mentorBio ? <div className="mt-5 text-sm text-slate-700 whitespace-pre-wrap">{mentor.mentorBio}</div> : null}
            </div>
          </div>

          {isDmModalOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <button
                type="button"
                onClick={() => (isSendingDmModal ? null : setIsDmModalOpen(false))}
                className="absolute inset-0 bg-slate-900/50"
              />
              <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-slate-900 truncate">Kirim Pesan</div>
                    <div className="text-xs text-slate-500 truncate">{mentor.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => (isSendingDmModal ? null : setIsDmModalOpen(false))}
                    className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center"
                    aria-label="Tutup"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5">
                  <textarea
                    value={dmModalDraft}
                    onChange={(e) => setDmModalDraft(e.target.value)}
                    rows={4}
                    placeholder="Tulis pesan Anda..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => (isSendingDmModal ? null : setIsDmModalOpen(false))}
                      disabled={isSendingDmModal}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50 disabled:opacity-60"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSendDmFromModal}
                      disabled={isSendingDmModal || dmModalDraft.trim().length === 0}
                      className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {isSendingDmModal ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                      Kirim
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {Array.isArray(mentor.mentorSkills) && mentor.mentorSkills.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-extrabold text-slate-900">Keahlian</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mentor.mentorSkills.filter((v) => typeof v === 'string' && v.trim()).map((s) => (
                  <div key={s} className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-700">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {mentorEducations.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <GraduationCap className="w-4 h-4 text-slate-600" /> Pendidikan
              </div>
              <div className="mt-4 space-y-3">
                {mentorEducations.map((e) => (
                  <div key={e.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900">{e.title}</div>
                        {e.subtitle ? <div className="text-sm text-slate-600 mt-0.5">{e.subtitle}</div> : null}
                        {e.description ? <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{e.description}</div> : null}
                      </div>
                      {e.years ? <div className="text-xs font-extrabold text-slate-500 shrink-0">{e.years}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {mentorExperiences.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Briefcase className="w-4 h-4 text-slate-600" /> Pengalaman
              </div>
              <div className="mt-4 space-y-3">
                {mentorExperiences.map((e) => (
                  <div key={e.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900">{e.title}</div>
                        {e.subtitle ? <div className="text-sm text-slate-600 mt-0.5">{e.subtitle}</div> : null}
                        {e.description ? <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{e.description}</div> : null}
                      </div>
                      {e.years ? <div className="text-xs font-extrabold text-slate-500 shrink-0">{e.years}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {mentorAttachments.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-extrabold text-slate-900">Lampiran</div>
              <div className="mt-4 space-y-2">
                {mentorAttachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{a.filename || 'Lampiran'}</div>
                      <div className="text-xs text-slate-500 truncate">{a.url}</div>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4 text-slate-700" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Harga</div>
              <div className="text-base font-extrabold text-slate-900 truncate">{priceLabel}</div>
            </div>
            {isEnrolled ? (
              <button
                type="button"
                onClick={handleContinue}
                className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-700"
              >
                Lanjut Belajar
              </button>
            ) : (
              <button
                type="button"
                disabled={isCtaLoading || enrollmentExpired}
                onClick={handleEnroll}
                className="shrink-0 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {isCtaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {enrollmentExpired ? 'Akses Berakhir' : Number(price || 0) <= 0 ? 'Daftar' : 'Beli'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
