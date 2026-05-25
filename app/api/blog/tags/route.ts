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
    const tags = await prisma.blogTag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(tags);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memuat tag' }, { status: 500 });
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
    if (!name) return NextResponse.json({ error: 'Nama tag wajib diisi' }, { status: 400 });

    const slug = slugify(slugInput || name);
    if (!slug) return NextResponse.json({ error: 'Slug tag tidak valid' }, { status: 400 });

    const created = await prisma.blogTag.create({
      data: { name, slug },
      select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Nama atau slug tag sudah digunakan' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Gagal menambah tag' }, { status: 500 });
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
    if (!id) return NextResponse.json({ error: 'Id tag wajib diisi' }, { status: 400 });

    await prisma.blogTag.delete({ where: { id } });
    return NextResponse.json({ message: 'Tag dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menghapus tag' }, { status: 500 });
  }
}

