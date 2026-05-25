import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import OrdersClient from '@/app/dashboard/mentor/sales/orders/orders-client';

export const dynamic = 'force-dynamic';

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

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  const settingsPage = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
  const settings = safeParseJson(settingsPage?.content);
  const enableRevenueSharing = toBool((settings as any).enableRevenueSharing, false);
  const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
  const courseFeePercent = enableRevenueSharing ? adminRevenueSharePercent : 0;

  const vendors = await prisma.shopVendor.findMany({ select: { id: true, commissionType: true, commissionRate: true } });
  const vendorById = new Map(vendors.map((v) => [v.id, v] as const));

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      createdAt: true,
      refundTotal: true,
      refundedAt: true,
      manualPaymentStatus: true,
      payment: { select: { status: true } },
      user: { select: { name: true, email: true } },
      items: {
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
  });

  const rows = orders.map((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const status = deriveUiStatus({
      status: o.status as any,
      manualPaymentStatus: (o as any).manualPaymentStatus as any,
      paymentStatus: (o as any)?.payment?.status ?? null,
      refundTotal: Number((o as any)?.refundTotal ?? 0),
      refundedAt: (o as any)?.refundedAt ?? null,
    });

    let orderTotal = 0;
    let earning = 0;
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const price = Number(it.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Number((it as any).refundAmount ?? 0);
      const { totalDiscount, storeDiscount } = getDiscountMeta(it);
      const buyerPaid = Math.max(0, gross - totalDiscount - refund);
      const sellerBase = Math.max(0, gross - storeDiscount - refund);
      orderTotal += buyerPaid;

      if (it.course) {
        earning += (sellerBase * Number(courseFeePercent || 0)) / 100;
        continue;
      }
      if (it.product) {
        const vendorId = (it as any)?.product?.vendorId ? String((it as any).product.vendorId) : '';
        const vendor = vendorId ? vendorById.get(vendorId) : undefined;
        const type = String((vendor as any)?.commissionType || 'PERCENT').toUpperCase();
        const rate = Number((vendor as any)?.commissionRate || 0);
        const fee = type === 'FLAT' ? Math.max(0, rate) : Math.max(0, (sellerBase * Math.max(0, rate)) / 100);
        earning += fee;
        continue;
      }
    }

    return {
      createdAt: o.createdAt.toISOString(),
      orderId: o.id,
      customer: o.user?.name || o.user?.email || 'Customer',
      orderTotal,
      earning: Math.max(0, earning),
      status,
    };
  });

  return <OrdersClient rows={rows as any} variant="ADMIN" />;
}
