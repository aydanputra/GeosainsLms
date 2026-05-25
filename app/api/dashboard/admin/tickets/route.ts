import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

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

type TicketStatus = 'OPEN' | 'CLOSED';

function computeTicketState(
  logs: Array<{ action: string; metadata: any; createdAt: Date }>
): { status: TicketStatus; assignedToAdminId: string | null; category: string | null } {
  let status: TicketStatus = 'OPEN';
  let assignedToAdminId: string | null = null;
  let category: string | null = null;

  for (const row of logs) {
    const action = String(row.action || '').toUpperCase();
    const meta = row.metadata || {};

    if (action === 'ADMIN_TICKET_CREATE') {
      const c = typeof meta?.category === 'string' ? meta.category.trim() : '';
      if (c) category = c;
      status = 'OPEN';
      assignedToAdminId = null;
    }

    if (action === 'ADMIN_TICKET_CLOSE') {
      status = 'CLOSED';
    }
    if (action === 'ADMIN_TICKET_REOPEN') {
      status = 'OPEN';
      if (meta?.clearAssignee) assignedToAdminId = null;
    }

    if (action === 'ADMIN_TICKET_ASSIGN' || action === 'ADMIN_TICKET_CLAIM') {
      const id = typeof meta?.assignedToAdminId === 'string' ? meta.assignedToAdminId.trim() : '';
      if (id) assignedToAdminId = id;
    }
  }

  return { status, assignedToAdminId, category };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const viewRaw = String(req.nextUrl.searchParams.get('view') || '').trim().toLowerCase();
    const view = viewRaw === 'queue' || viewRaw === 'mine' || viewRaw === 'open' || viewRaw === 'closed' || viewRaw === 'all' ? viewRaw : 'queue';
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(200, rawLimit ?? 50));

    const baseThreads = (await db.directThread.findMany({
      where: {
        OR: [
          { userA: { role: 'ADMIN' }, userB: { role: { not: 'ADMIN' } } },
          { userB: { role: 'ADMIN' }, userA: { role: { not: 'ADMIN' } } },
        ],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 400,
      select: {
        id: true,
        userAId: true,
        userBId: true,
        lastMessageAt: true,
        lastMessageText: true,
        lastMessageSenderId: true,
        createdAt: true,
        userA: { select: { id: true, name: true, email: true, role: true, isSuperAdmin: true } },
        userB: { select: { id: true, name: true, email: true, role: true, isSuperAdmin: true } },
      },
    })) as any[];

    const threadIds = baseThreads.map((t: any) => String(t.id));
    const auditRows =
      threadIds.length > 0
        ? await prisma.auditLog.findMany({
            where: {
              entityType: 'DirectThread',
              entityId: { in: threadIds },
              action: { in: ['ADMIN_TICKET_CREATE', 'ADMIN_TICKET_CLAIM', 'ADMIN_TICKET_ASSIGN', 'ADMIN_TICKET_CLOSE', 'ADMIN_TICKET_REOPEN'] },
            },
            orderBy: { createdAt: 'asc' },
            take: 5000,
            select: { entityId: true, action: true, metadata: true, createdAt: true },
          })
        : [];

    const logsByThreadId = new Map<string, Array<{ action: string; metadata: any; createdAt: Date }>>();
    for (const row of auditRows) {
      const id = row.entityId ? String(row.entityId) : '';
      if (!id) continue;
      const list = logsByThreadId.get(id) || [];
      list.push({ action: row.action, metadata: row.metadata, createdAt: row.createdAt });
      logsByThreadId.set(id, list);
    }

    const me = String(actor.id);
    const rows = baseThreads
      .map((t: any) => {
        const aRole = String(t.userA?.role || '').toUpperCase();
        const bRole = String(t.userB?.role || '').toUpperCase();
        const customer = aRole === 'ADMIN' ? t.userB : t.userA;
        const state = computeTicketState(logsByThreadId.get(String(t.id)) || []);
        const assignedToAdminId = state.assignedToAdminId;
        const isMine = assignedToAdminId ? assignedToAdminId === me : false;
        const isQueue = state.status === 'OPEN' && !assignedToAdminId;
        const isOpen = state.status === 'OPEN';
        const isClosed = state.status === 'CLOSED';

        const shouldInclude =
          view === 'all'
            ? true
            : view === 'queue'
              ? isQueue
              : view === 'mine'
                ? isMine
                : view === 'open'
                  ? isOpen
                  : isClosed;

        return shouldInclude
          ? {
              id: String(t.id),
              customer: {
                id: String(customer?.id || ''),
                name: String(customer?.name || customer?.email || ''),
                email: String(customer?.email || ''),
                role: String(customer?.role || ''),
              },
              status: state.status,
              category: state.category,
              assignedToAdminId: assignedToAdminId,
              lastMessageAt: t.lastMessageAt ? new Date(t.lastMessageAt).toISOString() : null,
              lastMessageText: typeof t.lastMessageText === 'string' ? t.lastMessageText : null,
              lastMessageSenderId: typeof t.lastMessageSenderId === 'string' ? t.lastMessageSenderId : null,
              createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
            }
          : null;
      })
      .filter(Boolean)
      .slice(0, limit);

    const adminIds = Array.from(
      new Set(
        rows
          .map((r: any) => (typeof r.assignedToAdminId === 'string' ? r.assignedToAdminId : null))
          .filter(Boolean) as string[]
      )
    );
    const admins =
      adminIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, email: true, isSuperAdmin: true, role: true } })
        : [];
    const adminById = new Map(admins.map((a) => [String(a.id), a] as const));

    const withAssignee = rows.map((r: any) => {
      const assignee = r.assignedToAdminId ? adminById.get(String(r.assignedToAdminId)) : null;
      return {
        ...r,
        assignee: assignee
          ? { id: String(assignee.id), name: String(assignee.name || assignee.email || ''), email: String(assignee.email || ''), isSuperAdmin: Boolean((assignee as any).isSuperAdmin) }
          : null,
      };
    });

    return NextResponse.json({ tickets: withAssignee, view }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { userId?: unknown; message?: unknown; category?: unknown };
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!userId) return NextResponse.json({ error: 'userId wajib' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    if (message.length > 4000) return NextResponse.json({ error: 'Pesan terlalu panjang' }, { status: 400 });

    const me = String(actor.id);
    const peer = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!peer?.id) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    if (String(peer.role || '').toUpperCase() === 'ADMIN') return NextResponse.json({ error: 'Tidak bisa membuat tiket ke admin' }, { status: 400 });

    const pair = normalizePair(me, userId);
    const now = new Date();

    const thread = await db.directThread.upsert({
      where: { userAId_userBId: pair },
      update: {},
      create: {
        ...pair,
        lastReadAtA: now,
        lastReadAtB: now,
        unreadCountA: 0,
        unreadCountB: 0,
      },
      select: { id: true, userAId: true, userBId: true },
    });

    const isA = String(thread.userAId) === me;
    await db.directMessage.create({ data: { threadId: thread.id, senderId: me, body: message } });
    await db.directThread.update({
      where: { id: thread.id },
      data: isA
        ? { lastMessageAt: now, lastMessageText: message.slice(0, 300), lastMessageSenderId: me, lastReadAtA: now, unreadCountB: { increment: 1 } }
        : { lastMessageAt: now, lastMessageText: message.slice(0, 300), lastMessageSenderId: me, lastReadAtB: now, unreadCountA: { increment: 1 } },
    });

    await writeAuditLog({
      req,
      actor: { id: me, role: actor.role },
      action: 'ADMIN_TICKET_CREATE',
      entityType: 'DirectThread',
      entityId: String(thread.id),
      metadata: { customerUserId: userId, category: category || null, assignedToAdminId: me, status: 'OPEN' },
    });
    await writeAuditLog({
      req,
      actor: { id: me, role: actor.role },
      action: 'ADMIN_TICKET_CLAIM',
      entityType: 'DirectThread',
      entityId: String(thread.id),
      metadata: { assignedToAdminId: me },
    });

    return NextResponse.json({ ticketId: String(thread.id) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create ticket' }, { status: 500 });
  }
}
