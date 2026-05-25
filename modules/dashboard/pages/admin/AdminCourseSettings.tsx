"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Award,
  BookOpen,
  DollarSign,
  Loader2,
  PenLine,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '../../components/ConfirmDialog';

type DripType = 'NONE' | 'SCHEDULE' | 'AFTER_ENROLLMENT' | 'SEQUENTIAL';
type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type PricingType = 'FREE' | 'PAID';
type WithdrawMethod = 'BANK_TRANSFER' | 'E_CHECK' | 'PAYPAL';
type GradebookUngradedAssignmentPolicy = 'IGNORE' | 'ZERO';
type CertificateDownloadPolicy = 'OWNER_ONLY' | 'PUBLIC';
type CertificateTemplate = 'CLASSIC' | 'MODERN' | 'CUSTOM';

function toDateInputValueUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function todayUtcInput() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return toDateInputValueUtc(d);
}

function toNumberOrNull(value: string) {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toNumberOrUndefined(value: string) {
  const v = value.trim();
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function toMoney(value: string) {
  const raw = value.trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

function toIsoEnd(dateValue: string | null) {
  if (!dateValue) return null;
  const d = new Date(`${dateValue}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toDateInputFromIso(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return toDateInputValueUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
}

const compactControlClass =
  'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';
const inputControlClass =
  'block w-full rounded-xl border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:placeholder:text-slate-400 disabled:cursor-not-allowed';
const selectControlClass =
  'block w-full rounded-xl border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';
const textareaControlClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={twMerge(
        'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
        checked ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-200 border-slate-200',
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      )}
      aria-pressed={checked}
    >
      <span
        className={twMerge(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function SettingRow({ title, description, right }: { title: string; description?: string; right: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        {description ? <div className="text-sm text-slate-500 mt-1">{description}</div> : null}
      </div>
      <div className="shrink-0 pt-0.5">{right}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
      </div>
      <div className="px-6 divide-y divide-slate-100">{children}</div>
    </div>
  );
}

export default function AdminCourseSettings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menu, setMenu] = useState<'GENERAL' | 'KURSUS' | 'SERTIFIKAT' | 'MONETISASI'>('GENERAL');
  const [certificateTab, setCertificateTab] = useState<'ALL' | 'SETTINGS'>('ALL');

  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const reauthResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const requestReauth = () =>
    new Promise<boolean>((resolve) => {
      setReauthPassword('');
      setReauthOpen(true);
      reauthResolverRef.current = resolve;
    });

  const closeReauth = () => {
    setReauthOpen(false);
    const resolver = reauthResolverRef.current;
    reauthResolverRef.current = null;
    if (resolver) resolver(false);
  };

  const confirmReauth = async () => {
    if (reauthLoading) return;
    const password = reauthPassword;
    if (!password) return;
    setReauthLoading(true);
    try {
      const res = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Gagal konfirmasi password');
        return;
      }
      setReauthOpen(false);
      const resolver = reauthResolverRef.current;
      reauthResolverRef.current = null;
      if (resolver) resolver(true);
    } finally {
      setReauthLoading(false);
    }
  };

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [becomeInstructorButtonEnabled, setBecomeInstructorButtonEnabled] = useState(false);
  const [allowInstructorsToPublishCourses, setAllowInstructorsToPublishCourses] = useState(true);
  const [allowInstructorsToTrashCourses, setAllowInstructorsToTrashCourses] = useState(true);
  const [allowInstructorsToChangeCourseAuthor, setAllowInstructorsToChangeCourseAuthor] = useState(false);
  const [allowInstructorsToManageCoInstructors, setAllowInstructorsToManageCoInstructors] = useState(false);
  const [allowInstructorsToResetStudentProgress, setAllowInstructorsToResetStudentProgress] = useState(false);

  const [studentsMustBeLoggedInToViewCourse, setStudentsMustBeLoggedInToViewCourse] = useState(false);
  const [allowStaffViewCourseContentWithoutEnrolling, setAllowStaffViewCourseContentWithoutEnrolling] = useState(true);
  const [spotlightModeEnabled, setSpotlightModeEnabled] = useState(false);
  const [autoLoadNextCourseContent, setAutoLoadNextCourseContent] = useState(true);
  const [autoIssueCertificateOnCompletion, setAutoIssueCertificateOnCompletion] = useState(true);
  const [courseCompletionMode, setCourseCompletionMode] = useState<'FLEXIBLE' | 'STRICT'>('STRICT');
  const [courseRetakeEnabled, setCourseRetakeEnabled] = useState(false);
  const [defaultQuizRetryLimit, setDefaultQuizRetryLimit] = useState<string>('');
  const [gradebookAllowCoInstructorAccess, setGradebookAllowCoInstructorAccess] = useState(false);
  const [gradebookUngradedAssignmentPolicy, setGradebookUngradedAssignmentPolicy] = useState<GradebookUngradedAssignmentPolicy>('IGNORE');
  const [certificatesEnabled, setCertificatesEnabled] = useState(true);
  const [certificateDownloadPolicy, setCertificateDownloadPolicy] = useState<CertificateDownloadPolicy>('OWNER_ONLY');
  const [certificateTemplate, setCertificateTemplate] = useState<CertificateTemplate>('CUSTOM');
  const [certificateBackgroundImageUrl, setCertificateBackgroundImageUrl] = useState<string>('');
  const [courseCertificateDesigns, setCourseCertificateDesigns] = useState<any[]>([]);
  const [isLoadingCourseCertificateDesigns, setIsLoadingCourseCertificateDesigns] = useState(false);
  const [isDeletingCourseCertificate, setIsDeletingCourseCertificate] = useState<string | null>(null);

  const [certificateShowQr, setCertificateShowQr] = useState(true);
  const [certificateShowSerial, setCertificateShowSerial] = useState(true);
  const [certificateShowDate, setCertificateShowDate] = useState(true);

  const [enableRevenueSharing, setEnableRevenueSharing] = useState(false);
  const [instructorRevenueSharePercent, setInstructorRevenueSharePercent] = useState<string>('90');
  const [adminRevenueSharePercent, setAdminRevenueSharePercent] = useState<string>('10');
  const [deductFees, setDeductFees] = useState(false);
  const [checkoutServiceFeeEnabled, setCheckoutServiceFeeEnabled] = useState(false);
  const [checkoutServiceFeeAmount, setCheckoutServiceFeeAmount] = useState<string>('15000');
  const [checkoutUniqueCodeEnabled, setCheckoutUniqueCodeEnabled] = useState(false);
  const [checkoutUniqueCodeDigits, setCheckoutUniqueCodeDigits] = useState<string>('3');
  const [minimumWithdrawalAmount, setMinimumWithdrawalAmount] = useState<string>('100000');
  const [minimumDaysBeforeBalanceAvailable, setMinimumDaysBeforeBalanceAvailable] = useState<string>('7');
  const [enabledWithdrawMethods, setEnabledWithdrawMethods] = useState<WithdrawMethod[]>(['BANK_TRANSFER']);
  const [bankInstructions, setBankInstructions] = useState<string>('');

  const [enableQA, setEnableQA] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [level, setLevel] = useState<CourseLevel>('BEGINNER');
  const [categoryId, setCategoryId] = useState<string>('');

  const [pricingType, setPricingType] = useState<PricingType>('FREE');
  const [price, setPrice] = useState<string>('0');
  const [subscriptionEligible, setSubscriptionEligible] = useState(false);

  const [maxStudents, setMaxStudents] = useState<string>('');
  const [validityDays, setValidityDays] = useState<string>('');
  const [enrollmentEndDate, setEnrollmentEndDate] = useState<string>('');

  const [dripEnabled, setDripEnabled] = useState(false);
  const [dripType, setDripType] = useState<DripType>('NONE');
  const [dripDays, setDripDays] = useState<string>('');

  const payload = useMemo(() => {
    return {
      becomeInstructorButtonEnabled,
      allowInstructorsToPublishCourses,
      allowInstructorsToTrashCourses,
      allowInstructorsToChangeCourseAuthor,
      allowInstructorsToManageCoInstructors,
      allowInstructorsToResetStudentProgress,
      studentsMustBeLoggedInToViewCourse,
      allowStaffViewCourseContentWithoutEnrolling,
      spotlightModeEnabled,
      autoLoadNextCourseContent,
      autoIssueCertificateOnCompletion,
      courseCompletionMode,
      courseRetakeEnabled,
      defaultQuizRetryLimit: toNumberOrNull(defaultQuizRetryLimit),
      gradebookAllowCoInstructorAccess,
      gradebookUngradedAssignmentPolicy,
      certificatesEnabled,
      certificateDownloadPolicy,
      certificateTemplate,
      certificateShowQr,
      certificateShowSerial,
      certificateShowDate,
      enableRevenueSharing,
      instructorRevenueSharePercent: toNumberOrUndefined(instructorRevenueSharePercent),
      adminRevenueSharePercent: toNumberOrUndefined(adminRevenueSharePercent),
      deductFees,
      checkoutServiceFeeEnabled,
      checkoutServiceFeeAmount: toNumberOrUndefined(checkoutServiceFeeAmount),
      checkoutUniqueCodeEnabled,
      checkoutUniqueCodeDigits: toNumberOrUndefined(checkoutUniqueCodeDigits),
      minimumWithdrawalAmount: toNumberOrUndefined(minimumWithdrawalAmount),
      minimumDaysBeforeBalanceAvailable: toNumberOrUndefined(minimumDaysBeforeBalanceAvailable),
      enabledWithdrawMethods,
      bankInstructions,
      enableQA,
      isPublic,
      reviewsEnabled,
      certificateEnabled,
      level,
      categoryId: categoryId ? categoryId : null,
      price: pricingType === 'FREE' ? 0 : toMoney(price),
      subscriptionEligible,
      maxStudents: toNumberOrNull(maxStudents),
      validityDays: toNumberOrNull(validityDays),
      enrollmentEndDate: enrollmentEndDate ? toIsoEnd(enrollmentEndDate) : null,
      dripEnabled,
      dripType,
      dripDays: toNumberOrNull(dripDays),
    };
  }, [
    becomeInstructorButtonEnabled,
    allowInstructorsToPublishCourses,
    allowInstructorsToTrashCourses,
    allowInstructorsToChangeCourseAuthor,
    allowInstructorsToManageCoInstructors,
    allowInstructorsToResetStudentProgress,
    studentsMustBeLoggedInToViewCourse,
    allowStaffViewCourseContentWithoutEnrolling,
    spotlightModeEnabled,
    autoLoadNextCourseContent,
    autoIssueCertificateOnCompletion,
    courseCompletionMode,
    courseRetakeEnabled,
    defaultQuizRetryLimit,
    gradebookAllowCoInstructorAccess,
    gradebookUngradedAssignmentPolicy,
    certificatesEnabled,
    certificateDownloadPolicy,
    certificateTemplate,
    certificateShowQr,
    certificateShowSerial,
    certificateShowDate,
    enableRevenueSharing,
    instructorRevenueSharePercent,
    adminRevenueSharePercent,
    deductFees,
    checkoutServiceFeeEnabled,
    checkoutServiceFeeAmount,
    checkoutUniqueCodeEnabled,
    checkoutUniqueCodeDigits,
    minimumWithdrawalAmount,
    minimumDaysBeforeBalanceAvailable,
    enabledWithdrawMethods,
    bankInstructions,
    enableQA,
    isPublic,
    reviewsEnabled,
    certificateEnabled,
    level,
    categoryId,
    pricingType,
    price,
    subscriptionEligible,
    maxStudents,
    validityDays,
    enrollmentEndDate,
    dripEnabled,
    dripType,
    dripDays,
  ]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    (async () => {
      try {
        const [settingsRes, categoriesRes] = await Promise.all([
          fetch('/api/course-settings', { cache: 'no-store' }),
          fetch('/api/categories', { cache: 'no-store' }),
        ]);
        const data = await settingsRes.json().catch(() => ({}));
        const categoriesData = await categoriesRes.json().catch(() => []);
        if (!active) return;
        if (!settingsRes.ok) throw new Error(data?.error || 'Gagal memuat pengaturan kursus');
        if (Array.isArray(categoriesData)) {
          const mapped = categoriesData
            .map((c: any) => ({ id: String(c?.id || ''), name: String(c?.name || '') }))
            .filter((c: { id: string; name: string }) => Boolean(c.id) && Boolean(c.name));
          setCategories(mapped);
        }

        if (typeof data?.becomeInstructorButtonEnabled === 'boolean') setBecomeInstructorButtonEnabled(data.becomeInstructorButtonEnabled);
        if (typeof data?.allowInstructorsToPublishCourses === 'boolean') setAllowInstructorsToPublishCourses(data.allowInstructorsToPublishCourses);
        if (typeof data?.allowInstructorsToTrashCourses === 'boolean') setAllowInstructorsToTrashCourses(data.allowInstructorsToTrashCourses);
        if (typeof data?.allowInstructorsToChangeCourseAuthor === 'boolean') setAllowInstructorsToChangeCourseAuthor(data.allowInstructorsToChangeCourseAuthor);
        if (typeof data?.allowInstructorsToManageCoInstructors === 'boolean') setAllowInstructorsToManageCoInstructors(data.allowInstructorsToManageCoInstructors);
        if (typeof data?.allowInstructorsToResetStudentProgress === 'boolean') setAllowInstructorsToResetStudentProgress(data.allowInstructorsToResetStudentProgress);
        if (typeof data?.studentsMustBeLoggedInToViewCourse === 'boolean') setStudentsMustBeLoggedInToViewCourse(data.studentsMustBeLoggedInToViewCourse);
        if (typeof data?.allowStaffViewCourseContentWithoutEnrolling === 'boolean') setAllowStaffViewCourseContentWithoutEnrolling(data.allowStaffViewCourseContentWithoutEnrolling);
        if (typeof data?.spotlightModeEnabled === 'boolean') setSpotlightModeEnabled(data.spotlightModeEnabled);
        if (typeof data?.autoLoadNextCourseContent === 'boolean') setAutoLoadNextCourseContent(data.autoLoadNextCourseContent);
        if (typeof data?.autoIssueCertificateOnCompletion === 'boolean') setAutoIssueCertificateOnCompletion(data.autoIssueCertificateOnCompletion);
        if (typeof data?.courseCompletionMode === 'string' && (data.courseCompletionMode === 'FLEXIBLE' || data.courseCompletionMode === 'STRICT')) setCourseCompletionMode(data.courseCompletionMode);
        if (typeof data?.courseRetakeEnabled === 'boolean') setCourseRetakeEnabled(data.courseRetakeEnabled);
        if (typeof data?.defaultQuizRetryLimit === 'number' || data?.defaultQuizRetryLimit === null) setDefaultQuizRetryLimit(data.defaultQuizRetryLimit === null ? '' : String(data.defaultQuizRetryLimit));
        if (typeof data?.gradebookAllowCoInstructorAccess === 'boolean') setGradebookAllowCoInstructorAccess(data.gradebookAllowCoInstructorAccess);
        if (typeof data?.gradebookUngradedAssignmentPolicy === 'string' && (data.gradebookUngradedAssignmentPolicy === 'IGNORE' || data.gradebookUngradedAssignmentPolicy === 'ZERO')) {
          setGradebookUngradedAssignmentPolicy(data.gradebookUngradedAssignmentPolicy);
        }
        if (typeof data?.certificatesEnabled === 'boolean') setCertificatesEnabled(data.certificatesEnabled);
        if (typeof data?.certificateDownloadPolicy === 'string' && (data.certificateDownloadPolicy === 'OWNER_ONLY' || data.certificateDownloadPolicy === 'PUBLIC')) {
          setCertificateDownloadPolicy(data.certificateDownloadPolicy);
        }
        if (
          typeof data?.certificateTemplate === 'string' &&
          (data.certificateTemplate === 'CLASSIC' || data.certificateTemplate === 'MODERN' || data.certificateTemplate === 'CUSTOM')
        ) {
          setCertificateTemplate(data.certificateTemplate);
        }
        if (typeof data?.certificateBackgroundImageUrl === 'string') setCertificateBackgroundImageUrl(data.certificateBackgroundImageUrl);
        if (typeof data?.certificateShowQr === 'boolean') setCertificateShowQr(data.certificateShowQr);
        if (typeof data?.certificateShowSerial === 'boolean') setCertificateShowSerial(data.certificateShowSerial);
        if (typeof data?.certificateShowDate === 'boolean') setCertificateShowDate(data.certificateShowDate);

        if (typeof data?.enableRevenueSharing === 'boolean') setEnableRevenueSharing(data.enableRevenueSharing);
        if (typeof data?.instructorRevenueSharePercent === 'number') setInstructorRevenueSharePercent(String(data.instructorRevenueSharePercent));
        if (typeof data?.adminRevenueSharePercent === 'number') setAdminRevenueSharePercent(String(data.adminRevenueSharePercent));
        if (typeof data?.deductFees === 'boolean') setDeductFees(data.deductFees);
        if (typeof data?.checkoutServiceFeeEnabled === 'boolean') setCheckoutServiceFeeEnabled(data.checkoutServiceFeeEnabled);
        if (typeof data?.checkoutServiceFeeAmount === 'number') setCheckoutServiceFeeAmount(String(data.checkoutServiceFeeAmount));
        if (typeof data?.checkoutUniqueCodeEnabled === 'boolean') setCheckoutUniqueCodeEnabled(data.checkoutUniqueCodeEnabled);
        if (typeof data?.checkoutUniqueCodeDigits === 'number') setCheckoutUniqueCodeDigits(String(data.checkoutUniqueCodeDigits));
        if (typeof data?.minimumWithdrawalAmount === 'number') setMinimumWithdrawalAmount(String(data.minimumWithdrawalAmount));
        if (typeof data?.minimumDaysBeforeBalanceAvailable === 'number') setMinimumDaysBeforeBalanceAvailable(String(data.minimumDaysBeforeBalanceAvailable));
        if (Array.isArray(data?.enabledWithdrawMethods)) {
          const next = data.enabledWithdrawMethods
            .map((x: any) => String(x))
            .filter((x: string) => x === 'BANK_TRANSFER' || x === 'E_CHECK' || x === 'PAYPAL') as WithdrawMethod[];
          if (next.length) setEnabledWithdrawMethods(next);
        }
        if (typeof data?.bankInstructions === 'string') setBankInstructions(data.bankInstructions);

        if (typeof data?.enableQA === 'boolean') setEnableQA(data.enableQA);
        if (typeof data?.isPublic === 'boolean') setIsPublic(data.isPublic);
        if (typeof data?.reviewsEnabled === 'boolean') setReviewsEnabled(data.reviewsEnabled);
        if (typeof data?.certificateEnabled === 'boolean') setCertificateEnabled(data.certificateEnabled);
        if (typeof data?.level === 'string') {
          const v = data.level as CourseLevel;
          if (v === 'BEGINNER' || v === 'INTERMEDIATE' || v === 'ADVANCED') setLevel(v);
        }
        if (typeof data?.categoryId === 'string') setCategoryId(data.categoryId);
        if (data?.categoryId === null) setCategoryId('');

        if (typeof data?.price === 'number') {
          const p = Math.max(0, data.price);
          setPrice(String(p));
          setPricingType(p > 0 ? 'PAID' : 'FREE');
        }
        if (typeof data?.subscriptionEligible === 'boolean') setSubscriptionEligible(data.subscriptionEligible);

        if (typeof data?.maxStudents === 'number') setMaxStudents(String(data.maxStudents));
        if (data?.maxStudents === null) setMaxStudents('');
        if (typeof data?.validityDays === 'number') setValidityDays(String(data.validityDays));
        if (data?.validityDays === null) setValidityDays('');
        setEnrollmentEndDate(toDateInputFromIso(data?.enrollmentEndDate));

        if (typeof data?.dripEnabled === 'boolean') setDripEnabled(data.dripEnabled);
        if (typeof data?.dripType === 'string') {
          const v = data.dripType as DripType;
          if (v === 'NONE' || v === 'SCHEDULE' || v === 'AFTER_ENROLLMENT' || v === 'SEQUENTIAL') setDripType(v);
        }
        if (typeof data?.dripDays === 'number') setDripDays(String(data.dripDays));
        if (data?.dripDays === null) setDripDays('');
      } catch (e: any) {
        toast.error(e?.message || 'Gagal memuat pengaturan kursus');
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (menu !== 'SERTIFIKAT') return;
    if (certificateTab !== 'ALL') return;
    let active = true;
    (async () => {
      try {
        setIsLoadingCourseCertificateDesigns(true);
        const coursesRes = await fetch('/api/dashboard/admin/course-reports?tab=courses&limit=30', { cache: 'no-store' });
        const coursesJson = await coursesRes.json().catch(() => ({}));
        if (!active) return;
        const courses = Array.isArray((coursesJson as any)?.courses) ? (coursesJson as any).courses : [];

        const settled = await Promise.allSettled(
          courses.map(async (c: any) => {
            const id = String(c?.id || '').trim();
            if (!id) return null;
            const res = await fetch(`/api/courses/${encodeURIComponent(id)}/certificate-design`, { cache: 'no-store' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) return null;
            const design = (json as any)?.design;
            if (!design || typeof design !== 'object') return null;
            const bg = typeof (design as any)?.certificateBackgroundImageUrl === 'string' ? String((design as any).certificateBackgroundImageUrl).trim() : '';
            const els = Array.isArray((design as any)?.elements) ? (design as any).elements : [];
            if (!bg && els.length === 0) return null;
            return { course: c, design, updatedAt: (json as any)?.updatedAt ?? null };
          })
        );

        if (!active) return;
        const items = settled
          .map((r) => (r.status === 'fulfilled' ? r.value : null))
          .filter(Boolean) as any[];
        setCourseCertificateDesigns(items);
      } catch {
        if (!active) return;
        setCourseCertificateDesigns([]);
      } finally {
        if (!active) return;
        setIsLoadingCourseCertificateDesigns(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [menu, certificateTab]);

  const getTemplatePageMm = (content: any) => {
    const orientation = content?.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE';
    const pageSize = content?.pageSize === 'LETTER' ? 'LETTER' : 'A4';
    const a4 = orientation === 'PORTRAIT' ? { widthMm: 210, heightMm: 297 } : { widthMm: 297, heightMm: 210 };
    const letter = orientation === 'PORTRAIT' ? { widthMm: 215.9, heightMm: 279.4 } : { widthMm: 279.4, heightMm: 215.9 };
    return pageSize === 'LETTER' ? letter : a4;
  };

  const renderTemplateThumb = (template: any) => {
    const content = template?.content && typeof template.content === 'object' ? template.content : {};
    const dims = getTemplatePageMm(content);
    const bg =
      typeof (content as any).background === 'string'
        ? String((content as any).background)
        : typeof (content as any).certificateBackgroundImageUrl === 'string'
          ? String((content as any).certificateBackgroundImageUrl)
          : '';
    const els = Array.isArray((content as any).elements) ? ((content as any).elements as any[]) : [];
    const sorted = [...els].sort((a, b) => (Number(a?.zIndex || 0) - Number(b?.zIndex || 0))).slice(0, 40);
    const getText = (el: any) => {
      switch (el?.type) {
        case 'TEXT':
          return String(el?.content || '').trim() || 'Text';
        case 'NAME':
          return '[ student_name ]';
        case 'COURSE':
          return '[ course_title ]';
        case 'INSTRUCTOR':
          return '[ instructor_name ]';
        case 'SERIAL':
          return '[ verification_id ]';
        case 'DATE':
          return '[ date ]';
        case 'DURATION':
          return '[ duration ]';
        case 'POINT':
          return '[ points ]';
        case 'GRADE':
          return '[ grade ]';
        case 'BUNDLE':
          return '[ bundle_courses ]';
        default:
          return '';
      }
    };
    return (
      <div className="relative w-full bg-white overflow-hidden" style={{ aspectRatio: `${dims.widthMm} / ${dims.heightMm}` }}>
        {bg ? <img src={bg} className="absolute inset-0 w-full h-full object-cover" /> : null}
        <div className="absolute inset-0">
          {sorted.map((el: any, idx: number) => {
            const x = Number(el?.x || 0);
            const y = Number(el?.y || 0);
            const w = Math.max(1, Number(el?.width || 1));
            const h = Math.max(1, Number(el?.height || 1));
            const left = `${(x / dims.widthMm) * 100}%`;
            const top = `${(y / dims.heightMm) * 100}%`;
            const width = `${(w / dims.widthMm) * 100}%`;
            const height = `${(h / dims.heightMm) * 100}%`;
            const color = typeof el?.color === 'string' ? el.color : '#111827';
            const fontSize = Math.max(6, Math.round((Number(el?.fontSize || 14) as number) * 0.22));
            const opacity = typeof el?.opacity === 'number' ? Math.max(0, Math.min(100, el.opacity)) / 100 : 1;
            const align = el?.align === 'left' ? 'left' : el?.align === 'right' ? 'right' : 'center';
            if (el?.type === 'IMAGE') {
              const src = typeof el?.src === 'string' ? el.src : '';
              return (
                <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                  {src ? <img src={src} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100" />}
                </div>
              );
            }
            if (el?.type === 'QR') {
              return (
                <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                  <div className="w-full h-full border border-slate-300 bg-white" />
                </div>
              );
            }
            if (el?.type === 'SIGNATURE') {
              return (
                <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                  <div className="w-full h-full border-b border-slate-300" />
                </div>
              );
            }
            const text = getText(el);
            if (!text) return null;
            return (
              <div
                key={String(el?.id || idx)}
                className="absolute overflow-hidden"
                style={{
                  left,
                  top,
                  width,
                  height,
                  opacity,
                  color,
                  fontSize,
                  fontWeight: el?.bold ? 800 : 700,
                  fontStyle: el?.italic ? 'italic' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
                  textAlign: align as any,
                  padding: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <span className="truncate">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleSave = async () => {
    if (enableRevenueSharing) {
      const instructorPct = toNumberOrUndefined(instructorRevenueSharePercent);
      const adminPct = toNumberOrUndefined(adminRevenueSharePercent);
      if (instructorPct === undefined || adminPct === undefined) {
        toast.error('Persentase bagi hasil wajib diisi.');
        return;
      }
      if (instructorPct < 0 || instructorPct > 100 || adminPct < 0 || adminPct > 100) {
        toast.error('Persentase bagi hasil harus 0–100.');
        return;
      }
      if (instructorPct + adminPct !== 100) {
        toast.error('Total persentase bagi hasil harus 100%.');
        return;
      }
    }
    if (!enabledWithdrawMethods.length) {
      toast.error('Pilih minimal satu metode penarikan.');
      return;
    }

    setIsSaving(true);
    try {
      const doRequest = async () => {
        const res = await fetch('/api/course-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

      let { res, data } = await doRequest();
      if (!res.ok && res.status === 401 && data?.code === 'REAUTH_REQUIRED') {
        const ok = await requestReauth();
        if (!ok) return;
        ({ res, data } = await doRequest());
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan');
      toast.success('Pengaturan tersimpan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWithdrawMethod = (m: WithdrawMethod) => {
    setEnabledWithdrawMethods((prev) => {
      const exists = prev.includes(m);
      if (exists) return prev.filter((x) => x !== m);
      return [...prev, m];
    });
  };

  const resetToDefault = () => {
    if (menu === 'GENERAL') {
      setBecomeInstructorButtonEnabled(false);
      setAllowInstructorsToPublishCourses(true);
      setAllowInstructorsToTrashCourses(true);
      setAllowInstructorsToChangeCourseAuthor(false);
      setAllowInstructorsToManageCoInstructors(false);
      setAllowInstructorsToResetStudentProgress(false);
      return;
    }
    if (menu === 'KURSUS') {
      setStudentsMustBeLoggedInToViewCourse(false);
      setAllowStaffViewCourseContentWithoutEnrolling(true);
      setSpotlightModeEnabled(false);
      setAutoLoadNextCourseContent(true);
      setCourseCompletionMode('STRICT');
      setCourseRetakeEnabled(false);
      setDefaultQuizRetryLimit('');
      setGradebookAllowCoInstructorAccess(false);
      setGradebookUngradedAssignmentPolicy('IGNORE');
      return;
    }
    if (menu === 'SERTIFIKAT') {
      setCertificateTab('ALL');
      setCertificatesEnabled(true);
      setAutoIssueCertificateOnCompletion(true);
      setCertificateDownloadPolicy('OWNER_ONLY');
      setCertificateTemplate('CLASSIC');
      setCertificateBackgroundImageUrl('');
      setCertificateShowQr(true);
      setCertificateShowSerial(true);
      setCertificateShowDate(true);
      return;
    }
    setEnableRevenueSharing(false);
    setInstructorRevenueSharePercent('90');
    setAdminRevenueSharePercent('10');
    setDeductFees(false);
    setCheckoutServiceFeeEnabled(false);
    setCheckoutServiceFeeAmount('15000');
    setCheckoutUniqueCodeEnabled(false);
    setCheckoutUniqueCodeDigits('3');
    setMinimumWithdrawalAmount('100000');
    setMinimumDaysBeforeBalanceAvailable('7');
    setEnabledWithdrawMethods(['BANK_TRANSFER']);
    setBankInstructions('');
  };

  const menuTitle = menu === 'GENERAL' ? 'Umum' : menu === 'KURSUS' ? 'Kursus' : menu === 'SERTIFIKAT' ? 'Sertifikat' : 'Monetisasi';

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan E-Learning</h1>
          <p className="text-slate-500 text-sm mt-1">Atur kebijakan utama kursus, instruktur, dan monetisasi.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium shadow-sm hover:shadow hover:-translate-y-0.5 transition-all disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-sm font-extrabold text-slate-900">Menu</div>
          </div>
          <div className="p-2">
            <button
              type="button"
              onClick={() => setMenu('GENERAL')}
              className={twMerge(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold',
                menu === 'GENERAL' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <Settings2 className="w-4 h-4" />
              Umum
            </button>
            <button
              type="button"
              onClick={() => setMenu('KURSUS')}
              className={twMerge(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold',
                menu === 'KURSUS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <BookOpen className="w-4 h-4" />
              Kursus
            </button>
            <button
              type="button"
              onClick={() => setMenu('SERTIFIKAT')}
              className={twMerge(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold',
                menu === 'SERTIFIKAT' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <Award className="w-4 h-4" />
              Sertifikat
            </button>
            <button
              type="button"
              onClick={() => setMenu('MONETISASI')}
              className={twMerge(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold',
                menu === 'MONETISASI' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <DollarSign className="w-4 h-4" />
              Monetisasi
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-extrabold text-slate-900">{menuTitle}</div>
            <button
              type="button"
              onClick={resetToDefault}
              disabled={isLoading || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-60"
            >
              <RotateCcw className="w-4 h-4" />
              Reset ke Default
            </button>
          </div>

          {menu === 'GENERAL' ? (
            <Card title="Izin & Instruktur">
              <SettingRow
                title="Tombol “Ajukan Menjadi Instruktur”"
                description="Jika aktif, tombol ini muncul di dashboard siswa untuk mengirim permintaan menjadi instruktur."
                right={<Toggle checked={becomeInstructorButtonEnabled} disabled={isLoading} onChange={() => setBecomeInstructorButtonEnabled((v) => !v)} />}
              />
              <SettingRow
                title="Instruktur dapat menerbitkan kursus"
                description="Jika dimatikan, kursus perlu ditinjau admin sebelum terbit."
                right={<Toggle checked={allowInstructorsToPublishCourses} disabled={isLoading} onChange={() => setAllowInstructorsToPublishCourses((v) => !v)} />}
              />
              <SettingRow
                title="Instruktur dapat menghapus (trash) kursus"
                description="Jika dimatikan, hanya admin yang dapat menghapus kursus."
                right={<Toggle checked={allowInstructorsToTrashCourses} disabled={isLoading} onChange={() => setAllowInstructorsToTrashCourses((v) => !v)} />}
              />
              <SettingRow
                title="Instruktur dapat mengganti penulis kursus"
                description="Jika dimatikan, hanya admin yang bisa mengganti author."
                right={<Toggle checked={allowInstructorsToChangeCourseAuthor} disabled={isLoading} onChange={() => setAllowInstructorsToChangeCourseAuthor((v) => !v)} />}
              />
              <SettingRow
                title="Instruktur dapat mengelola co-instructor"
                description="Jika aktif, instruktur dapat menambah/menghapus co-instructor di kursusnya."
                right={<Toggle checked={allowInstructorsToManageCoInstructors} disabled={isLoading} onChange={() => setAllowInstructorsToManageCoInstructors((v) => !v)} />}
              />
              <SettingRow
                title="Instruktur dapat reset progress siswa"
                description="Jika aktif, instruktur (author/co-instructor) dapat reset progress enrollment."
                right={<Toggle checked={allowInstructorsToResetStudentProgress} disabled={isLoading} onChange={() => setAllowInstructorsToResetStudentProgress((v) => !v)} />}
              />
            </Card>
          ) : null}

          {menu === 'KURSUS' ? (
            <div className="space-y-4">
              <Card title="Akses & Perilaku">
                <SettingRow
                  title="Wajib login untuk melihat kursus"
                  description="Jika aktif, katalog dan detail kursus tidak bisa dilihat tanpa login."
                  right={<Toggle checked={studentsMustBeLoggedInToViewCourse} disabled={isLoading} onChange={() => setStudentsMustBeLoggedInToViewCourse((v) => !v)} />}
                />
                <SettingRow
                  title="Admin/Instruktur bisa melihat konten tanpa enroll"
                  description="Berguna untuk review/QA kursus tanpa harus mendaftar."
                  right={
                    <Toggle
                      checked={allowStaffViewCourseContentWithoutEnrolling}
                      disabled={isLoading}
                      onChange={() => setAllowStaffViewCourseContentWithoutEnrolling((v) => !v)}
                    />
                  }
                />
                <SettingRow
                  title="Mode Spotlight (layar penuh)"
                  description="Sembunyikan header & footer saat siswa membuka halaman belajar."
                  right={<Toggle checked={spotlightModeEnabled} disabled={isLoading} onChange={() => setSpotlightModeEnabled((v) => !v)} />}
                />
                <SettingRow
                  title="Otomatis lanjut ke materi berikutnya"
                  description="Jika aktif, sistem akan memuat materi berikutnya setelah materi selesai."
                  right={<Toggle checked={autoLoadNextCourseContent} disabled={isLoading} onChange={() => setAutoLoadNextCourseContent((v) => !v)} />}
                />
                <SettingRow
                  title="Izinkan ulang kursus (retake)"
                  description="Jika aktif, siswa dapat mengulang kursus dan progress di-reset."
                  right={<Toggle checked={courseRetakeEnabled} disabled={isLoading} onChange={() => setCourseRetakeEnabled((v) => !v)} />}
                />
              </Card>

              <Card title="Penyelesaian Kursus">
                <SettingRow
                  title="Proses penyelesaian kursus"
                  description={courseCompletionMode === 'STRICT' ? 'Ketat: harus menyelesaikan semua materi/kuis/tugas.' : 'Fleksibel: siswa dapat menyelesaikan kapan saja.'}
                  right={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCourseCompletionMode('STRICT')}
                        disabled={isLoading}
                        className={twMerge(
                          'px-3 py-2 rounded-xl text-sm font-extrabold border',
                          courseCompletionMode === 'STRICT'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                          isLoading ? 'opacity-60 cursor-not-allowed' : ''
                        )}
                      >
                        Ketat
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourseCompletionMode('FLEXIBLE')}
                        disabled={isLoading}
                        className={twMerge(
                          'px-3 py-2 rounded-xl text-sm font-extrabold border',
                          courseCompletionMode === 'FLEXIBLE'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                          isLoading ? 'opacity-60 cursor-not-allowed' : ''
                        )}
                      >
                        Fleksibel
                      </button>
                    </div>
                  }
                />
              </Card>

              <Card title="Kuis (Default)">
                <SettingRow
                  title="Batas percobaan kuis default"
                  description="Kosongkan/0 = unlimited. Dipakai saat instruktur tidak mengisi batas percobaan."
                  right={
                    <input
                      value={defaultQuizRetryLimit}
                      onChange={(e) => setDefaultQuizRetryLimit(e.target.value)}
                      placeholder="Contoh: 10"
                      className={twMerge("w-36", compactControlClass)}
                      inputMode="numeric"
                      disabled={isLoading}
                    />
                  }
                />
              </Card>

              <Card title="Gradebook">
                <SettingRow
                  title="Co-instructor dapat melihat gradebook/evaluasi"
                  description="Jika aktif, co-instructor kursus bisa mengakses gradebook dan daftar evaluasi kursus tersebut."
                  right={
                    <Toggle
                      checked={gradebookAllowCoInstructorAccess}
                      disabled={isLoading}
                      onChange={() => setGradebookAllowCoInstructorAccess((v) => !v)}
                    />
                  }
                />
                <SettingRow
                  title="Tugas yang belum dinilai"
                  description={
                    gradebookUngradedAssignmentPolicy === 'IGNORE'
                      ? 'Tidak dihitung ke rata-rata sampai dinilai (rekomendasi).'
                      : 'Dihitung sebagai 0 sampai dinilai.'
                  }
                  right={
                    <select
                      value={gradebookUngradedAssignmentPolicy}
                      onChange={(e) => setGradebookUngradedAssignmentPolicy(e.target.value as GradebookUngradedAssignmentPolicy)}
                      disabled={isLoading}
                      className={twMerge("w-56", compactControlClass)}
                    >
                      <option value="IGNORE">Abaikan sampai dinilai</option>
                      <option value="ZERO">Anggap 0 sementara</option>
                    </select>
                  }
                />
              </Card>

              <Card title="Pengaturan Tambahan">
                <SettingRow
                  title="Q&A"
                  description="Aktifkan fitur tanya jawab pada materi."
                  right={<Toggle checked={enableQA} disabled={isLoading} onChange={() => setEnableQA((v) => !v)} />}
                />
                <SettingRow
                  title="Visibilitas kursus default"
                  description={isPublic ? 'Publik: kursus dapat dilihat umum.' : 'Privat: akses lebih terbatas.'}
                  right={<Toggle checked={isPublic} disabled={isLoading} onChange={() => setIsPublic((v) => !v)} />}
                />
                <SettingRow
                  title="Ulasan / Rating"
                  description="Aktifkan ulasan untuk kursus."
                  right={<Toggle checked={reviewsEnabled} disabled={isLoading} onChange={() => setReviewsEnabled((v) => !v)} />}
                />
                <SettingRow
                  title="Sertifikat (per kursus)"
                  description="Aktifkan fitur sertifikat di kursus."
                  right={<Toggle checked={certificateEnabled} disabled={isLoading} onChange={() => setCertificateEnabled((v) => !v)} />}
                />
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="text-sm font-extrabold text-slate-900">Katalog (Default)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Level</label>
                      <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value as CourseLevel)}
                        disabled={isLoading}
                        className={selectControlClass}
                      >
                        <option value="BEGINNER">Pemula</option>
                        <option value="INTERMEDIATE">Menengah</option>
                        <option value="ADVANCED">Lanjutan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Kategori</label>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        disabled={isLoading}
                        className={selectControlClass}
                      >
                        <option value="">Tidak ada default</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="text-sm font-extrabold text-slate-900">Harga Kursus (Default)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Model harga</label>
                      <select
                        value={pricingType}
                        onChange={(e) => setPricingType(e.target.value as PricingType)}
                        disabled={isLoading}
                        className={selectControlClass}
                      >
                        <option value="FREE">Gratis</option>
                        <option value="PAID">Berbayar</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Harga (IDR)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Contoh: 100000"
                        className={inputControlClass}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={isLoading || pricingType === 'FREE'}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-900">
                        <input
                          type="checkbox"
                          checked={subscriptionEligible}
                          onChange={() => setSubscriptionEligible((v) => !v)}
                          disabled={isLoading}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Bisa dibeli via langganan
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="text-sm font-extrabold text-slate-900">Pendaftaran (Default)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Maksimal siswa</label>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="Kosongkan untuk tidak dibatasi"
                      className={inputControlClass}
                      value={maxStudents}
                      onChange={(e) => setMaxStudents(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Masa berlaku (hari)</label>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="Kosongkan untuk selamanya"
                      className={inputControlClass}
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Batas akhir pendaftaran</label>
                    <input
                      type="date"
                      min={todayUtcInput()}
                      className={inputControlClass}
                      value={enrollmentEndDate}
                      onChange={(e) => setEnrollmentEndDate(e.target.value)}
                      disabled={isLoading}
                    />
                    <div className="text-xs text-slate-500 mt-1">Kosongkan untuk tidak ada batas akhir.</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="text-sm font-extrabold text-slate-900">Konten Bertahap (Drip)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-900">
                      <input
                        type="checkbox"
                        checked={dripEnabled}
                        onChange={() => setDripEnabled((v) => !v)}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Aktifkan drip
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Tipe drip</label>
                    <select
                      value={dripType}
                      onChange={(e) => setDripType(e.target.value as DripType)}
                      disabled={isLoading || !dripEnabled}
                      className={selectControlClass}
                    >
                      <option value="NONE">Tidak ada</option>
                      <option value="SCHEDULE">Jadwal</option>
                      <option value="AFTER_ENROLLMENT">Setelah daftar</option>
                      <option value="SEQUENTIAL">Berurutan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Interval (hari)</label>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="Contoh: 3"
                      className={inputControlClass}
                      value={dripDays}
                      onChange={(e) => setDripDays(e.target.value)}
                      disabled={isLoading || !dripEnabled}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {menu === 'SERTIFIKAT' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                    <div>
                      <div className="text-xl font-extrabold text-slate-900">Buat Sertifikat Anda</div>
                      <div className="mt-1 text-sm text-slate-500">Dalam 3 langkah</div>
                      <ol className="mt-4 space-y-2 text-sm text-slate-700 list-decimal pl-4">
                        <li>Pilih desain sertifikat</li>
                        <li>Atur teks dan unggah tanda tangan</li>
                        <li>Simpan, sertifikat siap digunakan</li>
                      </ol>
                      <button
                        type="button"
                        disabled={isLoading || !certificatesEnabled}
                        onClick={() => router.push('/dashboard/admin/certificates/builder/select')}
                        className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-bold disabled:opacity-60"
                      >
                        Buat sertifikat
                      </button>
                    </div>
                    <div className="hidden lg:block">
                      <div className="h-44 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-slate-200 flex items-center justify-center">
                        <Award className="w-16 h-16 text-indigo-600" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200 px-8">
                  <div className="flex items-center gap-6 text-sm font-bold text-slate-600">
                    <button
                      type="button"
                      onClick={() => setCertificateTab('ALL')}
                      className={twMerge('py-4 border-b-2', certificateTab === 'ALL' ? 'border-indigo-600 text-indigo-700' : 'border-transparent')}
                    >
                      Semua Sertifikat
                    </button>
                    <button
                      type="button"
                      onClick={() => setCertificateTab('SETTINGS')}
                      className={twMerge('py-4 border-b-2', certificateTab === 'SETTINGS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent')}
                    >
                      Kebijakan Sertifikat
                    </button>
                  </div>
                </div>
              </div>

              {certificateTab === 'ALL' ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <div className="text-sm font-extrabold text-slate-900">Sertifikat Dipublikasikan (Per Kursus)</div>
                      <div className="text-xs text-slate-500 mt-0.5">Desain yang sudah disimpan ke kursus tertentu</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {isLoadingCourseCertificateDesigns ? (
                        <div className="p-6 flex items-center gap-3 text-sm text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                          Memuat daftar sertifikat...
                        </div>
                      ) : courseCertificateDesigns.length === 0 ? (
                        <div className="p-6 text-center">
                          <div className="text-sm font-extrabold text-slate-400 uppercase tracking-widest">Belum ada</div>
                          <div className="text-xs text-slate-400 mt-2">Klik “Buat sertifikat”, pilih kursus, lalu Publish.</div>
                        </div>
                      ) : (
                        courseCertificateDesigns.map((row: any) => {
                          const course = row?.course;
                          const design = row?.design;
                          const courseId = String(course?.id || '');
                          const templateLike = {
                            content: {
                              background: typeof design?.certificateBackgroundImageUrl === 'string' ? design.certificateBackgroundImageUrl : '',
                              elements: Array.isArray(design?.elements) ? design.elements : [],
                              orientation: design?.certificatePageOrientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE',
                              pageSize: design?.certificatePageSize === 'LETTER' ? 'LETTER' : 'A4',
                            },
                          };
                          return (
                            <div key={courseId} className="p-5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="h-14 w-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                                  <div className="w-full h-full">{renderTemplateThumb(templateLike)}</div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-slate-900 truncate">{String(course?.title || course?.slug || course?.id || 'Kursus')}</div>
                                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                                    {design?.certificatePageSize === 'LETTER' ? 'Letter' : 'A4'} • {design?.certificatePageOrientation === 'PORTRAIT' ? 'Portrait' : 'Landscape'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Published
                                </span>
                                <button
                                  type="button"
                                  onClick={() => router.push(`/dashboard/admin/certificates/builder?courseId=${encodeURIComponent(courseId)}`)}
                                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  title="Edit"
                                >
                                  <PenLine className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!courseId || isDeletingCourseCertificate === courseId}
                                  onClick={async () => {
                                    if (!courseId) return;
                                    const ok = window.confirm('Hapus desain sertifikat untuk kursus ini?');
                                    if (!ok) return;
                                    setIsDeletingCourseCertificate(courseId);
                                    try {
                                      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/certificate-design`, { method: 'DELETE' });
                                      const data = await res.json().catch(() => ({}));
                                      if (!res.ok) throw new Error((data as any)?.error || 'Gagal menghapus sertifikat');
                                      setCourseCertificateDesigns((prev) => (Array.isArray(prev) ? prev.filter((x: any) => String(x?.course?.id || '') !== courseId) : []));
                                      toast.success('Sertifikat berhasil dihapus');
                                    } catch (e: any) {
                                      toast.error(e?.message || 'Gagal menghapus sertifikat');
                                    } finally {
                                      setIsDeletingCourseCertificate(null);
                                    }
                                  }}
                                  className={twMerge(
                                    "h-9 w-9 inline-flex items-center justify-center rounded-xl border transition-colors",
                                    isDeletingCourseCertificate === courseId
                                      ? "border-slate-200 bg-white text-slate-400 cursor-not-allowed"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                                  )}
                                  title="Hapus"
                                >
                                  {isDeletingCourseCertificate === courseId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Card title="Kebijakan">
                    <SettingRow
                      title="Aktifkan fitur sertifikat"
                      description="Jika dimatikan, sistem tidak akan menerbitkan sertifikat."
                      right={<Toggle checked={certificatesEnabled} disabled={isLoading} onChange={() => setCertificatesEnabled((v) => !v)} />}
                    />
                    <SettingRow
                      title="Terbitkan sertifikat otomatis"
                      description="Jika aktif, sertifikat dibuat otomatis saat kursus selesai."
                      right={
                        <Toggle
                          checked={autoIssueCertificateOnCompletion}
                          disabled={isLoading || !certificatesEnabled}
                          onChange={() => setAutoIssueCertificateOnCompletion((v) => !v)}
                        />
                      }
                    />
                    <SettingRow
                      title="Akses unduh PDF sertifikat"
                      description={
                        certificateDownloadPolicy === 'OWNER_ONLY'
                          ? 'Hanya pemilik sertifikat dan staff yang dapat mengunduh.'
                          : 'Siapa pun yang memiliki nomor seri dapat mengunduh.'
                      }
                      right={
                        <select
                          value={certificateDownloadPolicy}
                          onChange={(e) => setCertificateDownloadPolicy(e.target.value as CertificateDownloadPolicy)}
                          disabled={isLoading || !certificatesEnabled}
                          className={twMerge("w-56", compactControlClass)}
                        >
                          <option value="OWNER_ONLY">Pemilik + staff</option>
                          <option value="PUBLIC">Publik (berdasarkan seri)</option>
                        </select>
                      }
                    />
                    <SettingRow
                      title="Tampilkan QR verifikasi"
                      description="QR mengarah ke halaman verifikasi sertifikat."
                      right={
                        <Toggle
                          checked={certificateShowQr}
                          disabled={isLoading || !certificatesEnabled}
                          onChange={() => setCertificateShowQr((v) => !v)}
                        />
                      }
                    />
                    <SettingRow
                      title="Tampilkan nomor seri"
                      description="Menampilkan nomor seri di bagian bawah sertifikat."
                      right={
                        <Toggle
                          checked={certificateShowSerial}
                          disabled={isLoading || !certificatesEnabled}
                          onChange={() => setCertificateShowSerial((v) => !v)}
                        />
                      }
                    />
                    <SettingRow
                      title="Tampilkan tanggal terbit"
                      description="Menampilkan tanggal diterbitkan pada sertifikat."
                      right={
                        <Toggle
                          checked={certificateShowDate}
                          disabled={isLoading || !certificatesEnabled}
                          onChange={() => setCertificateShowDate((v) => !v)}
                        />
                      }
                    />
                  </Card>
                </>
              )}
            </div>
          ) : null}

          {menu === 'MONETISASI' ? (
            <div className="space-y-4">
              <Card title="Bagi Hasil Pendapatan">
                <SettingRow
                  title="Aktifkan bagi hasil (revenue sharing)"
                  description="Jika aktif, pendapatan dari penjualan kursus dapat dibagi dengan pembuat kursus."
                  right={<Toggle checked={enableRevenueSharing} disabled={isLoading} onChange={() => setEnableRevenueSharing((v) => !v)} />}
                />
                <div className="py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Instruktur mendapatkan (%)</label>
                      <input
                        value={instructorRevenueSharePercent}
                        onChange={(e) => {
                          setInstructorRevenueSharePercent(e.target.value);
                        }}
                        disabled={isLoading || !enableRevenueSharing}
                        inputMode="numeric"
                        className={inputControlClass}
                        placeholder="Contoh: 90"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Admin mendapatkan (%)</label>
                      <input
                        value={adminRevenueSharePercent}
                        onChange={(e) => {
                          setAdminRevenueSharePercent(e.target.value);
                        }}
                        disabled={isLoading || !enableRevenueSharing}
                        inputMode="numeric"
                        className={inputControlClass}
                        placeholder="Contoh: 10"
                      />
                    </div>
                  </div>
                  {enableRevenueSharing ? <div className="text-xs text-slate-500 mt-2">Total persentase harus 100%.</div> : null}
                </div>
              </Card>

              <Card title="Biaya">
                <SettingRow
                  title="Kurangi biaya (fees)"
                  description="Jika aktif, biaya dipotong dari total penjualan sebelum pembagian."
                  right={<Toggle checked={deductFees} disabled={isLoading} onChange={() => setDeductFees((v) => !v)} />}
                />
              </Card>

              <Card title="Checkout">
                <SettingRow
                  title="Aktifkan service fee per student"
                  description="Jika aktif, service fee akan muncul pada checkout untuk menutup biaya payment gateway dan service platform."
                  right={
                    <Toggle checked={checkoutServiceFeeEnabled} disabled={isLoading} onChange={() => setCheckoutServiceFeeEnabled((v) => !v)} />
                  }
                />
                <div className="py-4">
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nominal service fee (IDR)</label>
                  <input
                    value={checkoutServiceFeeAmount}
                    onChange={(e) => {
                      setCheckoutServiceFeeAmount(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                    disabled={isLoading || !checkoutServiceFeeEnabled}
                    inputMode="numeric"
                    className={inputControlClass}
                    placeholder="Contoh: 15000"
                  />
                </div>

                <div className="h-px bg-slate-100" />

                <SettingRow
                  title="Aktifkan kode unik pembayaran"
                  description="Jika aktif, sistem akan mengurangi total transfer dengan kode unik untuk membedakan transaksi."
                  right={
                    <Toggle checked={checkoutUniqueCodeEnabled} disabled={isLoading} onChange={() => setCheckoutUniqueCodeEnabled((v) => !v)} />
                  }
                />
                <div className="py-4">
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Jumlah digit kode unik</label>
                  <select
                    value={checkoutUniqueCodeDigits}
                    onChange={(e) => setCheckoutUniqueCodeDigits(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                    disabled={isLoading || !checkoutUniqueCodeEnabled}
                    className={twMerge("w-56", compactControlClass)}
                  >
                    <option value="1">1 digit (1–9)</option>
                    <option value="2">2 digit (1–99)</option>
                    <option value="3">3 digit (1–999)</option>
                  </select>
                </div>
              </Card>

              <Card title="Penarikan Dana">
                <div className="py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Minimum penarikan (IDR)</label>
                      <input
                        value={minimumWithdrawalAmount}
                        onChange={(e) => {
                          setMinimumWithdrawalAmount(e.target.value);
                        }}
                        disabled={isLoading}
                        inputMode="numeric"
                        className={inputControlClass}
                        placeholder="Contoh: 100000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Hari minimum sebelum saldo bisa ditarik</label>
                      <input
                        value={minimumDaysBeforeBalanceAvailable}
                        onChange={(e) => {
                          setMinimumDaysBeforeBalanceAvailable(e.target.value);
                        }}
                        disabled={isLoading}
                        inputMode="numeric"
                        className={inputControlClass}
                        placeholder="Contoh: 7"
                      />
                    </div>
                  </div>
                </div>

                <div className="py-4">
                  <div className="text-sm font-extrabold text-slate-900">Metode penarikan</div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={enabledWithdrawMethods.includes('BANK_TRANSFER')}
                        onChange={() => toggleWithdrawMethod('BANK_TRANSFER')}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Transfer Bank
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={enabledWithdrawMethods.includes('E_CHECK')}
                        onChange={() => toggleWithdrawMethod('E_CHECK')}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      E-Check
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={enabledWithdrawMethods.includes('PAYPAL')}
                        onChange={() => toggleWithdrawMethod('PAYPAL')}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      PayPal
                    </label>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Pilih minimal satu metode.</div>
                </div>

                <div className="py-4">
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Instruksi bank</label>
                  <textarea
                    value={bankInstructions}
                    onChange={(e) => {
                      setBankInstructions(e.target.value);
                    }}
                    disabled={isLoading}
                    rows={5}
                    className={textareaControlClass}
                    placeholder="Tuliskan instruksi penarikan via transfer bank untuk instruktur..."
                  />
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={reauthOpen}
        onClose={closeReauth}
        onConfirm={confirmReauth}
        title="Konfirmasi Password"
        variant="warning"
        confirmText="Konfirmasi"
        cancelText="Batal"
        isLoading={reauthLoading}
        content={
          <div className="space-y-3">
            <div>Masukkan password Super Admin untuk menyimpan pengaturan.</div>
            <input
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              autoComplete="current-password"
              className={inputControlClass}
              placeholder="Password"
            />
          </div>
        }
      />
    </div>
  );
}
