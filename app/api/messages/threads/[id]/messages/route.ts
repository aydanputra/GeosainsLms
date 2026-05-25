import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { writeAuditLog } from '@/utils/audit';

const db = prisma as any;

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseStructuredMessage(message: string): { text: string; commentId: string | null } {
  const lines = String(message || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let commentId: string | null = null;
  const kept: string[] = [];

  for (const raw of lines) {
    const lower = raw.toLowerCase();
    if (lower.startsWith('comment_id:')) {
      const candidate = raw.slice('COMMENT_ID:'.length).trim();
      if (candidate) commentId = candidate;
      continue;
    }
    if (lower.startsWith('link:')) continue;
    if (lower.startsWith('kursus:')) continue;
    if (lower.startsWith('slug:')) continue;
    if (lower.startsWith('user:')) continue;
    kept.push(raw);
  }

  return { text: kept.join('\n'), commentId };
}

type TicketStatus = 'OPEN' | 'CLOSED';

function computeTicketState(
  logs: Array<{ action: string; metadata: any; createdAt: Date }>
): { status: TicketStatus; assignedToAdminId: string | null; category: string | null; lastTicketCreatedAt: Date | null } {
  let status: TicketStatus = 'OPEN';
  let assignedToAdminId: string | null = null;
  let category: string | null = null;
  let lastTicketCreatedAt: Date | null = null;
  for (const row of logs) {
    const action = String(row.action || '').toUpperCase();
    const meta = row.metadata || {};
    if (action === 'ADMIN_TICKET_CREATE') {
      status = 'OPEN';
      assignedToAdminId = null;
      const c = typeof meta?.category === 'string' ? meta.category.trim() : '';
      if (c) category = c;
      lastTicketCreatedAt = row.createdAt instanceof Date ? row.createdAt : null;
    }
    if (action === 'ADMIN_TICKET_CLOSE') status = 'CLOSED';
    if (action === 'ADMIN_TICKET_REOPEN') {
      status = 'OPEN';
      if (meta?.clearAssignee) assignedToAdminId = null;
    }
    if (action === 'ADMIN_TICKET_ASSIGN' || action === 'ADMIN_TICKET_CLAIM') {
      const id = typeof meta?.assignedToAdminId === 'string' ? meta.assignedToAdminId.trim() : '';
      if (id) assignedToAdminId = id;
    }
  }
  return { status, assignedToAdminId, category, lastTicketCreatedAt };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: threadId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = String(user.id);

    const thread = await db.directThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        userA: { select: { id: true, role: true } },
        userB: { select: { id: true, role: true } },
      },
    });
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const aRole = String(thread.userA?.role || '').toUpperCase();
    const bRole = String(thread.userB?.role || '').toUpperCase();
    const isAdminTicket = (aRole === 'ADMIN' && bRole !== 'ADMIN') || (bRole === 'ADMIN' && aRole !== 'ADMIN');
    const isParticipant = thread.userAId === me || thread.userBId === me;
    const isAdminViewer = String((user as any)?.role || '').toUpperCase() === 'ADMIN';
    if (!isParticipant && !(isAdminViewer && isAdminTicket)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 50));
    const cursor = req.nextUrl.searchParams.get('cursor');

    const rows = (await db.directMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor
        ? {
            cursor: { id: String(cursor) },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderId: true,
        sender: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
      },
    })) as any[];

    const list = rows
      .slice()
      .reverse()
      .map((m: any) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        sender: {
          id: m.sender.id,
          name: m.sender.name || m.sender.email,
          email: m.sender.email,
          avatarUrl: m.sender.avatarUrl,
          role: m.sender.role,
        },
      }));

    const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id || null : null;

    let ticketMeta: any = null;
    if (isAdminTicket) {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'DirectThread',
          entityId: threadId,
          action: { in: ['ADMIN_TICKET_CREATE', 'ADMIN_TICKET_CLAIM', 'ADMIN_TICKET_ASSIGN', 'ADMIN_TICKET_CLOSE', 'ADMIN_TICKET_REOPEN'] },
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: { action: true, metadata: true, createdAt: true },
      });
      const state = computeTicketState(logs as any);
      ticketMeta = {
        status: state.status,
        assignedToAdminId: state.assignedToAdminId,
        category: state.category,
        lastTicketCreatedAt: state.lastTicketCreatedAt ? state.lastTicketCreatedAt.toISOString() : null,
      };
    }

    if (isParticipant) {
      const now = new Date();
      if (thread.userAId === me) {
        await db.directThread.update({ where: { id: threadId }, data: { lastReadAtA: now, unreadCountA: 0 } });
      } else {
        await db.directThread.update({ where: { id: threadId }, data: { lastReadAtB: now, unreadCountB: 0 } });
      }
    }

    return NextResponse.json({ messages: list, nextCursor, ticket: ticketMeta }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: threadId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = String(user.id);
    const isAdminSender = String((user as any)?.role || '').toUpperCase() === 'ADMIN';
    const actorDb = isAdminSender ? await prisma.user.findUnique({ where: { id: me }, select: { isSuperAdmin: true } }) : null;
    const isSuperAdmin = Boolean((actorDb as any)?.isSuperAdmin);

    const body = (await req.json().catch(() => ({}))) as { message?: unknown };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 1) return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    if (message.length > 4000) return NextResponse.json({ error: 'Pesan terlalu panjang' }, { status: 400 });

    const thread = await db.directThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        userA: { select: { id: true, role: true } },
        userB: { select: { id: true, role: true } },
      },
    });
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const aRole = String(thread.userA?.role || '').toUpperCase();
    const bRole = String(thread.userB?.role || '').toUpperCase();
    const isAdminTicket = (aRole === 'ADMIN' && bRole !== 'ADMIN') || (bRole === 'ADMIN' && aRole !== 'ADMIN');
    const isParticipant = thread.userAId === me || thread.userBId === me;
    if (!isParticipant && !(isAdminSender && isAdminTicket)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const isA = thread.userAId === me;

    if (isAdminTicket) {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'DirectThread',
          entityId: threadId,
          action: { in: ['ADMIN_TICKET_CREATE', 'ADMIN_TICKET_CLAIM', 'ADMIN_TICKET_ASSIGN', 'ADMIN_TICKET_CLOSE', 'ADMIN_TICKET_REOPEN'] },
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: { action: true, metadata: true, createdAt: true },
      });
      const state = computeTicketState(logs as any);
      const assignedTo = state.assignedToAdminId;

      if (!isAdminSender) {
        if (state.status === 'CLOSED') {
          await writeAuditLog({
            req,
            actor: { id: me, role: (user as any).role },
            action: 'ADMIN_TICKET_CREATE',
            entityType: 'DirectThread',
            entityId: threadId,
            metadata: { customerUserId: me, category: 'OTHER', status: 'OPEN' },
          });
        }
      } else {
        if (state.status === 'CLOSED') {
          await writeAuditLog({
            req,
            actor: { id: me, role: (user as any).role },
            action: 'ADMIN_TICKET_REOPEN',
            entityType: 'DirectThread',
            entityId: threadId,
            metadata: { reopenedByAdminId: me },
          });
        }
        if (assignedTo && assignedTo !== me && !isSuperAdmin) {
          return NextResponse.json({ error: 'Ticket sudah ditangani admin lain', code: 'NOT_ASSIGNED' }, { status: 403 });
        }
        if (!assignedTo) {
          await writeAuditLog({
            req,
            actor: { id: me, role: (user as any).role },
            action: 'ADMIN_TICKET_CLAIM',
            entityType: 'DirectThread',
            entityId: threadId,
            metadata: { assignedToAdminId: me },
          });
        }
      }
    }

    const created = await db.directMessage.create({
      data: { threadId, senderId: me, body: message },
      select: {
        id: true,
        body: true,
        createdAt: true,
        sender: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
      },
    });

    if (isParticipant) {
      await db.directThread.update({
        where: { id: threadId },
        data: isA
          ? {
              lastMessageAt: now,
              lastMessageText: message.slice(0, 300),
              lastMessageSenderId: me,
              lastReadAtA: now,
              unreadCountB: { increment: 1 },
            }
          : {
              lastMessageAt: now,
              lastMessageText: message.slice(0, 300),
              lastMessageSenderId: me,
              lastReadAtB: now,
              unreadCountA: { increment: 1 },
            },
      });
    } else {
      const customerId = aRole === 'ADMIN' ? String(thread.userBId) : String(thread.userAId);
      const incA = customerId === String(thread.userAId);
      await db.directThread.update({
        where: { id: threadId },
        data: incA
          ? { lastMessageAt: now, lastMessageText: message.slice(0, 300), lastMessageSenderId: me, unreadCountA: { increment: 1 } }
          : { lastMessageAt: now, lastMessageText: message.slice(0, 300), lastMessageSenderId: me, unreadCountB: { increment: 1 } },
      });
    }

    const meta = parseStructuredMessage(message);
    if (meta.commentId) {
      const canReply = await db.courseComment.findUnique({
        where: { id: meta.commentId },
        select: {
          id: true,
          course: {
            select: {
              instructorId: true,
              coInstructors: { select: { userId: true } },
            },
          },
        },
      });

      const coList = Array.isArray(canReply?.course?.coInstructors) ? canReply.course.coInstructors : [];
      const isInstructor =
        Boolean(canReply?.course) &&
        (String(canReply?.course?.instructorId || '') === me || coList.some((x: any) => String(x.userId) === me));

      if (canReply && isInstructor) {
        const replyBody = meta.text.trim();
        if (replyBody) {
          await db.courseCommentReply.create({
            data: { commentId: meta.commentId, userId: me, body: replyBody },
          });
        }
      }
    }

    return NextResponse.json(
      {
        message: {
          id: created.id,
          body: created.body,
          createdAt: created.createdAt,
          sender: {
            id: created.sender.id,
            name: created.sender.name || created.sender.email,
            email: created.sender.email,
            avatarUrl: created.sender.avatarUrl,
            role: created.sender.role,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
