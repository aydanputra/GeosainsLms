import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { name?: unknown; slug?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slugInput = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!name) return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });

    const baseSlug = slugify(slugInput || name);
    if (!baseSlug) return NextResponse.json({ error: 'Slug kategori tidak valid' }, { status: 400 });

    let slug = baseSlug;
    for (let i = 0; i < 50; i += 1) {
      const exists = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
      if (!exists) break;
      slug = `${baseSlug}-${i + 2}`;
    }
    const stillExists = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (stillExists) return NextResponse.json({ error: 'Slug kategori sudah dipakai' }, { status: 409 });

    const category = await prisma.category.create({ data: { name, slug } });

    return NextResponse.json(category);
  } catch (error: any) {
    console.error('Failed to create category:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Kategori dengan nama atau slug tersebut sudah ada' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create category', details: error.message }, { status: 500 });
  }
}
