import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const userIds = Array.isArray(body?.userIds) ? body.userIds.map(String).map((s: string) => s.trim()).filter(Boolean) : [];
    if (userIds.length === 0) return NextResponse.json({ error: 'userIds is required' }, { status: 400 });

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds }, role: { not: 'ADMIN' } },
      data: { role: 'MENTOR' },
    });

    return NextResponse.json({ updatedCount: result.count }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to promote instructors' }, { status: 500 });
  }
}

