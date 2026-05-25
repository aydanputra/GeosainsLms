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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const categories = await prisma.productCategoryModel.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil kategori' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'ADMIN') {
      if (user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const isVendorApproved = await prisma.shopVendor.findFirst({
        where: {
          status: 'APPROVED',
          OR: [{ ownerId: String(user.id) }, { members: { some: { userId: String(user.id) } } }],
        },
        select: { id: true },
      });
      if (!isVendorApproved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as { name?: unknown; slug?: unknown; description?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const slugInput = typeof body.slug === 'string' ? body.slug.trim() : '';
    const slug = slugify(slugInput || name);

    if (!name) return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    if (!slug) return NextResponse.json({ error: 'Slug kategori tidak valid' }, { status: 400 });

    const created = await prisma.productCategoryModel.create({
      data: {
        name,
        slug,
        description: description || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat kategori' }, { status: 500 });
  }
}
