import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import Cards from '@/modules/dashboard/components/Cards';

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

function getStoreDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
  return store;
}

function getMarketplaceDiscountAmount(it: any) {
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  const store = Number(it?.discountStoreAmount || 0);
  if (store === 0 && marketplace === 0) return 0;
  return marketplace;
}

function getTotalDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
  return store + marketplace;
}

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusPill(status: string) {
  const s = typeof status === 'string' ? status.toUpperCase() : '';
  const label = s === 'PAID' ? 'LUNAS' : s === 'PENDING' ? 'MENUNGGU' : s === 'SHIPPED' ? 'DIKIRIM' : s === 'CANCELLED' ? 'BATAL' : s || '-';
  const cls =
    s === 'PAID'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : s === 'PENDING'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : s === 'SHIPPED'
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
          : s === 'CANCELLED'
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${cls}`}>{label}</span>;
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
  const instructorRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).instructorRevenueSharePercent, 90)));
  const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
  const courseFeePercent = enableRevenueSharing ? adminRevenueSharePercent : 0;
  const courseMentorPercent = enableRevenueSharing ? instructorRevenueSharePercent : 100;

  const [vendors, coursePaidItems, productPaidItems, paidOrdersTotal, recentCourseOrdersRaw, recentProductOrdersRaw, commissionOrders] = await Promise.all([
    prisma.shopVendor.findMany({
      select: { id: true, commissionType: true, commissionRate: true },
    }),
    prisma.orderItem.findMany({
      where: { courseId: { not: null }, order: { is: { status: 'PAID' } } },
      select: { quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
    }),
    prisma.orderItem.findMany({
      where: { productId: { not: null }, order: { is: { status: 'PAID' } } },
      select: {
        productId: true,
        quantity: true,
        price: true,
        discountAmount: true,
        discountStoreAmount: true,
        discountMarketplaceAmount: true,
        refundAmount: true,
        product: { select: { vendorId: true } },
      },
    }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.findMany({
      where: { items: { some: { courseId: { not: null } } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        items: {
          where: { courseId: { not: null } },
          select: {
            quantity: true,
            price: true,
            discountAmount: true,
            discountStoreAmount: true,
            discountMarketplaceAmount: true,
            refundAmount: true,
            course: { select: { title: true, instructor: { select: { name: true, email: true } } } },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { items: { some: { productId: { not: null } } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        items: {
          where: { productId: { not: null } },
          select: {
            quantity: true,
            price: true,
            discountAmount: true,
            discountStoreAmount: true,
            discountMarketplaceAmount: true,
            refundAmount: true,
            product: { select: { name: true, vendor: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        status: 'PAID',
        commission: { isNot: null },
        items: { some: { OR: [{ courseId: { not: null } }, { productId: { not: null } }] } },
      },
      select: {
        total: true,
        commission: { select: { amount: true, status: true } },
        items: {
          select: {
            courseId: true,
            productId: true,
            quantity: true,
            price: true,
            discountAmount: true,
            discountStoreAmount: true,
            discountMarketplaceAmount: true,
            refundAmount: true,
          },
        },
      },
    }),
  ]);

  const vendorById = new Map(vendors.map((v) => [v.id, v] as const));

  const courseGross = coursePaidItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const courseSold = coursePaidItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const courseStoreDiscount = coursePaidItems.reduce((sum, it) => sum + getStoreDiscountAmount(it), 0);
  const courseMarketplaceDiscount = coursePaidItems.reduce((sum, it) => sum + getMarketplaceDiscountAmount(it), 0);
  const courseRefund = coursePaidItems.reduce((sum, it) => sum + Number(it.refundAmount || 0), 0);
  const courseNetSales = Math.max(0, courseGross - courseStoreDiscount - courseRefund);
  const courseFee = Math.max(0, (courseNetSales * courseFeePercent) / 100);
  const courseEarning = Math.max(0, courseNetSales - courseFee);

  const productGross = productPaidItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const productSoldPaid = productPaidItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const productStoreDiscount = productPaidItems.reduce((sum, it) => sum + getStoreDiscountAmount(it), 0);
  const productMarketplaceDiscount = productPaidItems.reduce((sum, it) => sum + getMarketplaceDiscountAmount(it), 0);
  const productRefund = productPaidItems.reduce((sum, it) => sum + Number(it.refundAmount || 0), 0);
  const productNetSales = Math.max(0, productGross - productStoreDiscount - productRefund);

  const grossByVendor = new Map<string, { gross: number; sold: number }>();
  for (const it of productPaidItems) {
    const vendorId = it.product?.vendorId ? String(it.product.vendorId) : null;
    if (!vendorId) continue;
    const prev = grossByVendor.get(vendorId) || { gross: 0, sold: 0 };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    const gross = Math.max(0, lineSubtotal - discount - refund);
    grossByVendor.set(vendorId, { gross: prev.gross + gross, sold: prev.sold + qty });
  }
  let productFee = 0;
  for (const [vendorId, agg] of grossByVendor.entries()) {
    const v = vendorById.get(vendorId);
    if (!v) continue;
    const rate = Number(v.commissionRate || 0);
    const fee = v.commissionType === 'FLAT' ? Math.max(0, rate * agg.sold) : Math.max(0, (agg.gross * rate) / 100);
    productFee += fee;
  }
  const productEarning = Math.max(0, productNetSales - productFee);

  let affiliateFeeCourse = 0;
  let affiliateFeeProduct = 0;
  for (const o of Array.isArray(commissionOrders) ? commissionOrders : []) {
    const commissionAmount = Math.max(0, Number(o?.commission?.amount || 0));
    const commissionStatus = String(o?.commission?.status || '').toUpperCase();
    const commissionApplied = commissionAmount > 0 && !commissionStatus.includes('REVERSED') ? commissionAmount : 0;
    if (commissionApplied <= 0) continue;

    const orderTotal = Math.max(0, Number(o?.total || 0));
    if (orderTotal <= 0) continue;

    const items = Array.isArray((o as any).items) ? (o as any).items : [];
    let courseBuyerPaid = 0;
    let productBuyerPaid = 0;
    for (const it of items) {
      const qty = Number(it?.quantity || 0);
      const price = Number(it?.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Number(it?.refundAmount || 0);
      const totalDiscount = getTotalDiscountAmount(it);
      const buyerPaid = Math.max(0, gross - totalDiscount - refund);
      if (it?.courseId) courseBuyerPaid += buyerPaid;
      if (it?.productId) productBuyerPaid += buyerPaid;
    }

    const itemsBuyerPaid = Math.max(0, courseBuyerPaid + productBuyerPaid);
    if (itemsBuyerPaid <= 0) continue;
    const orderShare = Math.min(1, itemsBuyerPaid / orderTotal);
    const affiliateFeeForItems = commissionApplied * orderShare;
    if (affiliateFeeForItems <= 0) continue;

    const courseShare = courseBuyerPaid > 0 ? courseBuyerPaid / itemsBuyerPaid : 0;
    affiliateFeeCourse += affiliateFeeForItems * courseShare;
    affiliateFeeProduct += affiliateFeeForItems * (1 - courseShare);
  }
  const affiliateFeeTotal = Math.max(0, affiliateFeeCourse + affiliateFeeProduct);

  const grossTotal = courseGross + productGross;
  const storeDiscountTotal = courseStoreDiscount + productStoreDiscount;
  const marketplaceDiscountTotal = courseMarketplaceDiscount + productMarketplaceDiscount;
  const commissionTotal = courseFee + productFee;
  const earningTotal = Math.max(0, courseEarning + productEarning - affiliateFeeTotal);

  const recentCourseOrders = (Array.isArray(recentCourseOrdersRaw) ? recentCourseOrdersRaw : []).map((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const subtotal = items.reduce(
      (sum, it) =>
        sum + Math.max(0, Number(it.quantity || 0) * Number(it.price || 0) - getStoreDiscountAmount(it) - Number((it as any).refundAmount ?? 0)),
      0
    );
    const qty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const mentorSet = new Set<string>();
    const itemText = items
      .map((it) => {
        const name = it.course?.title || '-';
        const q = Number(it.quantity || 0);
        const instructor = (it as any)?.course?.instructor;
        const mentor = instructor?.name || instructor?.email || '';
        if (mentor) mentorSet.add(String(mentor));
        return `${name} (${q})`;
      })
      .join(', ');
    const mentors = Array.from(mentorSet.values()).join(', ') || '-';

    return {
      createdAt: o.createdAt.toISOString(),
      orderId: o.id,
      buyer: o.user?.name || o.user?.email || 'Pembeli',
      mentor: mentors,
      items: itemText,
      quantity: qty,
      subtotal,
      status: String(o.status || ''),
    };
  });

  const recentProductOrders = (Array.isArray(recentProductOrdersRaw) ? recentProductOrdersRaw : []).map((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const subtotal = items.reduce(
      (sum, it) =>
        sum + Math.max(0, Number(it.quantity || 0) * Number(it.price || 0) - getStoreDiscountAmount(it) - Number((it as any).refundAmount ?? 0)),
      0
    );
    const qty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const vendorSet = new Set<string>();
    const itemText = items
      .map((it) => {
        const name = it.product?.name || '-';
        const q = Number(it.quantity || 0);
        const vendorName = (it as any)?.product?.vendor?.name;
        if (vendorName) vendorSet.add(String(vendorName));
        return `${name} (${q})`;
      })
      .join(', ');
    const vendors = Array.from(vendorSet.values()).join(', ') || '-';

    return {
      createdAt: o.createdAt.toISOString(),
      orderId: o.id,
      buyer: o.user?.name || o.user?.email || 'Pembeli',
      vendor: vendors,
      items: itemText,
      quantity: qty,
      subtotal,
      status: String(o.status || ''),
    };
  });

  return (
    <div className="space-y-10 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Penjualan</h1>
        <p className="text-sm text-slate-600 mt-1">Ringkasan penjualan kursus dan produk secara global.</p>
        <div className="text-xs text-slate-500 mt-2">
          Bagi hasil kursus: Mentor {Number(courseMentorPercent || 0)}% • Platform {Number(courseFeePercent || 0)}%
        </div>
      </div>

      <Cards
        metrics={[
          { label: 'Total Penjualan', value: formatIdr(grossTotal), color: 'bg-blue-500' as any },
          { label: 'Komisi Marketplace', value: formatIdr(commissionTotal), color: 'bg-yellow-500' as any },
          ...(affiliateFeeTotal > 0 ? [{ label: 'Fee Affiliate', value: formatIdr(affiliateFeeTotal), color: 'bg-rose-600' as any }] : []),
          { label: 'Diskon Marketplace', value: formatIdr(marketplaceDiscountTotal), color: 'bg-cyan-600' as any },
          { label: 'Diskon Toko', value: formatIdr(storeDiscountTotal), color: 'bg-rose-600' as any },
          { label: 'Total Order', value: paidOrdersTotal, color: 'bg-indigo-600' as any },
          { label: 'Produk Terjual', value: courseSold + productSoldPaid, color: 'bg-emerald-600' as any },
          { label: 'Pendapatan Bersih', value: formatIdr(earningTotal), color: 'bg-green-500' as any },
        ]}
        isLoading={false}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="text-lg font-extrabold text-slate-900 mb-4">Penjualan Kursus Terbaru</div>
        {recentCourseOrders.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada penjualan kursus.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Pembeli</th>
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">Subtotal</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentCourseOrders.map((o) => (
                  <tr key={o.orderId} className="border-b border-slate-100">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(o.createdAt)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-slate-700">{o.orderId}</td>
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-slate-900">{o.buyer}</div>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">{(o as any).mentor || '-'}</td>
                    <td className="py-2 pr-4 text-slate-700">{o.items || '-'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{Number(o.quantity || 0)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(Number(o.subtotal || 0))}</td>
                    <td className="py-2 whitespace-nowrap">{statusPill(o.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="text-lg font-extrabold text-slate-900 mb-4">Penjualan Produk Terbaru</div>
        {recentProductOrders.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada penjualan produk.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Pembeli</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">Subtotal</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentProductOrders.map((o) => (
                  <tr key={o.orderId} className="border-b border-slate-100">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(o.createdAt)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-slate-700">{o.orderId}</td>
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-slate-900">{o.buyer}</div>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">{(o as any).vendor || '-'}</td>
                    <td className="py-2 pr-4 text-slate-700">{o.items || '-'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{Number(o.quantity || 0)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(Number(o.subtotal || 0))}</td>
                    <td className="py-2 whitespace-nowrap">{statusPill(o.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
