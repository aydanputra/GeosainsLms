import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId } = await params;
    const id = String(orderId || '').trim();
    if (!id) return NextResponse.json({ error: 'Order tidak valid' }, { status: 400 });

    const order = (await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        shippedAt: true,
        manualPaymentStatus: true,
        paymentDueAt: true,
        payment: { select: { id: true, status: true } },
        items: { select: { id: true } },
      },
    })) as any;
    if (!order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });

    const isOwner = String(order.userId) === String(user.id);
    const isAdmin = String(user.role) === 'ADMIN';
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (order.status !== 'PENDING') return NextResponse.json({ error: 'Order sudah tidak bisa dibatalkan' }, { status: 400 });
    if (order.shippedAt) return NextResponse.json({ error: 'Order sudah diproses pengiriman' }, { status: 400 });
    if (String(order.manualPaymentStatus || '').toUpperCase() === 'APPROVED') {
      return NextResponse.json({ error: 'Pembayaran sudah dikonfirmasi' }, { status: 400 });
    }
    if (String(order.payment?.status || '').toUpperCase() === 'SUCCESS') {
      return NextResponse.json({ error: 'Pembayaran sudah berhasil' }, { status: 400 });
    }

    const now = new Date();
    const dueAt = (order as any).paymentDueAt ? new Date((order as any).paymentDueAt) : null;
    const reason = dueAt && now.getTime() > dueAt.getTime() ? 'EXPIRED' : 'USER_CANCELLED';
    const itemIds = Array.isArray(order.items) ? order.items.map((it: any) => String(it.id)) : [];

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason } as any,
      });
      if (cancelled.count === 0) throw new Error('Order sudah diproses');

      if (order.payment?.id) {
        await tx.payment.updateMany({ where: { id: order.payment.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      }

      if (itemIds.length) {
        await tx.serviceBooking.updateMany({
          where: { orderItemId: { in: itemIds }, status: { notIn: ['COMPLETED', 'CANCELLED'] as any } },
          data: { status: 'CANCELLED' as any, cancelledAt: now },
        });
        await tx.rentalReservation.updateMany({
          where: { orderItemId: { in: itemIds }, status: { notIn: ['RETURNED', 'CANCELLED'] as any } },
          data: { status: 'CANCELLED' as any, cancelledAt: now },
        });
      }

      const latest = await tx.order.findUnique({
        where: { id },
        select: { id: true, status: true, cancelledAt: true, cancelReason: true } as any,
      });
      return latest;
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'ORDER_CANCEL',
      entityType: 'Order',
      entityId: id,
      metadata: { reason },
    });

    return NextResponse.json({ ok: true, order: updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal membatalkan pesanan' }, { status: 500 });
  }
}
