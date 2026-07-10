"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import { twMerge } from 'tailwind-merge';
import { Award, BookOpen, Briefcase, Eye, EyeOff, FileText, GraduationCap, Mail, MapPin, MoreHorizontal, Settings2, ShoppingBag, User, X } from 'lucide-react';

type MentorListItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  years?: string | null;
  description?: string | null;
};

type MentorAttachment = {
  id: string;
  url: string;
  filename: string;
};

const SimpleTagInput = ({
  value,
  onChange,
  placeholder,
  inputClassName,
  maxTags = 30,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  inputClassName: string;
  maxTags?: number;
}) => {
  const [draft, setDraft] = useState('');

  const normalize = (raw: string) => raw.trim().replace(/\s+/g, ' ');

  const addFromRaw = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => normalize(p))
      .filter(Boolean);
    if (parts.length === 0) return;

    const existingLower = new Set((Array.isArray(value) ? value : []).map((t) => String(t).toLowerCase()));
    const next = [...(Array.isArray(value) ? value : [])];

    for (const p of parts) {
      const key = p.toLowerCase();
      if (existingLower.has(key)) continue;
      existingLower.add(key);
      next.push(p);
    }

    onChange(next.slice(0, maxTags));
  };

  const commitDraft = () => {
    const raw = draft;
    setDraft('');
    addFromRaw(raw);
  };

  const removeAt = (idx: number) => {
    const next = (Array.isArray(value) ? value : []).filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {Array.isArray(value) && value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((t, idx) => (
            <span
              key={`${t}-${idx}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-extrabold"
            >
              <span className="max-w-[220px] truncate">{t}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="text-slate-500 hover:text-rose-600"
                aria-label="Hapus"
                title="Hapus"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitDraft();
          }
        }}
        onBlur={() => {
          if (draft.trim()) commitDraft();
        }}
        placeholder={placeholder || 'Ketik lalu tekan Enter / koma'}
        className={inputClassName}
      />
    </div>
  );
};

type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
  profileCoverUrl?: string | null;
  signatureUrl?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthDate?: string | null;
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
  role: 'ADMIN' | 'MENTOR' | 'STUDENT';
  isSuperAdmin?: boolean;
  totpEnabled?: boolean;
  totpVerifiedAt?: string | null;
  createdAt?: string;
};

type LoginHistoryItem = {
  id: string;
  action: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
  createdAt: string;
  actor?: { id: string; name: string | null; email: string; role?: string | null } | null;
};

export default function ProfilePage({
  initialUser,
  variant = 'standalone',
  context = 'page',
  mode = 'profile',
}: {
  initialUser: SessionUser;
  variant?: 'standalone' | 'dashboard';
  context?: 'page' | 'tab';
  mode?: 'profile' | 'settings';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const didAutoRedirectRef = useRef(false);
  const [name, setName] = useState(initialUser.name || '');
  const [email, setEmail] = useState(initialUser.email || '');
  const [savingBasic, setSavingBasic] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const signatureFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAttachmentPickerOpen, setIsAttachmentPickerOpen] = useState(false);
  const [isVendorMediaOpen, setIsVendorMediaOpen] = useState(false);
  const [vendorMediaTarget, setVendorMediaTarget] = useState<'LOGO' | 'COVER'>('LOGO');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [isTotpModalOpen, setIsTotpModalOpen] = useState(false);
  const [totpMode, setTotpMode] = useState<'enable' | 'disable'>('enable');
  const [totpStep, setTotpStep] = useState<'password' | 'verify'>('password');
  const [totpPassword, setTotpPassword] = useState('');
  const [showTotpPassword, setShowTotpPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpQrDataUrl, setTotpQrDataUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [savingTotp, setSavingTotp] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'basic' | 'super' | 'additional' | 'images' | 'about' | 'logins'>('basic');
  const [mentorJobTitle, setMentorJobTitle] = useState('');
  const [mentorBio, setMentorBio] = useState('');
  const [mentorSkills, setMentorSkills] = useState<string[]>([]);
  const [mentorEducations, setMentorEducations] = useState<MentorListItem[]>([]);
  const [mentorExperiences, setMentorExperiences] = useState<MentorListItem[]>([]);
  const [mentorAttachments, setMentorAttachments] = useState<MentorAttachment[]>([]);
  const [savingMentorProfile, setSavingMentorProfile] = useState(false);
  const [savingAdditionalInfo, setSavingAdditionalInfo] = useState(false);
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [facebook, setFacebook] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [activeProfileTab, setActiveProfileTab] = useState<'about' | 'courses' | 'products' | 'articles'>('about');

  const loginHistoryScope = useMemo(() => {
    const role = initialUser?.role;
    if (activeSettingsTab === 'logins' && (role === 'ADMIN' || role === 'MENTOR')) return 'members';
    return 'self';
  }, [activeSettingsTab, initialUser?.role]);

  const { data: meData, isLoading: isMeLoading, isError: isMeError } = useQuery({
    queryKey: ['me', loginHistoryScope],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/me?loginHistoryScope=${encodeURIComponent(loginHistoryScope)}`, { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch session');
      return res.json();
    },
    staleTime: 30_000,
  });

  const user: SessionUser = useMemo(() => {
    const u = meData?.user;
    if (u && typeof u.id === 'string') return u;
    return initialUser;
  }, [meData, initialUser]);

  const loginHistory: LoginHistoryItem[] = useMemo(() => {
    const raw = meData?.loginHistory;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((v) => v && typeof v === 'object')
      .map((v) => ({
        id: typeof (v as any).id === 'string' ? (v as any).id : '',
        action: typeof (v as any).action === 'string' ? (v as any).action : '',
        ip: typeof (v as any).ip === 'string' ? (v as any).ip : null,
        userAgent: typeof (v as any).userAgent === 'string' ? (v as any).userAgent : null,
        metadata: (v as any).metadata,
        createdAt: typeof (v as any).createdAt === 'string' ? (v as any).createdAt : '',
        actor:
          (v as any).actor && typeof (v as any).actor === 'object'
            ? {
                id: typeof (v as any).actor.id === 'string' ? (v as any).actor.id : '',
                name: typeof (v as any).actor.name === 'string' ? (v as any).actor.name : null,
                email: typeof (v as any).actor.email === 'string' ? (v as any).actor.email : '',
                role: typeof (v as any).actor.role === 'string' ? (v as any).actor.role : null,
              }
            : null,
      }))
      .filter((v) => v.id && v.action && v.createdAt);
  }, [meData]);

  const loginDateFormatter = useMemo(
    () => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
    []
  );

  const formatLoginDate = (raw: string) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw || '-';
    return loginDateFormatter.format(d);
  };

  const compactUserAgent = (raw: string) => String(raw || '').replace(/\s+/g, ' ').trim();

  const maybeRedirectAfterProfileComplete = () => {
    if (didAutoRedirectRef.current) return;
    const targetRaw = searchParams?.get('redirect');
    const target = typeof targetRaw === 'string' ? targetRaw.trim() : '';
    if (!target) return;

    const nextName = name.trim();
    const nextPhone = phone.trim();
    const nextCity = city.trim();
    const nextAddress = address.trim();
    const complete = nextName.length >= 2 && nextPhone.length >= 8 && nextCity.length >= 2 && nextAddress.length >= 5;
    if (!complete) return;

    const safeTarget = target.startsWith('/') ? target : '';
    if (!safeTarget) return;

    didAutoRedirectRef.current = true;
    router.push(safeTarget);
  };

  const parseUserAgentInfo = (raw: string) => {
    const ua = compactUserAgent(raw).toLowerCase();

    let os = '-';
    if (ua.includes('windows nt 10.0')) os = 'Windows-10.0';
    else if (ua.includes('windows nt 6.3')) os = 'Windows-8.1';
    else if (ua.includes('windows nt 6.2')) os = 'Windows-8.0';
    else if (ua.includes('windows nt 6.1')) os = 'Windows-7.0';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('cpu iphone os')) os = 'iOS';
    else if (ua.includes('mac os x')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';

    let browser = '-';
    if (ua.includes('edg/')) browser = 'Edge';
    else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
    else if (ua.includes('firefox/')) browser = 'Firefox';
    else if (ua.includes('chrome/') && !ua.includes('edg/') && !ua.includes('opr/')) browser = 'Chrome';
    else if (ua.includes('safari/') && !ua.includes('chrome/') && !ua.includes('chromium/')) browser = 'Safari';

    const device = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad') ? 'mobile' : 'desktop';

    return { os, browser, device };
  };

  const getMetaString = (meta: unknown, key: string) => {
    if (!meta || typeof meta !== 'object') return null;
    const v = (meta as any)[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  const formatDuration = (startRaw: string, endRaw: string) => {
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '-';
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return `${minutes} Min`;
    const hours = Math.round(minutes / 60);
    return `${hours} Jam`;
  };

  const memberSinceFormatter = useMemo(() => new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }), []);

  const formatMemberSince = (raw?: string) => {
    if (!raw) return '-';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '-';
    return memberSinceFormatter.format(d);
  };

  const roleLabel = (role: SessionUser['role'], isSuperAdmin?: boolean) => {
    if (role === 'MENTOR') return 'Mentor';
    if (role === 'ADMIN') return isSuperAdmin ? 'Super Admin' : 'Admin';
    return 'Siswa';
  };

  const settingsHref = '/dashboard/settings';
  const isSuperAdmin = user.role === 'ADMIN' && Boolean((user as any).isSuperAdmin);
  const isMentorLike = user.role === 'MENTOR' || (user.role === 'ADMIN' && !isSuperAdmin);
  const totpEnabled = Boolean((user as any).totpEnabled);

  useEffect(() => {
    if (mode !== 'settings') return;
    if (!isSuperAdmin) return;
    if (activeSettingsTab === 'additional' || activeSettingsTab === 'images' || activeSettingsTab === 'about') {
      setActiveSettingsTab('basic');
    }
  }, [activeSettingsTab, isSuperAdmin, mode]);

  useEffect(() => {
    if (mode !== 'settings') return;
    if (!isSuperAdmin) return;
    if (totpEnabled) return;
    if (isTotpModalOpen) return;
    if (searchParams?.get('force2fa') !== '1') return;
    setActiveSettingsTab('basic');
    setTotpMode('enable');
    setTotpStep('password');
    setTotpPassword('');
    setTotpCode('');
    setTotpQrDataUrl('');
    setTotpSecret('');
    setIsTotpModalOpen(true);
  }, [isSuperAdmin, isTotpModalOpen, mode, searchParams, totpEnabled]);

  const { data: studentStats } = useQuery({
    queryKey: ['profile-stats', 'student'],
    enabled: user.role === 'STUDENT',
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/dashboard/stats/student', { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) return null;
      return res.json().catch(() => null);
    },
    staleTime: 30_000,
  });

  const { data: mentorStats } = useQuery({
    queryKey: ['profile-stats', 'mentor'],
    enabled: user.role === 'MENTOR',
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/dashboard/stats/mentor', { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) return null;
      return res.json().catch(() => null);
    },
    staleTime: 30_000,
  });

  const { data: adminStats } = useQuery({
    queryKey: ['profile-stats', 'admin'],
    enabled: user.role === 'ADMIN',
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/dashboard/stats/admin', { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) return null;
      return res.json().catch(() => null);
    },
    staleTime: 30_000,
  });

  const { data: enrolledCoursesData } = useQuery({
    queryKey: ['profile-courses', 'enrolled'],
    enabled: user.role === 'STUDENT',
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/courses/enrolled', { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  const { data: mentorCoursesData } = useQuery({
    queryKey: ['profile-courses', 'mentor'],
    enabled: isMentorLike,
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/dashboard/mentor/courses', { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  const enrolledCourses = useMemo(() => {
    const list = Array.isArray(enrolledCoursesData) ? enrolledCoursesData : [];
    return list
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        id: String((c as any).id || ''),
        title: String((c as any).title || (c as any).slug || 'Kursus'),
        slug: typeof (c as any).slug === 'string' ? (c as any).slug : null,
        thumbnailUrl: typeof (c as any).thumbnailUrl === 'string' ? (c as any).thumbnailUrl : null,
        instructorName: String((c as any).instructor?.name || (c as any).instructor?.email || 'Mentor'),
      }))
      .filter((c) => c.id);
  }, [enrolledCoursesData]);

  const mentorCourses = useMemo(() => {
    const list = Array.isArray(mentorCoursesData) ? mentorCoursesData : [];
    return list
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        id: String((c as any).id || ''),
        title: String((c as any).title || (c as any).slug || 'Kursus'),
        slug: typeof (c as any).slug === 'string' ? (c as any).slug : null,
        thumbnailUrl: typeof (c as any).thumbnailUrl === 'string' ? (c as any).thumbnailUrl : null,
        totalStudents: Number((c as any)?._count?.enrollments) || 0,
        status: typeof (c as any).status === 'string' ? String((c as any).status) : '',
      }))
      .filter((c) => c.id);
  }, [mentorCoursesData]);

  const { data: certificatesData } = useQuery({
    queryKey: ['profile-certificates'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/me/certificates', { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const certificates = useMemo(() => {
    const list = Array.isArray(certificatesData) ? certificatesData : [];
    return list
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        id: String((c as any).id || ''),
        serial: typeof (c as any).serial === 'string' ? (c as any).serial : '',
        issuedAt: typeof (c as any).issuedAt === 'string' ? (c as any).issuedAt : new Date((c as any).issuedAt).toISOString(),
        courseTitle: String((c as any).course?.title || 'Kursus'),
        courseSlug: typeof (c as any).course?.slug === 'string' ? (c as any).course.slug : null,
        thumbnailUrl: typeof (c as any).course?.thumbnailUrl === 'string' ? (c as any).course.thumbnailUrl : null,
      }))
      .filter((c) => c.id);
  }, [certificatesData]);

  const { data: mentorPostsData } = useQuery({
    queryKey: ['profile-posts', user.id],
    enabled: isMentorLike,
    queryFn: async ({ signal }) => {
      const url = new URL('/api/blog/posts', window.location.origin);
      url.searchParams.set('authorId', user.id);
      const res = await fetch(url.toString(), { signal, cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const mentorPosts = useMemo(() => {
    const list = Array.isArray(mentorPostsData) ? mentorPostsData : [];
    return list
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({
        id: String((p as any).id || ''),
        title: String((p as any).title || 'Artikel'),
        slug: typeof (p as any).slug === 'string' ? (p as any).slug : null,
        createdAt: typeof (p as any).createdAt === 'string' ? (p as any).createdAt : new Date((p as any).createdAt).toISOString(),
      }))
      .filter((p) => p.id);
  }, [mentorPostsData]);

  const { data: myVendorsData } = useQuery({
    queryKey: ['profile-vendors'],
    enabled: user.role === 'MENTOR' || user.role === 'ADMIN',
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/shop/vendors', { signal, cache: 'no-store', credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  const approvedVendorIds = useMemo(() => {
    const list = Array.isArray(myVendorsData) ? myVendorsData : [];
    return list
      .filter((v) => v && typeof v === 'object')
      .filter((v) => String((v as any).status || '') === 'APPROVED' || user.role === 'ADMIN')
      .map((v) => String((v as any).id || ''))
      .filter(Boolean);
  }, [myVendorsData, user.role]);

  const { data: myProductsData } = useQuery({
    queryKey: ['profile-products', approvedVendorIds.join(',')],
    enabled: (user.role === 'MENTOR' && approvedVendorIds.length > 0) || user.role === 'ADMIN',
    queryFn: async ({ signal }) => {
      const p = new URLSearchParams();
      p.set('take', '24');
      if (user.role !== 'ADMIN') p.set('vendorIds', approvedVendorIds.join(','));
      const res = await fetch(`/api/shop/products?${p.toString()}`, { signal, cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  const myProducts = useMemo(() => {
    const list = Array.isArray(myProductsData) ? myProductsData : [];
    return list
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({
        id: String((p as any).id || ''),
        name: String((p as any).name || 'Produk'),
        slug: typeof (p as any).slug === 'string' ? (p as any).slug : null,
        imageUrl: typeof (p as any).imageUrl === 'string' ? (p as any).imageUrl : null,
        price: Number((p as any).price) || 0,
        stock: (p as any).stock === null || (p as any).stock === undefined ? null : Number((p as any).stock) || 0,
        type: typeof (p as any).type === 'string' ? String((p as any).type) : '',
      }))
      .filter((p) => p.id);
  }, [myProductsData]);

  const profileTabs = useMemo(() => {
    const base: Array<{ id: 'about' | 'courses' | 'products' | 'articles'; label: string; icon: any }> = [
      { id: 'about', label: 'Tentang', icon: User },
    ];
    if (isMentorLike || user.role === 'STUDENT') base.push({ id: 'courses' as const, label: 'Kursus', icon: BookOpen });
    if (isMentorLike) base.push({ id: 'products' as const, label: 'Produk', icon: ShoppingBag });
    if (isMentorLike) base.push({ id: 'articles' as const, label: 'Artikel', icon: FileText });
    return base;
  }, [isMentorLike, user.role]);

  const metrics = useMemo(() => {
    if (isMentorLike) {
      const totalCourses = Number((mentorStats as any)?.totalCourses) || 0;
      const adminActiveStudents = Number((adminStats as any)?.activeStudents) || 0;
      const enrolledStudents =
        user.role === 'MENTOR' ? Number((mentorStats as any)?.enrolledStudents) || 0 : adminActiveStudents;
      const pendingSubmissions = Number((mentorStats as any)?.pendingSubmissions) || 0;
      const articles = mentorPosts.length;
      return [
        { label: 'Kursus', value: user.role === 'MENTOR' ? totalCourses : mentorCourses.length, icon: BookOpen },
        { label: 'Siswa', value: enrolledStudents, icon: GraduationCap },
        { label: 'Tugas Pending', value: pendingSubmissions, icon: Briefcase },
        { label: 'Artikel', value: articles, icon: FileText },
      ];
    }
    if (user.role === 'ADMIN') {
      const totalUsers = Number((adminStats as any)?.totalUsers) || 0;
      const totalCourses = Number((adminStats as any)?.totalCourses) || 0;
      const totalOrders = Number((adminStats as any)?.totalOrders) || 0;
      const revenue = Number((adminStats as any)?.revenue) || 0;
      return [
        { label: 'Pengguna', value: totalUsers, icon: User },
        { label: 'Kursus', value: totalCourses, icon: BookOpen },
        { label: 'Order', value: totalOrders, icon: Briefcase },
        { label: 'Total Pendapatan', value: revenue.toLocaleString('id-ID'), icon: Award, isMoney: true },
      ];
    }
    const completedCourses = Number((studentStats as any)?.completedCourses) || 0;
    const inProgressCourses = Number((studentStats as any)?.inProgressCourses) || 0;
    const totalScore = Number((studentStats as any)?.totalScore) || 0;
    return [
      { label: 'Selesai', value: completedCourses, icon: Award },
      { label: 'Berjalan', value: inProgressCourses, icon: BookOpen },
      { label: 'Sertifikat', value: certificates.length, icon: GraduationCap },
      { label: 'Skor Kuis', value: totalScore, icon: User },
    ];
  }, [adminStats, isMentorLike, mentorCourses.length, mentorPosts.length, mentorStats, studentStats, user.role, certificates.length]);

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(typeof user.phone === 'string' ? user.phone : '');
    setGender(
      typeof user.gender === 'string' && (user.gender.toUpperCase() === 'MALE' || user.gender.toUpperCase() === 'FEMALE')
        ? (user.gender.toUpperCase() as any)
        : ''
    );
    const bd = (user as any).birthDate;
    if (typeof bd === 'string' && bd) {
      const d = new Date(bd);
      if (!Number.isNaN(d.getTime())) setBirthDate(d.toISOString().slice(0, 10));
      else setBirthDate('');
    } else if (bd instanceof Date && !Number.isNaN(bd.getTime())) {
      setBirthDate(bd.toISOString().slice(0, 10));
    } else {
      setBirthDate('');
    }
    setCountry(typeof user.country === 'string' ? user.country : '');
    setProvince(typeof user.province === 'string' ? user.province : '');
    setCity(typeof user.city === 'string' ? user.city : '');
    setAddress(typeof user.address === 'string' ? user.address : '');
    const socials = (user as any).socialLinks;
    setInstagram(typeof socials?.instagram === 'string' ? socials.instagram : '');
    setWhatsapp(typeof socials?.whatsapp === 'string' ? socials.whatsapp : '');
    setFacebook(typeof socials?.facebook === 'string' ? socials.facebook : '');
    setLinkedin(typeof socials?.linkedin === 'string' ? socials.linkedin : '');
    setTiktok(typeof socials?.tiktok === 'string' ? socials.tiktok : '');
    if (isMentorLike) {
      setMentorJobTitle(typeof user.mentorJobTitle === 'string' ? user.mentorJobTitle : '');
      setMentorBio(typeof user.mentorBio === 'string' ? user.mentorBio : '');
      setMentorSkills(Array.isArray(user.mentorSkills) ? user.mentorSkills.filter((v) => typeof v === 'string') : []);

      const nextEdu = Array.isArray(user.mentorEducations)
        ? (user.mentorEducations as any[])
            .filter((v) => v && typeof v === 'object')
            .map((v) => ({
              id: typeof (v as any).id === 'string' ? (v as any).id : '',
              title: typeof (v as any).title === 'string' ? (v as any).title : '',
              subtitle: typeof (v as any).subtitle === 'string' ? (v as any).subtitle : null,
              years: typeof (v as any).years === 'string' ? (v as any).years : null,
              description: typeof (v as any).description === 'string' ? (v as any).description : null,
            }))
            .filter((v) => v.id && v.title)
        : [];
      setMentorEducations(nextEdu);

      const nextExp = Array.isArray(user.mentorExperiences)
        ? (user.mentorExperiences as any[])
            .filter((v) => v && typeof v === 'object')
            .map((v) => ({
              id: typeof (v as any).id === 'string' ? (v as any).id : '',
              title: typeof (v as any).title === 'string' ? (v as any).title : '',
              subtitle: typeof (v as any).subtitle === 'string' ? (v as any).subtitle : null,
              years: typeof (v as any).years === 'string' ? (v as any).years : null,
              description: typeof (v as any).description === 'string' ? (v as any).description : null,
            }))
            .filter((v) => v.id && v.title)
        : [];
      setMentorExperiences(nextExp);

      const nextFiles = Array.isArray(user.mentorAttachments)
        ? (user.mentorAttachments as any[])
            .filter((v) => v && typeof v === 'object')
            .map((v) => ({
              id: typeof (v as any).id === 'string' ? (v as any).id : '',
              url: typeof (v as any).url === 'string' ? (v as any).url : '',
              filename: typeof (v as any).filename === 'string' ? (v as any).filename : '',
            }))
            .filter((v) => v.id && v.url)
        : [];
      setMentorAttachments(nextFiles);
    }
  }, [
    user.id,
    user.name,
    user.email,
    user.role,
    isMentorLike,
    (user as any).mentorJobTitle,
    (user as any).mentorBio,
    (user as any).mentorSkills,
    (user as any).mentorEducations,
    (user as any).mentorExperiences,
    (user as any).mentorAttachments,
  ]);

  const avatarUrl =
    typeof user.avatarUrl === 'string' && user.avatarUrl.trim() && !user.avatarUrl.startsWith('blob:') ? user.avatarUrl : '';
  const profileCoverUrl =
    typeof user.profileCoverUrl === 'string' && user.profileCoverUrl.trim() && !user.profileCoverUrl.startsWith('blob:') ? user.profileCoverUrl : '';
  const signatureUrl =
    typeof user.signatureUrl === 'string' && user.signatureUrl.trim() && !user.signatureUrl.startsWith('blob:') ? user.signatureUrl : '';

  const saveAvatar = async (nextUrl: string) => {
    setSavingAvatar(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: nextUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan foto profil');
      toast.success('Foto profil diperbarui');
      queryClient.setQueryData(['me'], (prev: any) => ({ ...(prev || {}), user: { ...(prev?.user || user), avatarUrl: nextUrl || null } }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan foto profil';
      toast.error(message);
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveCover = async (nextUrl: string) => {
    setSavingCover(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileCoverUrl: nextUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan cover profil');
      toast.success('Cover profil diperbarui');
      queryClient.setQueryData(['me'], (prev: any) => ({ ...(prev || {}), user: { ...(prev?.user || user), profileCoverUrl: nextUrl || null } }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan cover profil';
      toast.error(message);
    } finally {
      setSavingCover(false);
    }
  };

  const saveSignature = async (nextUrl: string) => {
    setSavingSignature(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureUrl: nextUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan tanda tangan');
      toast.success('Tanda tangan diperbarui');
      queryClient.setQueryData(['me'], (prev: any) => ({ ...(prev || {}), user: { ...(prev?.user || user), signatureUrl: nextUrl || null } }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan tanda tangan';
      toast.error(message);
    } finally {
      setSavingSignature(false);
    }
  };

  const uploadSignatureFile = async (file: File) => {
    setSavingSignature(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('alt', 'signature');
      const res = await fetch('/api/media/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal upload tanda tangan');
      const url = typeof data?.url === 'string' ? data.url : '';
      if (!url) throw new Error('URL file tidak valid');
      await saveSignature(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal upload tanda tangan';
      toast.error(message);
      setSavingSignature(false);
    }
  };

  const saveBasic = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Nama minimal 2 karakter');
      return;
    }

    setSavingBasic(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil');
      toast.success('Profil berhasil diperbarui');
      router.refresh();
      maybeRedirectAfterProfileComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan profil';
      toast.error(message);
    } finally {
      setSavingBasic(false);
    }
  };

  const saveSecurity = async () => {
    if (!currentPassword) {
      toast.error('Password saat ini wajib diisi');
      return;
    }
    const minLen = isSuperAdmin ? 12 : 8;
    if (!newPassword || newPassword.length < minLen) {
      toast.error(`Password baru minimal ${minLen} karakter`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak sama');
      return;
    }

    setSavingSecurity(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah password');
      toast.success('Password berhasil diubah');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengubah password';
      toast.error(message);
    } finally {
      setSavingSecurity(false);
    }
  };

  const openTotpEnable = () => {
    setTotpMode('enable');
    setTotpStep('password');
    setTotpPassword('');
    setTotpCode('');
    setTotpQrDataUrl('');
    setTotpSecret('');
    setIsTotpModalOpen(true);
  };

  const openTotpDisable = () => {
    setTotpMode('disable');
    setTotpStep('password');
    setTotpPassword('');
    setTotpCode('');
    setTotpQrDataUrl('');
    setTotpSecret('');
    setIsTotpModalOpen(true);
  };

  const closeTotpModal = () => {
    if (savingTotp) return;
    setIsTotpModalOpen(false);
    setTotpPassword('');
    setShowTotpPassword(false);
    setTotpCode('');
    setTotpQrDataUrl('');
    setTotpSecret('');
    setTotpStep('password');
  };

  const startTotpSetup = async () => {
    if (!totpPassword) {
      toast.error('Password saat ini wajib diisi');
      return;
    }
    setSavingTotp(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: totpPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memulai aktivasi 2FA');
      const qr = typeof data?.qrDataUrl === 'string' ? data.qrDataUrl : '';
      const secret = typeof data?.secret === 'string' ? data.secret : '';
      if (!qr || !secret) throw new Error('Data 2FA tidak valid');
      setTotpQrDataUrl(qr);
      setTotpSecret(secret);
      setTotpCode('');
      setTotpStep('verify');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memulai aktivasi 2FA');
    } finally {
      setSavingTotp(false);
    }
  };

  const confirmTotpEnable = async () => {
    if (!totpCode) {
      toast.error('Kode verifikasi wajib diisi');
      return;
    }
    setSavingTotp(true);
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengaktifkan 2FA');
      toast.success('Verifikasi 2 langkah diaktifkan');
      closeTotpModal();
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengaktifkan 2FA');
    } finally {
      setSavingTotp(false);
    }
  };

  const submitTotpDisable = async () => {
    if (!totpPassword) {
      toast.error('Password saat ini wajib diisi');
      return;
    }
    if (!totpCode) {
      toast.error('Kode verifikasi wajib diisi');
      return;
    }
    setSavingTotp(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: totpPassword, code: totpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menonaktifkan 2FA');
      toast.success('Verifikasi 2 langkah dinonaktifkan');
      closeTotpModal();
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menonaktifkan 2FA');
    } finally {
      setSavingTotp(false);
    }
  };

  const isDashboard = variant === 'dashboard';
  const inTab = context === 'tab';
  const inputControlClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:placeholder:text-slate-400 disabled:cursor-not-allowed';

  const renderPasswordInput = ({
    value,
    onChange,
    placeholder,
    show,
    onToggle,
    disabled = false,
    autoComplete = 'current-password',
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    show: boolean;
    onToggle: () => void;
    disabled?: boolean;
    autoComplete?: string;
  }) => (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={twMerge(inputControlClass, 'pr-11')}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={show ? 'Sembunyikan password' : 'Lihat password'}
        title={show ? 'Sembunyikan password' : 'Lihat password'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  const saveAll = async () => {
    if (savingBasic || savingSecurity || savingMentorProfile || savingAdditionalInfo) return;
    const nextName = name.trim();
    const nextEmail = email.trim();
    const prevName = (user.name || '').trim();
    const prevEmail = (user.email || '').trim();

    const shouldSaveBasic = nextName !== prevName || nextEmail !== prevEmail;
    const shouldSaveSecurity = Boolean(currentPassword || newPassword || confirmPassword);
    const shouldSaveMentor =
      isMentorLike &&
      (mentorJobTitle.trim() !== String(user.mentorJobTitle || '').trim() ||
        mentorBio !== String(user.mentorBio || '') ||
        JSON.stringify(mentorSkills) !== JSON.stringify(Array.isArray(user.mentorSkills) ? user.mentorSkills : []) ||
        JSON.stringify(mentorEducations) !== JSON.stringify(Array.isArray(user.mentorEducations) ? user.mentorEducations : []) ||
        JSON.stringify(mentorExperiences) !== JSON.stringify(Array.isArray(user.mentorExperiences) ? user.mentorExperiences : []) ||
        JSON.stringify(mentorAttachments) !== JSON.stringify(Array.isArray(user.mentorAttachments) ? user.mentorAttachments : []));
    const userSocialLinks = (user as any).socialLinks;
    const shouldSaveAdditional =
      phone.trim() !== String((user as any).phone || '').trim() ||
      gender !== (typeof (user as any).gender === 'string' ? (user as any).gender.toUpperCase() : '') ||
      birthDate !==
        (() => {
          const bd = (user as any).birthDate;
          if (!bd) return '';
          const d = new Date(bd);
          if (Number.isNaN(d.getTime())) return '';
          return d.toISOString().slice(0, 10);
        })() ||
      country.trim() !== String((user as any).country || '').trim() ||
      province.trim() !== String((user as any).province || '').trim() ||
      city.trim() !== String((user as any).city || '').trim() ||
      address.trim() !== String((user as any).address || '').trim() ||
      instagram.trim() !== String(userSocialLinks?.instagram || '').trim() ||
      whatsapp.trim() !== String(userSocialLinks?.whatsapp || '').trim() ||
      facebook.trim() !== String(userSocialLinks?.facebook || '').trim() ||
      linkedin.trim() !== String(userSocialLinks?.linkedin || '').trim() ||
      tiktok.trim() !== String(userSocialLinks?.tiktok || '').trim();

    if (!shouldSaveBasic && !shouldSaveSecurity && !shouldSaveMentor && !shouldSaveAdditional) {
      toast.info('Tidak ada perubahan');
      return;
    }

    if (shouldSaveBasic) {
      await saveBasic();
    }
    if (shouldSaveSecurity) {
      await saveSecurity();
    }
    if (shouldSaveAdditional) {
      setSavingAdditionalInfo(true);
      try {
        const res = await fetch('/api/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone.trim(),
            gender: gender || null,
            birthDate: birthDate || null,
            country: country.trim(),
            province: province.trim(),
            city: city.trim(),
            address: address.trim(),
            socialLinks: {
              instagram: instagram.trim(),
              whatsapp: whatsapp.trim(),
              facebook: facebook.trim(),
              linkedin: linkedin.trim(),
              tiktok: tiktok.trim(),
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan informasi tambahan');
        toast.success('Informasi tambahan berhasil diperbarui');
        queryClient.invalidateQueries({ queryKey: ['me'] });
        router.refresh();
        maybeRedirectAfterProfileComplete();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menyimpan informasi tambahan';
        toast.error(message);
      } finally {
        setSavingAdditionalInfo(false);
      }
    }
    if (shouldSaveMentor) {
      setSavingMentorProfile(true);
      try {
        const res = await fetch('/api/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mentorJobTitle: mentorJobTitle.trim(),
            mentorBio,
            mentorSkills,
            mentorEducations,
            mentorExperiences,
            mentorAttachments,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil mentor');
        toast.success('Profil mentor berhasil diperbarui');
        queryClient.invalidateQueries({ queryKey: ['me'] });
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menyimpan profil mentor';
        toast.error(message);
      } finally {
        setSavingMentorProfile(false);
      }
    }
  };

  const { data: vendorsData } = useQuery({
    queryKey: ['my-vendors'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/shop/vendors', { signal });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    enabled: mode === 'settings' && !isSuperAdmin,
    staleTime: 60_000,
  });

  const vendors = useMemo(() => (Array.isArray(vendorsData) ? vendorsData : []), [vendorsData]);
  const [activeVendorId, setActiveVendorId] = useState<string>('');

  useEffect(() => {
    if (mode !== 'settings') return;
    if (activeVendorId) return;
    const firstId = typeof (vendors as any[])?.[0]?.id === 'string' ? String((vendors as any[])[0].id) : '';
    if (firstId) setActiveVendorId(firstId);
  }, [vendors, activeVendorId, mode]);

  const activeVendor = useMemo(() => vendors.find((v: any) => String(v?.id) === String(activeVendorId)), [vendors, activeVendorId]);
  const vendorLogoUrl = typeof (activeVendor as any)?.logoUrl === 'string' && String((activeVendor as any).logoUrl).trim() ? String((activeVendor as any).logoUrl) : '';
  const vendorCoverUrl = typeof (activeVendor as any)?.coverUrl === 'string' && String((activeVendor as any).coverUrl).trim() ? String((activeVendor as any).coverUrl) : '';

  const saveVendorImage = async (target: 'LOGO' | 'COVER', nextUrl: string) => {
    if (!activeVendorId) {
      toast.error('Vendor belum dipilih');
      return;
    }
    try {
      const payload = target === 'LOGO' ? { logoUrl: nextUrl } : { coverUrl: nextUrl };
      const res = await fetch(`/api/shop/vendors/${encodeURIComponent(activeVendorId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan gambar vendor');
      toast.success('Gambar vendor diperbarui');
      queryClient.invalidateQueries({ queryKey: ['my-vendors'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan gambar vendor';
      toast.error(message);
    }
  };

  if (mode === 'settings') {
    const tabs = isSuperAdmin
      ? [
          { id: 'basic' as const, label: 'Dasar' },
          { id: 'super' as const, label: 'Super Admin' },
          { id: 'logins' as const, label: 'Login' },
        ]
      : [
          { id: 'basic' as const, label: 'Dasar' },
          { id: 'additional' as const, label: 'Tambahan' },
          { id: 'images' as const, label: 'Gambar' },
          { id: 'about' as const, label: 'Tentang' },
          { id: 'logins' as const, label: 'Login' },
        ];

    const makeId = () => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
    };

    const surfaceClass = 'bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden';
    const cardClass = 'bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6';
    const sectionTitleClass = 'text-sm font-extrabold text-slate-900';
    const sectionDescClass = 'text-xs text-slate-500 mt-1';
    const fieldLabelClass = 'text-[11px] font-extrabold text-slate-600 tracking-wide uppercase';

    return (
      <div className={isDashboard ? 'w-full' : 'min-h-screen bg-slate-50'}>
        <div className={isDashboard ? '' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10'}>
          <div className={surfaceClass}>
            <div className="px-6 py-5 border-b border-slate-200/70">
              <div className="text-xl font-extrabold text-slate-900">{isSuperAdmin ? 'Pengaturan Super Admin' : 'Pengaturan Akun'}</div>
              <div className="text-sm text-slate-500 mt-1">
                {isSuperAdmin ? 'Kelola profil dan akses Super Admin untuk operasional platform.' : 'Kelola profil, keamanan, dan preferensi akun.'}
              </div>
            </div>

            <div className="border-b border-slate-200/70 px-4 sm:px-6 overflow-x-auto">
              <div className="flex items-center gap-6 min-w-max">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveSettingsTab(t.id)}
                    className={twMerge(
                      'py-3 text-[13px] sm:text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap',
                      activeSettingsTab === t.id
                        ? 'text-indigo-700 border-indigo-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-7 pb-[calc(104px+env(safe-area-inset-bottom))] sm:pb-7">
              {activeSettingsTab === 'basic' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={sectionTitleClass}>Akun & Keamanan</div>
                      </div>
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                        {roleLabel(user.role, isSuperAdmin)}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Nama</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className={inputControlClass} placeholder="Nama lengkap" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Email</label>
                        <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputControlClass} placeholder="email@contoh.com" />
                      </div>
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-6">
                      <div className="text-sm font-extrabold text-slate-900">Ubah Password</div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600">Password Saat Ini</label>
                          {renderPasswordInput({
                            value: currentPassword,
                            onChange: setCurrentPassword,
                            placeholder: '••••••••',
                            show: showCurrentPassword,
                            onToggle: () => setShowCurrentPassword((prev) => !prev),
                          })}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600">Password Baru</label>
                          {renderPasswordInput({
                            value: newPassword,
                            onChange: setNewPassword,
                            placeholder: isSuperAdmin ? 'Minimal 12 karakter' : 'Minimal 8 karakter',
                            show: showNewPassword,
                            onToggle: () => setShowNewPassword((prev) => !prev),
                            autoComplete: 'new-password',
                          })}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-bold text-slate-600">Konfirmasi Password Baru</label>
                          {renderPasswordInput({
                            value: confirmPassword,
                            onChange: setConfirmPassword,
                            placeholder: 'Ulangi password baru',
                            show: showConfirmPassword,
                            onToggle: () => setShowConfirmPassword((prev) => !prev),
                            autoComplete: 'new-password',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className={cardClass}>
                      <div className={sectionTitleClass}>Verifikasi 2 Langkah</div>
                      <div className={sectionDescClass}>Amankan akun dengan Google Authenticator (TOTP).</div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-700">
                          Status:{' '}
                          <span
                            className={twMerge(
                              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold border',
                              totpEnabled ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                            )}
                          >
                            {totpEnabled ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2">
                        {totpEnabled ? (
                          <button
                            type="button"
                            onClick={openTotpDisable}
                            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-rose-700 font-extrabold text-xs hover:bg-rose-50"
                          >
                            Nonaktifkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={openTotpEnable}
                            className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700"
                          >
                            Aktifkan
                          </button>
                        )}
                      </div>
                    </div>
                    {isSuperAdmin ? (
                      <div className={cardClass}>
                        <div className={sectionTitleClass}>Foto Profil</div>
                        <div className={sectionDescClass}>Digunakan untuk identifikasi di audit log dan halaman operasional.</div>

                        <div className="mt-4 flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                            {avatarUrl ? (
                              <Image src={avatarUrl} alt={user.name || user.email} fill unoptimized className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-700 font-extrabold">
                                {String(user.name || user.email || 'U')
                                  .trim()
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 flex items-center justify-end gap-2">
                            {avatarUrl ? (
                              <button
                                type="button"
                                onClick={() => void saveAvatar('')}
                                disabled={savingAvatar}
                                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-rose-700 font-extrabold text-xs hover:bg-rose-50 disabled:opacity-60"
                              >
                                Hapus
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setIsAvatarPickerOpen(true)}
                              disabled={savingAvatar}
                              className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 disabled:opacity-60"
                            >
                              Upload
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className={cardClass}>
                      <div className={sectionTitleClass}>Keluar</div>

                      <div className="mt-4 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                            } catch {
                            }
                            toast.success('Anda telah keluar');
                            router.push('/login');
                          }}
                          className="px-5 py-2.5 rounded-xl border border-slate-200 text-red-700 font-bold hover:bg-red-50"
                        >
                          Keluar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSettingsTab === 'super' ? (
                isSuperAdmin ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className={cardClass}>
                      <div className={sectionTitleClass}>Akses Super Admin</div>
                      <div className={sectionDescClass}>Akses penuh untuk pengaturan platform dan aksi finansial sensitif.</div>

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link
                          href="/dashboard/admin/settings"
                          className="h-11 px-4 rounded-xl bg-slate-900 text-white font-extrabold text-sm inline-flex items-center justify-center hover:bg-slate-800"
                        >
                          Pengaturan Platform
                        </Link>
                        <Link
                          href="/dashboard/admin/audit"
                          className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-sm inline-flex items-center justify-center hover:bg-slate-50"
                        >
                          Audit Log
                        </Link>
                        <Link
                          href="/dashboard/admin/users"
                          className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-sm inline-flex items-center justify-center hover:bg-slate-50"
                        >
                          Manajemen User
                        </Link>
                        <Link
                          href="/dashboard/admin/sales/withdraw"
                          className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-sm inline-flex items-center justify-center hover:bg-slate-50"
                        >
                          Withdraw (Admin)
                        </Link>
                        <Link
                          href="/dashboard/admin/sales/orders"
                          className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-sm inline-flex items-center justify-center hover:bg-slate-50"
                        >
                          Order Masuk
                        </Link>
                      </div>

                      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
                        <div className={fieldLabelClass}>Identitas</div>
                        <div className="mt-2 text-sm font-semibold text-slate-700">
                          {user.name || user.email} • {user.email}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Role: {roleLabel(user.role, true)}</div>
                      </div>
                    </div>

                    <div className={cardClass}>
                      <div className={sectionTitleClass}>Checklist Keamanan</div>
                      <div className={sectionDescClass}>Disarankan untuk mengurangi risiko akses tidak sah.</div>

                      <div className="mt-5 space-y-3 text-sm text-slate-700">
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                          <div className="font-extrabold text-slate-900">Lengkapi profil</div>
                          <div className="mt-1 text-sm text-slate-600">Nama jelas, nomor HP, dan avatar untuk identifikasi di audit.</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                          <div className="font-extrabold text-slate-900">Gunakan password kuat</div>
                          <div className="mt-1 text-sm text-slate-600">Minimal 12 karakter, unik, dan tidak dipakai di layanan lain.</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                          <div className="font-extrabold text-slate-900">Pantau riwayat login</div>
                          <div className="mt-1 text-sm text-slate-600">Cek tab Login untuk aktivitas yang mencurigakan.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cardClass}>
                    <div className={sectionTitleClass}>Akses Ditolak</div>
                    <div className={sectionDescClass}>Tab ini hanya tersedia untuk Super Admin.</div>
                  </div>
                )
              ) : null}

              {activeSettingsTab === 'additional' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className={cardClass}>
                      <div className={sectionTitleClass}>Informasi Personal</div>

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className={fieldLabelClass}>Tanggal Lahir</label>
                          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputControlClass} />
                        </div>

                        <div className="space-y-1.5">
                          <div className={fieldLabelClass}>Jenis Kelamin</div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setGender('MALE')}
                              className={twMerge(
                                'h-10 rounded-xl border text-xs font-extrabold transition-colors',
                                gender === 'MALE'
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              )}
                            >
                              Laki-laki
                            </button>
                            <button
                              type="button"
                              onClick={() => setGender('FEMALE')}
                              className={twMerge(
                                'h-10 rounded-xl border text-xs font-extrabold transition-colors',
                                gender === 'FEMALE'
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              )}
                            >
                              Perempuan
                            </button>
                            <button
                              type="button"
                              onClick={() => setGender('')}
                              className={twMerge(
                                'h-10 rounded-xl border text-xs font-extrabold transition-colors',
                                gender === ''
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              )}
                            >
                              -
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <label className={fieldLabelClass}>Telepon</label>
                          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputControlClass} placeholder="Contoh: 08xxxxxxxxxx" />
                        </div>
                      </div>
                    </div>

                    <div className={cardClass}>
                      <div className={sectionTitleClass}>Jejaring Sosial</div>

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputControlClass} placeholder="Instagram" />
                        <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} className={inputControlClass} placeholder="TikTok" />
                        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputControlClass} placeholder="WhatsApp" />
                        <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className={inputControlClass} placeholder="LinkedIn" />
                        <input value={facebook} onChange={(e) => setFacebook(e.target.value)} className={inputControlClass} placeholder="Facebook" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className={cardClass}>
                      <div className={sectionTitleClass}>Lokasi</div>

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className={fieldLabelClass}>Negara</label>
                          <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputControlClass} placeholder="Indonesia" />
                        </div>
                        <div className="space-y-1.5">
                          <label className={fieldLabelClass}>Provinsi</label>
                          <input value={province} onChange={(e) => setProvince(e.target.value)} className={inputControlClass} placeholder="Jawa Barat" />
                        </div>
                        <div className="space-y-1.5">
                          <label className={fieldLabelClass}>Kota</label>
                          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputControlClass} placeholder="Bandung" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className={fieldLabelClass}>Alamat</label>
                          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputControlClass} placeholder="Alamat lengkap" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSettingsTab === 'images' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={cardClass}>
                    <div className={sectionTitleClass}>Gambar Akun</div>
                    <div className="mt-4 divide-y divide-slate-200/70">
                      <div className="py-3 flex items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                          {avatarUrl ? <Image src={avatarUrl} alt={user.name || user.email} fill unoptimized className="object-cover" /> : null}
                          {avatarUrl ? (
                            <button
                              type="button"
                              onClick={() => void saveAvatar('')}
                              disabled={savingAvatar}
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-white flex items-center justify-center disabled:opacity-60"
                              title="Hapus"
                              aria-label="Hapus"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 text-sm font-extrabold text-slate-900">Foto Profil</div>
                        <button
                          type="button"
                          onClick={() => setIsAvatarPickerOpen(true)}
                          className="h-9 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 disabled:opacity-60"
                          disabled={savingAvatar}
                        >
                          Upload
                        </button>
                      </div>

                      <div className="py-3 flex items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                          {profileCoverUrl ? <Image src={profileCoverUrl} alt="Cover profil" fill unoptimized className="object-cover" /> : null}
                          {profileCoverUrl ? (
                            <button
                              type="button"
                              onClick={() => void saveCover('')}
                              disabled={savingCover}
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-white flex items-center justify-center disabled:opacity-60"
                              title="Hapus"
                              aria-label="Hapus"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 text-sm font-extrabold text-slate-900">Cover Profil</div>
                        <button
                          type="button"
                          onClick={() => setIsCoverPickerOpen(true)}
                          className="h-9 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 disabled:opacity-60"
                          disabled={savingCover}
                        >
                          Upload
                        </button>
                      </div>

                      {isMentorLike ? (
                        <div className="py-3 flex items-center gap-3">
                          <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                            {signatureUrl ? <Image src={signatureUrl} alt="Tanda Tangan" width={160} height={64} unoptimized className="w-full h-full object-contain" /> : null}
                            {signatureUrl ? (
                              <button
                                type="button"
                                onClick={() => void saveSignature('')}
                                disabled={savingSignature}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-white flex items-center justify-center disabled:opacity-60"
                                title="Hapus"
                                aria-label="Hapus"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 text-sm font-extrabold text-slate-900">Tanda Tangan</div>
                          <button
                            type="button"
                            onClick={() => signatureFileInputRef.current?.click()}
                            className="h-9 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 disabled:opacity-60"
                            disabled={savingSignature}
                          >
                            Upload
                          </button>
                          <input
                            ref={signatureFileInputRef}
                            type="file"
                            accept="image/*"
                            disabled={savingSignature}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              void uploadSignatureFile(file);
                              e.currentTarget.value = '';
                            }}
                            className="hidden"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {vendors.length > 0 ? (
                    <div className={cardClass}>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <div className={sectionTitleClass}>Gambar Vendor</div>
                        </div>
                        {vendors.length > 1 ? (
                          <select
                            value={activeVendorId}
                            onChange={(e) => setActiveVendorId(e.target.value)}
                            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-extrabold text-slate-700"
                          >
                            {vendors.map((v: any) => (
                              <option key={String(v.id)} value={String(v.id)}>
                                {String(v.name || v.slug || v.id)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>

                      <div className="mt-5 divide-y divide-slate-200/70">
                        <div className="py-3 flex items-center gap-3">
                          <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                            {vendorLogoUrl ? <Image src={vendorLogoUrl} alt="Logo vendor" fill unoptimized className="object-cover" /> : null}
                            {vendorLogoUrl ? (
                              <button
                                type="button"
                                onClick={() => void saveVendorImage('LOGO', '')}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-white flex items-center justify-center"
                                title="Hapus"
                                aria-label="Hapus"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 text-sm font-extrabold text-slate-900">Logo Vendor</div>
                          <button
                            type="button"
                            onClick={() => {
                              setVendorMediaTarget('LOGO');
                              setIsVendorMediaOpen(true);
                            }}
                            className="h-9 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700"
                          >
                            Upload
                          </button>
                        </div>

                        <div className="py-3 flex items-center gap-3">
                          <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                            {vendorCoverUrl ? <Image src={vendorCoverUrl} alt="Cover vendor" fill unoptimized className="object-cover" /> : null}
                            {vendorCoverUrl ? (
                              <button
                                type="button"
                                onClick={() => void saveVendorImage('COVER', '')}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-white flex items-center justify-center"
                                title="Hapus"
                                aria-label="Hapus"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 text-sm font-extrabold text-slate-900">Cover Vendor</div>
                          <button
                            type="button"
                            onClick={() => {
                              setVendorMediaTarget('COVER');
                              setIsVendorMediaOpen(true);
                            }}
                            className="h-9 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeSettingsTab === 'about' ? (
                isMentorLike ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className={cardClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={sectionTitleClass}>Riwayat Pendidikan</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const id = makeId();
                              setMentorEducations((prev) => [
                                { id, title: 'Pendidikan', subtitle: '', years: '', description: '' },
                                ...(Array.isArray(prev) ? prev : []),
                              ]);
                            }}
                            className="text-sm font-extrabold text-indigo-600 hover:text-indigo-700"
                          >
                            + Tambah Pendidikan
                          </button>
                        </div>

                        <div className="mt-5 space-y-3">
                          {mentorEducations.length === 0 ? (
                            <div className="text-sm text-slate-500">Belum ada riwayat pendidikan.</div>
                          ) : (
                            mentorEducations.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 space-y-3">
                                    <input
                                      value={item.title}
                                      onChange={(e) =>
                                        setMentorEducations((prev) =>
                                          prev.map((p) => (p.id === item.id ? { ...p, title: e.target.value } : p))
                                        )
                                      }
                                      className={inputControlClass}
                                      placeholder="Contoh: S1 Teknik Geologi"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <input
                                        value={item.subtitle || ''}
                                        onChange={(e) =>
                                          setMentorEducations((prev) =>
                                            prev.map((p) => (p.id === item.id ? { ...p, subtitle: e.target.value } : p))
                                          )
                                        }
                                        className={inputControlClass}
                                        placeholder="Institusi"
                                      />
                                      <input
                                        value={item.years || ''}
                                        onChange={(e) =>
                                          setMentorEducations((prev) =>
                                            prev.map((p) => (p.id === item.id ? { ...p, years: e.target.value } : p))
                                          )
                                        }
                                        className={inputControlClass}
                                        placeholder="Tahun"
                                      />
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setMentorEducations((prev) => prev.filter((p) => p.id !== item.id))}
                                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className={cardClass}>
                        <div className={sectionTitleClass}>Tentang</div>

                        <div className="mt-5 space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Jabatan</label>
                            <input
                              value={mentorJobTitle}
                              onChange={(e) => setMentorJobTitle(e.target.value)}
                              className={inputControlClass}
                              placeholder="Contoh: Mentor Geosains"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Biografi</label>
                            <textarea
                              value={mentorBio}
                              onChange={(e) => setMentorBio(e.target.value)}
                              className={twMerge(inputControlClass, 'min-h-36')}
                              placeholder="Tulis bio singkat..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className={cardClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={sectionTitleClass}>Riwayat Pengalaman</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const id = makeId();
                              setMentorExperiences((prev) => [
                                { id, title: 'Pengalaman', subtitle: '', years: '', description: '' },
                                ...(Array.isArray(prev) ? prev : []),
                              ]);
                            }}
                            className="text-sm font-extrabold text-indigo-600 hover:text-indigo-700"
                          >
                            + Tambah Pengalaman
                          </button>
                        </div>

                        <div className="mt-5 space-y-3">
                          {mentorExperiences.length === 0 ? (
                            <div className="text-sm text-slate-500">Belum ada pengalaman.</div>
                          ) : (
                            mentorExperiences.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 space-y-3">
                                    <input
                                      value={item.title}
                                      onChange={(e) =>
                                        setMentorExperiences((prev) =>
                                          prev.map((p) => (p.id === item.id ? { ...p, title: e.target.value } : p))
                                        )
                                      }
                                      className={inputControlClass}
                                      placeholder="Contoh: Geologist"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <input
                                        value={item.subtitle || ''}
                                        onChange={(e) =>
                                          setMentorExperiences((prev) =>
                                            prev.map((p) => (p.id === item.id ? { ...p, subtitle: e.target.value } : p))
                                          )
                                        }
                                        className={inputControlClass}
                                        placeholder="Perusahaan"
                                      />
                                      <input
                                        value={item.years || ''}
                                        onChange={(e) =>
                                          setMentorExperiences((prev) =>
                                            prev.map((p) => (p.id === item.id ? { ...p, years: e.target.value } : p))
                                          )
                                        }
                                        className={inputControlClass}
                                        placeholder="Tahun"
                                      />
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setMentorExperiences((prev) => prev.filter((p) => p.id !== item.id))}
                                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className={cardClass}>
                        <div className={sectionTitleClass}>Keahlian</div>
                        <div className="mt-4">
                          <SimpleTagInput
                            value={mentorSkills}
                            onChange={(next) => setMentorSkills(next)}
                            inputClassName={inputControlClass}
                            placeholder="Tambah keahlian, contoh: Geologi Struktur"
                            maxTags={30}
                          />
                        </div>
                      </div>

                      <div className={cardClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={sectionTitleClass}>File & Lampiran</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAttachmentPickerOpen(true)}
                            className="text-sm font-extrabold text-indigo-600 hover:text-indigo-700"
                          >
                            + Tambah File
                          </button>
                        </div>

                        <div className="mt-5 space-y-3">
                          {mentorAttachments.length === 0 ? (
                            <div className="text-sm text-slate-500">Belum ada lampiran</div>
                          ) : (
                            mentorAttachments.map((f) => (
                              <div
                                key={f.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4"
                              >
                                <a href={f.url} target="_blank" rel="noreferrer" className="text-sm font-extrabold text-slate-900 hover:underline">
                                  {f.filename || 'File'}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setMentorAttachments((prev) => prev.filter((p) => p.id !== f.id))}
                                  className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
                                >
                                  Hapus
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cardClass}>
                    <div className={sectionTitleClass}>Tentang Akun</div>
                    <div className={sectionDescClass}>Ringkasan informasi akun Anda.</div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
                        <div className="text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Role</div>
                        <div className="mt-1 text-sm font-extrabold text-slate-900">{roleLabel(user.role, Boolean((user as any).isSuperAdmin))}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
                        <div className="text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Member Sejak</div>
                        <div className="mt-1 text-sm font-extrabold text-slate-900">{formatMemberSince(user.createdAt)}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200/80 p-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Mail className="w-4 h-4 text-indigo-700 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-500">Email</div>
                            <div className="text-sm font-extrabold text-slate-900 truncate">{user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-indigo-700 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-500">Lokasi</div>
                            <div className="text-sm font-semibold text-slate-700 truncate">
                              {[city, province, country].map((v) => String(v || '').trim()).filter(Boolean).join(', ') || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-slate-200/70">
                          <div className="text-xs font-bold text-slate-500">Kontak</div>
                          <div className="mt-1 text-sm font-semibold text-slate-700">{phone ? phone : '-'}</div>
                        </div>
                        <div className="pt-3 border-t border-slate-200/70">
                          <div className="text-xs font-bold text-slate-500">Alamat</div>
                          <div className="mt-1 text-sm font-semibold text-slate-700 whitespace-pre-wrap">{address ? address : '-'}</div>
                        </div>
                        <div className="pt-3 border-t border-slate-200/70">
                          <div className="text-xs font-bold text-slate-500">Sosial</div>
                          <div className="mt-1 text-sm font-semibold text-slate-700">
                            {[
                              instagram ? `Instagram: ${instagram}` : '',
                              whatsapp ? `WhatsApp: ${whatsapp}` : '',
                              facebook ? `Facebook: ${facebook}` : '',
                              linkedin ? `LinkedIn: ${linkedin}` : '',
                              tiktok ? `TikTok: ${tiktok}` : '',
                            ]
                              .map((v) => String(v || '').trim())
                              .filter(Boolean)
                              .join(' • ') || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : null}

              {activeSettingsTab === 'logins' ? (
                <div className={cardClass}>
                  <div className={sectionTitleClass}>Riwayat Login</div>

                  <div className="mt-5">
                    {isMeLoading ? (
                      <div className="text-sm text-slate-500">Memuat...</div>
                    ) : isMeError ? (
                      <div className="text-sm text-slate-500">Gagal memuat riwayat login</div>
                    ) : loginHistory.length === 0 ? (
                      <div className="text-sm text-slate-500">Belum ada riwayat login</div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200/80 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className={twMerge('w-full', loginHistoryScope === 'members' ? 'min-w-[1350px]' : 'min-w-[1180px]')}>
                            <thead className="bg-slate-50">
                              <tr className="text-left">
                                {loginHistoryScope === 'members' ? (
                                  <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Member</th>
                                ) : null}
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Sistem Operasi</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Browser</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Perangkat</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Alamat IP</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Negara</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Kota</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Mulai Sesi</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Selesai Sesi</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase">Durasi</th>
                                <th className="px-5 py-4 text-[11px] font-extrabold text-slate-500 tracking-wide uppercase text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200/70">
                              {loginHistory.map((item) => {
                                const uaInfo = item.userAgent ? parseUserAgentInfo(item.userAgent) : { os: '-', browser: '-', device: '-' };
                                const provider = String(item.action).toUpperCase().includes('GOOGLE') ? 'google' : 'email';
                                const country = getMetaString(item.metadata, 'country') ?? '-';
                                const city = getMetaString(item.metadata, 'city') ?? '-';
                                const sessionEndRaw = getMetaString(item.metadata, 'sessionEnd') || getMetaString(item.metadata, 'logoutAt');
                                const sessionEnd = sessionEndRaw ? formatLoginDate(sessionEndRaw) : '-';
                                const duration = sessionEndRaw ? formatDuration(item.createdAt, sessionEndRaw) : '-';
                                const actorName = item.actor?.name && String(item.actor.name).trim() ? String(item.actor.name).trim() : '';
                                const actorEmail = item.actor?.email && String(item.actor.email).trim() ? String(item.actor.email).trim() : '';
                                const actorDisplay = actorName || actorEmail || '-';

                                return (
                                  <tr key={item.id} className="text-sm text-slate-700">
                                    {loginHistoryScope === 'members' ? (
                                      <td className="px-5 py-5">
                                        <div className="min-w-[220px]">
                                          <div className="font-extrabold text-slate-900 truncate">{actorDisplay}</div>
                                          {actorName && actorEmail && actorName !== actorEmail ? (
                                            <div className="text-xs text-slate-500 font-bold truncate">{actorEmail}</div>
                                          ) : null}
                                        </div>
                                      </td>
                                    ) : null}
                                    <td className="px-5 py-5 font-bold text-slate-900">{uaInfo.os}</td>
                                    <td className="px-5 py-5 text-slate-700">{uaInfo.browser}</td>
                                    <td className="px-5 py-5 text-slate-700">{uaInfo.device}</td>
                                    <td className="px-5 py-5 text-slate-700">{item.ip || '-'}</td>
                                    <td className="px-5 py-5 text-slate-700">{country}</td>
                                    <td className="px-5 py-5 text-slate-700">{city}</td>
                                    <td className="px-5 py-5 text-slate-700">{formatLoginDate(item.createdAt)}</td>
                                    <td className="px-5 py-5 text-slate-700">{sessionEnd}</td>
                                    <td className="px-5 py-5 text-slate-700">{duration}</td>
                                    <td className="px-5 py-5 text-right">
                                      <button
                                        type="button"
                                        className={twMerge(
                                          'inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100',
                                          provider === 'google' ? 'ring-1 ring-indigo-500/10' : ''
                                        )}
                                        title="Aksi"
                                        aria-label="Aksi"
                                      >
                                        <MoreHorizontal className="w-5 h-5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {!isSuperAdmin || activeSettingsTab === 'basic' ? (
          <div className="fixed bottom-0 inset-x-0 z-40 sm:bottom-6 sm:right-6 sm:left-auto sm:inset-x-auto">
            <div className="sm:hidden border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={saveAll}
                disabled={savingBasic || savingSecurity || savingMentorProfile || savingAdditionalInfo}
                className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm shadow-lg shadow-indigo-900/15 hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingBasic || savingSecurity || savingMentorProfile || savingAdditionalInfo ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
            <button
              type="button"
              onClick={saveAll}
              disabled={savingBasic || savingSecurity || savingMentorProfile || savingAdditionalInfo}
              className="hidden sm:inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm shadow-lg shadow-indigo-900/15 hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingBasic || savingSecurity || savingMentorProfile || savingAdditionalInfo ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        ) : null}

        {isTotpModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-200">
                <div className="text-lg font-extrabold text-slate-900">
                  {totpMode === 'enable' ? 'Aktifkan Verifikasi 2 Langkah' : 'Nonaktifkan Verifikasi 2 Langkah'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Google Authenticator (TOTP)</div>
              </div>

              <div className="p-5 space-y-4">
                {totpMode === 'enable' && totpStep === 'verify' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                      <div className="text-xs font-extrabold text-slate-700">Scan QR</div>
                      {totpQrDataUrl ? (
                        <div className="mt-3 flex items-center justify-center">
                          <img src={totpQrDataUrl} alt="QR 2FA" className="w-[220px] h-[220px] rounded-xl border border-slate-200 bg-white" />
                        </div>
                      ) : null}
                      {totpSecret ? (
                        <div className="mt-3">
                          <div className="text-[11px] font-extrabold text-slate-600 tracking-wide uppercase">Secret (manual)</div>
                          <div className="mt-1 font-mono text-xs text-slate-700 break-all">{totpSecret}</div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Kode 6 digit</label>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        className={inputControlClass}
                        placeholder="Contoh: 123456"
                        disabled={savingTotp}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Password Saat Ini</label>
                      {renderPasswordInput({
                        value: totpPassword,
                        onChange: setTotpPassword,
                        placeholder: '••••••••',
                        show: showTotpPassword,
                        onToggle: () => setShowTotpPassword((prev) => !prev),
                        disabled: savingTotp,
                      })}
                    </div>

                    {totpMode === 'disable' ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Kode 6 digit</label>
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          className={inputControlClass}
                          placeholder="Contoh: 123456"
                          disabled={savingTotp}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTotpModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
                  disabled={savingTotp}
                >
                  Batal
                </button>

                {totpMode === 'enable' ? (
                  totpStep === 'password' ? (
                    <button
                      type="button"
                      onClick={startTotpSetup}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                      disabled={savingTotp}
                    >
                      {savingTotp ? 'Memproses...' : 'Lanjutkan'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={confirmTotpEnable}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                      disabled={savingTotp}
                    >
                      {savingTotp ? 'Memproses...' : 'Aktifkan'}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={submitTotpDisable}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white font-extrabold text-sm hover:bg-rose-700 disabled:opacity-60"
                    disabled={savingTotp}
                  >
                    {savingTotp ? 'Memproses...' : 'Nonaktifkan'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <MediaPickerModal
          isOpen={isAttachmentPickerOpen}
          onClose={() => setIsAttachmentPickerOpen(false)}
          onSelect={(item) => {
            setMentorAttachments((prev) => {
              const exists = prev.some((p) => p.id === item.id);
              if (exists) return prev;
              return [{ id: item.id, url: item.url, filename: item.filename }, ...prev].slice(0, 50);
            });
            setIsAttachmentPickerOpen(false);
          }}
          initialTab="GALLERY"
        />

        <MediaPickerModal
          isOpen={isCoverPickerOpen}
          onClose={() => setIsCoverPickerOpen(false)}
          onSelect={(item) => void saveCover(item.url)}
          initialTab="UPLOAD"
        />

        <MediaPickerModal
          isOpen={isVendorMediaOpen}
          onClose={() => setIsVendorMediaOpen(false)}
          onSelect={(item) => {
            void saveVendorImage(vendorMediaTarget, item.url);
            setIsVendorMediaOpen(false);
          }}
          initialTab="UPLOAD"
        />

        <MediaPickerModal
          isOpen={isAvatarPickerOpen}
          onClose={() => setIsAvatarPickerOpen(false)}
          onSelect={(item) => void saveAvatar(item.url)}
          initialTab="UPLOAD"
        />
      </div>
    );
  }

  return (
    <div className={isDashboard ? 'w-full' : 'min-h-screen bg-slate-50'}>
      <div className={isDashboard ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10'}>
        {!inTab ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-slate-500">Akun</div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Profil Saya</h1>
            </div>
            {!isDashboard ? (
              <Link href="/dashboard" className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-white">
                Ke Dashboard
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className={inTab ? 'mt-4' : 'mt-6'}>
          <div className="relative">
            <div className="h-44 sm:h-56 bg-slate-200 rounded-2xl overflow-hidden relative">
              {profileCoverUrl ? <Image src={profileCoverUrl} alt="Cover" fill unoptimized className="object-cover" /> : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-white/0" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:sticky lg:top-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative">
                    {avatarUrl ? <Image src={avatarUrl} alt={user.name || user.email} fill unoptimized className="object-cover" /> : null}
                  </div>
                  <div className="mt-4 text-lg font-extrabold text-slate-900">{user.name || user.email}</div>
                  <div className="mt-1 inline-flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-50 text-slate-700 border border-slate-200 uppercase tracking-wide">
                      {roleLabel(user.role, Boolean((user as any).isSuperAdmin))}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 w-full border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="p-3">
                      <div className="text-sm font-extrabold text-slate-900">{isMentorLike ? mentorCourses.length : enrolledCourses.length}</div>
                      <div className="text-[11px] text-slate-500">Kursus</div>
                    </div>
                    <div className="p-3 border-l border-slate-200">
                      <div className="text-sm font-extrabold text-slate-900">{certificates.length}</div>
                      <div className="text-[11px] text-slate-500">Sertifikat</div>
                    </div>
                    <div className="p-3 border-l border-slate-200">
                      <div className="text-sm font-extrabold text-slate-900">{isMentorLike ? mentorPosts.length : loginHistory.length}</div>
                      <div className="text-[11px] text-slate-500">{isMentorLike ? 'Artikel' : 'Login'}</div>
                    </div>
                  </div>

                  <div className="mt-5 w-full space-y-2">
                    <Link
                      href={settingsHref}
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold hover:opacity-90 transition-opacity"
                    >
                      <Settings2 className="w-4 h-4" />
                      Pengaturan
                    </Link>
                    <button
                      type="button"
                      onClick={() => setIsAvatarPickerOpen(true)}
                      className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-extrabold hover:bg-slate-50"
                      disabled={savingAvatar}
                    >
                      Ganti Foto
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                        } catch {
                        }
                        toast.success('Anda telah keluar');
                        router.push('/login');
                      }}
                      className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl border border-slate-200 text-red-700 font-extrabold hover:bg-red-50"
                    >
                      Keluar
                    </button>
                  </div>

                  <div className="mt-5 text-xs text-slate-500">Member sejak {formatMemberSince(user.createdAt)}</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 min-w-0 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-4 sm:px-6 overflow-x-auto">
                  <div className="flex items-center gap-6 min-w-max">
                    {profileTabs.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveProfileTab(t.id)}
                          className={twMerge(
                            'py-3 text-[13px] sm:text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-2',
                            activeProfileTab === t.id
                              ? 'text-indigo-700 border-indigo-600'
                              : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {metrics.map((m) => {
                      const Icon = m.icon;
                      return (
                        <div key={m.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Icon className="w-4 h-4 text-indigo-700" />
                            <div className="text-xs font-bold">{m.label}</div>
                          </div>
                          <div className="mt-2 text-lg font-extrabold text-slate-900">{m.isMoney ? `Rp ${m.value}` : m.value}</div>
                        </div>
                      );
                    })}
                  </div>

                  {activeProfileTab === 'about' ? (
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-6">
                        <div className="rounded-2xl border border-slate-200 p-5">
                          <div className="text-sm font-extrabold text-slate-900">Tentang Saya</div>
                          {isMentorLike ? (
                            <div className="mt-3 space-y-3">
                              <div className="text-sm text-slate-600">
                                <span className="font-extrabold text-slate-900">{mentorJobTitle || 'Mentor'}</span>
                              </div>
                              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {mentorBio || 'Belum ada deskripsi.'}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                              {`Halo, saya ${user.name || user.email}.`}
                            </div>
                          )}
                        </div>

                        {isMentorLike ? (
                          <div className="rounded-2xl border border-slate-200 p-5">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-indigo-700" />
                              <div className="text-sm font-extrabold text-slate-900">Pengalaman</div>
                            </div>
                            <div className="mt-4 space-y-3">
                              {mentorExperiences.length === 0 ? (
                                <div className="text-sm text-slate-500">Belum ada pengalaman</div>
                              ) : (
                                mentorExperiences.slice(0, 6).map((exp) => (
                                  <div key={exp.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="text-sm font-extrabold text-slate-900">{exp.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {[exp.subtitle, exp.years].filter(Boolean).join(' • ') || '-'}
                                    </div>
                                    {exp.description ? <div className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{exp.description}</div> : null}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ) : null}

                        {isMentorLike ? (
                          <div className="rounded-2xl border border-slate-200 p-5">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-indigo-700" />
                              <div className="text-sm font-extrabold text-slate-900">Keahlian</div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {mentorSkills.length === 0 ? (
                                <div className="text-sm text-slate-500">Belum ada keahlian</div>
                              ) : (
                                mentorSkills.slice(0, 20).map((s, idx) => (
                                  <span key={`${s}-${idx}`} className="px-3 py-1.5 rounded-full text-xs font-extrabold border bg-slate-50 text-slate-700 border-slate-200">
                                    {s}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-2xl border border-slate-200 p-5">
                          <div className="text-sm font-extrabold text-slate-900">Informasi</div>
                          <div className="mt-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <Mail className="w-4 h-4 text-indigo-700 mt-0.5" />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-500">Email</div>
                                <div className="text-sm font-extrabold text-slate-900 truncate">{user.email}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <MapPin className="w-4 h-4 text-indigo-700 mt-0.5" />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-500">Lokasi</div>
                                <div className="text-sm font-semibold text-slate-700 truncate">
                                  {[city, province, country].map((v) => String(v || '').trim()).filter(Boolean).join(', ') || '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {isMentorLike ? (
                          <div className="rounded-2xl border border-slate-200 p-5">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-indigo-700" />
                              <div className="text-sm font-extrabold text-slate-900">Pendidikan</div>
                            </div>
                            <div className="mt-4 space-y-3">
                              {mentorEducations.length === 0 ? (
                                <div className="text-sm text-slate-500">Belum ada pendidikan</div>
                              ) : (
                                mentorEducations.slice(0, 6).map((edu) => (
                                  <div key={edu.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="text-sm font-extrabold text-slate-900">{edu.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {[edu.subtitle, edu.years].filter(Boolean).join(' • ') || '-'}
                                    </div>
                                    {edu.description ? <div className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{edu.description}</div> : null}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {activeProfileTab === 'courses' ? (
                    <div className="mt-6">
                      <div className="text-sm font-extrabold text-slate-900">Kursus</div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(isMentorLike ? mentorCourses : enrolledCourses).length === 0 ? (
                          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                            Belum ada kursus untuk ditampilkan.
                          </div>
                        ) : (
                          (isMentorLike ? mentorCourses : enrolledCourses).slice(0, 12).map((c: any) => (
                            <div key={c.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                              <div className="h-28 bg-slate-100 relative">
                                {c.thumbnailUrl ? <Image src={c.thumbnailUrl} alt={c.title} fill unoptimized className="object-cover" /> : null}
                              </div>
                              <div className="p-4">
                                <div className="text-sm font-extrabold text-slate-900 line-clamp-2">{c.title}</div>
                                {isMentorLike ? (
                                  <div className="text-xs text-slate-500 mt-1">{c.totalStudents} siswa</div>
                                ) : (
                                  <div className="text-xs text-slate-500 mt-1">{c.instructorName}</div>
                                )}
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  {c.slug ? (
                                    <Link
                                      href={`/courses/${encodeURIComponent(String(c.slug))}`}
                                      className="text-sm font-extrabold text-indigo-700 hover:text-indigo-800"
                                    >
                                      Lihat
                                    </Link>
                                  ) : (
                                    <span className="text-sm text-slate-400">-</span>
                                  )}
                                  {isMentorLike ? (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-slate-50 text-slate-700 border-slate-200">
                                      {String(c.status || '').toUpperCase() === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  {activeProfileTab === 'products' ? (
                    <div className="mt-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-extrabold text-slate-900">Produk</div>
                        {isMentorLike ? (
                          <Link
                            href={user.role === 'ADMIN' ? '/dashboard/admin/shop' : '/dashboard/vendor/shop'}
                            className="text-sm font-extrabold text-indigo-700 hover:text-indigo-800"
                          >
                            Kelola produk
                          </Link>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        {user.role === 'MENTOR' && approvedVendorIds.length === 0 ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                            Vendor belum aktif. Aktifkan vendor dulu untuk menampilkan produk.
                          </div>
                        ) : myProducts.length === 0 ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                            Belum ada produk untuk ditampilkan.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {myProducts.slice(0, 12).map((p) => {
                              const imageUrl =
                                typeof p.imageUrl === 'string' && p.imageUrl.trim() && !p.imageUrl.startsWith('blob:') ? p.imageUrl : '';
                              const href = p.slug ? `/shop/products/${encodeURIComponent(p.slug)}` : '/shop';
                              return (
                                <div key={p.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                                  <Link href={href} className="block h-28 bg-slate-100 relative">
                                    {imageUrl ? <Image src={imageUrl} alt={p.name} fill unoptimized className="object-cover" /> : null}
                                  </Link>
                                  <div className="p-4">
                                    <div className="text-sm font-extrabold text-slate-900 line-clamp-2">{p.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {p.type ? String(p.type).toUpperCase() : '-'}
                                      {p.stock === null ? '' : ` • Stok ${p.stock}`}
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                      <div className="text-sm font-extrabold text-indigo-700">Rp {Math.round(p.price).toLocaleString('id-ID')}</div>
                                      <Link href={href} className="text-sm font-extrabold text-slate-700 hover:text-slate-900">
                                        Lihat
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {activeProfileTab === 'articles' ? (
                    <div className="mt-6">
                      <div className="text-sm font-extrabold text-slate-900">Artikel</div>
                      <div className="mt-4 space-y-3">
                        {mentorPosts.length === 0 ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                            Belum ada artikel.
                          </div>
                        ) : (
                          mentorPosts.slice(0, 12).map((p) => (
                            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-indigo-700" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-extrabold text-slate-900 truncate">{p.title}</div>
                                <div className="text-xs text-slate-500 mt-1">{formatLoginDate(p.createdAt)}</div>
                              </div>
                              {p.slug ? (
                                <Link href={`/blog/${encodeURIComponent(p.slug)}`} className="text-sm font-extrabold text-indigo-700 hover:text-indigo-800">
                                  Buka
                                </Link>
                              ) : null}
                            </div>
                          ))
                        )}
                        <div>
                          <Link
                            href={user.role === 'ADMIN' ? '/dashboard/admin/blog' : '/dashboard/mentor/blog'}
                            className="text-sm font-extrabold text-indigo-700 hover:text-indigo-800"
                          >
                            Kelola artikel
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MediaPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        onSelect={(item) => void saveAvatar(item.url)}
        initialTab="UPLOAD"
      />
    </div>
  );
}
