import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentWebhook } from '@/modules/payment/api/service';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { writeAuditLog } from '@/utils/audit';
import { prisma } from '@/utils/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const body = JSON.parse(rawBody);

    const xenditExternalId = typeof body?.external_id === 'string' ? body.external_id : null;
    const xenditStatusRaw = typeof body?.status === 'string' ? body.status : null;
    if (xenditExternalId && xenditStatusRaw) {
      const callbackToken = String(process.env.XENDIT_CALLBACK_TOKEN || '').trim();
      if (!callbackToken) {
        return NextResponse.json({ error: 'XENDIT_CALLBACK_TOKEN not configured' }, { status: 500 });
      }

      const headerToken =
        req.headers.get('x-callback-token') ||
        req.headers.get('x-xendit-callback-token') ||
        req.headers.get('xendit-callback-token');
      if (!headerToken) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      const a = Buffer.from(String(headerToken), 'utf8');
      const b = Buffer.from(callbackToken, 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const normalizedStatus = (() => {
        const s = xenditStatusRaw.toUpperCase();
        if (s === 'PENDING') return null;
        if (s === 'PAID' || s === 'SETTLED') return 'SUCCESS' as const;
        if (s === 'EXPIRED' || s === 'FAILED') return 'FAILED' as const;
        return null;
      })();

      const xenditAmountRaw =
        typeof body?.amount === 'number' ? body.amount : typeof body?.amount === 'string' ? Number(body.amount) : NaN;
      const xenditAmount = Number.isFinite(xenditAmountRaw) ? Number(xenditAmountRaw) : null;
      const linkedPayment = await prisma.payment.findFirst({ where: { externalId: xenditExternalId }, select: { id: true, provider: true, amount: true, orderId: true } });
      if (!linkedPayment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }
      if (String(linkedPayment.provider || '').toUpperCase() !== 'XENDIT') {
        return NextResponse.json({ error: 'Provider mismatch' }, { status: 400 });
      }
      if (xenditAmount !== null && Math.abs(Number(linkedPayment.amount || 0) - xenditAmount) > 0.01) {
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }

      const payment = normalizedStatus ? await handlePaymentWebhook(xenditExternalId, normalizedStatus) : null;
      await writeAuditLog({
        req,
        actor: null,
        action: 'PAYMENT_WEBHOOK',
        entityType: 'Payment',
        entityId: (payment as any)?.id ? String((payment as any).id) : null,
        metadata: {
          provider: 'XENDIT',
          external_id: xenditExternalId,
          status: xenditStatusRaw,
          normalizedStatus: normalizedStatus || 'PENDING',
          paymentId: (payment as any)?.id || null,
          internalOrderId: (payment as any)?.orderId || null,
        },
      });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const midtransOrderId = typeof body?.order_id === 'string' ? body.order_id : null;
    const midtransSignature = typeof body?.signature_key === 'string' ? body.signature_key : null;
    const midtransStatusCode = typeof body?.status_code === 'string' ? body.status_code : null;
    const midtransGrossAmount =
      typeof body?.gross_amount === 'string' || typeof body?.gross_amount === 'number' ? String(body.gross_amount) : null;
    const midtransTransactionStatus = typeof body?.transaction_status === 'string' ? body.transaction_status : null;
    const midtransFraudStatus = typeof body?.fraud_status === 'string' ? body.fraud_status : null;

    if (midtransOrderId && midtransSignature && midtransStatusCode && midtransGrossAmount && midtransTransactionStatus) {
      const serverKey = String(process.env.MIDTRANS_SERVER_KEY || '').trim();
      if (!serverKey) {
        return NextResponse.json({ error: 'MIDTRANS_SERVER_KEY not configured' }, { status: 500 });
      }

      const computed = createHash('sha512')
        .update(`${midtransOrderId}${midtransStatusCode}${midtransGrossAmount}${serverKey}`, 'utf8')
        .digest('hex');

      const a = Buffer.from(midtransSignature, 'utf8');
      const b = Buffer.from(computed, 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const normalizedStatus = (() => {
        const s = midtransTransactionStatus.toLowerCase();
        if (s === 'pending') return null;
        if (s === 'settlement') return 'SUCCESS' as const;
        if (s === 'capture') return (midtransFraudStatus || '').toLowerCase() === 'accept' ? ('SUCCESS' as const) : null;
        if (s === 'deny' || s === 'cancel' || s === 'expire' || s === 'failure') return 'FAILED' as const;
        if (s === 'refund' || s === 'chargeback') return 'FAILED' as const;
        return null;
      })();

      const linkedPayment = await prisma.payment.findFirst({ where: { externalId: midtransOrderId }, select: { id: true, provider: true, amount: true, orderId: true } });
      if (!linkedPayment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }
      if (String(linkedPayment.provider || '').toUpperCase() !== 'MIDTRANS') {
        return NextResponse.json({ error: 'Provider mismatch' }, { status: 400 });
      }
      const grossAmountRaw = Number(midtransGrossAmount);
      if (Number.isFinite(grossAmountRaw) && Math.abs(Number(linkedPayment.amount || 0) - grossAmountRaw) > 0.01) {
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }

      const payment = normalizedStatus ? await handlePaymentWebhook(midtransOrderId, normalizedStatus) : null;
      await writeAuditLog({
        req,
        actor: null,
        action: 'PAYMENT_WEBHOOK',
        entityType: 'Payment',
        entityId: (payment as any)?.id ? String((payment as any).id) : null,
        metadata: {
          provider: 'MIDTRANS',
          order_id: midtransOrderId,
          transaction_status: midtransTransactionStatus,
          fraud_status: midtransFraudStatus,
          status_code: midtransStatusCode,
          gross_amount: midtransGrossAmount,
          normalizedStatus: normalizedStatus || 'PENDING',
          paymentId: (payment as any)?.id || null,
          internalOrderId: (payment as any)?.orderId || null,
        },
      });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const signatureHeader = req.headers.get('x-webhook-signature') || req.headers.get('x-signature');
    if (!signatureHeader) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const provided = signatureHeader.startsWith('sha256=') ? signatureHeader.slice('sha256='.length) : signatureHeader;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const externalId = typeof body?.externalId === 'string' ? body.externalId : null;
    const statusRaw = typeof body?.status === 'string' ? body.status : null;

    if (!externalId || !statusRaw) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    if (statusRaw !== 'SUCCESS' && statusRaw !== 'FAILED') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const payment = await handlePaymentWebhook(externalId, statusRaw);
    await writeAuditLog({
      req,
      actor: null,
      action: 'PAYMENT_WEBHOOK',
      entityType: 'Payment',
      entityId: (payment as any)?.id ? String((payment as any).id) : null,
      metadata: { externalId, status: statusRaw, orderId: (payment as any)?.orderId || null },
    });
    return NextResponse.json(payment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
