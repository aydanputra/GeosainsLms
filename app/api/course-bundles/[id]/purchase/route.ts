import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { createOrder } from '@/modules/shop/api/service';
import { CourseStatus } from '@prisma/client';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { createPayment, finalizeOrderPaid } from '@/modules/payment/api/service';
import { sendStudentOrderCreatedEmail } from '@/utils/email-notifications';
import { getAppUrl } from '@/modules/core/utils/appUrl';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });

    const bundle = await prisma.courseBundle.findUnique({ where: { id } });
    if (!bundle || !bundle.published) return NextResponse.json({ error: 'Bundle tidak ditemukan' }, { status: 404 });

    const courseIds = Array.from(new Set((bundle.courseIds || []).map((c) => c.trim()).filter(Boolean)));
    if (courseIds.length === 0) return NextResponse.json({ error: 'Bundle belum memiliki kursus' }, { status: 400 });

    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds }, deletedAt: null, status: CourseStatus.PUBLISHED },
      select: { id: true, title: true, slug: true, price: true, instructorId: true },
    });

    const foundIds = new Set(courses.map((c) => c.id));
    const missingIds = courseIds.filter((cid) => !foundIds.has(cid));
    if (missingIds.length) return NextResponse.json({ error: 'Sebagian kursus bundle tidak tersedia' }, { status: 400 });

    const subtotal = courses.reduce((sum, c) => sum + Number(c.price || 0), 0);
    const targetTotal = Math.max(0, Number(bundle.price || 0));
    const discountTotal = Math.max(0, Math.min(subtotal, subtotal - targetTotal));

    const order = await createOrder(
      user.id,
      {
      items: courses.map((c) => ({ courseId: c.id, quantity: 1 })),
      discountTotal,
      },
      {
        allowManualDiscount: true,
        affiliateCode: req.cookies.get('affiliate_code')?.value || '',
        affiliateReferralId: req.cookies.get('affiliate_referral_id')?.value || '',
      }
    );

    if (order.total <= 0) {
      await finalizeOrderPaid(String(order.id));
      return NextResponse.json(
        {
          message: 'Berhasil mendaftar bundle',
          enrolled: true,
          redirectUrl: '/dashboard/student/courses',
        },
        { status: 200 }
      );
    }

    const buyer = await prisma.user.findUnique({
      where: { id: String(user.id) },
      select: { name: true, email: true },
    });

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
    const settings = safeParse(settingsPage?.content);
    const methodRaw = typeof settings?.paymentMethod === 'string' ? String(settings.paymentMethod).trim().toUpperCase() : '';
    const paymentMethod = methodRaw === 'MIDTRANS' || methodRaw === 'MANUAL' ? methodRaw : 'XENDIT';

    if (paymentMethod !== 'MANUAL') {
      const payment = await createPayment({ provider: paymentMethod as any, orderId: order.id });
      const paymentUrl = typeof (payment as any)?.paymentUrl === 'string' ? String((payment as any).paymentUrl) : '';
      if (paymentUrl.trim()) {
        return NextResponse.json(
          {
            message: 'Pembayaran dibuat',
            enrolled: false,
            orderId: order.id,
            paymentUrl: paymentUrl.trim(),
            redirectUrl: '/dashboard/student/orders',
          },
          { status: 200 }
        );
      }
    }

    if (buyer?.email) {
      await sendStudentOrderCreatedEmail({
        to: buyer.email,
        name: buyer.name || null,
        orderId: String(order.id),
        total: Number(order.total || 0),
        manualPayment: true,
        actionUrl: `${getAppUrl(req.headers)}/dashboard/student/orders?orderId=${encodeURIComponent(String(order.id))}`,
      });
    }

    return NextResponse.json(
      {
        message: 'Pesanan berhasil dibuat. Silakan lakukan pembayaran manual dan tunggu konfirmasi admin.',
        enrolled: false,
        orderId: order.id,
        redirectUrl: '/dashboard/student/orders',
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal membeli bundle' }, { status: 500 });
  }
}
