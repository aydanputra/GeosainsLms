import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { finalizeOrderPaid } from '@/modules/payment/api/service';
import { writeAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await verifyToken(token);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { orderId } = await params;
    const id = String(orderId || '').trim();
    if (!id) return NextResponse.json({ error: 'Order tidak valid' }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
    const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (action !== 'APPROVE' && action !== 'REJECT') return NextResponse.json({ error: 'action tidak valid' }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
        total: true,
        manualPaymentProofUrl: true,
        manualPaymentStatus: true,
      },
    });
    if (!order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });

    const now = new Date();

    if (action === 'REJECT') {
      const updated = await prisma.order.update({
        where: { id },
        data: {
          manualPaymentStatus: 'REJECTED',
          manualPaymentNote: note || null,
          manualPaymentReviewedAt: now,
          manualPaymentReviewedById: String(admin.id),
        },
      });

      await prisma.notification.create({
        data: {
          userId: String(order.userId),
          title: 'Pembayaran Ditolak',
          message: [`Order: ${id}`, note ? `Catatan: ${note}` : '', `LINK:/dashboard/student/orders?orderId=${encodeURIComponent(id)}`]
            .filter(Boolean)
            .join('\n'),
          read: false,
        },
      });

      await writeAuditLog({
        req,
        actor: { id: String(admin.id), role: admin.role },
        action: 'ORDER_MANUAL_PAYMENT_REJECT',
        entityType: 'Order',
        entityId: id,
        metadata: { note: note || null },
      });

      return NextResponse.json({ ok: true, order: updated }, { status: 200 });
    }

    await finalizeOrderPaid(id);
    const updated = await prisma.order.update({
      where: { id },
      data: {
        manualPaymentStatus: 'APPROVED',
        manualPaymentNote: note || null,
        manualPaymentReviewedAt: now,
        manualPaymentReviewedById: String(admin.id),
      },
    });

    await prisma.notification.create({
      data: {
        userId: String(order.userId),
        title: 'Pembayaran Dikonfirmasi',
        message: [`Order: ${id}`, `Total: IDR ${Number(order.total || 0).toLocaleString('id-ID')}`, note ? `Catatan: ${note}` : '', `LINK:/dashboard/student/orders?orderId=${encodeURIComponent(id)}`]
          .filter(Boolean)
          .join('\n'),
        read: false,
      },
    });

    await writeAuditLog({
      req,
      actor: { id: String(admin.id), role: admin.role },
      action: 'ORDER_MANUAL_PAYMENT_APPROVE',
      entityType: 'Order',
      entityId: id,
      metadata: { proofUrl: order.manualPaymentProofUrl || null, note: note || null },
    });

    return NextResponse.json({ ok: true, order: updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memproses order' }, { status: 500 });
  }
}
