import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { writeAuditLog } from '@/utils/audit';

const db = prisma as any;

type TicketStatus = 'OPEN' | 'CLOSED';

function computeTicketState(logs: Array<{ action: string; metadata: any; createdAt: Date }>): { status: TicketStatus } {
  let status: TicketStatus = 'OPEN';
  for (const row of logs) {
    const action = String(row.action || '').toUpperCase();
    if (action === 'ADMIN_TICKET_CREATE') status = 'OPEN';
    if (action === 'ADMIN_TICKET_CLOSE') status = 'CLOSED';
    if (action === 'ADMIN_TICKET_REOPEN') status = 'OPEN';
  }
  return { status };
}

function normalizePair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

function sanitizeDirectMessage(input: string) {
  const lines = String(input || '')
    .split('\n')
    .map((l) => l.trimEnd());
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const lower = line.toLowerCase();
    if (lower.startsWith('kursus:')) continue;
    if (lower.startsWith('produk:')) continue;
    if (lower.startsWith('slug:')) continue;
    if (lower.startsWith('comment_id:')) continue;
    if (lower.startsWith('link:')) continue;
    if (lower.startsWith('user:')) continue;
    kept.push(raw);
  }
  return kept.join('\n').trim();
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = String(user.id);
    const myRole = String((user as any)?.role || '').toUpperCase();

    const body = (await req.json().catch(() => ({}))) as { toUserId?: unknown; message?: unknown; topic?: unknown };
    const toUserId = typeof body.toUserId === 'string' ? body.toUserId.trim() : '';
    const messageRaw = typeof body.message === 'string' ? body.message : '';
    const message = sanitizeDirectMessage(messageRaw);
    const topic = typeof body.topic === 'string' ? body.topic.trim().toUpperCase() : '';
    if (!toUserId) return NextResponse.json({ error: 'toUserId is required' }, { status: 400 });
    if (toUserId === me) return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
    if (message.length < 1) return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    if (message.length > 4000) return NextResponse.json({ error: 'Pesan terlalu panjang' }, { status: 400 });
    if (topic && topic !== 'PURCHASE' && topic !== 'PRODUCT_SERVICE' && topic !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Topik tidak valid' }, { status: 400 });
    }

    const recipient = await db.user.findUnique({
      where: { id: toUserId },
      select: { id: true, role: true },
    });
    if (!recipient) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const recipientRole = String(recipient.role || '').toUpperCase();

    const pair = normalizePair(me, toUserId);
    const now = new Date();
    const isA = pair.userAId === me;

    const existing = await db.directThread.findUnique({
      where: { userAId_userBId: pair },
      select: { id: true },
    });

    const thread = existing
      ? await db.directThread.findUnique({
          where: { id: existing.id },
          select: { id: true, userAId: true, userBId: true },
        })
      : await db.directThread.create({
          data: {
            ...pair,
            lastReadAtA: now,
            lastReadAtB: now,
            unreadCountA: 0,
            unreadCountB: 0,
          },
          select: { id: true, userAId: true, userBId: true },
        });

    const isSupportTicket = myRole !== 'ADMIN' && recipientRole === 'ADMIN';
    if (isSupportTicket) {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: 'DirectThread',
          entityId: String(thread.id),
          action: { in: ['ADMIN_TICKET_CREATE', 'ADMIN_TICKET_CLOSE', 'ADMIN_TICKET_REOPEN'] },
        },
        orderBy: { createdAt: 'asc' },
        take: 300,
        select: { action: true, metadata: true, createdAt: true },
      });
      const state = computeTicketState(logs as any);
      const hasCreateLog = logs.some((l: any) => String(l.action || '').toUpperCase() === 'ADMIN_TICKET_CREATE');
      const shouldCreateTicket = !hasCreateLog || state.status === 'CLOSED';
      if (shouldCreateTicket) {
        const category =
          topic === 'PURCHASE'
            ? 'Pembelian'
            : topic === 'PRODUCT_SERVICE'
              ? 'Produk & Layanan'
              : topic === 'TECH_SUPPORT'
                ? 'Technical Support'
                : 'OTHER';
        await writeAuditLog({
          req,
          actor: { id: me, role: (user as any).role },
          action: 'ADMIN_TICKET_CREATE',
          entityType: 'DirectThread',
          entityId: String(thread.id),
          metadata: { customerUserId: me, category, status: 'OPEN' },
        });
      }
    }

    await db.directMessage.create({ data: { threadId: thread.id, senderId: me, body: message } });

    await db.directThread.update({
      where: { id: thread.id },
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

    return NextResponse.json({ ok: true, threadId: thread.id }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send' }, { status: 500 });
  }
}
