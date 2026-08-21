import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';
import { sendStudentStatusUpdateEmail } from '@/utils/email-notifications';
import { getAppUrl } from '@/modules/core/utils/appUrl';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await verifyToken(token);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const reservationId = String(id || '').trim();
    if (!reservationId) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
    const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!['APPROVE', 'START', 'RETURN', 'CANCEL'].includes(action)) {
      return NextResponse.json({ error: 'action tidak valid' }, { status: 400 });
    }

    const reservation = await prisma.rentalReservation.findUnique({
      where: { id: reservationId },
      include: {
        orderItem: { include: { order: true } },
        product: { select: { id: true, name: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!reservation) return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 });

    const orderStatus = reservation.orderItem?.order?.status;
    const isPaid = orderStatus === 'PAID' || orderStatus === 'SHIPPED';
    if (!isPaid && action !== 'CANCEL') {
      return NextResponse.json({ error: 'Order belum LUNAS' }, { status: 400 });
    }

    const now = new Date();
    const current = reservation.status;
    const next =
      action === 'APPROVE'
        ? 'APPROVED'
        : action === 'START'
          ? 'ACTIVE'
          : action === 'RETURN'
            ? 'RETURNED'
            : 'CANCELLED';

    if (current === next) return NextResponse.json({ ok: true, reservation }, { status: 200 });
    if (current === 'RETURNED') return NextResponse.json({ error: 'Sewa sudah selesai' }, { status: 400 });
    if (current === 'CANCELLED') return NextResponse.json({ error: 'Sewa sudah dibatalkan' }, { status: 400 });

    if (action === 'START' && current !== 'APPROVED') {
      return NextResponse.json({ error: 'Status sewa tidak valid untuk dimulai' }, { status: 400 });
    }
    if (action === 'RETURN' && current !== 'ACTIVE') {
      return NextResponse.json({ error: 'Status sewa tidak valid untuk dikembalikan' }, { status: 400 });
    }

    const updated = await prisma.rentalReservation.update({
      where: { id: reservationId },
      data: {
        status: next as any,
        ...(action === 'START' ? { activatedAt: now } : {}),
        ...(action === 'RETURN' ? { returnedAt: now } : {}),
        ...(action === 'CANCEL' ? { cancelledAt: now } : {}),
      },
    });

    await prisma.notification.create({
      data: {
        userId: String(updated.userId),
        title:
          action === 'APPROVE'
            ? 'Sewa Disetujui'
            : action === 'START'
              ? 'Sewa Dimulai'
              : action === 'RETURN'
                ? 'Sewa Selesai (Dikembalikan)'
                : 'Sewa Dibatalkan',
        message: [
          `Produk: ${reservation.product?.name || reservation.productId}`,
          `Order: ${reservation.orderItem?.orderId || '-'}`,
          note ? `Catatan: ${note}` : '',
          `LINK:/dashboard/student/orders?orderId=${encodeURIComponent(String(reservation.orderItem?.orderId || ''))}`,
        ]
          .filter(Boolean)
          .join('\n'),
        read: false,
      },
    });

    if (reservation.user?.email) {
      await sendStudentStatusUpdateEmail({
        to: reservation.user.email,
        name: reservation.user.name || null,
        title:
          action === 'APPROVE'
            ? 'Sewa Disetujui'
            : action === 'START'
              ? 'Sewa Dimulai'
              : action === 'RETURN'
                ? 'Sewa Selesai (Dikembalikan)'
                : 'Sewa Dibatalkan',
        itemName: reservation.product?.name || reservation.productId,
        orderId: reservation.orderItem?.orderId || null,
        note: note || null,
        actionUrl: `${getAppUrl(req.headers)}/dashboard/student/orders?orderId=${encodeURIComponent(String(reservation.orderItem?.orderId || ''))}`,
      });
    }

    await writeAuditLog({
      req,
      actor: { id: String(admin.id), role: admin.role },
      action: 'RENTAL_RESERVATION_STATUS_UPDATE',
      entityType: 'RentalReservation',
      entityId: reservationId,
      metadata: { action, from: current, to: next, orderId: reservation.orderItem?.orderId || null, note: note || null },
    });

    return NextResponse.json({ ok: true, reservation: updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal update reservasi' }, { status: 500 });
  }
}
