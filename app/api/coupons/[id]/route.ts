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

async function assertMentorCouponTargets(userId: string, args: { scope: string; courseIds?: string[]; productIds?: string[]; vendorIds?: string[] }) {
  const scope = String(args.scope || '').toUpperCase();

  if (scope === 'COURSES') {
    const ids = Array.from(new Set((args.courseIds || []).map((x) => String(x).trim()).filter(Boolean)));
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
    const ids = Array.from(new Set((args.vendorIds || []).map((x) => String(x).trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('Isi minimal 1 Vendor ID untuk scope VENDORS');
    const allOk = ids.every((id) => allowedVendorSet.has(String(id)));
    if (!allOk) throw new Error('Anda hanya bisa memilih vendor milik Anda');
    return { courseIds: [], productIds: [], vendorIds: ids };
  }

  if (scope === 'PRODUCTS') {
    const ids = Array.from(new Set((args.productIds || []).map((x) => String(x).trim()).filter(Boolean)));
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const user = await requireAdminOrMentor(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await ctx.params;
    const existing = await prisma.coupon.findUnique({
      where: { id },
      select: { id: true, createdById: true, scope: true, courseIds: true, productIds: true, vendorIds: true },
    });
    if (!existing) return NextResponse.json({ error: 'Kupon tidak ditemukan' }, { status: 404 });
    const isMentor = user.role === 'MENTOR';
    if (isMentor && String(existing.createdById || '') !== String(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, any> = {};

    if (isMentor) {
      if (body.funding !== undefined || body.marketplaceSharePercent !== undefined || (body as any).allowMentorOptIn !== undefined) {
        return NextResponse.json({ error: 'Mentor tidak bisa mengubah pendanaan/promo platform' }, { status: 400 });
      }
    }

    if (body.code !== undefined) {
      const code = normalizeCode(body.code);
      if (!code || code.length < 3) return NextResponse.json({ error: 'Kode kupon minimal 3 karakter' }, { status: 400 });
      data.code = code;
    }
    if (body.type !== undefined) {
      const type = typeof body.type === 'string' && (body.type === 'PERCENT' || body.type === 'FIXED') ? body.type : '';
      if (!type) return NextResponse.json({ error: 'Tipe kupon tidak valid' }, { status: 400 });
      data.type = type;
    }
    if (body.amount !== undefined) {
      const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : NaN;
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Nilai kupon tidak valid' }, { status: 400 });
      if ((data.type || undefined) === 'PERCENT' && amount > 100) return NextResponse.json({ error: 'Diskon persen maksimal 100' }, { status: 400 });
      data.amount = amount;
    }
    if (body.isActive !== undefined) data.isActive = body.isActive === true;
    if (body.startsAt !== undefined) {
      data.startsAt = typeof body.startsAt === 'string' && body.startsAt ? new Date(body.startsAt) : null;
      if (data.startsAt && Number.isNaN(data.startsAt.getTime())) return NextResponse.json({ error: 'StartsAt tidak valid' }, { status: 400 });
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = typeof body.expiresAt === 'string' && body.expiresAt ? new Date(body.expiresAt) : null;
      if (data.expiresAt && Number.isNaN(data.expiresAt.getTime())) return NextResponse.json({ error: 'ExpiresAt tidak valid' }, { status: 400 });
    }
    if (body.minSubtotal !== undefined) {
      data.minSubtotal = typeof body.minSubtotal === 'number' && Number.isFinite(body.minSubtotal) ? body.minSubtotal : null;
    }
    if (body.maxRedemptions !== undefined) {
      data.maxRedemptions =
        typeof body.maxRedemptions === 'number' && Number.isFinite(body.maxRedemptions) ? Math.trunc(body.maxRedemptions) : null;
      if (data.maxRedemptions !== null && data.maxRedemptions <= 0) return NextResponse.json({ error: 'Max redemptions tidak valid' }, { status: 400 });
    }
    if (body.usageLimitPerUser !== undefined) {
      data.usageLimitPerUser =
        typeof body.usageLimitPerUser === 'number' && Number.isFinite(body.usageLimitPerUser)
          ? Math.trunc(body.usageLimitPerUser)
          : typeof body.usageLimitPerUser === 'string' && body.usageLimitPerUser.trim()
            ? Math.trunc(Number(body.usageLimitPerUser))
            : null;
      if (data.usageLimitPerUser !== null && (!Number.isFinite(data.usageLimitPerUser) || data.usageLimitPerUser <= 0)) {
        return NextResponse.json({ error: 'Usage limit per user tidak valid' }, { status: 400 });
      }
    }
    if (body.maxDiscount !== undefined) {
      data.maxDiscount =
        typeof body.maxDiscount === 'number' && Number.isFinite(body.maxDiscount)
          ? body.maxDiscount
          : typeof body.maxDiscount === 'string' && body.maxDiscount.trim()
            ? Number(body.maxDiscount)
            : null;
      if (data.maxDiscount !== null && (!Number.isFinite(data.maxDiscount) || data.maxDiscount <= 0)) {
        return NextResponse.json({ error: 'Max discount tidak valid' }, { status: 400 });
      }
    }

    if (!isMentor && body.funding !== undefined) {
      const raw = typeof body.funding === 'string' ? body.funding.trim().toUpperCase() : '';
      const funding = raw === 'STORE' || raw === 'MARKETPLACE' || raw === 'SPLIT' ? raw : '';
      if (!funding) return NextResponse.json({ error: 'Funding kupon tidak valid' }, { status: 400 });
      data.funding = funding;
    }

    if (!isMentor && body.marketplaceSharePercent !== undefined) {
      const m =
        typeof body.marketplaceSharePercent === 'number' && Number.isFinite(body.marketplaceSharePercent)
          ? Math.trunc(body.marketplaceSharePercent)
          : typeof body.marketplaceSharePercent === 'string' && body.marketplaceSharePercent.trim()
            ? Math.trunc(Number(body.marketplaceSharePercent))
            : NaN;
      if (!Number.isFinite(m) || m < 0 || m > 100) return NextResponse.json({ error: 'Marketplace share percent harus 0–100' }, { status: 400 });
      data.marketplaceSharePercent = m;
    }

    if (!isMentor && data.funding) {
      if (data.funding === 'STORE') data.marketplaceSharePercent = 0;
      if (data.funding === 'MARKETPLACE') data.marketplaceSharePercent = 100;
      if (data.funding === 'SPLIT') {
        const m = data.marketplaceSharePercent ?? undefined;
        if (!Number.isFinite(m) || m <= 0 || m >= 100) {
          return NextResponse.json({ error: 'Marketplace share percent harus 1–99 untuk mode SPLIT' }, { status: 400 });
        }
      }
    }

    const parseIds = (v: unknown) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
      if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
      return [];
    };

    if (body.scope !== undefined) {
      const raw = typeof body.scope === 'string' ? body.scope.trim().toUpperCase() : '';
      const scope =
        raw === 'ALL' ||
        raw === 'COURSES' ||
        raw === 'PRODUCTS' ||
        raw === 'COURSE_CATEGORIES' ||
        raw === 'PRODUCT_CATEGORIES' ||
        raw === 'VENDORS'
          ? raw
          : '';
      if (!scope) return NextResponse.json({ error: 'Scope kupon tidak valid' }, { status: 400 });
      if (isMentor && (scope === 'ALL' || scope === 'COURSE_CATEGORIES' || scope === 'PRODUCT_CATEGORIES')) {
        return NextResponse.json({ error: 'Scope kupon mentor harus Kursus / Produk / Vendor' }, { status: 400 });
      }
      data.scope = scope;
    }

    if ((body as any).courseIds !== undefined) data.courseIds = parseIds((body as any).courseIds);
    if ((body as any).productIds !== undefined) data.productIds = parseIds((body as any).productIds);
    if ((body as any).vendorIds !== undefined) data.vendorIds = parseIds((body as any).vendorIds);
    if ((body as any).courseCategoryIds !== undefined) data.courseCategoryIds = parseIds((body as any).courseCategoryIds);
    if ((body as any).productCategoryIds !== undefined) data.productCategoryIds = parseIds((body as any).productCategoryIds);
    if (!isMentor && (body as any).allowMentorOptIn !== undefined) data.allowMentorOptIn = Boolean((body as any).allowMentorOptIn);

    const effectiveScope = String(data.scope || '');
    const effectiveOptIn = Boolean((data as any).allowMentorOptIn);
    const effectiveFunding = String((data as any).funding || '');
    if (effectiveOptIn) {
      if (effectiveScope && effectiveScope !== 'COURSES') return NextResponse.json({ error: 'Promo Platform hanya bisa untuk scope COURSES' }, { status: 400 });
      if (effectiveFunding === 'STORE') return NextResponse.json({ error: 'Promo Platform harus ditanggung Marketplace atau Split' }, { status: 400 });
    }
    if (effectiveScope === 'COURSES' && Array.isArray(data.courseIds) && data.courseIds.length === 0 && !effectiveOptIn) {
      return NextResponse.json({ error: 'Isi minimal 1 Course ID untuk scope COURSES' }, { status: 400 });
    }
    if (effectiveScope === 'PRODUCTS' && Array.isArray(data.productIds) && data.productIds.length === 0) {
      return NextResponse.json({ error: 'Isi minimal 1 Product ID untuk scope PRODUCTS' }, { status: 400 });
    }
    if (effectiveScope === 'VENDORS' && Array.isArray(data.vendorIds) && data.vendorIds.length === 0) {
      return NextResponse.json({ error: 'Isi minimal 1 Vendor ID untuk scope VENDORS' }, { status: 400 });
    }
    if (effectiveScope === 'COURSE_CATEGORIES' && Array.isArray(data.courseCategoryIds) && data.courseCategoryIds.length === 0) {
      return NextResponse.json({ error: 'Isi minimal 1 Category ID untuk scope COURSE_CATEGORIES' }, { status: 400 });
    }
    if (effectiveScope === 'PRODUCT_CATEGORIES' && Array.isArray(data.productCategoryIds) && data.productCategoryIds.length === 0) {
      return NextResponse.json({ error: 'Isi minimal 1 Category ID untuk scope PRODUCT_CATEGORIES' }, { status: 400 });
    }

    if (isMentor) {
      const scopeForCheck = String(data.scope ?? existing.scope).toUpperCase();
      const targets = await assertMentorCouponTargets(String(user.id), {
        scope: scopeForCheck,
        courseIds: Array.isArray(data.courseIds) ? data.courseIds : (existing as any).courseIds,
        productIds: Array.isArray(data.productIds) ? data.productIds : (existing as any).productIds,
        vendorIds: Array.isArray(data.vendorIds) ? data.vendorIds : (existing as any).vendorIds,
      });
      data.funding = 'STORE';
      data.marketplaceSharePercent = 0;
      data.allowMentorOptIn = false;
      data.courseIds = targets.courseIds;
      data.productIds = targets.productIds;
      data.vendorIds = targets.vendorIds;
      data.courseCategoryIds = [];
      data.productCategoryIds = [];
    }

    const updated = await prisma.coupon.update({ where: { id }, data });
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'COUPON_UPDATE',
      entityType: 'Coupon',
      entityId: updated.id,
      metadata: { changes: data },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Kupon tidak ditemukan' }, { status: 404 });
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Kode kupon sudah digunakan' }, { status: 409 });
    return NextResponse.json({ error: error?.message || 'Failed to update coupon' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const user = await requireAdminOrMentor(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await ctx.params;
    if (user.role === 'MENTOR') {
      const existing = await prisma.coupon.findUnique({ where: { id }, select: { id: true, createdById: true } });
      if (!existing) return NextResponse.json({ error: 'Kupon tidak ditemukan' }, { status: 404 });
      if (String(existing.createdById || '') !== String(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const deleted = await prisma.coupon.delete({ where: { id } });
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'COUPON_DELETE',
      entityType: 'Coupon',
      entityId: deleted.id,
      metadata: { code: deleted.code },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Kupon tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ error: error?.message || 'Failed to delete coupon' }, { status: 500 });
  }
}
