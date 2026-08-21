import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';
import { sendStudentOrderShippedEmail } from '@/utils/email-notifications';
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

    const body = (await req.json().catch(() => ({}))) as { courier?: unknown; trackingNumber?: unknown };
    const courier = typeof body.courier === 'string' ? body.courier.trim() : '';
    const trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
    if (!courier) return NextResponse.json({ error: 'Kurir wajib diisi' }, { status: 400 });
    if (!trackingNumber) return NextResponse.json({ error: 'Nomor resi wajib diisi' }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { type: true } } } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    if (order.status !== 'PAID') return NextResponse.json({ error: 'Order belum LUNAS' }, { status: 400 });

    const hasPhysical = order.items.some((it) => it?.productId && it?.product?.type === 'PHYSICAL');
    if (!hasPhysical) return NextResponse.json({ error: 'Order ini tidak memiliki produk fisik' }, { status: 400 });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'SHIPPED',
        shippingCourier: courier,
        shippingTrackingNumber: trackingNumber,
        shippedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: String(order.userId),
        title: 'Pesanan Dikirim',
        message: [`Order: ${id}`, `Kurir: ${courier}`, `Resi: ${trackingNumber}`, `LINK:/dashboard/student/orders?orderId=${encodeURIComponent(id)}`].join('\n'),
        read: false,
      },
    });

    if (order.user?.email) {
      await sendStudentOrderShippedEmail({
        to: order.user.email,
        name: order.user.name || null,
        orderId: id,
        courier,
        trackingNumber,
        actionUrl: `${getAppUrl(req.headers)}/dashboard/student/orders?orderId=${encodeURIComponent(id)}`,
      });
    }

    await writeAuditLog({
      req,
      actor: { id: String(admin.id), role: admin.role },
      action: 'ORDER_SHIP',
      entityType: 'Order',
      entityId: id,
      metadata: { courier, trackingNumber },
    });

    return NextResponse.json({ ok: true, order: updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal mengirim pesanan' }, { status: 500 });
  }
}
