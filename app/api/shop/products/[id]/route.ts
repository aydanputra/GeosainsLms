import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { getProductById, updateProduct, deleteProduct, ProductSchema } from '@/modules/shop/api/service';
import { prisma } from '@/utils/prisma';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function generateUniqueSlug(base: string, currentProductId: string) {
  const normalizedBase = slugify(base);
  if (!normalizedBase) return null;

  const existing = await prisma.product.findUnique({ where: { slug: normalizedBase }, select: { id: true } });
  if (!existing || existing.id === currentProductId) return normalizedBase;

  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${normalizedBase}-${suffix}`;
    const used = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!used || used.id === currentProductId) return candidate;
  }

  return `${normalizedBase}-${Date.now().toString(36)}`;
}

function normalizeProductPayload(body: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...body };

  if (typeof normalized.name === 'string') normalized.name = normalized.name.trim();
  if (typeof normalized.slug === 'string') normalized.slug = normalized.slug.trim();
  if (typeof normalized.description === 'string') normalized.description = normalized.description.trim();
  if (typeof normalized.type === 'string') normalized.type = normalized.type.trim().toUpperCase();
  if (typeof normalized.category === 'string') normalized.category = normalized.category.trim();

  if (normalized.description === '') normalized.description = null;
  if (normalized.imageUrl === '') normalized.imageUrl = null;
  if (Array.isArray(normalized.imageUrls)) {
    normalized.imageUrls = normalized.imageUrls
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .slice(0, 4);
  }
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

  if (Array.isArray(normalized.imageUrls) && normalized.imageUrls.length > 0) {
    normalized.imageUrl = normalized.imageUrls[0];
  }

  return normalized;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'ADMIN';

    const body = normalizeProductPayload((await req.json()) as Record<string, unknown>);
    const parsed = ProductSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data produk tidak valid' }, { status: 400 });
    }

    const current = await prisma.product.findUnique({ where: { id }, select: { id: true, slug: true, name: true, vendorId: true } });
    if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (!isAdmin) {
      const vendorId = current.vendorId ? String(current.vendorId) : '';
      if (!vendorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const vendor = await prisma.shopVendor.findFirst({
        where: {
          id: vendorId,
          status: 'APPROVED',
          OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }],
        },
        select: { id: true },
      });

      if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      if (parsed.data.vendorId !== undefined && String(parsed.data.vendorId || '') !== vendorId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const requestedSlug = typeof parsed.data.slug === 'string' && parsed.data.slug.trim() ? parsed.data.slug : null;
    const shouldBackfillSlug = !requestedSlug && !current.slug;
    const baseSlug = requestedSlug || (shouldBackfillSlug ? (typeof parsed.data.name === 'string' && parsed.data.name.trim() ? parsed.data.name : current.name) : null);
    const slug = baseSlug ? await generateUniqueSlug(baseSlug, id) : undefined;

    const updated = await updateProduct(id, { ...parsed.data, ...(slug !== undefined ? { slug } : {}) });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui produk' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PUT(req, ctx);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'ADMIN';

    if (!isAdmin) {
      const current = await prisma.product.findUnique({ where: { id }, select: { id: true, vendorId: true } });
      if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      const vendorId = current.vendorId ? String(current.vendorId) : '';
      if (!vendorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const vendor = await prisma.shopVendor.findFirst({
        where: {
          id: vendorId,
          status: 'APPROVED',
          OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }],
        },
        select: { id: true },
      });

      if (!vendor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteProduct(id);
    return NextResponse.json({ message: 'Produk dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus produk' }, { status: 500 });
  }
}
