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

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { orderId } = await params;
    const id = String(orderId || '').trim();
    const order = await finalizeOrderPaid(id);
    await prisma.order.update({
      where: { id },
      data: {
        manualPaymentStatus: 'APPROVED',
        manualPaymentReviewedAt: new Date(),
        manualPaymentReviewedById: String(user.id),
      },
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'ORDER_MARK_PAID',
      entityType: 'Order',
      entityId: id,
      metadata: { orderId: id },
    });

    return NextResponse.json({ ok: true, order }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal mengkonfirmasi pesanan' }, { status: 500 });
  }
}
