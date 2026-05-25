import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { z } from 'zod';

const BundleSchema = z.object({
  name: z.string().trim().min(3),
  slug: z.string().trim().min(3).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  price: z.number().min(0).default(0),
  courseIds: z.array(z.string().trim().min(1)).default([]),
  published: z.boolean().optional(),
});

async function requireStaff(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.role === 'ADMIN' || user.role === 'MENTOR') return user;
  return null;
}

async function requireStaffOrPublic(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return { kind: 'public' as const };
  const user = await verifyToken(token);
  if (!user) return { kind: 'public' as const };
  if (user.role === 'ADMIN' || user.role === 'MENTOR') return { kind: 'staff' as const, user };
  return { kind: 'public' as const };
}

async function generateUniqueSlug(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  let slug = base || 'bundle';
  let counter = 1;
  while (true) {
    const existing = await prisma.courseBundle.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${base || 'bundle'}-${counter}`;
    counter++;
  }
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireStaffOrPublic(req);
    const onlyPublished = req.nextUrl.searchParams.get('published') === 'true';
    if (access.kind === 'public' && !onlyPublished) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.courseBundle.findMany({
      where: access.kind === 'public' ? { published: true } : onlyPublished ? { published: true } : {},
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(rows, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const parsed = BundleSchema.parse(await req.json().catch(() => ({})));
    const slug = parsed.slug ? parsed.slug : await generateUniqueSlug(parsed.name);
    const cleanedCourseIds = Array.from(new Set((parsed.courseIds || []).map((c) => c.trim()).filter(Boolean)));

    if (user.role === 'MENTOR') {
      const owned = await prisma.course.findMany({
        where: { id: { in: cleanedCourseIds }, instructorId: String(user.id), deletedAt: null },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((c) => c.id));
      const allOwned = cleanedCourseIds.every((id) => ownedSet.has(id));
      if (!allOwned) {
        return NextResponse.json({ error: 'Anda hanya bisa memasukkan kursus milik Anda' }, { status: 403 });
      }
    }

    const created = await prisma.courseBundle.create({
      data: {
        name: parsed.name,
        slug,
        description: parsed.description ? String(parsed.description) : null,
        thumbnailUrl: parsed.thumbnailUrl ? String(parsed.thumbnailUrl) : null,
        price: parsed.price,
        courseIds: cleanedCourseIds,
        published: parsed.published === true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const msg = error?.issues?.[0]?.message || error?.message || 'Gagal membuat bundle';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
