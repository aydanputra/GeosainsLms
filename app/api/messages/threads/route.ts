import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

const db = prisma as any;

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizePair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return null;
  return v;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 50));

    const threads = (await db.directThread.findMany({
      where: { OR: [{ userAId: String(user.id) }, { userBId: String(user.id) }] },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        userAId: true,
        userBId: true,
        lastMessageAt: true,
        lastMessageText: true,
        lastMessageSenderId: true,
        unreadCountA: true,
        unreadCountB: true,
        userA: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        userB: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
      },
    })) as any[];

    const me = String(user.id);
    const mapped = threads.map((t: any) => {
      const isA = t.userAId === me;
      const peer = isA ? t.userB : t.userA;
      const unreadCount = isA ? t.unreadCountA : t.unreadCountB;
      return {
        id: t.id,
        peer: {
          id: peer.id,
          name: peer.name || peer.email,
          email: peer.email,
          avatarUrl: normalizeAvatarUrl(peer.avatarUrl),
          role: peer.role,
        },
        lastMessageAt: t.lastMessageAt,
        lastMessageText: t.lastMessageText,
        lastMessageSenderId: t.lastMessageSenderId,
        unreadCount,
      };
    });

    const threadIds = mapped.map((t: any) => t.id);
    const contextRows =
      threadIds.length > 0
        ? await db.directMessage.findMany({
            where: {
              threadId: { in: threadIds },
              body: { contains: 'COMMENT_ID:' },
            },
            select: { threadId: true },
            distinct: ['threadId'],
          })
        : [];
    const contextThreadIds = new Set<string>(contextRows.map((r: any) => String(r.threadId)));

    const mappedWithContext = mapped.map((t: any) => ({
      ...t,
      isContextThread: contextThreadIds.has(String(t.id)),
    }));

    const totalUnread = mappedWithContext.reduce((sum: number, t: any) => sum + (Number(t.unreadCount || 0) || 0), 0);
    return NextResponse.json({ threads: mappedWithContext, unreadCount: totalUnread }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load threads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { peerId?: unknown };
    const peerId = typeof body.peerId === 'string' ? body.peerId.trim() : '';
    if (!peerId) return NextResponse.json({ error: 'peerId is required' }, { status: 400 });
    if (peerId === String(user.id)) return NextResponse.json({ error: 'Invalid peer' }, { status: 400 });

    const peer = await db.user.findUnique({
      where: { id: peerId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });
    if (!peer) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const pair = normalizePair(String(user.id), peerId);

    const thread = await db.directThread.upsert({
      where: { userAId_userBId: pair },
      update: {},
      create: {
        ...pair,
        lastReadAtA: new Date(),
        lastReadAtB: new Date(),
        unreadCountA: 0,
        unreadCountB: 0,
      },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        lastMessageAt: true,
        lastMessageText: true,
        lastMessageSenderId: true,
        unreadCountA: true,
        unreadCountB: true,
      },
    });

    const me = String(user.id);
    const isA = thread.userAId === me;
    return NextResponse.json(
      {
        thread: {
          id: thread.id,
          peer: {
            id: peer.id,
            name: peer.name || peer.email,
            email: peer.email,
            avatarUrl: normalizeAvatarUrl(peer.avatarUrl),
            role: peer.role,
          },
          lastMessageAt: thread.lastMessageAt,
          lastMessageText: thread.lastMessageText,
          lastMessageSenderId: thread.lastMessageSenderId,
          unreadCount: isA ? thread.unreadCountA : thread.unreadCountB,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create thread' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = String(user.id);
    const scopeRaw = String(req.nextUrl.searchParams.get('scope') || '').trim().toLowerCase();
    const scope = scopeRaw === 'comments' || scopeRaw === 'dm' || scopeRaw === 'all' || scopeRaw === 'admin' ? scopeRaw : 'dm';

    const result = await db.$transaction(async (tx: any) => {
      const myThreads = await tx.directThread.findMany({
        where: { OR: [{ userAId: me }, { userBId: me }] },
        select: {
          id: true,
          userAId: true,
          userBId: true,
          userA: { select: { role: true } },
          userB: { select: { role: true } },
        },
      });

      const threadIds = myThreads.map((t: any) => String(t.id));
      const adminThreadIds = myThreads
        .filter((t: any) => {
          const isA = String(t.userAId) === me;
          const peerRole = String((isA ? t.userB?.role : t.userA?.role) || '').toUpperCase();
          return peerRole === 'ADMIN';
        })
        .map((t: any) => String(t.id));

      const targetThreadIds = scope === 'admin' ? adminThreadIds : threadIds;

      if (targetThreadIds.length === 0) {
        const role = String((user as any)?.role || '').toUpperCase();
        const shouldClearCourseComments = scope === 'comments' || scope === 'all';
        const isMentorOrAdmin = role === 'MENTOR' || role === 'ADMIN';

        const deletedCourseComments = shouldClearCourseComments
          ? await tx.courseComment.deleteMany({
              where: isMentorOrAdmin
                ? {
                    course: {
                      OR: [
                        { instructorId: me },
                        {
                          coInstructors: {
                            some: { userId: me },
                          },
                        },
                      ],
                    },
                  }
                : { userId: me },
            })
          : { count: 0 };

        return { deletedMessages: 0, deletedThreads: 0, updatedThreads: 0, deletedCourseComments: deletedCourseComments.count };
      }

      const messageWhere =
        scope === 'comments'
          ? { body: { contains: 'COMMENT_ID:' } }
          : scope === 'dm'
            ? { NOT: { body: { contains: 'COMMENT_ID:' } } }
            : {};

      const affectedThreadIds =
        scope === 'all'
          ? threadIds
          : scope === 'admin'
            ? adminThreadIds
            : (
                await tx.directMessage.findMany({
                  where: { threadId: { in: targetThreadIds }, ...(messageWhere as any) },
                  select: { threadId: true },
                  distinct: ['threadId'],
                })
              ).map((r: any) => String(r.threadId));

      const deleted = await tx.directMessage.deleteMany({
        where: { threadId: { in: targetThreadIds }, ...(messageWhere as any) },
      });

      const now = new Date();
      let deletedThreads = 0;
      let updatedThreads = 0;

      for (const threadId of affectedThreadIds) {
        const last = await tx.directMessage.findFirst({
          where: { threadId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, body: true, senderId: true },
        });

        if (!last) {
          await tx.directThread.delete({ where: { id: threadId } });
          deletedThreads += 1;
          continue;
        }

        await tx.directThread.update({
          where: { id: threadId },
          data: {
            lastMessageAt: last.createdAt,
            lastMessageText: String(last.body || '').slice(0, 300),
            lastMessageSenderId: String(last.senderId || ''),
            lastReadAtA: now,
            lastReadAtB: now,
            unreadCountA: 0,
            unreadCountB: 0,
          },
        });
        updatedThreads += 1;
      }

      const role = String((user as any)?.role || '').toUpperCase();
      const shouldClearCourseComments = scope === 'comments' || scope === 'all';
      const isMentorOrAdmin = role === 'MENTOR' || role === 'ADMIN';

      const deletedCourseComments = shouldClearCourseComments
        ? await tx.courseComment.deleteMany({
            where: isMentorOrAdmin
              ? {
                  course: {
                    OR: [
                      { instructorId: me },
                      {
                        coInstructors: {
                          some: { userId: me },
                        },
                      },
                    ],
                  },
                }
              : { userId: me },
          })
        : { count: 0 };

      return { deletedMessages: deleted.count, deletedThreads, updatedThreads, deletedCourseComments: deletedCourseComments.count };
    });

    return NextResponse.json({ ok: true, scope, ...result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to clear history' }, { status: 500 });
  }
}
