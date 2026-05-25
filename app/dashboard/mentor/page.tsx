import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorDashboard from '@/modules/dashboard/pages/mentor/MentorDashboard';

const SETTINGS_SLUG = '__course_settings__';

function safeParseJson(value: unknown) {
  try {
    if (typeof value !== 'string') return {};
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toInt(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toBool(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function getStoreDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
  return store;
}

function getTotalDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  const fallbackTotal = Number(it?.discountAmount || 0);
  if (store === 0 && marketplace === 0) return fallbackTotal;
  return store + marketplace;
}

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const courseWhere = role === 'MENTOR' ? { instructorId: userId, deletedAt: null } : { instructorId: userId, deletedAt: null };

  const settingsPage = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
  const settings = safeParseJson(settingsPage?.content);
  const enableRevenueSharing = toBool((settings as any).enableRevenueSharing, false);
  const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
  const platformFeePercent = enableRevenueSharing ? adminRevenueSharePercent : 0;

  const myCourseIds = (
    await prisma.course.findMany({
      where: courseWhere,
      select: { id: true },
    })
  ).map((c) => c.id);
  const coCourseIds = (
    await prisma.courseCoInstructor.findMany({
      where: { userId },
      select: { courseId: true },
    })
  ).map((x) => x.courseId);
  const courseIds = Array.from(new Set([...myCourseIds, ...coCourseIds]));

  const totalBundles = courseIds.length
    ? await prisma.courseBundle.count({ where: { published: true, courseIds: { hasSome: courseIds } } })
    : 0;

  const publishedPosts = await prisma.post.count({ where: { authorId: userId, published: true } });

  const approvedVendors = await prisma.shopVendor.findMany({
    where: { status: 'APPROVED', OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, commissionType: true, commissionRate: true },
  });
  const vendorIds = approvedVendors.map((v) => v.id);

  const totalProducts = vendorIds.length ? await prisma.product.count({ where: { vendorId: { in: vendorIds } } }) : 0;

  const productPaidItems = vendorIds.length
    ? await prisma.orderItem.findMany({
        where: { product: { vendorId: { in: vendorIds } }, order: { is: { status: 'PAID' } } },
        select: {
          quantity: true,
          price: true,
          discountAmount: true,
          discountStoreAmount: true,
          discountMarketplaceAmount: true,
          refundAmount: true,
          product: { select: { vendorId: true } },
        },
      })
    : [];

  const productsSold = productPaidItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const productGross = productPaidItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const productStoreDiscount = productPaidItems.reduce((sum, it) => sum + getStoreDiscountAmount(it), 0);
  const productRefund = productPaidItems.reduce((sum, it) => sum + Number(it.refundAmount || 0), 0);
  const productNetSales = Math.max(0, productGross - productStoreDiscount - productRefund);

  const vendorById = new Map(approvedVendors.map((v) => [v.id, v] as const));
  const grossByVendor = new Map<string, { gross: number; sold: number }>();
  for (const it of productPaidItems) {
    const vid = typeof it.product?.vendorId === 'string' ? it.product.vendorId : null;
    if (!vid) continue;
    const prev = grossByVendor.get(vid) || { gross: 0, sold: 0 };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    const gross = Math.max(0, lineSubtotal - discount - refund);
    grossByVendor.set(vid, { gross: prev.gross + gross, sold: prev.sold + qty });
  }
  let productFee = 0;
  for (const [vid, agg] of grossByVendor.entries()) {
    const v = vendorById.get(vid);
    if (!v) continue;
    const rate = Number(v.commissionRate || 0);
    const fee = v.commissionType === 'FLAT' ? Math.max(0, rate * agg.sold) : Math.max(0, (agg.gross * rate) / 100);
    productFee += fee;
  }
  const productEarning = Math.max(0, productNetSales - productFee);

  const coursePaidItems = courseIds.length
    ? await prisma.orderItem.findMany({
        where: { courseId: { in: courseIds }, order: { is: { status: 'PAID' } } },
        select: { quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      })
    : [];
  const courseGross = coursePaidItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const courseStoreDiscount = coursePaidItems.reduce((sum, it) => sum + getStoreDiscountAmount(it), 0);
  const courseRefund = coursePaidItems.reduce((sum, it) => sum + Number(it.refundAmount || 0), 0);
  const courseNetSales = Math.max(0, courseGross - courseStoreDiscount - courseRefund);
  const courseFee = Math.max(0, (courseNetSales * platformFeePercent) / 100);
  const courseEarning = Math.max(0, courseNetSales - courseFee);

  const commissionOrders =
    courseIds.length || vendorIds.length
      ? await prisma.order.findMany({
          where: {
            status: 'PAID',
            commission: { isNot: null },
            OR: [
              ...(courseIds.length ? [{ items: { some: { courseId: { in: courseIds } } } }] : []),
              ...(vendorIds.length ? [{ items: { some: { product: { vendorId: { in: vendorIds } } } } }] : []),
            ],
          },
          select: {
            total: true,
            commission: { select: { amount: true, status: true } },
            items: {
              where: {
                OR: [
                  ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
                  ...(vendorIds.length ? [{ product: { vendorId: { in: vendorIds } } }] : []),
                ],
              },
              select: {
                quantity: true,
                price: true,
                discountAmount: true,
                discountStoreAmount: true,
                discountMarketplaceAmount: true,
                refundAmount: true,
              },
            },
          },
        })
      : [];

  let affiliateFeeTotal = 0;
  for (const o of commissionOrders) {
    const orderTotal = Math.max(0, Number(o.total || 0));
    const commissionAmount = Math.max(0, Number((o as any)?.commission?.amount || 0));
    const commissionStatus = String((o as any)?.commission?.status || '').toUpperCase();
    if (!orderTotal || !commissionAmount || commissionStatus.includes('REVERSED')) continue;

    const items = Array.isArray((o as any)?.items) ? (o as any).items : [];
    const mentorBuyerPaid = items.reduce((sum: number, it: any) => {
      const qty = Number(it?.quantity || 0);
      const price = Number(it?.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Math.max(0, Number(it?.refundAmount || 0));
      const discountTotal = Math.max(0, getTotalDiscountAmount(it));
      const buyerPaid = Math.max(0, gross - discountTotal - refund);
      return sum + buyerPaid;
    }, 0);
    if (!mentorBuyerPaid) continue;

    const orderShare = Math.max(0, Math.min(1, mentorBuyerPaid / orderTotal));
    affiliateFeeTotal += Math.max(0, commissionAmount * orderShare);
  }

  const totalEarning = Math.max(0, courseEarning + productEarning - affiliateFeeTotal);
  const platformFeeTotal = courseFee + productFee;

  const [
    totalCourses,
    publishedCourses,
    draftCourses,
    archivedCourses,
    enrolledStudents,
    lessonsTotal,
    quizzesTotal,
    assignmentsTotal,
    pendingSubmissionsCount,
    coursesRaw,
    notificationsRaw,
    recentEnrollmentsRaw,
    pendingSubmissionsRaw,
  ] = await Promise.all([
    prisma.course.count({ where: courseWhere }),
    prisma.course.count({ where: { ...courseWhere, status: 'PUBLISHED' } }),
    prisma.course.count({ where: { ...courseWhere, status: 'DRAFT' } }),
    prisma.course.count({ where: { ...courseWhere, status: 'ARCHIVED' } }),
    prisma.enrollment.count({ where: { course: courseWhere } }),
    prisma.lesson.count({ where: { module: { course: courseWhere } } }),
    prisma.quiz.count({ where: { lesson: { module: { course: courseWhere } } } }),
    prisma.assignment.count({ where: { lesson: { module: { course: courseWhere } } } }),
    prisma.assignmentSubmission.count({ where: { status: 'PENDING', assignment: { lesson: { module: { course: courseWhere } } } } }),
    prisma.course.findMany({
      where: courseWhere,
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { id: true, title: true, slug: true, status: true, price: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, message: true, read: true, createdAt: true },
    }),
    prisma.enrollment.findMany({
      where: { course: courseWhere },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
    }),
    prisma.assignmentSubmission.findMany({
      where: { status: 'PENDING', assignment: { lesson: { module: { course: courseWhere } } } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        submittedAt: true,
        user: { select: { name: true, email: true } },
        assignment: {
          select: {
            title: true,
            lesson: {
              select: {
                title: true,
                module: { select: { course: { select: { title: true, slug: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  const courseIdsForTable = coursesRaw.map((c) => c.id);
  const enrollmentAgg =
    courseIdsForTable.length > 0
      ? await prisma.enrollment.groupBy({
          by: ['courseId'],
          where: { courseId: { in: courseIdsForTable } },
          _count: { _all: true },
        })
      : [];
  const enrollmentsByCourseId = new Map<string, number>(enrollmentAgg.map((r) => [r.courseId, r._count._all]));
  const courses = coursesRaw.map((c) => ({
    id: c.id,
    title: c.title,
    published: c.status === 'PUBLISHED',
    price: c.price,
    students: enrollmentsByCourseId.get(c.id) || 0,
  }));

  const notifications = notificationsRaw.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));
  const recentEnrollments = recentEnrollmentsRaw.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    studentName: e.user?.name || e.user?.email || 'Siswa',
    studentEmail: e.user?.email || '',
    courseTitle: e.course?.title || '-',
    courseSlug: e.course?.slug || '',
  }));
  const pendingSubmissions = pendingSubmissionsRaw.map((s) => ({
    id: s.id,
    submittedAt: s.submittedAt.toISOString(),
    studentName: s.user?.name || s.user?.email || 'Siswa',
    studentEmail: s.user?.email || '',
    courseTitle: s.assignment?.lesson?.module?.course?.title || '-',
    courseSlug: s.assignment?.lesson?.module?.course?.slug || '',
    assignmentTitle: s.assignment?.title || 'Tugas',
    lessonTitle: s.assignment?.lesson?.title || 'Pelajaran',
  }));

  return (
    <MentorDashboard
      stats={{
        totalCourses,
        enrolledStudents,
        totalBundles,
        totalProducts,
        productsSold,
        totalEarning,
        publishedPosts,
        platformFeeTotal,
        affiliateFeeTotal,
      }}
      courses={courses}
      notifications={notifications}
      recentEnrollments={recentEnrollments}
      pendingSubmissions={pendingSubmissions}
    />
  );
}
