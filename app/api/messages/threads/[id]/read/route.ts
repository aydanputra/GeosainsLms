import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: threadId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = String(user.id);

    const thread = await prisma.directThread.findUnique({
      where: { id: threadId },
      select: { id: true, userAId: true, userBId: true },
    });
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    if (thread.userAId !== me && thread.userBId !== me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    if (thread.userAId === me) {
      await prisma.directThread.update({ where: { id: threadId }, data: { lastReadAtA: now, unreadCountA: 0 } });
    } else {
      await prisma.directThread.update({ where: { id: threadId }, data: { lastReadAtB: now, unreadCountB: 0 } });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to mark read' }, { status: 500 });
  }
}

