import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { handlePaymentWebhook } from '@/modules/payment/api/service';

function normalizeXenditStatus(status: unknown) {
  const s = typeof status === 'string' ? status.toUpperCase() : '';
  if (s === 'PAID' || s === 'SETTLED') return 'SUCCESS' as const;
  if (s === 'EXPIRED' || s === 'FAILED') return 'FAILED' as const;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { orderId?: unknown; externalId?: unknown };
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : '';
    if (!orderId && !externalId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const payment = (await (orderId
      ? prisma.payment.findUnique({ where: { orderId }, include: { order: true } })
      : prisma.payment.findFirst({ where: { externalId }, include: { order: true } }))) as any;
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const isOwner = String(payment.order?.userId) === String(user.id);
    const isAdmin = String(user.role) === 'ADMIN';
    if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const provider = String(payment.provider || '').toUpperCase();
    if (provider !== 'XENDIT') return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });

    const xenditExternalId = String(payment.externalId || externalId || '').trim();
    if (!xenditExternalId) return NextResponse.json({ error: 'Missing externalId' }, { status: 400 });

    const secretKey = String(process.env.XENDIT_SECRET_KEY || process.env.XENDIT_API_KEY || '').trim();
    if (!secretKey) return NextResponse.json({ error: 'XENDIT_SECRET_KEY not configured' }, { status: 500 });

    const auth = Buffer.from(`${secretKey}:`, 'utf8').toString('base64');
    const url = `https://api.xendit.co/v2/invoices?external_id=${encodeURIComponent(xenditExternalId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : 'Failed to fetch invoice';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const invoice =
      Array.isArray(data) ? data[0] : Array.isArray((data as any)?.data) ? (data as any).data[0] : (data as any) ?? null;
    const invoiceStatusRaw = invoice?.status;
    const normalized = normalizeXenditStatus(invoiceStatusRaw);

    if (normalized) {
      const updated = await handlePaymentWebhook(xenditExternalId, normalized);
      return NextResponse.json({ ok: true, invoiceStatus: invoiceStatusRaw, payment: updated }, { status: 200 });
    }

    return NextResponse.json({ ok: true, invoiceStatus: invoiceStatusRaw, payment }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to sync payment' }, { status: 500 });
  }
}

