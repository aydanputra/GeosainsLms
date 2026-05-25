import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { refundOrder } from '@/modules/payment/api/service';
import { writeAuditLog } from '@/utils/audit';
import { isSameOrigin } from '@/modules/auth/utils/security';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const updatedOrder = await refundOrder(body);
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'ORDER_REFUND',
      entityType: 'Order',
      entityId: (updatedOrder as any)?.id ? String((updatedOrder as any).id) : null,
      metadata: { request: body, refundTotal: (updatedOrder as any)?.refundTotal || 0, status: (updatedOrder as any)?.status || null },
    });
    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to refund order' }, { status: 400 });
  }
}
