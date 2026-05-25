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

    const body = (await req.json().catch(() => ({}))) as { mediaId?: unknown; note?: unknown };
    const mediaId = typeof body.mediaId === 'string' ? body.mediaId.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!mediaId) return NextResponse.json({ error: 'mediaId wajib diisi' }, { status: 400 });

    const order = (await prisma.order.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, manualPaymentStatus: true, paymentDueAt: true },
    })) as any;
    if (!order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    if (String(order.userId) !== String(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (order.status !== 'PENDING') return NextResponse.json({ error: 'Order sudah tidak bisa diubah' }, { status: 400 });
    const dueAt = (order as any).paymentDueAt ? new Date((order as any).paymentDueAt) : null;
    const nowCheck = new Date();
    if (dueAt && nowCheck.getTime() > dueAt.getTime()) {
      return NextResponse.json({ error: 'Order sudah kadaluarsa. Silakan batalkan pesanan dan buat pesanan baru.' }, { status: 400 });
    }

    const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { id: true, url: true, userId: true } });
    if (!media) return NextResponse.json({ error: 'Media tidak ditemukan' }, { status: 404 });
    if (String(media.userId) !== String(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id },
      data: {
        manualPaymentStatus: 'SUBMITTED',
        manualPaymentProofMediaId: media.id,
        manualPaymentProofUrl: media.url,
        manualPaymentNote: note || null,
        manualPaymentSubmittedAt: now,
        manualPaymentReviewedAt: null,
        manualPaymentReviewedById: null,
      },
      select: {
        id: true,
        manualPaymentStatus: true,
        manualPaymentProofUrl: true,
        manualPaymentNote: true,
        manualPaymentSubmittedAt: true,
      },
    });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admins.length) {
      const message = [
        `Ada bukti pembayaran baru`,
        `Order: ${id}`,
        `UserId: ${String(user.id)}`,
        `LINK:/dashboard/admin/orders`,
      ].join('\n');
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: 'Bukti Pembayaran Baru',
          message,
          read: false,
        })),
      });
    }

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'ORDER_MANUAL_PAYMENT_PROOF_SUBMIT',
      entityType: 'Order',
      entityId: id,
      metadata: { mediaId: media.id, url: media.url },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menyimpan bukti' }, { status: 500 });
  }
}
