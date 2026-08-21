import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { finalizeOrderPaid } from '@/modules/payment/api/service';
import { writeAuditLog } from '@/utils/audit';
import { sendStudentManualPaymentReviewEmail } from '@/utils/email-notifications';
import { getAppUrl } from '@/modules/core/utils/appUrl';

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
        manualPaymentProofMediaId: true,
        manualPaymentStatus: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    if (String(order.status || '').toUpperCase() !== 'PENDING') {
      return NextResponse.json({ error: 'Order sudah tidak bisa direview' }, { status: 400 });
    }
    if (String(order.manualPaymentStatus || '').toUpperCase() !== 'SUBMITTED') {
      return NextResponse.json({ error: 'Bukti pembayaran belum diajukan atau sudah diproses' }, { status: 400 });
    }
    if (!order.manualPaymentProofMediaId && !order.manualPaymentProofUrl) {
      return NextResponse.json({ error: 'Bukti pembayaran tidak ditemukan' }, { status: 400 });
    }

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

      if (order.user?.email) {
        await sendStudentManualPaymentReviewEmail({
          to: order.user.email,
          name: order.user.name || null,
          orderId: id,
          total: Number(order.total || 0),
          approved: false,
          note: note || null,
          actionUrl: `${getAppUrl(req.headers)}/dashboard/student/orders?orderId=${encodeURIComponent(id)}`,
        });
      }

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

    if (order.user?.email) {
      await sendStudentManualPaymentReviewEmail({
        to: order.user.email,
        name: order.user.name || null,
        orderId: id,
        total: Number(order.total || 0),
        approved: true,
        note: note || null,
        actionUrl: `${getAppUrl(req.headers)}/dashboard/student/orders?orderId=${encodeURIComponent(id)}`,
      });
    }

    await writeAuditLog({
      req,
      actor: { id: String(admin.id), role: admin.role },
      action: 'ORDER_MANUAL_PAYMENT_APPROVE',
      entityType: 'Order',
      entityId: id,
      metadata: { proofMediaId: order.manualPaymentProofMediaId || null, note: note || null },
    });

    return NextResponse.json({ ok: true, order: updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memproses order' }, { status: 500 });
  }
}
