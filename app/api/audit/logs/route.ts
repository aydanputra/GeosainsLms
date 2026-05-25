import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sp = req.nextUrl.searchParams;
    const action = (sp.get('action') || '').trim();
    const actions = (sp.get('actions') || '').trim();
    const entityType = (sp.get('entityType') || '').trim();
    const entityId = (sp.get('entityId') || '').trim();
    const actorId = (sp.get('actorId') || '').trim();
    const q = (sp.get('q') || '').trim();

    const takeRaw = Number(sp.get('take') || '50');
    const skipRaw = Number(sp.get('skip') || '0');
    const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(200, takeRaw)) : 50;
    const skip = Number.isFinite(skipRaw) ? Math.max(0, skipRaw) : 0;

    const actionList = actions
      ? Array.from(
          new Set(
            actions
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
              .slice(0, 50)
          )
        )
      : [];

    const where: any = {
      ...(action ? { action } : {}),
      ...(actionList.length > 0 ? { action: { in: actionList } } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(actorId ? { actorId } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' } },
              { entityType: { contains: q, mode: 'insensitive' } },
              { entityId: { contains: q, mode: 'insensitive' } },
              { actor: { name: { contains: q, mode: 'insensitive' } } },
              { actor: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ items, total, take, skip }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
