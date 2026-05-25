import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

function normalizeCode(value: unknown) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return raw.replace(/\s+/g, '');
}

async function requireAdminOrMentor(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return null;
  return user;
}

async function getAllowedVendorIds(userId: string) {
  const [owned, member] = await Promise.all([
    prisma.shopVendor.findMany({ where: { ownerId: userId }, select: { id: true } }),
    prisma.shopVendorMember.findMany({ where: { userId }, select: { vendorId: true } }),
  ]);
  const ids = new Set<string>();
  for (const v of owned) ids.add(String(v.id));
  for (const m of member) ids.add(String(m.vendorId));
  return Array.from(ids);
}

async function assertMentorCouponTargets(userId: string, args: { scope: string; courseIds: string[]; productIds: string[]; vendorIds: string[] }) {
  const scope = String(args.scope || '').toUpperCase();

  if (scope === 'COURSES') {
    const ids = Array.from(new Set(args.courseIds.map((x) => String(x).trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('Isi minimal 1 Course ID untuk scope COURSES');

    const [owned, co] = await Promise.all([
      prisma.course.findMany({ where: { id: { in: ids }, instructorId: userId, deletedAt: null }, select: { id: true } }),
      prisma.courseCoInstructor.findMany({ where: { courseId: { in: ids }, userId }, select: { courseId: true } }),
    ]);
    const okSet = new Set<string>([...owned.map((c) => String(c.id)), ...co.map((r) => String(r.courseId))]);
    const allOk = ids.every((id) => okSet.has(String(id)));
    if (!allOk) throw new Error('Anda hanya bisa memilih kursus milik Anda');
    return { courseIds: ids, productIds: [], vendorIds: [] };
  }

  const allowedVendorIds = await getAllowedVendorIds(userId);
  const allowedVendorSet = new Set(allowedVendorIds.map(String));

  if (scope === 'VENDORS') {
    const ids = Array.from(new Set(args.vendorIds.map((x) => String(x).trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('Isi minimal 1 Vendor ID untuk scope VENDORS');
    const allOk = ids.every((id) => allowedVendorSet.has(String(id)));
    if (!allOk) throw new Error('Anda hanya bisa memilih vendor milik Anda');
    return { courseIds: [], productIds: [], vendorIds: ids };
  }

  if (scope === 'PRODUCTS') {
    const ids = Array.from(new Set(args.productIds.map((x) => String(x).trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('Isi minimal 1 Product ID untuk scope PRODUCTS');
    const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, vendorId: true } });
    const byId = new Map(products.map((p) => [String(p.id), p] as const));
    const allOk = ids.every((id) => {
      const p = byId.get(String(id));
      if (!p) return false;
      if (!p.vendorId) return false;
      return allowedVendorSet.has(String(p.vendorId));
    });
    if (!allOk) throw new Error('Anda hanya bisa memilih produk milik vendor Anda');
    return { courseIds: [], productIds: ids, vendorIds: [] };
  }

  throw new Error('Scope kupon untuk mentor tidak valid');
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAdminOrMentor(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const coupons = await prisma.coupon.findMany({
      where: {
        ...(user.role === 'MENTOR' ? { createdById: String(user.id) } : {}),
        ...(q
          ? {
              OR: [{ code: { contains: q.toUpperCase() } }],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(coupons, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch coupons' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const user = await requireAdminOrMentor(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = normalizeCode(body.code);
    const type = typeof body.type === 'string' && (body.type === 'PERCENT' || body.type === 'FIXED') ? body.type : 'PERCENT';
    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : NaN;
    const isActive = body.isActive === undefined ? true : body.isActive === true;
    const startsAt = typeof body.startsAt === 'string' && body.startsAt ? new Date(body.startsAt) : null;
    const expiresAt = typeof body.expiresAt === 'string' && body.expiresAt ? new Date(body.expiresAt) : null;
    const minSubtotal = typeof body.minSubtotal === 'number' && Number.isFinite(body.minSubtotal) ? body.minSubtotal : null;
    const maxRedemptions = typeof body.maxRedemptions === 'number' && Number.isFinite(body.maxRedemptions) ? Math.trunc(body.maxRedemptions) : null;
    const usageLimitPerUser =
      typeof body.usageLimitPerUser === 'number' && Number.isFinite(body.usageLimitPerUser)
        ? Math.trunc(body.usageLimitPerUser)
        : typeof body.usageLimitPerUser === 'string' && body.usageLimitPerUser.trim()
          ? Math.trunc(Number(body.usageLimitPerUser))
          : null;
    const maxDiscount =
      typeof body.maxDiscount === 'number' && Number.isFinite(body.maxDiscount)
        ? body.maxDiscount
        : typeof body.maxDiscount === 'string' && body.maxDiscount.trim()
          ? Number(body.maxDiscount)
          : null;

    const scopeRaw = typeof body.scope === 'string' ? body.scope.trim().toUpperCase() : 'ALL';
    const scope =
      scopeRaw === 'ALL' ||
      scopeRaw === 'COURSES' ||
      scopeRaw === 'PRODUCTS' ||
      scopeRaw === 'COURSE_CATEGORIES' ||
      scopeRaw === 'PRODUCT_CATEGORIES' ||
      scopeRaw === 'VENDORS'
        ? scopeRaw
        : 'ALL';

    const parseIds = (v: unknown) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
      if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
      return [];
    };
    const courseIds = parseIds((body as any).courseIds);
    const productIds = parseIds((body as any).productIds);
    const vendorIds = parseIds((body as any).vendorIds);
    const courseCategoryIds = parseIds((body as any).courseCategoryIds);
    const productCategoryIds = parseIds((body as any).productCategoryIds);
    const allowMentorOptIn = Boolean((body as any).allowMentorOptIn);
    const fundingRaw = typeof body.funding === 'string' ? body.funding.trim().toUpperCase() : 'STORE';
    const funding = fundingRaw === 'MARKETPLACE' || fundingRaw === 'SPLIT' || fundingRaw === 'STORE' ? fundingRaw : 'STORE';
    const marketplaceSharePercentRaw =
      typeof body.marketplaceSharePercent === 'number' && Number.isFinite(body.marketplaceSharePercent)
        ? Math.trunc(body.marketplaceSharePercent)
        : typeof body.marketplaceSharePercent === 'string' && body.marketplaceSharePercent.trim()
          ? Math.trunc(Number(body.marketplaceSharePercent))
          : null;
    const marketplaceSharePercent = marketplaceSharePercentRaw === null || Number.isNaN(marketplaceSharePercentRaw) ? null : marketplaceSharePercentRaw;

    if (!code || code.length < 3) return NextResponse.json({ error: 'Kode kupon minimal 3 karakter' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Nilai kupon tidak valid' }, { status: 400 });
    if (type === 'PERCENT' && amount > 100) return NextResponse.json({ error: 'Diskon persen maksimal 100' }, { status: 400 });
    if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) return NextResponse.json({ error: 'Max discount tidak valid' }, { status: 400 });
    if (maxRedemptions !== null && maxRedemptions <= 0) return NextResponse.json({ error: 'Max redemptions tidak valid' }, { status: 400 });
    if (usageLimitPerUser !== null && usageLimitPerUser <= 0) return NextResponse.json({ error: 'Usage limit per user tidak valid' }, { status: 400 });
    if (startsAt && Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: 'StartsAt tidak valid' }, { status: 400 });
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: 'ExpiresAt tidak valid' }, { status: 400 });
    if (startsAt && expiresAt && startsAt >= expiresAt) return NextResponse.json({ error: 'Rentang tanggal tidak valid' }, { status: 400 });

    const isMentor = user.role === 'MENTOR';
    let effectiveFunding = funding;
    let effectiveMarketplaceSharePercent = marketplaceSharePercent;
    let effectiveAllowMentorOptIn = allowMentorOptIn;
    const effectiveScope = scope;
    let effectiveCourseIds = courseIds;
    let effectiveProductIds = productIds;
    let effectiveVendorIds = vendorIds;
    let effectiveCourseCategoryIds = courseCategoryIds;
    let effectiveProductCategoryIds = productCategoryIds;

    if (isMentor) {
      effectiveFunding = 'STORE';
      effectiveMarketplaceSharePercent = 0;
      effectiveAllowMentorOptIn = false;
      if (effectiveScope === 'ALL' || effectiveScope === 'COURSE_CATEGORIES' || effectiveScope === 'PRODUCT_CATEGORIES') {
        return NextResponse.json({ error: 'Scope kupon mentor harus Kursus / Produk / Vendor' }, { status: 400 });
      }

      const targets = await assertMentorCouponTargets(String(user.id), {
        scope: effectiveScope,
        courseIds: effectiveCourseIds,
        productIds: effectiveProductIds,
        vendorIds: effectiveVendorIds,
      });
      effectiveCourseIds = targets.courseIds;
      effectiveProductIds = targets.productIds;
      effectiveVendorIds = targets.vendorIds;
      effectiveCourseCategoryIds = [];
      effectiveProductCategoryIds = [];
    } else {
      if (effectiveFunding === 'STORE') effectiveMarketplaceSharePercent = 0;
      if (effectiveFunding === 'MARKETPLACE') effectiveMarketplaceSharePercent = 100;
      if (effectiveFunding === 'SPLIT') {
        if (effectiveMarketplaceSharePercent === null) effectiveMarketplaceSharePercent = 50;
        if (
          !Number.isFinite(effectiveMarketplaceSharePercent) ||
          effectiveMarketplaceSharePercent <= 0 ||
          effectiveMarketplaceSharePercent >= 100
        ) {
          return NextResponse.json({ error: 'Marketplace share percent harus 1–99 untuk mode SPLIT' }, { status: 400 });
        }
      }
    }

    if (effectiveAllowMentorOptIn) {
      if (effectiveScope !== 'COURSES') return NextResponse.json({ error: 'Promo Platform hanya bisa untuk scope COURSES' }, { status: 400 });
      if (effectiveFunding === 'STORE') return NextResponse.json({ error: 'Promo Platform harus ditanggung Marketplace atau Split' }, { status: 400 });
    }

    if (effectiveScope === 'COURSES' && effectiveCourseIds.length === 0 && !effectiveAllowMentorOptIn)
      return NextResponse.json({ error: 'Isi minimal 1 Course ID untuk scope COURSES (atau aktifkan Promo Platform)' }, { status: 400 });
    if (effectiveScope === 'PRODUCTS' && effectiveProductIds.length === 0)
      return NextResponse.json({ error: 'Isi minimal 1 Product ID untuk scope PRODUCTS' }, { status: 400 });
    if (effectiveScope === 'VENDORS' && effectiveVendorIds.length === 0)
      return NextResponse.json({ error: 'Isi minimal 1 Vendor ID untuk scope VENDORS' }, { status: 400 });
    if (effectiveScope === 'COURSE_CATEGORIES' && effectiveCourseCategoryIds.length === 0)
      return NextResponse.json({ error: 'Isi minimal 1 Category ID untuk scope COURSE_CATEGORIES' }, { status: 400 });
    if (effectiveScope === 'PRODUCT_CATEGORIES' && effectiveProductCategoryIds.length === 0)
      return NextResponse.json({ error: 'Isi minimal 1 Category ID untuk scope PRODUCT_CATEGORIES' }, { status: 400 });

    const created = await prisma.coupon.create({
      data: {
        code,
        type: type as any,
        amount,
        createdById: user.role === 'MENTOR' ? String(user.id) : null,
        funding: effectiveFunding as any,
        marketplaceSharePercent: effectiveMarketplaceSharePercent ?? 0,
        allowMentorOptIn: effectiveAllowMentorOptIn,
        scope: effectiveScope as any,
        courseIds: effectiveCourseIds,
        productIds: effectiveProductIds,
        vendorIds: effectiveVendorIds,
        courseCategoryIds: effectiveCourseCategoryIds,
        productCategoryIds: effectiveProductCategoryIds,
        maxDiscount: maxDiscount !== null ? maxDiscount : null,
        isActive,
        startsAt,
        expiresAt,
        minSubtotal,
        maxRedemptions,
        usageLimitPerUser,
      },
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'COUPON_CREATE',
      entityType: 'Coupon',
      entityId: created.id,
      metadata: {
        code,
        type,
        amount,
        isActive,
        funding: effectiveFunding,
        marketplaceSharePercent: effectiveMarketplaceSharePercent ?? 0,
        scope: effectiveScope,
        allowMentorOptIn: effectiveAllowMentorOptIn,
        usageLimitPerUser,
        maxDiscount,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Kode kupon sudah digunakan' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to create coupon' }, { status: 500 });
  }
}
