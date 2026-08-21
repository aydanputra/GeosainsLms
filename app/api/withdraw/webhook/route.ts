import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { timingSafeEqual } from 'crypto';
import { writeAuditLog } from '@/utils/audit';

export const runtime = 'nodejs';

function normalizeXenditDisbursementStatus(statusRaw: string | null) {
  const s = String(statusRaw || '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'COMPLETED') return 'SUCCESS' as const;
  if (s === 'FAILED') return 'FAILED' as const;
  if (s === 'PENDING' || s === 'LOCKED') return 'PROCESSING' as const;
  return 'PROCESSING' as const;
}

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const disbursementId = typeof (body as any)?.id === 'string' ? String((body as any).id).trim() : '';
    const externalId = typeof (body as any)?.external_id === 'string' ? String((body as any).external_id).trim() : '';
    const statusRaw = typeof (body as any)?.status === 'string' ? String((body as any).status).trim() : '';
    const amountRaw =
      typeof (body as any)?.amount === 'number'
        ? (body as any).amount
        : typeof (body as any)?.amount === 'string'
          ? Number((body as any).amount)
          : NaN;

    if (!disbursementId && !externalId) return NextResponse.json({ error: 'Missing disbursement id' }, { status: 400 });
    if (!Number.isFinite(amountRaw)) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

    const linked = await prisma.mentorWithdrawal.findFirst({
      where: disbursementId
        ? { disbursementId }
        : externalId
          ? { externalId }
          : undefined,
      select: { id: true, status: true, provider: true, amount: true, disbursementId: true, externalId: true },
    });
    if (!linked) return NextResponse.json({ error: 'MentorWithdrawal not found' }, { status: 404 });
    if (String(linked.provider || '').toUpperCase() !== 'XENDIT') {
      return NextResponse.json({ error: 'Provider mismatch' }, { status: 400 });
    }
    if (disbursementId && linked.disbursementId && String(linked.disbursementId) !== disbursementId) {
      return NextResponse.json({ error: 'Disbursement mismatch' }, { status: 400 });
    }
    if (externalId && linked.externalId && String(linked.externalId) !== externalId) {
      return NextResponse.json({ error: 'External id mismatch' }, { status: 400 });
    }
    if (Math.abs(Number(linked.amount || 0) - Number(amountRaw)) > 0.01) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    const normalized = normalizeXenditDisbursementStatus(statusRaw);
    if (!normalized) return NextResponse.json({ ok: true }, { status: 200 });

    const current = String(linked.status || '').toUpperCase();
    if (current === 'SUCCESS' || current === 'FAILED') {
      await writeAuditLog({
        req,
        actor: null,
        action: 'MENTOR_WITHDRAW_WEBHOOK_IGNORED',
        entityType: 'MentorWithdrawal',
        entityId: linked.id,
        metadata: { disbursementId: disbursementId || null, externalId: externalId || null, status: statusRaw || null },
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await prisma.mentorWithdrawal.update({
      where: { id: linked.id },
      data: {
        status: normalized,
        ...(disbursementId && !linked.disbursementId ? { disbursementId } : {}),
        ...(externalId && !linked.externalId ? { externalId } : {}),
        metadata: body as any,
      },
    });

    await writeAuditLog({
      req,
      actor: null,
      action: 'MENTOR_WITHDRAW_WEBHOOK',
      entityType: 'MentorWithdrawal',
      entityId: linked.id,
      metadata: { disbursementId: disbursementId || null, externalId: externalId || null, amount: Number(amountRaw), status: statusRaw || null, normalized },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Webhook error' }, { status: 500 });
  }
}
