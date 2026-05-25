import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { name?: unknown; slug?: unknown; description?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const slugInput = typeof body.slug === 'string' ? body.slug.trim() : '';

    const data: { name?: string; slug?: string; description?: string | null } = {};
    if (name) data.name = name;
    if (slugInput) data.slug = slugify(slugInput);
    if (typeof body.description === 'string') data.description = description || null;

    if (data.slug === '') return NextResponse.json({ error: 'Slug kategori tidak valid' }, { status: 400 });
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });

    const updated = await prisma.productCategoryModel.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui kategori' }, { status: 500 });
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
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const inUse = await prisma.product.count({ where: { categoryId: id } });
    if (inUse > 0) return NextResponse.json({ error: 'Kategori sedang dipakai produk' }, { status: 400 });

    await prisma.productCategoryModel.delete({ where: { id } });
    return NextResponse.json({ message: 'Kategori dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus kategori' }, { status: 500 });
  }
}

