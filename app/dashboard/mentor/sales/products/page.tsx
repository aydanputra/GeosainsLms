import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import ProductsClient from './products-client';
import { getCourseRevenueRows, getCourseRevenueSettings, getMentorScope, getProductRevenueRows } from '@/modules/dashboard/api/performance';

export const dynamic = 'force-dynamic';

const JAKARTA_UTC_OFFSET_HOURS = 7;

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

  const todayRange = getJakartaTodayRange();
  const [settings, mentorScope, adminVendorConfigs] = await Promise.all([
    getCourseRevenueSettings(),
    getMentorScope(userId),
    role === 'ADMIN'
      ? prisma.shopVendor.findMany({
          select: { id: true, name: true, commissionType: true, commissionRate: true, status: true },
        })
      : Promise.resolve([]),
  ]);
  const feePercent = settings.platformFeePercent;
  const mentorPercent = settings.mentorRevenuePercent;
  const courseIds = mentorScope.courseIds;
  const vendorConfigs =
    role === 'ADMIN'
      ? adminVendorConfigs.map((vendor) => ({
          id: String(vendor.id),
          commissionType: vendor.commissionType,
          commissionRate: Number(vendor.commissionRate || 0),
        }))
      : mentorScope.vendorConfigs;
  const approvedVendorIds = vendorConfigs.map((vendor) => vendor.id);
  const vendorById = new Map(vendorConfigs.map((vendor) => [vendor.id, vendor] as const));
  const vendorActive = role === 'ADMIN' ? true : approvedVendorIds.length > 0;

  const [courseRowsAgg, productRowsAgg] = await Promise.all([
    getCourseRevenueRows(courseIds, todayRange),
    approvedVendorIds.length > 0 ? getProductRevenueRows(approvedVendorIds, todayRange) : [],
  ]);
  const courseAgg = new Map(courseRowsAgg.map((row) => [String(row.itemId || ''), row] as const));
  const productAgg = new Map(productRowsAgg.map((row) => [String(row.itemId || ''), row] as const));

  const courses = courseIds.length
    ? await prisma.course.findMany({
        where: { id: { in: courseIds }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, price: true, normalPrice: true, slug: true, thumbnailUrl: true },
      })
    : [];

  const courseRows = courses.map((c) => {
    const agg = courseAgg.get(c.id);
    const gross = Number(agg?.sellerGross || 0);
    const sold = Number(agg?.sold || 0);
    const fee = Math.max(0, (gross * feePercent) / 100);
    const netBeforeAffiliate = Math.max(0, (gross * mentorPercent) / 100);
    const affiliateFee = Math.max(0, Number(agg?.affiliateFee || 0));
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

  if (!vendorActive) {
    return (
      <ProductsClient
        mode="COURSE_ONLY"
        platform={{
          feePercent,
          mentorPercent,
        }}
        defaultRangeLabel="Hari ini"
        courseRows={courseRows as any}
        productRows={[] as any}
      />
    );
  }

  const products =
    approvedVendorIds.length > 0 || role === 'ADMIN'
      ? await prisma.product.findMany({
          where: role === 'ADMIN' ? undefined : { vendorId: { in: approvedVendorIds } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, type: true, stock: true, price: true, vendorId: true, imageUrl: true, slug: true },
        })
      : [];

  const productRows = products.map((p) => {
    const vendor = p.vendorId ? vendorById.get(p.vendorId) : null;
    const agg = productAgg.get(p.id);
    const gross = Number(agg?.sellerGross || 0);
    const sold = Number(agg?.sold || 0);
    const commissionType = vendor?.commissionType || 'PERCENT';
    const commissionRate = Number(vendor?.commissionRate || 0);
    const platformFee =
      commissionType === 'FLAT' ? Math.max(0, commissionRate * sold) : Math.max(0, (gross * commissionRate) / 100);
    const netBeforeAffiliate = Math.max(0, gross - platformFee);
    const affiliateFee = Math.max(0, Number(agg?.affiliateFee || 0));
    const net = Math.max(0, netBeforeAffiliate - affiliateFee);

    const status =
      p.type === 'PHYSICAL' && Number(p.stock ?? 0) <= 0 ? 'HABIS' : 'AKTIF';

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status,
      stock: p.type === 'PHYSICAL' ? Number(p.stock ?? 0) : null,
      price: Number(p.price || 0),
      imageUrl: p.imageUrl,
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
      platform={{
        feePercent,
        mentorPercent,
      }}
      defaultRangeLabel="Hari ini"
      courseRows={courseRows as any}
      productRows={productRows as any}
    />
  );
}
