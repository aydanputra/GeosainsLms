import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { createOrder } from '@/modules/shop/api/service';
import { createPayment } from '@/modules/payment/api/service';
import { prisma } from '@/utils/prisma';

function safeParseSettings(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    const payload: any =
      contentType.includes('application/json')
        ? await req.json().catch(() => ({}))
        : Object.fromEntries(Array.from((await req.formData()).entries()).map(([k, v]) => [k, String(v)]));

    const planRaw = typeof payload?.plan === 'string' ? payload.plan.trim().toUpperCase() : '';
    const plan = planRaw === 'YEARLY' ? 'YEARLY' : planRaw === 'MONTHLY' ? 'MONTHLY' : '';
    if (!plan) return NextResponse.json({ error: 'Plan tidak valid' }, { status: 400 });

    const order = await createOrder(
      String(user.id),
      { items: [{ subscriptionPlan: plan, quantity: 1 }] as any[] },
      {
        affiliateCode: req.cookies.get('affiliate_code')?.value || '',
        affiliateReferralId: req.cookies.get('affiliate_referral_id')?.value || '',
      }
    );

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
    const settings = safeParseSettings(settingsPage?.content);
    const methodRaw = typeof (settings as any)?.paymentMethod === 'string' ? String((settings as any).paymentMethod).trim().toUpperCase() : '';
    const paymentMethod = methodRaw === 'MIDTRANS' || methodRaw === 'MANUAL' ? methodRaw : 'XENDIT';

    if (paymentMethod === 'MANUAL') {
      const redirectUrl = `/dashboard/student/orders?orderId=${encodeURIComponent(String(order.id))}`;
      return NextResponse.redirect(new URL(redirectUrl, req.url), 302);
    }

    const payment = await createPayment({ provider: paymentMethod as any, orderId: String(order.id) });
    const paymentUrl = typeof (payment as any)?.paymentUrl === 'string' ? String((payment as any).paymentUrl).trim() : '';
    if (!paymentUrl) return NextResponse.json({ error: 'Gagal membuat pembayaran' }, { status: 500 });

    return NextResponse.redirect(paymentUrl, 302);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal membuat langganan' }, { status: 500 });
  }
}

