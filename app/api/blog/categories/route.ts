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

export async function GET() {
  try {
    const categories = await prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memuat kategori' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const slugInput = typeof body?.slug === 'string' ? body.slug.trim() : '';
    if (!name) return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });

    const slug = slugify(slugInput || name);
    if (!slug) return NextResponse.json({ error: 'Slug kategori tidak valid' }, { status: 400 });

    const created = await prisma.blogCategory.create({
      data: { name, slug },
      select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Nama atau slug kategori sudah digunakan' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Gagal menambah kategori' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'Id kategori wajib diisi' }, { status: 400 });

    await prisma.blogCategory.delete({ where: { id } });
    return NextResponse.json({ message: 'Kategori dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menghapus kategori' }, { status: 500 });
  }
}

