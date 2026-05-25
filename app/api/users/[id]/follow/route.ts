import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

async function getMeId(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user?.id) return null;
  return String(user.id);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const targetId = String(id || '').trim();
    if (!targetId) return NextResponse.json({ error: 'Invalid user' }, { status: 400 });

    const me = await getMeId(req);

    const [followersCount, isFollowing] = await Promise.all([
      (prisma as any).userFollow.count({ where: { followingId: targetId } }),
      me
        ? (prisma as any).userFollow.findUnique({ where: { followerId_followingId: { followerId: me, followingId: targetId } } })
        : Promise.resolve(null),
    ]);

    return NextResponse.json(
      {
        followersCount,
        isFollowing: Boolean(isFollowing),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load follow state' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const targetId = String(id || '').trim();
    if (!targetId) return NextResponse.json({ error: 'Invalid user' }, { status: 400 });

    const me = await getMeId(req);
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (me === targetId) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });

    await (prisma as any).userFollow.upsert({
      where: { followerId_followingId: { followerId: me, followingId: targetId } },
      update: {},
      create: { followerId: me, followingId: targetId },
    });

    const followersCount = await (prisma as any).userFollow.count({ where: { followingId: targetId } });
    return NextResponse.json({ ok: true, followersCount, isFollowing: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to follow' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const targetId = String(id || '').trim();
    if (!targetId) return NextResponse.json({ error: 'Invalid user' }, { status: 400 });

    const me = await getMeId(req);
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (me === targetId) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });

    await (prisma as any).userFollow.deleteMany({ where: { followerId: me, followingId: targetId } });

    const followersCount = await (prisma as any).userFollow.count({ where: { followingId: targetId } });
    return NextResponse.json({ ok: true, followersCount, isFollowing: false }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to unfollow' }, { status: 500 });
  }
}
