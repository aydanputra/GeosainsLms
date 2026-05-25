import { NextRequest, NextResponse } from 'next/server';
import { createPayment } from '@/modules/payment/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';
import { prisma } from '@/utils/prisma';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const settingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
    let settings: any = {};
    try {
      settings = settingsPage?.content ? JSON.parse(settingsPage.content) : {};
    } catch {
      settings = {};
    }
    const methodRaw = typeof settings?.paymentMethod === 'string' ? String(settings.paymentMethod).trim().toUpperCase() : '';
    const activeMethod = methodRaw === 'MIDTRANS' || methodRaw === 'MANUAL' ? methodRaw : 'XENDIT';
    if (activeMethod === 'MANUAL') {
      return NextResponse.json({ error: 'Metode pembayaran saat ini adalah manual' }, { status: 400 });
    }

    const payment = await createPayment({
      provider: activeMethod,
      orderId: body?.orderId,
      amount: body?.amount,
    });
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'PAYMENT_CHECKOUT',
      entityType: 'Payment',
      entityId: payment?.id ? String((payment as any).id) : null,
      metadata: { orderId: (payment as any)?.orderId || body?.orderId || null, provider: (payment as any)?.provider || activeMethod || null },
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
