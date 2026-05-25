import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { z } from 'zod';

const PatchSchema = z.object({
  name: z.string().trim().min(3).optional(),
  slug: z.string().trim().min(3).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  courseIds: z.array(z.string().trim().min(1)).optional(),
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.courseBundle.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const token = req.cookies.get('token')?.value;
    const user = token ? await verifyToken(token) : null;
    const isStaff = user && (user.role === 'ADMIN' || user.role === 'MENTOR');
    if (!isStaff && !row.published) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(row, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await params;
    const existing = await prisma.courseBundle.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (user.role === 'MENTOR') {
      const owned = await prisma.course.findMany({
        where: { instructorId: String(user.id), deletedAt: null },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((c) => c.id));
      const canEditExisting = Array.isArray(existing.courseIds) && existing.courseIds.every((cid) => ownedSet.has(String(cid)));
      if (!canEditExisting) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = PatchSchema.parse(await req.json().catch(() => ({})));
    const data: any = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl ? String(body.thumbnailUrl) : null;
    if (body.price !== undefined) data.price = body.price;
    if (body.published !== undefined) data.published = body.published;
    if (body.courseIds !== undefined) {
      const cleaned = Array.from(new Set(body.courseIds.map((c) => c.trim()).filter(Boolean)));
      if (user.role === 'MENTOR') {
        const owned = await prisma.course.findMany({
          where: { id: { in: cleaned }, instructorId: String(user.id), deletedAt: null },
          select: { id: true },
        });
        const ownedSet = new Set(owned.map((c) => c.id));
        const allOwned = cleaned.every((cid) => ownedSet.has(cid));
        if (!allOwned) return NextResponse.json({ error: 'Anda hanya bisa memasukkan kursus milik Anda' }, { status: 403 });
      }
      data.courseIds = cleaned;
    }

    const updated = await prisma.courseBundle.update({ where: { id }, data });
    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    const msg = error?.issues?.[0]?.message || error?.message || 'Gagal memperbarui bundle';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await params;
    if (user.role === 'MENTOR') {
      const existing = await prisma.courseBundle.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const owned = await prisma.course.findMany({
        where: { instructorId: String(user.id), deletedAt: null },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((c) => c.id));
      const canDelete = Array.isArray(existing.courseIds) && existing.courseIds.every((cid) => ownedSet.has(String(cid)));
      if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.courseBundle.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
