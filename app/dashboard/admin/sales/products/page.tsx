import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import ProductsClient from '@/app/dashboard/mentor/sales/products/products-client';

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
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  const settingsPage = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
  const settings = safeParseJson(settingsPage?.content);
  const enableRevenueSharing = toBool((settings as any).enableRevenueSharing, false);
  const instructorRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).instructorRevenueSharePercent, 90)));
  const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
  const feePercent = enableRevenueSharing ? adminRevenueSharePercent : 0;
  const mentorPercent = enableRevenueSharing ? instructorRevenueSharePercent : 100;

  const [courses, courseItems, vendors, products, productItems] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, price: true, normalPrice: true, slug: true, thumbnailUrl: true },
    }),
    prisma.orderItem.findMany({
      where: { courseId: { not: null }, order: { is: { status: 'PAID' } } },
      select: { courseId: true, quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
    }),
    prisma.shopVendor.findMany({
      select: { id: true, name: true, commissionType: true, commissionRate: true, status: true },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, type: true, stock: true, price: true, vendorId: true, imageUrl: true, imageUrls: true, slug: true },
    }),
    prisma.orderItem.findMany({
      where: { productId: { not: null }, order: { is: { status: 'PAID' } } },
      select: { productId: true, quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
    }),
  ]);

  const courseIds = courses.map((c) => c.id);
  const productIds = products.map((p) => p.id);

  const commissionOrders =
    courseIds.length || productIds.length
      ? await prisma.order.findMany({
          where: {
            status: 'PAID',
            commission: { isNot: null },
            OR: [
              ...(courseIds.length ? [{ items: { some: { courseId: { in: courseIds } } } }] : []),
              ...(productIds.length ? [{ items: { some: { productId: { in: productIds } } } }] : []),
            ],
          },
          select: {
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
        })
      : [];

  const affiliateFeeByCourseId = new Map<string, number>();
  const affiliateFeeByProductId = new Map<string, number>();
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
    const feeForMentor = Math.max(0, commissionAmount * orderShare);
    if (!feeForMentor) continue;

    for (const it of items) {
      const courseId = it?.courseId ? String(it.courseId) : '';
      const productId = it?.productId ? String(it.productId) : '';
      if (!courseId && !productId) continue;

      const qty = Number(it?.quantity || 0);
      const price = Number(it?.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Math.max(0, Number(it?.refundAmount || 0));
      const discountTotal = Math.max(0, getTotalDiscountAmount(it));
      const buyerPaid = Math.max(0, gross - discountTotal - refund);
      if (!buyerPaid) continue;

      const share = Math.max(0, Math.min(1, buyerPaid / mentorBuyerPaid));
      const itemFee = Math.max(0, feeForMentor * share);

      if (courseId) affiliateFeeByCourseId.set(courseId, (affiliateFeeByCourseId.get(courseId) || 0) + itemFee);
      if (productId) affiliateFeeByProductId.set(productId, (affiliateFeeByProductId.get(productId) || 0) + itemFee);
    }
  }

  const courseAgg = new Map<string, { sold: number; gross: number }>();
  for (const it of courseItems) {
    if (!it.courseId) continue;
    const prev = courseAgg.get(it.courseId) || { sold: 0, gross: 0 };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    const gross = Math.max(0, lineSubtotal - discount - refund);
    courseAgg.set(it.courseId, { sold: prev.sold + qty, gross: prev.gross + gross });
  }

  const courseRows = courses.map((c) => {
    const gross = courseAgg.get(c.id)?.gross ?? 0;
    const sold = courseAgg.get(c.id)?.sold ?? 0;
    const fee = Math.max(0, (gross * feePercent) / 100);
    const netBeforeAffiliate = Math.max(0, (gross * mentorPercent) / 100);
    const affiliateFee = Math.max(0, Number(affiliateFeeByCourseId.get(c.id) || 0));
    const net = Math.max(0, netBeforeAffiliate - affiliateFee);
    return {
      id: c.id,
      title: c.title,
      type: 'KURSUS',
      status: c.status,
      stock: null,
      price: Number(c.price || 0),
      normalPrice: c.normalPrice === null ? null : Number(c.normalPrice || 0),
      slug: c.slug,
      imageUrl: c.thumbnailUrl,
      sold,
      gross,
      platformFeePercent: feePercent,
      platformFee: fee,
      affiliateFee,
      net,
    };
  });

  const vendorById = new Map(vendors.map((v) => [v.id, v] as const));

  const productAgg = new Map<string, { sold: number; gross: number }>();
  for (const it of productItems) {
    if (!it.productId) continue;
    const prev = productAgg.get(it.productId) || { sold: 0, gross: 0 };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    const gross = Math.max(0, lineSubtotal - discount - refund);
    productAgg.set(it.productId, { sold: prev.sold + qty, gross: prev.gross + gross });
  }

  const productRows = products.map((p) => {
    const vendor = p.vendorId ? vendorById.get(p.vendorId) : null;
    const gross = productAgg.get(p.id)?.gross ?? 0;
    const sold = productAgg.get(p.id)?.sold ?? 0;
    const commissionType = vendor?.commissionType || 'PERCENT';
    const commissionRate = Number(vendor?.commissionRate || 0);
    const platformFee =
      commissionType === 'FLAT' ? Math.max(0, commissionRate * sold) : Math.max(0, (gross * commissionRate) / 100);
    const netBeforeAffiliate = Math.max(0, gross - platformFee);
    const affiliateFee = Math.max(0, Number(affiliateFeeByProductId.get(p.id) || 0));
    const net = Math.max(0, netBeforeAffiliate - affiliateFee);

    const status = 'AKTIF';

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status,
      stock: p.type === 'PHYSICAL' ? Number(p.stock ?? 0) : null,
      price: Number(p.price || 0),
      imageUrl: p.type === 'SERVICE' && Array.isArray(p.imageUrls) && p.imageUrls.length > 0 ? p.imageUrls[0] : p.imageUrl,
      slug: p.slug,
      sold,
      gross,
      platformFeePercent: commissionType === 'PERCENT' ? commissionRate : null,
      platformFeeFlat: commissionType === 'FLAT' ? commissionRate : null,
      platformFee,
      affiliateFee,
      net,
    };
  });

  return (
    <ProductsClient
      mode="VENDOR_ACTIVE"
      variant="ADMIN"
      platform={{
        feePercent,
        mentorPercent,
      }}
      courseRows={courseRows as any}
      productRows={productRows as any}
    />
  );
}
