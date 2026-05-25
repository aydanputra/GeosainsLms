import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/modules/auth/utils/auth';

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const role = (req.nextUrl.searchParams.get('role') || 'ALL').trim().toUpperCase();
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 50));

    const roleFilter =
      role === 'ADMIN'
        ? ['ADMIN']
        : role === 'MENTOR'
          ? ['MENTOR']
          : ['ADMIN', 'MENTOR'];

    const instructors = await prisma.user.findMany({
      where: {
        role: { in: roleFilter as any },
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: limit,
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json(
      instructors.map((u) => ({
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role,
      })),
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load instructors' }, { status: 500 });
  }
}
