import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { createOrder } from '@/modules/shop/api/service';
import { createPayment } from '@/modules/payment/api/service';
import { CourseStatus } from '@prisma/client';

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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function computeCouponDiscountForCourse(opts: {
  userId: string;
  course: { id: string; categoryId: string | null; categoryIds?: unknown; price: number };
  couponCode: string;
}) {
  const now = new Date();
  const coupon = await prisma.coupon.findUnique({ where: { code: opts.couponCode } });
  if (!coupon || !coupon.isActive) throw new Error('Kupon tidak valid');
  if (coupon.startsAt && coupon.startsAt > now) throw new Error('Kupon belum berlaku');
  if (coupon.expiresAt && coupon.expiresAt <= now) throw new Error('Kupon sudah kedaluwarsa');
  if (
    typeof coupon.maxRedemptions === 'number' &&
    Number.isFinite(coupon.maxRedemptions) &&
    coupon.maxRedemptions !== null &&
    coupon.redeemedCount >= coupon.maxRedemptions
  ) {
    throw new Error('Kupon sudah mencapai batas penggunaan');
  }

  const scope = String((coupon as any).scope || 'ALL').toUpperCase();
  const courseIds = new Set<string>(Array.isArray((coupon as any).courseIds) ? (coupon as any).courseIds.map(String) : []);
  const courseCategoryIds = new Set<string>(
    Array.isArray((coupon as any).courseCategoryIds) ? (coupon as any).courseCategoryIds.map(String) : []
  );

  const courseCategoryList: string[] = Array.isArray(opts.course.categoryIds)
    ? (opts.course.categoryIds as any[]).map(String).filter(Boolean)
    : [];

  const isEligible =
    scope === 'ALL' ||
    (scope === 'COURSES' && courseIds.has(String(opts.course.id))) ||
    (scope === 'COURSE_CATEGORIES' &&
      (courseCategoryList.length > 0
        ? courseCategoryList.some((cid) => courseCategoryIds.has(String(cid)))
        : opts.course.categoryId
          ? courseCategoryIds.has(String(opts.course.categoryId))
          : false));

  if (!isEligible) throw new Error('Kupon tidak berlaku untuk kursus ini');

  const eligibleSubtotal = Math.max(0, Number(opts.course.price || 0));
  if (eligibleSubtotal <= 0) throw new Error('Kupon tidak berlaku untuk kursus ini');
  if (typeof coupon.minSubtotal === 'number' && Number.isFinite(coupon.minSubtotal) && eligibleSubtotal < coupon.minSubtotal) {
    throw new Error('Subtotal item yang memenuhi syarat belum mencukupi untuk kupon ini');
  }

  const discountRaw = coupon.type === 'PERCENT' ? (eligibleSubtotal * Number(coupon.amount || 0)) / 100 : Number(coupon.amount || 0);
  const maxDiscount =
    typeof (coupon as any).maxDiscount === 'number' && Number.isFinite((coupon as any).maxDiscount) ? Number((coupon as any).maxDiscount) : null;
  const boundedRaw = maxDiscount !== null ? Math.min(discountRaw, maxDiscount) : discountRaw;
  const normalizedDiscount = Math.max(0, Math.min(eligibleSubtotal, round2(boundedRaw)));

  const usageLimitPerUser =
    typeof (coupon as any).usageLimitPerUser === 'number' && Number.isFinite((coupon as any).usageLimitPerUser)
      ? Math.trunc(Number((coupon as any).usageLimitPerUser))
      : null;
  if (usageLimitPerUser && usageLimitPerUser > 0) {
    const usedCount = await prisma.couponRedemption.count({
      where: {
        couponId: coupon.id,
        userId: opts.userId,
        order: { status: { in: ['PENDING', 'PAID', 'SHIPPED'] } },
      },
    });
    if (usedCount >= usageLimitPerUser) throw new Error('Kupon sudah mencapai batas penggunaan untuk akun Anda');
  }

  return {
    couponId: coupon.id,
    coupon: {
      code: coupon.code,
      type: coupon.type,
      amount: coupon.amount,
      maxDiscount: coupon.maxDiscount ?? null,
    },
    discountTotal: normalizedDiscount,
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: courseId } = await params;
    const body = (await req.json().catch(() => ({}))) as { couponCode?: unknown; uniqueCode?: unknown; preview?: unknown };
    const couponCode = typeof body?.couponCode === 'string' && body.couponCode.trim() ? body.couponCode.trim() : undefined;
    const uniqueCodeRaw = typeof body?.uniqueCode === 'number' ? body.uniqueCode : typeof body?.uniqueCode === 'string' ? Number(body.uniqueCode) : NaN;
    const uniqueCode = Number.isFinite(uniqueCodeRaw) ? Math.floor(uniqueCodeRaw) : null;
    const preview = body?.preview === true;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        categoryId: true,
        categoryIds: true,
        status: true,
        deletedAt: true,
        instructorId: true,
        enrollmentEndDate: true,
        maxStudents: true,
        validityDays: true,
        subscriptionEligible: true,
        requirements: true,
      },
    });

    if (!course || course.deletedAt) return NextResponse.json({ error: 'Kursus tidak ditemukan' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || user.id === course.instructorId;
    if (course.status !== CourseStatus.PUBLISHED && !isOwner) {
      return NextResponse.json({ error: 'Kursus belum tersedia untuk didaftarkan' }, { status: 403 });
    }

    if (preview) {
      const normalized =
        typeof couponCode === 'string' ? couponCode.trim().toUpperCase().replace(/\s+/g, '') : '';
      if (!normalized) {
        return NextResponse.json({ ok: true, coupon: null, couponCode: null, discountTotal: 0 }, { status: 200 });
      }

      const { discountTotal, coupon } = await computeCouponDiscountForCourse({
        userId: user.id,
        course: { id: course.id, categoryId: course.categoryId ?? null, categoryIds: (course as any).categoryIds, price: Number(course.price || 0) },
        couponCode: normalized,
      });
      return NextResponse.json({ ok: true, couponCode: normalized, coupon, discountTotal }, { status: 200 });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      select: { createdAt: true },
    });
    if (existingEnrollment) {
      return NextResponse.json({
        message: 'Anda sudah terdaftar di kursus ini',
        enrolled: true,
        redirectUrl: `/courses/${course.slug}/learn`,
      });
    }

    if (!isOwner) {
      if (course.enrollmentEndDate && new Date() > course.enrollmentEndDate) {
        return NextResponse.json({ error: 'Pendaftaran kursus sudah ditutup' }, { status: 403 });
      }

      if (course.maxStudents && course.maxStudents > 0) {
        const totalEnrollments = await prisma.enrollment.count({ where: { courseId: course.id } });
        if (totalEnrollments >= course.maxStudents) {
          return NextResponse.json({ error: 'Kuota kursus sudah penuh' }, { status: 403 });
        }
      }

      if (course.subscriptionEligible) {
        const now = new Date();
        const activeSubscription = await prisma.subscription.findFirst({
          where: {
            userId: user.id,
            startDate: { lte: now },
            endDate: { gte: now },
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (!activeSubscription) {
          return NextResponse.json({ error: 'Kursus ini membutuhkan langganan aktif' }, { status: 403 });
        }
      }

      const raw = Array.isArray(course.requirements) ? course.requirements : [];
      const requiredCourseIds = Array.from(new Set(raw.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)));
      if (requiredCourseIds.length) {
        const prerequisiteCourses = await prisma.course.findMany({
          where: { id: { in: requiredCourseIds }, deletedAt: null },
          select: { id: true, title: true, slug: true },
        });
        const prerequisiteIds = prerequisiteCourses.map((c) => c.id);
        if (prerequisiteIds.length) {
          const certificates = await prisma.certificate.findMany({
            where: { userId: user.id, courseId: { in: prerequisiteIds } },
            select: { courseId: true },
          });
          const completed = new Set(certificates.map((c) => c.courseId));
          const missing = prerequisiteCourses.filter((c) => !completed.has(c.id));
          if (missing.length) {
            return NextResponse.json(
              { error: `Selesaikan kursus prasyarat terlebih dahulu: ${missing.map((c) => c.title || c.slug || c.id).join(', ')}` },
              { status: 403 }
            );
          }
        }
      }
    }

    if (Number(course.price || 0) <= 0) {
      await prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
      return NextResponse.json({
        message: 'Berhasil mendaftar kursus gratis',
        enrolled: true,
        redirectUrl: `/courses/${course.slug}/learn`,
      });
    }

    const order = await createOrder(
      user.id,
      { items: [{ courseId: course.id, quantity: 1 }], ...(couponCode ? { couponCode } : {}) },
      {
        checkoutUniqueCode: uniqueCode,
        affiliateCode: req.cookies.get('affiliate_code')?.value || '',
        affiliateReferralId: req.cookies.get('affiliate_referral_id')?.value || '',
      }
    );

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
    const settings = safeParse(settingsPage?.content);
    const methodRaw = typeof settings?.paymentMethod === 'string' ? String(settings.paymentMethod).trim().toUpperCase() : '';
    const paymentMethod = methodRaw === 'MIDTRANS' || methodRaw === 'MANUAL' ? methodRaw : 'XENDIT';

    if (paymentMethod === 'MANUAL') {
      return NextResponse.json({
        message: 'Pesanan berhasil dibuat. Silakan lakukan pembayaran manual dan unggah bukti transfer.',
        enrolled: false,
        orderId: order.id,
        redirectUrl: `/dashboard/student/orders?orderId=${encodeURIComponent(order.id)}`,
      });
    }

    const payment = await createPayment({ provider: paymentMethod as any, orderId: order.id });
    return NextResponse.json({
      message: 'Pembayaran dibuat',
      enrolled: false,
      orderId: order.id,
      paymentUrl: (payment as any)?.paymentUrl || null,
      redirectUrl: `/dashboard/student/orders?orderId=${encodeURIComponent(order.id)}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat checkout' }, { status: 400 });
  }
}
