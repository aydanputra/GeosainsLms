import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import WithdrawClient from './withdraw-client';

export const dynamic = 'force-dynamic';

const SETTINGS_SLUG = '__course_settings__';
const SITE_SETTINGS_SLUG = '__site_settings__';

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

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
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

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });

  const settingsPage = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
  const settings = safeParseJson(settingsPage?.content);

  const siteSettingsPage = await prisma.page.findUnique({ where: { slug: SITE_SETTINGS_SLUG }, select: { content: true } });
  const siteSettings = safeParseJson(siteSettingsPage?.content);
  const withdrawModeRaw = typeof (siteSettings as any).withdrawMode === 'string' ? String((siteSettings as any).withdrawMode).trim().toUpperCase() : '';
  const paymentMethodRaw = typeof (siteSettings as any).paymentMethod === 'string' ? String((siteSettings as any).paymentMethod).trim().toUpperCase() : '';
  const paymentMethod = paymentMethodRaw === 'MIDTRANS' || paymentMethodRaw === 'MANUAL' ? paymentMethodRaw : 'XENDIT';
  const withdrawMode = withdrawModeRaw === 'AUTO' && paymentMethod === 'XENDIT' ? 'AUTO' : 'MANUAL';

  const enableRevenueSharing = toBool((settings as any).enableRevenueSharing, false);
  const instructorRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).instructorRevenueSharePercent, 90)));
  const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
  const minimumWithdrawalAmount = Math.max(0, toInt((settings as any).minimumWithdrawalAmount, 100000));
  const minimumDaysBeforeBalanceAvailable = Math.max(0, toInt((settings as any).minimumDaysBeforeBalanceAvailable, 7));
  const enabledWithdrawMethods = toStringArray((settings as any).enabledWithdrawMethods);
  const bankInstructions = typeof (settings as any).bankInstructions === 'string' ? String((settings as any).bankInstructions) : '';

  const feePercent = enableRevenueSharing ? adminRevenueSharePercent : 0;
  const mentorPercent = enableRevenueSharing ? instructorRevenueSharePercent : 100;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - minimumDaysBeforeBalanceAvailable);

  const myCourseIds = (
    await prisma.course.findMany({
      where: { instructorId: userId, deletedAt: null },
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

  const courseItemsEligible = courseIds.length
    ? await prisma.orderItem.findMany({
        where: { courseId: { in: courseIds }, order: { is: { status: 'PAID', createdAt: { lte: cutoff } } } },
        select: { quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      })
    : [];
  const courseItemsHold = courseIds.length
    ? await prisma.orderItem.findMany({
        where: { courseId: { in: courseIds }, order: { is: { status: 'PAID', createdAt: { gt: cutoff } } } },
        select: { quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      })
    : [];

  const courseGrossEligible = courseItemsEligible.reduce((sum, it) => {
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    return sum + Math.max(0, lineSubtotal - discount - refund);
  }, 0);
  const courseGrossHold = courseItemsHold.reduce((sum, it) => {
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    return sum + Math.max(0, lineSubtotal - discount - refund);
  }, 0);
  const courseGrossPaid = courseGrossEligible + courseGrossHold;
  const courseFeePaid = Math.max(0, (courseGrossPaid * feePercent) / 100);
  const courseNetEligible = Math.max(0, (courseGrossEligible * mentorPercent) / 100);
  const courseNetHold = Math.max(0, (courseGrossHold * mentorPercent) / 100);
  const courseNetPaid = Math.max(0, (courseGrossPaid * mentorPercent) / 100);

  const approvedVendors = await prisma.shopVendor.findMany({
    where: role === 'ADMIN' ? undefined : { status: 'APPROVED', OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, name: true, commissionType: true, commissionRate: true, status: true },
  });
  const vendorIds = approvedVendors.map((v) => v.id);
  const vendorById = new Map(approvedVendors.map((v) => [v.id, v] as const));
  const vendorActive = role === 'ADMIN' ? true : vendorIds.length > 0;

  const products = vendorIds.length
    ? await prisma.product.findMany({
        where: { vendorId: { in: vendorIds } },
        select: { id: true, vendorId: true },
      })
    : [];
  const productIds = products.map((p) => p.id);
  const productItemsEligible = productIds.length
    ? await prisma.orderItem.findMany({
        where: { productId: { in: productIds }, order: { is: { status: 'PAID', createdAt: { lte: cutoff } } } },
        select: { productId: true, quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      })
    : [];
  const productItemsHold = productIds.length
    ? await prisma.orderItem.findMany({
        where: { productId: { in: productIds }, order: { is: { status: 'PAID', createdAt: { gt: cutoff } } } },
        select: { productId: true, quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      })
    : [];

  const productGrossByVendor = new Map<string, { gross: number; sold: number }>();
  const productVendorByProductId = new Map(products.map((p) => [p.id, p.vendorId] as const));
  for (const it of productItemsEligible) {
    const productId = it.productId;
    if (!productId) continue;
    const vendorId = productVendorByProductId.get(productId);
    if (!vendorId) continue;
    const prev = productGrossByVendor.get(vendorId) || { gross: 0, sold: 0 };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    const gross = Math.max(0, lineSubtotal - discount - refund);
    productGrossByVendor.set(vendorId, { gross: prev.gross + gross, sold: prev.sold + qty });
  }

  const productHoldGrossByVendor = new Map<string, { gross: number; sold: number }>();
  for (const it of productItemsHold) {
    const productId = it.productId;
    if (!productId) continue;
    const vendorId = productVendorByProductId.get(productId);
    if (!vendorId) continue;
    const prev = productHoldGrossByVendor.get(vendorId) || { gross: 0, sold: 0 };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    const gross = Math.max(0, lineSubtotal - discount - refund);
    productHoldGrossByVendor.set(vendorId, { gross: prev.gross + gross, sold: prev.sold + qty });
  }

  let productGrossEligible = 0;
  let productFeeEligible = 0;
  let productNetEligible = 0;
  for (const [vendorId, agg] of productGrossByVendor.entries()) {
    const vendor = vendorById.get(vendorId);
    if (!vendor) continue;
    const commissionType = vendor.commissionType || 'PERCENT';
    const commissionRate = Number(vendor.commissionRate || 0);
    const fee =
      commissionType === 'FLAT' ? Math.max(0, commissionRate * agg.sold) : Math.max(0, (agg.gross * commissionRate) / 100);
    const net = Math.max(0, agg.gross - fee);
    productGrossEligible += agg.gross;
    productFeeEligible += fee;
    productNetEligible += net;
  }

  let productGrossHold = 0;
  let productFeeHold = 0;
  let productNetHold = 0;
  for (const [vendorId, agg] of productHoldGrossByVendor.entries()) {
    const vendor = vendorById.get(vendorId);
    if (!vendor) continue;
    const commissionType = vendor.commissionType || 'PERCENT';
    const commissionRate = Number(vendor.commissionRate || 0);
    const fee =
      commissionType === 'FLAT' ? Math.max(0, commissionRate * agg.sold) : Math.max(0, (agg.gross * commissionRate) / 100);
    const net = Math.max(0, agg.gross - fee);
    productGrossHold += agg.gross;
    productFeeHold += fee;
    productNetHold += net;
  }

  const productGrossPaid = productGrossEligible + productGrossHold;
  const productFeePaid = productFeeEligible + productFeeHold;
  const productNetPaid = productNetEligible + productNetHold;

  const orderWhereRelevant: any = {
    status: 'PAID',
    OR: [
      ...(courseIds.length ? [{ items: { some: { courseId: { in: courseIds } } } }] : []),
      ...(productIds.length ? [{ items: { some: { productId: { in: productIds } } } }] : []),
    ],
  };

  const [ordersEligible, ordersHold] =
    courseIds.length || productIds.length
      ? await Promise.all([
          prisma.order.findMany({
            where: { ...orderWhereRelevant, createdAt: { lte: cutoff } },
            select: {
              id: true,
              total: true,
              commission: { select: { amount: true, status: true } },
              items: {
                where: {
                  OR: [
                    ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
                    ...(productIds.length ? [{ productId: { in: productIds } }] : []),
                  ],
                },
                select: {
                  quantity: true,
                  price: true,
                  discountAmount: true,
                  discountStoreAmount: true,
                  discountMarketplaceAmount: true,
                  refundAmount: true,
                  courseId: true,
                  product: { select: { vendorId: true } },
                },
              },
            },
          }),
          prisma.order.findMany({
            where: { ...orderWhereRelevant, createdAt: { gt: cutoff } },
            select: {
              id: true,
              total: true,
              commission: { select: { amount: true, status: true } },
              items: {
                where: {
                  OR: [
                    ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
                    ...(productIds.length ? [{ productId: { in: productIds } }] : []),
                  ],
                },
                select: {
                  quantity: true,
                  price: true,
                  discountAmount: true,
                  discountStoreAmount: true,
                  discountMarketplaceAmount: true,
                  refundAmount: true,
                  courseId: true,
                  product: { select: { vendorId: true } },
                },
              },
            },
          }),
        ])
      : [[], []];

  const computeAffiliateFeeSplit = (orders: any[]) => {
    let total = 0;
    let course = 0;
    let product = 0;
    for (const o of orders) {
      const orderTotal = Math.max(0, Number(o?.total || 0));
      const commissionAmount = Math.max(0, Number(o?.commission?.amount || 0));
      const commissionStatus = String(o?.commission?.status || '').toUpperCase();
      if (!orderTotal || !commissionAmount || commissionStatus.includes('REVERSED')) continue;

      let buyerPaidCourse = 0;
      let buyerPaidProduct = 0;
      for (const it of Array.isArray(o?.items) ? o.items : []) {
        const qty = Number(it?.quantity || 0);
        const price = Number(it?.price || 0);
        const gross = Math.max(0, qty * price);
        const refund = Math.max(0, Number(it?.refundAmount || 0));
        const discountTotal = Math.max(0, getTotalDiscountAmount(it));
        const buyerPaid = Math.max(0, gross - discountTotal - refund);
        if (it?.courseId) {
          buyerPaidCourse += buyerPaid;
          continue;
        }
        const vendorId = it?.product?.vendorId ? String(it.product.vendorId) : '';
        if (vendorId && vendorById.has(vendorId)) buyerPaidProduct += buyerPaid;
      }
      const mentorBuyerPaid = buyerPaidCourse + buyerPaidProduct;
      if (!mentorBuyerPaid) continue;
      const orderShare = Math.max(0, Math.min(1, mentorBuyerPaid / orderTotal));
      const feeForMentor = Math.max(0, commissionAmount * orderShare);
      if (!feeForMentor) continue;
      const courseShare = Math.max(0, Math.min(1, buyerPaidCourse / mentorBuyerPaid));
      const courseFee = feeForMentor * courseShare;
      const productFee = Math.max(0, feeForMentor - courseFee);
      total += feeForMentor;
      course += courseFee;
      product += productFee;
    }
    return { total, course, product };
  };

  const eligibleAffiliateFee = computeAffiliateFeeSplit(ordersEligible);
  const holdAffiliateFee = computeAffiliateFeeSplit(ordersHold);

  const courseNetEligibleAdj = Math.max(0, courseNetEligible - eligibleAffiliateFee.course);
  const courseNetHoldAdj = Math.max(0, courseNetHold - holdAffiliateFee.course);
  const courseNetPaidAdj = courseNetEligibleAdj + courseNetHoldAdj;

  const productNetEligibleAdj = Math.max(0, productNetEligible - eligibleAffiliateFee.product);
  const productNetHoldAdj = Math.max(0, productNetHold - holdAffiliateFee.product);
  const productNetPaidAdj = productNetEligibleAdj + productNetHoldAdj;

  const netEligible = courseNetEligibleAdj + productNetEligibleAdj;
  const netHold = courseNetHoldAdj + productNetHoldAdj;
  const grossPaidTotal = courseGrossPaid + productGrossPaid;
  const feePaidTotal = courseFeePaid + productFeePaid;
  const affiliateFeePaidTotal = eligibleAffiliateFee.total + holdAffiliateFee.total;
  const netPaidTotal = courseNetPaidAdj + productNetPaidAdj;
  const reservedAgg = await prisma.mentorWithdrawal.aggregate({
    where: { userId, status: { in: ['PENDING', 'PROCESSING', 'SUCCESS'] } },
    _sum: { amount: true },
  });
  const reserved = Number(reservedAgg._sum.amount || 0);
  const availableNet = Math.max(0, netEligible - reserved);

  return (
    <WithdrawClient
      me={{ id: me?.id || userId, name: me?.name || me?.email || 'Mentor', email: me?.email || '' }}
      config={{
        enableRevenueSharing,
        feePercent,
        mentorPercent,
        minimumWithdrawalAmount,
        minimumDaysBeforeBalanceAvailable,
        enabledWithdrawMethods,
        bankInstructions,
        withdrawMode,
      }}
      totals={{
        courses: { gross: courseGrossPaid, fee: courseFeePaid, net: courseNetPaidAdj },
        products: { gross: productGrossPaid, fee: productFeePaid, net: productNetPaidAdj, enabled: vendorActive },
        all: {
          gross: grossPaidTotal,
          fee: feePaidTotal,
          affiliateFee: affiliateFeePaidTotal,
          net: availableNet,
          reserved,
          hold: netHold,
          paidNet: netPaidTotal,
        },
      }}
    />
  );
}
