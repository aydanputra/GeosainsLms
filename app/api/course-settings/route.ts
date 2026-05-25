import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { jwtVerify } from 'jose';

const SETTINGS_SLUG = '__course_settings__';

const CourseSettingsSchema = z.object({
  becomeInstructorButtonEnabled: z.boolean().optional(),
  allowInstructorsToPublishCourses: z.boolean().optional(),
  allowInstructorsToTrashCourses: z.boolean().optional(),
  allowInstructorsToChangeCourseAuthor: z.boolean().optional(),
  allowInstructorsToManageCoInstructors: z.boolean().optional(),
  allowInstructorsToResetStudentProgress: z.boolean().optional(),
  studentsMustBeLoggedInToViewCourse: z.boolean().optional(),
  allowStaffViewCourseContentWithoutEnrolling: z.boolean().optional(),
  spotlightModeEnabled: z.boolean().optional(),
  autoLoadNextCourseContent: z.boolean().optional(),
  autoIssueCertificateOnCompletion: z.boolean().optional(),
  courseCompletionMode: z.enum(['FLEXIBLE', 'STRICT']).optional(),
  courseRetakeEnabled: z.boolean().optional(),
  defaultQuizRetryLimit: z.number().int().min(0).nullable().optional(),
  enableRevenueSharing: z.boolean().optional(),
  instructorRevenueSharePercent: z.number().int().min(0).max(100).optional(),
  adminRevenueSharePercent: z.number().int().min(0).max(100).optional(),
  deductFees: z.boolean().optional(),
  minimumWithdrawalAmount: z.number().int().min(0).optional(),
  minimumDaysBeforeBalanceAvailable: z.number().int().min(0).optional(),
  enabledWithdrawMethods: z.array(z.enum(['BANK_TRANSFER', 'E_CHECK', 'PAYPAL'])).optional(),
  bankInstructions: z.string().trim().max(5000).optional(),
  gradebookAllowCoInstructorAccess: z.boolean().optional(),
  gradebookUngradedAssignmentPolicy: z.enum(['IGNORE', 'ZERO']).optional(),
  certificatesEnabled: z.boolean().optional(),
  certificateDownloadPolicy: z.enum(['OWNER_ONLY', 'PUBLIC']).optional(),
  certificateTemplate: z.enum(['CLASSIC', 'MODERN', 'CUSTOM']).optional(),
  certificatePageOrientation: z.enum(['LANDSCAPE', 'PORTRAIT']).optional(),
  certificateBackgroundImageUrl: z.string().trim().max(2000).optional(),
  certificateLogoUrl: z.string().trim().max(2000).optional(),
  certificateLogoX: z.number().min(0).optional(),
  certificateLogoY: z.number().min(0).optional(),
  certificateLogoW: z.number().min(1).optional(),
  certificateLogoH: z.number().min(1).optional(),
  certificateQrX: z.number().min(0).optional(),
  certificateQrY: z.number().min(0).optional(),
  certificateQrSize: z.number().min(1).optional(),
  certificateNameX: z.number().min(0).optional(),
  certificateNameY: z.number().min(0).optional(),
  certificateNameFontSize: z.number().min(6).max(200).optional(),
  certificateNameColor: z.string().trim().max(16).optional(),
  certificateNameFontFamily: z.string().trim().max(50).optional(),
  certificateCourseX: z.number().min(0).optional(),
  certificateCourseY: z.number().min(0).optional(),
  certificateCourseFontSize: z.number().min(6).max(200).optional(),
  certificateCourseColor: z.string().trim().max(16).optional(),
  certificateDateX: z.number().min(0).optional(),
  certificateDateY: z.number().min(0).optional(),
  certificateSerialX: z.number().min(0).optional(),
  certificateSerialY: z.number().min(0).optional(),
  certificateMetaFontSize: z.number().min(6).max(100).optional(),
  certificateSignatureX: z.number().min(0).optional(),
  certificateSignatureY: z.number().min(0).optional(),
  certificateSignatureW: z.number().min(10).optional(),
  certificateExtraText: z.string().trim().max(1000).optional(),
  certificateExtraTextX: z.number().min(0).optional(),
  certificateExtraTextY: z.number().min(0).optional(),
  certificateExtraTextFontSize: z.number().min(6).max(200).optional(),
  certificateExtraTextBold: z.boolean().optional(),
  certificateExtraTextColor: z.string().trim().max(16).optional(),
  certificateTitle: z.string().trim().max(120).optional(),
  certificateSubtitle: z.string().trim().max(200).optional(),
  certificateBody: z.string().trim().max(400).optional(),
  certificateIssuerName: z.string().trim().max(120).optional(),
  certificateSignatoryName: z.string().trim().max(120).optional(),
  certificateSignatoryTitle: z.string().trim().max(120).optional(),
  certificateAccentColor: z.string().trim().max(16).optional(),
  certificateShowQr: z.boolean().optional(),
  certificateShowSerial: z.boolean().optional(),
  certificateShowDate: z.boolean().optional(),
  enableQA: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  reviewsEnabled: z.boolean().optional(),
  certificateEnabled: z.boolean().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  price: z.number().min(0).optional(),
  subscriptionEligible: z.boolean().optional(),
  maxStudents: z.number().int().min(1).nullable().optional(),
  validityDays: z.number().int().min(1).nullable().optional(),
  enrollmentEndDate: z.string().datetime().nullable().optional(),
  dripEnabled: z.boolean().optional(),
  dripType: z.enum(['NONE', 'SCHEDULE', 'AFTER_ENROLLMENT', 'SEQUENTIAL']).optional(),
  dripDays: z.number().int().min(1).nullable().optional(),
  checkoutServiceFeeEnabled: z.boolean().optional(),
  checkoutServiceFeeAmount: z.number().int().min(0).max(100000000).optional(),
  checkoutUniqueCodeEnabled: z.boolean().optional(),
  checkoutUniqueCodeDigits: z.number().int().min(1).max(3).optional(),
});

type CourseSettings = z.infer<typeof CourseSettingsSchema>;

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toSettings(obj: Record<string, unknown>): CourseSettings {
  const parsed = CourseSettingsSchema.safeParse(obj);
  if (parsed.success) return parsed.data;
  return {};
}

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}

async function requireSuperAdmin(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return null;
  const actor = await prisma.user.findUnique({ where: { id: String(user.id) }, select: { isSuperAdmin: true } });
  if (!actor?.isSuperAdmin) return null;
  return user;
}

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

async function hasSuperAdminReauth(req: NextRequest, actorId: string) {
  const raw = req.cookies.get('super_admin_reauth')?.value;
  if (!raw) return false;
  try {
    const { payload } = await jwtVerify(raw, getSecretKey());
    if (payload?.purpose !== 'super_admin_reauth') return false;
    if (String((payload as any)?.uid || '') !== actorId) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const page = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG } });
  const settings = toSettings(safeParse(page?.content));

  const token = req.cookies.get('token')?.value;
  const user = token ? await verifyToken(token) : null;

  if (user && user.role === 'ADMIN') return NextResponse.json(settings, { status: 200 });

  return NextResponse.json(
    {
      becomeInstructorButtonEnabled: settings.becomeInstructorButtonEnabled ?? false,
      allowInstructorsToPublishCourses: settings.allowInstructorsToPublishCourses ?? true,
      allowInstructorsToTrashCourses: settings.allowInstructorsToTrashCourses ?? true,
      allowInstructorsToChangeCourseAuthor: settings.allowInstructorsToChangeCourseAuthor ?? false,
      allowInstructorsToManageCoInstructors: settings.allowInstructorsToManageCoInstructors ?? false,
      allowInstructorsToResetStudentProgress: settings.allowInstructorsToResetStudentProgress ?? false,
      studentsMustBeLoggedInToViewCourse: settings.studentsMustBeLoggedInToViewCourse ?? false,
      allowStaffViewCourseContentWithoutEnrolling: settings.allowStaffViewCourseContentWithoutEnrolling ?? true,
      spotlightModeEnabled: settings.spotlightModeEnabled ?? false,
      autoLoadNextCourseContent: settings.autoLoadNextCourseContent ?? true,
      autoIssueCertificateOnCompletion: settings.autoIssueCertificateOnCompletion ?? true,
      courseCompletionMode: settings.courseCompletionMode ?? 'STRICT',
      courseRetakeEnabled: settings.courseRetakeEnabled ?? false,
      defaultQuizRetryLimit: settings.defaultQuizRetryLimit ?? null,
    },
    { status: 200 }
  );
}

export async function PUT(req: NextRequest) {
  const user = await requireSuperAdmin(req);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await hasSuperAdminReauth(req, String(user.id)))) {
    return NextResponse.json({ error: 'Perlu konfirmasi password', code: 'REAUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const next = CourseSettingsSchema.parse(body);

    const saved = await prisma.page.upsert({
      where: { slug: SETTINGS_SLUG },
      update: { title: 'Course Settings', published: false, content: JSON.stringify(next) },
      create: { title: 'Course Settings', slug: SETTINGS_SLUG, published: false, content: JSON.stringify(next) },
      select: { content: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: String(user.id),
        actorRole: user.role,
        action: 'COURSE_SETTINGS_UPDATE',
        entityType: 'Page',
        entityId: SETTINGS_SLUG,
        metadata: next as any,
      },
    });

    return NextResponse.json(toSettings(safeParse(saved.content)), { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan pengaturan kursus' }, { status: 500 });
  }
}
