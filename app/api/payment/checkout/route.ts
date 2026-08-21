import { NextRequest, NextResponse } from 'next/server';
import { createPayment } from '@/modules/payment/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAccessDeniedAuditLog, writeAuditLog } from '@/utils/audit';
import { prisma } from '@/utils/prisma';

async function auditPaymentCheckoutDenied(
  req: NextRequest,
  status: 401 | 403,
  reason: string,
  actor?: { id: string; role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR' | 'VENDOR_STAFF' } | null,
  orderId?: string | null
) {
  await writeAccessDeniedAuditLog({
    req,
    actor: actor || null,
    action: 'PAYMENT_CHECKOUT_DENIED',
    status,
    entityType: 'Order',
    entityId: orderId || null,
    reason,
    metadata: { orderId: orderId || null },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      await auditPaymentCheckoutDenied(req, 403, 'cross_origin');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = req.cookies.get('token')?.value;
    if (!token) {
      await auditPaymentCheckoutDenied(req, 401, 'missing_token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      await auditPaymentCheckoutDenied(req, 401, 'invalid_token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && String(order.userId) !== String(user.id)) {
      await auditPaymentCheckoutDenied(
        req,
        403,
        'not_order_owner',
        { id: String(user.id), role: user.role },
        String(order.id)
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      orderId: orderId,
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
