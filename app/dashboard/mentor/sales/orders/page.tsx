import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import OrdersClient from './orders-client';
import { getCourseRevenueSettings, getMentorScope } from '@/modules/dashboard/api/performance';

export const dynamic = 'force-dynamic';

const JAKARTA_UTC_OFFSET_HOURS = 7;

function getDiscountMeta(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  const fallbackTotal = Number(it?.discountAmount || 0);
  const total = store === 0 && marketplace === 0 ? fallbackTotal : store + marketplace;
  const storeOnly = store === 0 && marketplace === 0 ? fallbackTotal : store;
  return { totalDiscount: Math.max(0, total), storeDiscount: Math.max(0, storeOnly) };
}

function deriveUiStatus(order: { status: string; manualPaymentStatus: string; paymentStatus?: string | null; refundTotal?: number; refundedAt?: Date | null }) {
  const payment = String(order.paymentStatus || '').toUpperCase();
  if (payment === 'FAILED') return 'FAILED' as const;
  const refundTotal = Number(order.refundTotal || 0);
  if (refundTotal > 0 || order.refundedAt) return 'REFUNDED' as const;
  const s = String(order.status || '').toUpperCase();
  if (s === 'CANCELLED') return 'CANCELLED' as const;
  if (s === 'SHIPPED') return 'PROCESSING' as const;
  const manual = String(order.manualPaymentStatus || '').toUpperCase();
  if (manual === 'SUBMITTED') return 'ON_HOLD' as const;
  if (s === 'PAID') return 'COMPLETED' as const;
  return 'PENDING_PAYMENT' as const;
}

function getJakartaTodayRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === 'year')?.value || now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === 'month')?.value || now.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === 'day')?.value || now.getUTCDate());

  const gte = new Date(Date.UTC(year, month - 1, day, -JAKARTA_UTC_OFFSET_HOURS, 0, 0, 0));
  const lt = new Date(Date.UTC(year, month - 1, day + 1, -JAKARTA_UTC_OFFSET_HOURS, 0, 0, 0));
  return { gte, lt };
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

  const [settings, mentorScope] = await Promise.all([getCourseRevenueSettings(), getMentorScope(userId)]);
  const courseMentorPercent = settings.mentorRevenuePercent;
  const courseIds = mentorScope.courseIds;
  const todayRange = getJakartaTodayRange();

  const vendorConfigs =
    role === 'ADMIN'
      ? await prisma.shopVendor.findMany({
          select: { id: true, commissionType: true, commissionRate: true },
        })
      : mentorScope.vendorConfigs;
  const vendorIds = vendorConfigs.map((v) => v.id);
  const vendorById = new Map(vendorConfigs.map((v) => [v.id, v] as const));
  const productIds = role === 'ADMIN'
    ? (
        await prisma.product.findMany({
          select: { id: true },
        })
      ).map((p) => p.id)
    : mentorScope.productIds;

  const orders =
    courseIds.length > 0 || productIds.length > 0
      ? await prisma.order.findMany({
          where: {
            createdAt: todayRange,
            OR: [
              ...(courseIds.length > 0 ? [{ items: { some: { courseId: { in: courseIds } } } }] : []),
              ...(productIds.length > 0 ? [{ items: { some: { productId: { in: productIds } } } }] : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            status: true,
            createdAt: true,
            total: true,
            refundTotal: true,
            refundedAt: true,
            manualPaymentStatus: true,
            payment: { select: { status: true } },
            user: { select: { name: true, email: true } },
            commission: { select: { amount: true, status: true } },
            items: {
              where: {
                OR: [
                  ...(courseIds.length > 0 ? [{ courseId: { in: courseIds } }] : []),
                  ...(productIds.length > 0 ? [{ productId: { in: productIds } }] : []),
                ],
              },
              select: {
                quantity: true,
                price: true,
                discountAmount: true,
                discountStoreAmount: true,
                discountMarketplaceAmount: true,
                refundAmount: true,
                course: { select: { title: true } },
                product: { select: { name: true, type: true, vendorId: true } },
              },
            },
          },
        })
      : [];

  const rows = orders.map((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const status = deriveUiStatus({
      status: o.status as any,
      manualPaymentStatus: o.manualPaymentStatus as any,
      paymentStatus: (o as any)?.payment?.status ?? null,
      refundTotal: Number((o as any)?.refundTotal ?? 0),
      refundedAt: (o as any)?.refundedAt ?? null,
    });
    const isPaid = String(o.status || '').toUpperCase() === 'PAID';

    const orderTotal = Number((o as any)?.total ?? 0);
    let earning = 0;
    let mentorBuyerPaid = 0;
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const price = Number(it.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Number((it as any).refundAmount ?? 0);
      const { totalDiscount, storeDiscount } = getDiscountMeta(it);
      const buyerPaid = Math.max(0, gross - totalDiscount - refund);
      const sellerBase = Math.max(0, gross - storeDiscount - refund);
      mentorBuyerPaid += buyerPaid;

      if (!isPaid) continue;
      if (it.course) {
        earning += (sellerBase * Number(courseMentorPercent || 0)) / 100;
        continue;
      }
      if (it.product) {
        const vendorId = (it as any)?.product?.vendorId ? String((it as any).product.vendorId) : '';
        const vendor = vendorId ? vendorById.get(vendorId) : undefined;
        const type = String((vendor as any)?.commissionType || 'PERCENT').toUpperCase();
        const rate = Number((vendor as any)?.commissionRate || 0);
        const fee = type === 'FLAT' ? Math.max(0, rate) : Math.max(0, (sellerBase * Math.max(0, rate)) / 100);
        earning += Math.max(0, sellerBase - fee);
        continue;
      }
    }

    const commissionAmount = Math.max(0, Number((o as any)?.commission?.amount || 0));
    const commissionStatus = String((o as any)?.commission?.status || '').toUpperCase();
    const commissionApplied = isPaid && commissionAmount > 0 && !commissionStatus.includes('REVERSED') ? commissionAmount : 0;
    const orderShare = orderTotal > 0 ? Math.max(0, Math.min(1, mentorBuyerPaid / orderTotal)) : 0;
    const affiliateFee = commissionApplied > 0 ? Math.max(0, commissionApplied * orderShare) : 0;
    const netEarning = Math.max(0, earning - affiliateFee);

    return {
      createdAt: o.createdAt.toISOString(),
      orderId: o.id,
      customer: o.user?.name || o.user?.email || 'Customer',
      orderTotal: Math.max(0, mentorBuyerPaid),
      earning: netEarning,
      status,
    };
  });

  return <OrdersClient rows={rows as any} defaultRangeLabel="Hari ini" />;
}
