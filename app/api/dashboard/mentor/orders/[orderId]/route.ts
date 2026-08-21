import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

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
  return { totalDiscount: Math.max(0, total), storeDiscount: Math.max(0, storeOnly), marketplaceDiscount: Math.max(0, total - storeOnly) };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { orderId } = await params;
    const id = String(orderId || '').trim();
    if (!id) return NextResponse.json({ error: 'Order tidak valid' }, { status: 400 });

    const [myCourses, coCourses, vendors] = await Promise.all([
      prisma.course.findMany({ where: { instructorId: String(user.id), deletedAt: null }, select: { id: true } }),
      prisma.courseCoInstructor.findMany({ where: { userId: String(user.id) }, select: { courseId: true } }),
      prisma.shopVendor.findMany({
        where: { status: 'APPROVED', OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }] },
        select: { id: true },
      }),
    ]);

    const allowedCourseIds = new Set<string>([
      ...myCourses.map((c) => String(c.id)),
      ...coCourses.map((c) => String(c.courseId)),
    ]);
    const allowedVendorIds = new Set<string>(vendors.map((v) => String(v.id)));

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        total: true,
        shippingRecipientName: true,
        shippingPhone: true,
        shippingAddressLine1: true,
        shippingAddressLine2: true,
        shippingCity: true,
        shippingProvince: true,
        shippingPostalCode: true,
        shippingCountry: true,
        shippingCourier: true,
        shippingTrackingNumber: true,
        shippedAt: true,
        user: { select: { id: true, name: true, email: true } },
        commission: { select: { amount: true, status: true } },
        items: {
          select: {
            id: true,
            productId: true,
            courseId: true,
            quantity: true,
            price: true,
            discountAmount: true,
            discountStoreAmount: true,
            discountMarketplaceAmount: true,
            refundAmount: true,
            product: { select: { id: true, name: true, type: true, vendorId: true } },
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });

    const filteredItems = (Array.isArray(order.items) ? order.items : []).filter((it) => {
      if (it.courseId && allowedCourseIds.has(String(it.courseId))) return true;
      const vendorId = it.product?.vendorId ? String(it.product.vendorId) : '';
      if (vendorId && allowedVendorIds.has(vendorId)) return true;
      return false;
    });

    if (filteredItems.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const hasAllowedPhysicalItem = filteredItems.some((it) => String(it?.product?.type || '').toUpperCase() === 'PHYSICAL');

    const settingsPage = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
    const settings = safeParseJson(settingsPage?.content);
    const enableRevenueSharing = toBool((settings as any).enableRevenueSharing, false);
    const instructorRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).instructorRevenueSharePercent, 90)));
    const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
    const courseMentorPercent = enableRevenueSharing ? instructorRevenueSharePercent : 100;
    const coursePlatformPercent = enableRevenueSharing ? adminRevenueSharePercent : 0;

    const vendorIds = Array.from(
      new Set(
        filteredItems
          .map((it) => (it?.product?.vendorId ? String(it.product.vendorId) : ''))
          .filter((x) => x && allowedVendorIds.has(x))
      )
    );
    const vendorConfigs = vendorIds.length
      ? await prisma.shopVendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, commissionType: true, commissionRate: true } })
      : [];
    const vendorById = new Map(vendorConfigs.map((v) => [String(v.id), v] as const));

    const isPaid = String(order.status || '').toUpperCase() === 'PAID';

    const itemBreakdown = filteredItems.map((it: any) => {
      const qty = Number(it?.quantity || 0);
      const price = Number(it?.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Math.max(0, Number(it?.refundAmount || 0));
      const { totalDiscount, storeDiscount, marketplaceDiscount } = getDiscountMeta(it);
      const buyerPaid = Math.max(0, gross - totalDiscount - refund);
      const sellerBase = Math.max(0, gross - storeDiscount - refund);

      let platformFee = 0;
      let mentorEarning = 0;
      let meta: any = null;

      if (it?.course) {
        platformFee = isPaid ? Math.max(0, (sellerBase * Number(coursePlatformPercent || 0)) / 100) : 0;
        mentorEarning = isPaid ? Math.max(0, (sellerBase * Number(courseMentorPercent || 0)) / 100) : 0;
        meta = { kind: 'COURSE', mentorPercent: courseMentorPercent, platformPercent: coursePlatformPercent };
      } else if (it?.product) {
        const vendorId = it?.product?.vendorId ? String(it.product.vendorId) : '';
        const vendor = vendorId ? vendorById.get(vendorId) : undefined;
        const type = String((vendor as any)?.commissionType || 'PERCENT').toUpperCase();
        const rate = Number((vendor as any)?.commissionRate || 0);
        const fee = type === 'FLAT' ? Math.max(0, rate) : Math.max(0, (sellerBase * Math.max(0, rate)) / 100);
        platformFee = isPaid ? fee : 0;
        mentorEarning = isPaid ? Math.max(0, sellerBase - fee) : 0;
        meta = { kind: 'PRODUCT', vendorId: vendorId || null, commissionType: type, commissionRate: rate };
      }

      return {
        id: String(it?.id || ''),
        name: it?.course?.title || it?.product?.name || '-',
        kind: it?.course ? 'COURSE' : it?.product ? 'PRODUCT' : 'OTHER',
        quantity: qty,
        unitPrice: price,
        gross,
        discountStore: storeDiscount,
        discountMarketplace: marketplaceDiscount,
        discountTotal: totalDiscount,
        refund,
        buyerPaid,
        sellerBase,
        platformFee,
        mentorEarning,
        meta,
      };
    });

    const sums = itemBreakdown.reduce(
      (acc: any, it: any) => {
        acc.gross += Number(it.gross || 0);
        acc.discountStore += Number(it.discountStore || 0);
        acc.discountMarketplace += Number(it.discountMarketplace || 0);
        acc.discountTotal += Number(it.discountTotal || 0);
        acc.refund += Number(it.refund || 0);
        acc.buyerPaid += Number(it.buyerPaid || 0);
        acc.sellerBase += Number(it.sellerBase || 0);
        acc.platformFee += Number(it.platformFee || 0);
        acc.mentorEarning += Number(it.mentorEarning || 0);
        return acc;
      },
      {
        gross: 0,
        discountStore: 0,
        discountMarketplace: 0,
        discountTotal: 0,
        refund: 0,
        buyerPaid: 0,
        sellerBase: 0,
        platformFee: 0,
        mentorEarning: 0,
      }
    );

    const commissionAmount = Math.max(0, Number((order as any)?.commission?.amount || 0));
    const commissionStatus = String((order as any)?.commission?.status || '').toUpperCase();
    const commissionApplied = isPaid && commissionAmount > 0 && !commissionStatus.includes('REVERSED') ? commissionAmount : 0;
    const orderTotal = Math.max(0, Number(order.total || 0));
    const orderShare = orderTotal > 0 ? Math.max(0, Math.min(1, Number(sums.buyerPaid || 0) / orderTotal)) : 0;
    const affiliateFee = commissionApplied > 0 ? Math.max(0, commissionApplied * orderShare) : 0;

    const itemBreakdownWithAffiliate = itemBreakdown.map((it: any) => {
      const buyerPaid = Math.max(0, Number(it?.buyerPaid || 0));
      const share = Number(sums.buyerPaid || 0) > 0 ? Math.max(0, Math.min(1, buyerPaid / Number(sums.buyerPaid || 0))) : 0;
      const itemAffiliateFee = affiliateFee > 0 ? Math.max(0, affiliateFee * share) : 0;
      const mentorNetEarning = Math.max(0, Number(it?.mentorEarning || 0) - itemAffiliateFee);
      return { ...it, affiliateFee: itemAffiliateFee, mentorNetEarning };
    });

    const mentorNetEarningTotal = Math.max(0, Number(sums.mentorEarning || 0) - affiliateFee);

    const pricing = {
      isPaid,
      order: {
        subtotal: sums.gross,
        discountStoreTotal: sums.discountStore,
        discountMarketplaceTotal: sums.discountMarketplace,
        discountTotal: sums.discountTotal,
        serviceFee: 0,
        uniqueCode: 0,
        total: sums.buyerPaid,
        refundTotal: sums.refund,
      },
      earnings: {
        gross: sums.gross,
        discountStore: sums.discountStore,
        discountMarketplace: sums.discountMarketplace,
        discountTotal: sums.discountTotal,
        refund: sums.refund,
        buyerPaid: sums.buyerPaid,
        sellerBase: sums.sellerBase,
        platformFee: sums.platformFee,
        affiliateFee,
        mentorEarning: sums.mentorEarning,
        mentorNetEarning: mentorNetEarningTotal,
      },
      settings: {
        enableRevenueSharing,
        courseMentorPercent,
        coursePlatformPercent,
      },
      items: itemBreakdownWithAffiliate,
    };

    return NextResponse.json(
      {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        user: order.user,
        shippingRecipientName: hasAllowedPhysicalItem ? order.shippingRecipientName : null,
        shippingPhone: hasAllowedPhysicalItem ? order.shippingPhone : null,
        shippingAddressLine1: hasAllowedPhysicalItem ? order.shippingAddressLine1 : null,
        shippingAddressLine2: hasAllowedPhysicalItem ? order.shippingAddressLine2 : null,
        shippingCity: hasAllowedPhysicalItem ? order.shippingCity : null,
        shippingProvince: hasAllowedPhysicalItem ? order.shippingProvince : null,
        shippingPostalCode: hasAllowedPhysicalItem ? order.shippingPostalCode : null,
        shippingCountry: hasAllowedPhysicalItem ? order.shippingCountry : null,
        shippingCourier: hasAllowedPhysicalItem ? order.shippingCourier : null,
        shippingTrackingNumber: hasAllowedPhysicalItem ? order.shippingTrackingNumber : null,
        shippedAt: hasAllowedPhysicalItem ? order.shippedAt : null,
        items: filteredItems,
        pricing,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memuat order' }, { status: 500 });
  }
}
