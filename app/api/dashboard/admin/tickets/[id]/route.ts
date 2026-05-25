import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

type TicketStatus = 'OPEN' | 'CLOSED';

function computeTicketState(logs: Array<{ action: string; metadata: any; createdAt: Date }>): { status: TicketStatus; assignedToAdminId: string | null } {
  let status: TicketStatus = 'OPEN';
  let assignedToAdminId: string | null = null;

  for (const row of logs) {
    const action = String(row.action || '').toUpperCase();
    const meta = row.metadata || {};
    if (action === 'ADMIN_TICKET_CREATE') {
      status = 'OPEN';
      assignedToAdminId = null;
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

  return { status, assignedToAdminId };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 });

    const actorId = String(actor.id);
    const actorDb = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
    const isSuperAdmin = Boolean(actorDb?.isSuperAdmin);

    const thread = await (prisma as any).directThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        userA: { select: { id: true, role: true } },
        userB: { select: { id: true, role: true } },
      },
    });
    if (!thread?.id) return NextResponse.json({ error: 'Ticket tidak ditemukan' }, { status: 404 });

    const aRole = String(thread.userA?.role || '').toUpperCase();
    const bRole = String(thread.userB?.role || '').toUpperCase();
    const isAdminTicket = (aRole === 'ADMIN' && bRole !== 'ADMIN') || (bRole === 'ADMIN' && aRole !== 'ADMIN');
    if (!isAdminTicket) return NextResponse.json({ error: 'Bukan ticket admin' }, { status: 400 });

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

    const payload = (await req.json().catch(() => ({}))) as { action?: unknown; assignedToAdminId?: unknown };
    const action = typeof payload.action === 'string' ? payload.action.trim().toUpperCase() : '';

    const canAct = (state.assignedToAdminId ? state.assignedToAdminId === actorId : false) || isSuperAdmin;

    if (action === 'CLAIM') {
      if (state.status !== 'OPEN') return NextResponse.json({ error: 'Ticket sudah ditutup' }, { status: 400 });
      if (state.assignedToAdminId && state.assignedToAdminId !== actorId && !isSuperAdmin) {
        return NextResponse.json({ error: 'Ticket sudah diambil admin lain' }, { status: 403 });
      }
      await writeAuditLog({
        req,
        actor: { id: actorId, role: actor.role },
        action: 'ADMIN_TICKET_CLAIM',
        entityType: 'DirectThread',
        entityId: threadId,
        metadata: { assignedToAdminId: actorId },
      });
      return NextResponse.json({ ok: true, status: 'OPEN', assignedToAdminId: actorId }, { status: 200 });
    }

    if (action === 'ASSIGN') {
      if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (state.status !== 'OPEN') return NextResponse.json({ error: 'Ticket sudah ditutup' }, { status: 400 });
      const assignedToAdminId = typeof payload.assignedToAdminId === 'string' ? payload.assignedToAdminId.trim() : '';
      if (!assignedToAdminId) return NextResponse.json({ error: 'assignedToAdminId wajib' }, { status: 400 });
      const target = await prisma.user.findUnique({ where: { id: assignedToAdminId }, select: { id: true, role: true } });
      if (!target?.id || String(target.role) !== 'ADMIN') return NextResponse.json({ error: 'Target bukan admin' }, { status: 400 });
      await writeAuditLog({
        req,
        actor: { id: actorId, role: actor.role },
        action: 'ADMIN_TICKET_ASSIGN',
        entityType: 'DirectThread',
        entityId: threadId,
        metadata: { assignedToAdminId, assignedByAdminId: actorId },
      });
      return NextResponse.json({ ok: true, status: 'OPEN', assignedToAdminId }, { status: 200 });
    }

    if (action === 'CLOSE') {
      if (!canAct) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (state.status === 'CLOSED') return NextResponse.json({ ok: true, status: 'CLOSED', assignedToAdminId: state.assignedToAdminId }, { status: 200 });
      await writeAuditLog({
        req,
        actor: { id: actorId, role: actor.role },
        action: 'ADMIN_TICKET_CLOSE',
        entityType: 'DirectThread',
        entityId: threadId,
        metadata: { closedByAdminId: actorId },
      });
      return NextResponse.json({ ok: true, status: 'CLOSED', assignedToAdminId: state.assignedToAdminId }, { status: 200 });
    }

    if (action === 'REOPEN') {
      if (!canAct) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (state.status === 'OPEN') return NextResponse.json({ ok: true, status: 'OPEN', assignedToAdminId: state.assignedToAdminId }, { status: 200 });
      await writeAuditLog({
        req,
        actor: { id: actorId, role: actor.role },
        action: 'ADMIN_TICKET_REOPEN',
        entityType: 'DirectThread',
        entityId: threadId,
        metadata: { reopenedByAdminId: actorId },
      });
      return NextResponse.json({ ok: true, status: 'OPEN', assignedToAdminId: state.assignedToAdminId }, { status: 200 });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update ticket' }, { status: 500 });
  }
}
