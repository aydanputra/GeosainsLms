import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await verifyToken(token);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const bookingId = String(id || '').trim();
    if (!bookingId) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
    const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!['CONFIRM', 'START', 'COMPLETE', 'CANCEL'].includes(action)) {
      return NextResponse.json({ error: 'action tidak valid' }, { status: 400 });
    }

    const booking = await prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      include: { orderItem: { include: { order: true } }, product: { select: { id: true, name: true } } },
    });
    if (!booking) return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });

    const orderStatus = booking.orderItem?.order?.status;
    const isPaid = orderStatus === 'PAID' || orderStatus === 'SHIPPED';
    if (!isPaid && action !== 'CANCEL') {
      return NextResponse.json({ error: 'Order belum LUNAS' }, { status: 400 });
    }

    const now = new Date();
    const current = booking.status;
    const next =
      action === 'CONFIRM'
        ? 'CONFIRMED'
        : action === 'START'
          ? 'IN_PROGRESS'
          : action === 'COMPLETE'
            ? 'COMPLETED'
            : 'CANCELLED';

    if (current === next) return NextResponse.json({ ok: true, booking }, { status: 200 });
    if (current === 'COMPLETED') return NextResponse.json({ error: 'Booking sudah selesai' }, { status: 400 });
    if (current === 'CANCELLED') return NextResponse.json({ error: 'Booking sudah dibatalkan' }, { status: 400 });

    if (action === 'START' && current !== 'CONFIRMED' && current !== 'REQUESTED') {
      return NextResponse.json({ error: 'Status booking tidak valid untuk dimulai' }, { status: 400 });
    }
    if (action === 'COMPLETE' && current !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Status booking tidak valid untuk diselesaikan' }, { status: 400 });
    }

    const updated = await prisma.serviceBooking.update({
      where: { id: bookingId },
      data: {
        status: next as any,
        ...(action === 'START' ? { startedAt: now } : {}),
        ...(action === 'COMPLETE' ? { completedAt: now } : {}),
        ...(action === 'CANCEL' ? { cancelledAt: now } : {}),
      },
    });

    await prisma.notification.create({
      data: {
        userId: String(updated.userId),
        title:
          action === 'CONFIRM'
            ? 'Jadwal Jasa Dikonfirmasi'
            : action === 'START'
              ? 'Jasa Dimulai'
              : action === 'COMPLETE'
                ? 'Jasa Selesai'
                : 'Jasa Dibatalkan',
        message: [
          `Produk: ${booking.product?.name || booking.productId}`,
          `Order: ${booking.orderItem?.orderId || '-'}`,
          note ? `Catatan: ${note}` : '',
          `LINK:/dashboard/student/orders?orderId=${encodeURIComponent(String(booking.orderItem?.orderId || ''))}`,
        ]
          .filter(Boolean)
          .join('\n'),
        read: false,
      },
    });

    await writeAuditLog({
      req,
      actor: { id: String(admin.id), role: admin.role },
      action: 'SERVICE_BOOKING_STATUS_UPDATE',
      entityType: 'ServiceBooking',
      entityId: bookingId,
      metadata: { action, from: current, to: next, orderId: booking.orderItem?.orderId || null, note: note || null },
    });

    return NextResponse.json({ ok: true, booking: updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal update booking' }, { status: 500 });
  }
}

