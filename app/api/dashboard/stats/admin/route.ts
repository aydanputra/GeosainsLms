import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

const COURSE_SETTINGS_SLUG = '__course_settings__';

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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const totalUsers = await prisma.user.count();
    const totalCourses = await prisma.course.count({ where: { deletedAt: null } });
    const totalOrders = await prisma.order.count({ where: { status: 'PAID' } });
    const revenueAgg = await prisma.order.aggregate({
      _sum: { total: true, refundTotal: true },
      where: { status: 'PAID' }
    });
    const sumTotal = revenueAgg._sum.total || 0;
    const sumRefund = revenueAgg._sum.refundTotal || 0;
    const revenue = Math.max(0, sumTotal - sumRefund);

    const settingsPage = await prisma.page.findUnique({ where: { slug: COURSE_SETTINGS_SLUG }, select: { content: true } });
    const settings = safeParseJson(settingsPage?.content);
    const enableRevenueSharing = toBool((settings as any).enableRevenueSharing, false);
    const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
    const courseFeePercent = enableRevenueSharing ? adminRevenueSharePercent : 0;

    const [vendors, coursePaidItems, productPaidItems] = await Promise.all([
      prisma.shopVendor.findMany({ select: { id: true, commissionType: true, commissionRate: true } }),
      prisma.orderItem.findMany({
        where: { courseId: { not: null }, order: { is: { status: 'PAID' } } },
        select: { quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      }),
      prisma.orderItem.findMany({
        where: { productId: { not: null }, order: { is: { status: 'PAID' } } },
        select: {
          quantity: true,
          price: true,
          discountAmount: true,
          discountStoreAmount: true,
          discountMarketplaceAmount: true,
          refundAmount: true,
          product: { select: { vendorId: true } },
        },
      }),
    ]);

    const courseGross = coursePaidItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
    const courseStoreDiscount = coursePaidItems.reduce((sum, it) => sum + getStoreDiscountAmount(it), 0);
    const courseRefund = coursePaidItems.reduce((sum, it) => sum + Number(it.refundAmount || 0), 0);
    const courseNetSales = Math.max(0, courseGross - courseStoreDiscount - courseRefund);
    const courseFee = Math.max(0, (courseNetSales * courseFeePercent) / 100);

    const vendorById = new Map(vendors.map((v) => [v.id, v] as const));
    const productGross = productPaidItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
    const productStoreDiscount = productPaidItems.reduce((sum, it) => sum + getStoreDiscountAmount(it), 0);
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

    const netSalesTotal = Math.max(0, courseNetSales + productNetSales);
    const marketplaceFeeTotal = Math.max(0, courseFee + productFee);

    const activeStudents = await prisma.user.count({
      where: {
        role: 'STUDENT',
        enrollments: {
          some: {}
        }
      }
    });

    const pendingWithdrawals = await prisma.withdrawal.count({
      where: {
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      totalUsers,
      totalCourses,
      totalOrders,
      revenue,
      netSalesTotal,
      marketplaceFeeTotal,
      activeStudents,
      pendingWithdrawals
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
