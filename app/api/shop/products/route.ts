import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createProduct, ProductSchema } from '@/modules/shop/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function generateUniqueSlug(base: string) {
  const normalizedBase = slugify(base);
  if (!normalizedBase) return null;

  const existing = await prisma.product.findUnique({ where: { slug: normalizedBase }, select: { id: true } });
  if (!existing) return normalizedBase;

  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${normalizedBase}-${suffix}`;
    const used = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!used) return candidate;
  }

  return `${normalizedBase}-${Date.now().toString(36)}`;
}

export async function GET(_req: NextRequest) {
  try {
    const url = new URL(_req.url);
    const vendorId = (url.searchParams.get('vendorId') || '').trim();
    const vendorIdsRaw = (url.searchParams.get('vendorIds') || '').trim();
    const q = (url.searchParams.get('q') || '').trim();
    const categoryId = (url.searchParams.get('categoryId') || '').trim();
    const sort = (url.searchParams.get('sort') || 'NEWEST').trim().toUpperCase();
    const onlyInStock = url.searchParams.get('onlyInStock') === 'true';
    const paginated = url.searchParams.get('paginated') === '1';
    const takeStr = url.searchParams.get('take');
    const skipStr = url.searchParams.get('skip');
    const takeRaw = takeStr === null ? null : Number(takeStr);
    const skipRaw = skipStr === null ? null : Number(skipStr);
    const take = typeof takeRaw === 'number' && Number.isFinite(takeRaw) && takeRaw > 0 ? Math.max(1, Math.min(100, takeRaw)) : undefined;
    const skip = typeof skipRaw === 'number' && Number.isFinite(skipRaw) && skipRaw >= 0 ? Math.max(0, Math.trunc(skipRaw)) : 0;

    const vendorIds = vendorIdsRaw
      ? Array.from(
          new Set(
            vendorIdsRaw
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          )
        )
      : [];

    const where: any = {};

    if (vendorId || vendorIds.length > 0) {
      where.vendorId = vendorId ? vendorId : { in: vendorIds };
    }
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }
    if (categoryId) {
      where.OR = [{ categoryId }, { categoryIds: { has: categoryId } }];
    }
    if (onlyInStock) {
      where.stock = { gt: 0 };
    }

    const orderBy =
      sort === 'PRICE_ASC'
        ? { price: 'asc' as const }
        : sort === 'PRICE_DESC'
          ? { price: 'desc' as const }
          : sort === 'NAME_ASC'
            ? { name: 'asc' as const }
            : { createdAt: 'desc' as const };

    if (paginated) {
      const effectiveTake = take ?? 15;
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            categoryRef: true,
            vendor: {
              select: {
                id: true,
                name: true,
                slug: true,
                contactPhone: true,
                status: true,
              },
            },
          },
          orderBy,
          skip,
          take: effectiveTake,
        }),
        prisma.product.count({ where }),
      ]);

      const nextOffset = skip + products.length;
      return NextResponse.json({
        items: products,
        total,
        take: effectiveTake,
        skip,
        hasMore: nextOffset < total,
        nextOffset,
      });
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        categoryRef: true,
        vendor: {
          select: {
            id: true,
            name: true,
            slug: true,
            contactPhone: true,
            status: true,
          },
        },
      },
      orderBy,
      ...(take ? { take } : {}),
    });
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function normalizeProductPayload(body: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...body };
  if (typeof normalized.name === 'string') normalized.name = normalized.name.trim();
  if (typeof normalized.slug === 'string') normalized.slug = normalized.slug.trim();
  if (typeof normalized.description === 'string') normalized.description = normalized.description.trim();
  if (typeof normalized.type === 'string') normalized.type = normalized.type.trim().toUpperCase();
  if (normalized.description === '') normalized.description = undefined;
  if (normalized.imageUrl === '') normalized.imageUrl = null;
  if (Array.isArray(normalized.imageUrls)) {
    normalized.imageUrls = normalized.imageUrls
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .slice(0, 4);
  }
  if (typeof normalized.category === 'string') normalized.category = normalized.category.trim();
  if (normalized.categoryId === '') normalized.categoryId = null;
  if (Array.isArray((normalized as any).categoryIds)) {
    (normalized as any).categoryIds = (normalized as any).categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean);
  }
  if (!Array.isArray((normalized as any).categoryIds) && typeof normalized.categoryId === 'string' && normalized.categoryId) {
    (normalized as any).categoryIds = [normalized.categoryId];
  }
  if (Array.isArray((normalized as any).categoryIds) && (normalized as any).categoryIds.length > 0 && (normalized.categoryId === null || normalized.categoryId === undefined || normalized.categoryId === '')) {
    normalized.categoryId = String((normalized as any).categoryIds[0] || '').trim() || null;
  }
  if (normalized.vendorId === '') normalized.vendorId = null;

  // Hanya set imageUrl dari imageUrls untuk produk non-SERVICE (icon layanan terpisah)
  if (normalized.type !== 'SERVICE' && Array.isArray(normalized.imageUrls) && normalized.imageUrls.length > 0) {
    normalized.imageUrl = normalized.imageUrls[0];
  }
  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'ADMIN';

    const body = normalizeProductPayload((await req.json()) as Record<string, unknown>);
    const parsed = ProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data produk tidak valid' }, { status: 400 });
    }

    const vendorId = parsed.data.vendorId ? String(parsed.data.vendorId) : '';
    if (!vendorId) return NextResponse.json({ error: 'Vendor wajib diisi' }, { status: 400 });

    const vendor = await prisma.shopVendor.findFirst({
      where: isAdmin
        ? { id: vendorId }
        : {
            id: vendorId,
            status: 'APPROVED',
            OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }],
          },
      select: {
        id: true,
        description: true,
        contactEmail: true,
        contactPhone: true,
        addressLine1: true,
        city: true,
        province: true,
        postalCode: true,
        country: true,
      },
    });

    if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (isAdmin) {
      const created = await prisma.product.create({
        data: {
          ...(parsed.data as any),
          vendorId,
        },
      });
      revalidateTag('public-shop-products-page');
      revalidateTag('public-shop-categories');
      revalidateTag('public-product-route-ids');
      revalidateTag('public-page-vendors');
      revalidateTag('homepage-vendors');
      return NextResponse.json(created, { status: 201 });
    }

    const missing: string[] = [];
    if (!vendor.description) missing.push('Deskripsi');
    if (!vendor.contactEmail) missing.push('Email');
    if (!vendor.contactPhone) missing.push('Telepon');
    if (!vendor.addressLine1) missing.push('Alamat');
    if (!vendor.city) missing.push('Kota');
    if (!vendor.province) missing.push('Provinsi');
    if (!vendor.postalCode) missing.push('Kode Pos');
    if (!vendor.country) missing.push('Negara');
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Profil vendor belum lengkap. Lengkapi terlebih dahulu: ${missing.join(', ')}.` },
        { status: 400 }
      );
    }

    const slug = parsed.data.slug ? await generateUniqueSlug(parsed.data.slug) : await generateUniqueSlug(parsed.data.name);
    const product = await createProduct({ ...parsed.data, slug });
    revalidateTag('public-shop-products-page');
    revalidateTag('public-shop-categories');
    revalidateTag('public-product-route-ids');
    revalidateTag('public-page-vendors');
    revalidateTag('homepage-vendors');
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
