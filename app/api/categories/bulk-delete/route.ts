import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

async function requireAdminOrMentor(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdminOrMentor(req);
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const idsRaw = Array.isArray(body?.ids) ? body.ids : [];
    const ids = Array.from(
      new Set(
        idsRaw
          .map((x) => String(x || '').trim())
          .filter((x) => x.length > 0)
      )
    );

    if (ids.length === 0) return NextResponse.json({ error: 'Pilih minimal 1 kategori' }, { status: 400 });

    const existing = await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const existingSet = new Set(existing.map((c) => c.id));
    const targetIds = ids.filter((id) => existingSet.has(id));

    if (targetIds.length === 0) {
      return NextResponse.json({ deletedIds: [], blocked: [] });
    }

    const courses = await prisma.course.findMany({
      where: {
        deletedAt: null,
        OR: [{ categoryId: { in: targetIds } }, { categoryIds: { hasSome: targetIds } }],
      },
      select: { categoryId: true, categoryIds: true },
    });

    const usageCountById = new Map<string, number>();
    for (const c of courses) {
      const used = new Set<string>();
      if (typeof c.categoryId === 'string' && c.categoryId.trim()) used.add(c.categoryId);
      if (Array.isArray(c.categoryIds)) {
        for (const id of c.categoryIds) {
          const s = String(id || '').trim();
          if (s) used.add(s);
        }
      }
      for (const id of used) {
        if (!existingSet.has(id)) continue;
        usageCountById.set(id, (usageCountById.get(id) || 0) + 1);
      }
    }

    const blocked = targetIds
      .map((id) => ({ id, usageCount: usageCountById.get(id) || 0 }))
      .filter((x) => x.usageCount > 0);
    const toDelete = targetIds.filter((id) => (usageCountById.get(id) || 0) === 0);

    if (toDelete.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: toDelete } } });
    }

    return NextResponse.json({ deletedIds: toDelete, blocked });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
