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

async function requireAdminOrMentor(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return null;
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdminOrMentor(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { name?: unknown; slug?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slugInput = typeof body.slug === 'string' ? body.slug.trim() : '';

    if (!name && !slugInput) {
      return NextResponse.json({ error: 'Minimal salah satu field harus diisi' }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
    if (!existing) return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });

    const nextName = name || existing.name;
    const nextSlugBase = slugify(slugInput || nextName);
    if (!nextSlugBase) return NextResponse.json({ error: 'Slug kategori tidak valid' }, { status: 400 });

    let nextSlug = nextSlugBase;
    if (nextSlug !== existing.slug) {
      for (let i = 0; i < 50; i += 1) {
        const dup = await prisma.category.findUnique({ where: { slug: nextSlug }, select: { id: true } });
        if (!dup || dup.id === id) break;
        nextSlug = `${nextSlugBase}-${i + 2}`;
      }
      const stillDup = await prisma.category.findUnique({ where: { slug: nextSlug }, select: { id: true } });
      if (stillDup && stillDup.id !== id) {
        return NextResponse.json({ error: 'Slug kategori sudah dipakai' }, { status: 409 });
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(nextName !== existing.name ? { name: nextName } : {}),
        ...(nextSlug !== existing.slug ? { slug: nextSlug } : {}),
      },
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Kategori dengan nama atau slug tersebut sudah ada' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdminOrMentor(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });

    const usageCount = await prisma.course.count({
      where: {
        deletedAt: null,
        OR: [{ categoryId: id }, { categoryIds: { has: id } }],
      },
    });

    if (usageCount > 0) {
      return NextResponse.json(
        { error: `Kategori masih digunakan oleh ${usageCount} kursus. Hapus/ubah kategori pada kursus terlebih dahulu.` },
        { status: 409 }
      );
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

