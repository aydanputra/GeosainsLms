import { prisma } from '@/utils/prisma';
import { z } from 'zod';
import { PaymentProvider } from '@prisma/client';
import { getAppUrl } from '@/modules/core/utils/appUrl';
import {
  sendStudentOrderCreatedEmail,
  sendStudentPaymentConfirmedEmail,
  sendStudentPaymentFailedEmail,
} from '@/utils/email-notifications';

const SITE_SETTINGS_SLUG = '__site_settings__';

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

async function getAffiliateSettingsTx(tx: any) {
  const page = await (tx as any).page.findUnique({ where: { slug: SITE_SETTINGS_SLUG }, select: { content: true } });
  const data = safeParseSettings(page?.content);
  const toInt = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  };
  const defaultCommission = toInt((data as any).affiliateDefaultCommissionPercent);
  const marketplaceShare = toInt((data as any).affiliateMarketplaceSharePercent);
  const holdDays = toInt((data as any).affiliateHoldDays);
  return {
    defaultCommissionPercent: Math.max(0, Math.min(100, defaultCommission ?? 10)),
    marketplaceSharePercent: Math.max(0, Math.min(100, marketplaceShare ?? 20)),
    holdDays: Math.max(0, Math.min(30, holdDays ?? 7)),
  };
}

export const CreatePaymentSchema = z.object({
  orderId: z.string(),
  amount: z.number().min(1).optional(),
  provider: z.enum(['MIDTRANS', 'XENDIT']),
});

function resolveMidtransBaseUrl() {
  const isProd = String(process.env.MIDTRANS_IS_PRODUCTION || '').trim() === 'true';
  return isProd ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
}

async function createXenditInvoiceRedirectUrl(args: {
  externalId: string;
  amount: number;
  customer: { name: string | null; email: string | null };
  description: string;
  invoiceDurationSeconds?: number | null;
}) {
  const secretKey = String(process.env.XENDIT_SECRET_KEY || process.env.XENDIT_API_KEY || '').trim();
  if (!secretKey) throw new Error('XENDIT_SECRET_KEY not configured');

  const auth = Buffer.from(`${secretKey}:`, 'utf8').toString('base64');
  const appUrl = getAppUrl();
  const successRedirectUrl = `${appUrl}/checkout/success?externalId=${encodeURIComponent(args.externalId)}`;
  const failureRedirectUrl = `${appUrl}/checkout/failure?externalId=${encodeURIComponent(args.externalId)}`;

  const payload: Record<string, any> = {
    external_id: args.externalId,
    amount: args.amount,
    description: args.description,
    success_redirect_url: successRedirectUrl,
    failure_redirect_url: failureRedirectUrl,
    currency: 'IDR',
    should_exclude_credit_card: true,
    should_send_email: false,
    available_banks: [{ bank_code: 'BCA' }, { bank_code: 'BNI' }, { bank_code: 'BRI' }, { bank_code: 'MANDIRI' }, { bank_code: 'PERMATA' }],
    available_ewallets: [{ ewallet_type: 'DANA' }, { ewallet_type: 'OVO' }, { ewallet_type: 'SHOPEEPAY' }, { ewallet_type: 'LINKAJA' }],
    available_qr_codes: [{ qr_code_type: 'QRIS' }],
    available_retail_outlets: [],
    available_direct_debits: [],
    available_paylaters: [],
  };

  const invDur = typeof args.invoiceDurationSeconds === 'number' ? Math.floor(args.invoiceDurationSeconds) : 0;
  if (invDur > 0) payload.invoice_duration = invDur;

  const email = (args.customer.email || '').trim();
  if (email) payload.payer_email = email;

  const name = (args.customer.name || '').trim();
  if (name || email) {
    payload.customer = {
      given_names: (name || email || 'Customer').slice(0, 100),
      ...(email ? { email } : {}),
    };
  }

  const res = await fetch('https://api.xendit.co/v2/invoices', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
          : 'Failed to create Xendit invoice';
    throw new Error(message);
  }

  const invoiceUrl = typeof body?.invoice_url === 'string' ? body.invoice_url : null;
  if (!invoiceUrl) throw new Error('Invalid Xendit response (missing invoice_url)');
  return invoiceUrl;
}

async function createMidtransSnapRedirectUrl(args: {
  orderId: string;
  grossAmount: number;
  customer: { name: string | null; email: string | null };
}) {
  const serverKey = String(process.env.MIDTRANS_SERVER_KEY || '').trim();
  if (!serverKey) throw new Error('MIDTRANS_SERVER_KEY not configured');

  const baseUrl = resolveMidtransBaseUrl();
  const auth = Buffer.from(`${serverKey}:`, 'utf8').toString('base64');
  const appUrl = getAppUrl();

  const firstName = (args.customer.name || '').trim() || (args.customer.email || '').trim() || 'Customer';
  const payload = {
    transaction_details: {
      order_id: args.orderId,
      gross_amount: args.grossAmount,
    },
    customer_details: {
      first_name: firstName.slice(0, 50),
      email: (args.customer.email || '').trim() || undefined,
    },
    callbacks: {
      finish: `${appUrl}/checkout/success`,
    },
  };

  const res = await fetch(`${baseUrl}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body?.error_messages?.[0] === 'string'
        ? body.error_messages[0]
        : typeof body?.message === 'string'
          ? body.message
          : 'Failed to create Midtrans transaction';
    throw new Error(message);
  }

  const redirectUrl = typeof body?.redirect_url === 'string' ? body.redirect_url : null;
  if (!redirectUrl) throw new Error('Invalid Midtrans response (missing redirect_url)');
  return redirectUrl;
}

export const createPayment = async (data: z.infer<typeof CreatePaymentSchema>) => {
  const parsed = CreatePaymentSchema.parse(data);
  const expiryMinutesRaw = Number(process.env.PAYMENT_EXPIRY_MINUTES || process.env.ORDER_PAYMENT_EXPIRY_MINUTES || 60);
  const expiryMinutes = Number.isFinite(expiryMinutesRaw) && expiryMinutesRaw > 0 ? Math.min(7 * 24 * 60, Math.floor(expiryMinutesRaw)) : 60;
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: parsed.orderId },
      include: {
        user: { select: { name: true, email: true } },
        payment: true,
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.status === 'PAID') throw new Error('Order already paid');
    if (order.status === 'CANCELLED') throw new Error('Order cancelled');
    if (order.total <= 0) throw new Error('Invalid order total');

    const dueAt = (order as any).paymentDueAt ? new Date((order as any).paymentDueAt) : new Date(now.getTime() + expiryMinutes * 60 * 1000);
    if (!(order as any).paymentDueAt) {
      await tx.order.update({ where: { id: parsed.orderId }, data: { paymentDueAt: dueAt } as any });
    }

    if (dueAt && now.getTime() > dueAt.getTime()) {
      await tx.order.updateMany({
        where: { id: parsed.orderId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: 'EXPIRED' } as any,
      });
      if (order.payment) {
        await tx.payment.updateMany({ where: { id: order.payment.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      }
      throw new Error('Order expired');
    }

    if (typeof parsed.amount === 'number' && Math.abs(parsed.amount - order.total) > 0.0001) {
      throw new Error('Invalid payment amount');
    }

    if (order.payment) {
      if (order.payment.status === 'PENDING') return { payment: order.payment, order, dueAt };
      throw new Error('Payment already processed');
    }

    const payment = await tx.payment.create({
      data: {
        orderId: parsed.orderId,
        amount: order.total,
        provider: parsed.provider,
        externalId: parsed.provider === 'MIDTRANS' ? parsed.orderId : `order_${parsed.orderId}`,
        paymentUrl: null,
        status: 'PENDING',
      },
    });

    await tx.order.update({
      where: { id: parsed.orderId },
      data: { paymentId: payment.id },
    });

    return { payment, order, dueAt };
  });

  if (result.payment.paymentUrl) return result.payment;

  if (result.payment.provider === PaymentProvider.XENDIT) {
    const amount = Math.max(1, Math.round(Number(result.order.total || 0)));
    const dueAt = (result as any)?.dueAt ? new Date((result as any).dueAt) : null;
    const invoiceDurationSeconds = dueAt ? Math.max(60, Math.floor((dueAt.getTime() - now.getTime()) / 1000)) : null;
    const paymentUrl = await createXenditInvoiceRedirectUrl({
      externalId: String(result.payment.externalId || `order_${result.payment.orderId}`),
      amount,
      customer: { name: result.order.user?.name || null, email: result.order.user?.email || null },
      description: `Order ${result.payment.orderId}`,
      invoiceDurationSeconds,
    });

    const updated = await prisma.payment.updateMany({
      where: { id: result.payment.id, status: 'PENDING', paymentUrl: null },
      data: { paymentUrl },
    });

    if (updated.count === 0) {
      const latest = await prisma.payment.findUnique({ where: { id: result.payment.id } });
      if (!latest) throw new Error('Payment not found');
      return latest;
    }

    const latest = await prisma.payment.findUnique({ where: { id: result.payment.id } });
    if (!latest) throw new Error('Payment not found');
    if (updated.count > 0 && result.order.user?.email) {
      await sendStudentOrderCreatedEmail({
        to: result.order.user.email,
        name: result.order.user.name || null,
        orderId: String(result.order.id),
        total: Number(result.order.total || 0),
        paymentUrl,
        manualPayment: false,
        actionUrl: `${getAppUrl()}/dashboard/student/orders?orderId=${encodeURIComponent(String(result.order.id))}`,
      });
    }
    return latest;
  }

  if (result.payment.provider === PaymentProvider.MIDTRANS) {
    const grossAmount = Math.max(1, Math.round(Number(result.order.total || 0)));
    const paymentUrl = await createMidtransSnapRedirectUrl({
      orderId: String(result.payment.externalId || result.payment.orderId),
      grossAmount,
      customer: { name: result.order.user?.name || null, email: result.order.user?.email || null },
    });

    const updated = await prisma.payment.updateMany({
      where: { id: result.payment.id, status: 'PENDING', paymentUrl: null },
      data: { paymentUrl },
    });

    if (updated.count === 0) {
      const latest = await prisma.payment.findUnique({ where: { id: result.payment.id } });
      if (!latest) throw new Error('Payment not found');
      return latest;
    }

    const latest = await prisma.payment.findUnique({ where: { id: result.payment.id } });
    if (!latest) throw new Error('Payment not found');
    if (updated.count > 0 && result.order.user?.email) {
      await sendStudentOrderCreatedEmail({
        to: result.order.user.email,
        name: result.order.user.name || null,
        orderId: String(result.order.id),
        total: Number(result.order.total || 0),
        paymentUrl,
        manualPayment: false,
        actionUrl: `${getAppUrl()}/dashboard/student/orders?orderId=${encodeURIComponent(String(result.order.id))}`,
      });
    }
    return latest;
  }

  throw new Error('Payment provider not supported');
};

async function finalizeOrderPaidTx(tx: typeof prisma, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) throw new Error('Order not found');

  if (order.status === 'PAID') {
    return { order, successEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string } };
  }
  if (order.status === 'CANCELLED') throw new Error('Order cancelled');
  if (order.status !== 'PENDING') throw new Error('Order is not payable');

  const updated = await tx.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'PAID' },
  });
  if (updated.count === 0) {
    const latest = await tx.order.findUnique({ where: { id: orderId } });
    if (!latest) throw new Error('Order not found');
    if (latest.status === 'PAID') {
      return { order: latest, successEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string } };
    }
    throw new Error('Order is not payable');
  }

  const orderItems = await tx.orderItem.findMany({
    where: { orderId },
    include: { product: { select: { id: true, name: true, type: true, vendorId: true } } },
  });

  const buyerName = order.user?.name || order.user?.email || 'Siswa';
  const buyerEmail = order.user?.email || '';

  const purchasedCourseIds = Array.from(new Set(orderItems.map((it) => it.courseId).filter(Boolean))) as string[];
  const purchasedCourses = purchasedCourseIds.length
    ? await tx.course.findMany({
        where: { id: { in: purchasedCourseIds } },
        select: { id: true, title: true, instructorId: true },
      })
    : [];

  const courseTitleById = new Map(purchasedCourses.map((c) => [c.id, c.title] as const));
  const courseTitlesByMentor = new Map<string, Set<string>>();

  for (const c of purchasedCourses) {
    const set = courseTitlesByMentor.get(c.instructorId) ?? new Set<string>();
    set.add(c.title);
    courseTitlesByMentor.set(c.instructorId, set);
  }

  if (purchasedCourseIds.length > 0) {
    const co = await tx.courseCoInstructor.findMany({
      where: { courseId: { in: purchasedCourseIds } },
      select: { courseId: true, userId: true },
    });
    for (const rel of co) {
      const title = courseTitleById.get(rel.courseId);
      if (!title) continue;
      const set = courseTitlesByMentor.get(rel.userId) ?? new Set<string>();
      set.add(title);
      courseTitlesByMentor.set(rel.userId, set);
    }
  }

  for (const item of orderItems) {
    if (item.courseId) {
      await tx.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: order.userId,
            courseId: item.courseId,
          },
        },
        update: {},
        create: {
          userId: order.userId,
          courseId: item.courseId,
        },
      });
    }
    if (item.productId) {
      const t = item.product?.type || 'PHYSICAL';
      if (t === 'PHYSICAL') {
        const ok = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (ok.count === 0) throw new Error('Insufficient stock');
      }
      if (t === 'SERVICE') {
        await tx.serviceBooking.updateMany({
          where: { orderItemId: item.id },
          data: { status: 'CONFIRMED' },
        });
      }
      if (t === 'RENTAL') {
        await tx.rentalReservation.updateMany({
          where: { orderItemId: item.id },
          data: { status: 'APPROVED' },
        });
      }
    }

    const meta = (item as any)?.meta;
    const subscriptionMeta = meta && typeof meta === 'object' ? (meta as any).subscription : null;
    const planRaw = subscriptionMeta && typeof subscriptionMeta.plan === 'string' ? subscriptionMeta.plan.trim().toUpperCase() : '';
    if (planRaw === 'MONTHLY' || planRaw === 'YEARLY') {
      const durationRaw =
        typeof subscriptionMeta.durationDays === 'number'
          ? subscriptionMeta.durationDays
          : typeof subscriptionMeta.durationDays === 'string'
            ? Number(subscriptionMeta.durationDays)
            : NaN;
      const durationDays = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : planRaw === 'YEARLY' ? 365 : 30;
      const now = new Date();
      const active = await tx.subscription.findFirst({
        where: { userId: String(order.userId), status: 'ACTIVE', endDate: { gte: now } },
        orderBy: { endDate: 'desc' },
        select: { id: true, startDate: true, endDate: true },
      });

      const addDays = (d: Date, days: number) => {
        const out = new Date(d);
        out.setDate(out.getDate() + days);
        return out;
      };

      if (active?.id) {
        const nextEnd = addDays(active.endDate, durationDays);
        await tx.subscription.update({
          where: { id: active.id },
          data: { endDate: nextEnd, plan: planRaw, status: 'ACTIVE' },
        });
      } else {
        await tx.subscription.create({
          data: {
            userId: String(order.userId),
            plan: planRaw,
            status: 'ACTIVE',
            startDate: now,
            endDate: addDays(now, durationDays),
          },
        });
      }
    }
  }

  if (courseTitlesByMentor.size > 0) {
    const href = '/dashboard/mentor/students';
    const notifications = Array.from(courseTitlesByMentor.entries()).map(([mentorId, titlesSet]) => {
      const titles = Array.from(titlesSet.values());
      const lines = [
        `Siswa: ${buyerName}${buyerEmail ? ` (${buyerEmail})` : ''}`,
        `Kursus: ${titles.join(', ')}`,
        `Order: ${orderId}`,
        `LINK:${href}`,
      ];
      return {
        userId: mentorId,
        title: 'Pendaftaran Kursus Baru',
        message: lines.join('\n'),
        read: false,
      };
    });
    await tx.notification.createMany({ data: notifications });
  }

  const purchasedVendorIds = Array.from(
    new Set(orderItems.map((it) => it.product?.vendorId).filter((v) => typeof v === 'string' && v.trim()))
  ) as string[];
  if (purchasedVendorIds.length > 0) {
    const vendors = await tx.shopVendor.findMany({
      where: { id: { in: purchasedVendorIds } },
      select: {
        id: true,
        name: true,
        ownerId: true,
        members: { select: { userId: true } },
      },
    });
    const vendorById = new Map(vendors.map((v) => [v.id, v] as const));
    const byRecipientVendor = new Map<string, Map<string, Set<string>>>();
    const vendorBuyerPaidById = new Map<string, number>();

    for (const it of orderItems) {
      const vendorId = it.product?.vendorId;
      if (!vendorId) continue;
      const vendor = vendorById.get(vendorId);
      if (!vendor) continue;
      const productName = it.product?.name || it.productId || '';
      if (!productName) continue;
      const quantity = Number(it.quantity || 0);
      const lineSubtotal = Math.max(0, Number(it.price || 0) * quantity);
      const discountStore = Math.max(0, Number((it as any).discountStoreAmount || 0));
      const discountMarketplace = Math.max(0, Number((it as any).discountMarketplaceAmount || 0));
      const fallbackDiscount = Math.max(0, Number((it as any).discountAmount || 0));
      const totalDiscount = discountStore === 0 && discountMarketplace === 0 ? fallbackDiscount : discountStore + discountMarketplace;
      const refund = Math.max(0, Number((it as any).refundAmount || 0));
      const buyerPaid = Math.max(0, lineSubtotal - totalDiscount - refund);
      vendorBuyerPaidById.set(String(vendorId), Number(vendorBuyerPaidById.get(String(vendorId)) || 0) + buyerPaid);

      const recipients = new Set<string>();
      if (vendor.ownerId) recipients.add(String(vendor.ownerId));
      for (const m of vendor.members) recipients.add(String(m.userId));

      for (const userId of recipients) {
        const byVendor = byRecipientVendor.get(userId) ?? new Map<string, Set<string>>();
        const set = byVendor.get(vendorId) ?? new Set<string>();
        set.add(productName);
        byVendor.set(vendorId, set);
        byRecipientVendor.set(userId, byVendor);
      }
    }

    if (byRecipientVendor.size > 0) {
      const href = '/dashboard/vendor';
      const notifications = Array.from(byRecipientVendor.entries()).flatMap(([userId, vendorMap]) => {
        return Array.from(vendorMap.entries()).map(([vendorId, namesSet]) => {
          const vendor = vendorById.get(vendorId);
          const names = Array.from(namesSet.values());
          const vendorBuyerPaid = Math.max(0, Number(vendorBuyerPaidById.get(String(vendorId)) || 0));
          const lines = [
            `Pembeli: ${buyerName}${buyerEmail ? ` (${buyerEmail})` : ''}`,
            vendor?.name ? `Vendor: ${vendor.name}` : '',
            `Produk: ${names.join(', ')}`,
            `Order: ${orderId}`,
            `Total: IDR ${vendorBuyerPaid.toLocaleString('id-ID')}`,
            `LINK:${href}`,
          ].filter(Boolean);
          return {
            userId,
            title: 'Pesanan Produk Baru',
            message: lines.join('\n'),
            read: false,
          };
        });
      });
      await tx.notification.createMany({ data: notifications });
    }
  }

  if (purchasedCourses.length > 0) {
    const href = '/dashboard/student/courses';
    const titles = purchasedCourses.map((c) => c.title);
    const lines = [
      `Kursus: ${titles.join(', ')}`,
      `Order: ${orderId}`,
      `Total: IDR ${Number(order.total || 0).toLocaleString('id-ID')}`,
      `LINK:${href}`,
    ];
    await tx.notification.create({
      data: {
        userId: String(order.userId),
        title: 'Pembelian Berhasil',
        message: lines.join('\n'),
        read: false,
      },
    });
  }

  const hasSubscriptionItem = orderItems.some((it) => {
    const m: any = (it as any)?.meta;
    const s = m && typeof m === 'object' ? m.subscription : null;
    const plan = s && typeof s.plan === 'string' ? s.plan.trim().toUpperCase() : '';
    return plan === 'MONTHLY' || plan === 'YEARLY';
  });
  if (hasSubscriptionItem) {
    const now = new Date();
    const sub = await tx.subscription.findFirst({
      where: { userId: String(order.userId), status: 'ACTIVE', endDate: { gte: now } },
      orderBy: { endDate: 'desc' },
      select: { plan: true, startDate: true, endDate: true },
    });
    if (sub) {
      const planLabel = String(sub.plan || '').toUpperCase() === 'YEARLY' ? 'Tahunan' : 'Bulanan';
      const lines = [
        `Paket: ${planLabel}`,
        `Aktif sampai: ${new Date(sub.endDate).toLocaleDateString('id-ID')}`,
        `Order: ${orderId}`,
        'LINK:/subscribe',
      ];
      await tx.notification.create({
        data: {
          userId: String(order.userId),
          title: 'Langganan Aktif',
          message: lines.join('\n'),
          read: false,
        },
      });
    }
  }

  const adminUsers = await tx.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  if (adminUsers.length > 0 && (purchasedCourses.length > 0 || orderItems.some((it) => it.productId))) {
    const href = '/dashboard/admin/orders';
    const lines = [
      `Pembeli: ${buyerName}${buyerEmail ? ` (${buyerEmail})` : ''}`,
      `Order: ${orderId}`,
      `Total: IDR ${Number(order.total || 0).toLocaleString('id-ID')}`,
      `LINK:${href}`,
    ];
    await tx.notification.createMany({
      data: adminUsers.map((a) => ({
        userId: a.id,
        title: 'Pesanan Dibayar',
        message: lines.join('\n'),
        read: false,
      })),
    });
  }

  const affiliateCodeRaw = typeof (order as any).affiliateCode === 'string' ? String((order as any).affiliateCode).trim().toUpperCase() : '';
  if (affiliateCodeRaw) {
    const aff = await getAffiliateSettingsTx(tx);
    const commissionRate = Math.max(0, Math.min(100, Number(aff.defaultCommissionPercent || 0))) / 100;
    const amount = Math.max(0, Math.round(Number(order.total || 0) * commissionRate));

    if (amount > 0) {
      const profile = await tx.affiliateProfile.findUnique({
        where: { code: affiliateCodeRaw },
        select: { id: true, userId: true },
      });

      if (profile && String(profile.userId) !== String(order.userId)) {
        const existing = await tx.commission.findUnique({ where: { orderId }, select: { id: true } });
        if (!existing) {
          await tx.commission.create({
            data: {
              affiliateId: profile.id,
              orderId,
              amount,
              status: 'EARNED',
            },
          });

          await tx.affiliateProfile.update({
            where: { id: profile.id },
            data: {
              pendingBalance: { increment: amount },
              conversions: { increment: 1 },
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: null,
              actorRole: null,
              action: 'AFFILIATE_COMMISSION_CREATE',
              entityType: 'Commission',
              entityId: null,
              metadata: {
                orderId,
                affiliateCode: affiliateCodeRaw,
                amount,
                rate: commissionRate,
                marketplaceSharePercent: aff.marketplaceSharePercent,
                holdDays: aff.holdDays,
                status: 'EARNED',
              } as any,
            },
          });
        }

        const referralIdRaw = typeof (order as any).affiliateReferralId === 'string' ? String((order as any).affiliateReferralId).trim() : '';
        const referralId = referralIdRaw && referralIdRaw.length <= 64 ? referralIdRaw : '';
        if (referralId) {
          const r = await tx.referral.findUnique({ where: { id: referralId }, select: { id: true, userId: true, affiliateId: true, converted: true } });
          if (r?.id && String(r.affiliateId) === String(profile.id)) {
            const desiredUserId = String(order.userId);
            if (!r.userId) {
              const existingForUser = await tx.referral.findFirst({
                where: { affiliateId: profile.id, userId: desiredUserId },
                select: { id: true },
              });
              if (!existingForUser?.id) {
                await tx.referral.update({ where: { id: r.id }, data: { userId: desiredUserId, converted: true } });
              } else {
                await tx.referral.update({ where: { id: existingForUser.id }, data: { converted: true } });
              }
            } else if (String(r.userId) === desiredUserId) {
              if (!r.converted) {
                await tx.referral.update({ where: { id: r.id }, data: { converted: true } });
              }
            }
          }
        } else {
          const alreadyLinked = await tx.referral.findFirst({
            where: { affiliateId: profile.id, userId: String(order.userId) },
            select: { id: true },
          });

          if (alreadyLinked?.id) {
            await tx.referral.update({ where: { id: alreadyLinked.id }, data: { converted: true } });
          } else {
            const candidate = await tx.referral.findFirst({
              where: { affiliateId: profile.id, userId: null },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });
            if (candidate?.id) {
              await tx.referral.update({
                where: { id: candidate.id },
                data: { userId: String(order.userId), converted: true },
              });
            }
          }
        }
      }
    }
  }

  const final = await tx.order.findUnique({ where: { id: orderId } });
  if (!final) throw new Error('Order not found');
  return {
    order: final,
    successEmail: order.user?.email
      ? {
          to: order.user.email,
          name: order.user.name || null,
          orderId,
          total: Number(order.total || 0),
          actionUrl: `${getAppUrl()}/dashboard/student/orders?orderId=${encodeURIComponent(orderId)}`,
        }
      : null,
  };
}

export const finalizeOrderPaid = async (orderId: string) => {
  const result = await prisma.$transaction(async (tx) => finalizeOrderPaidTx(tx as any, orderId));
  if (result.successEmail) {
    await sendStudentPaymentConfirmedEmail(result.successEmail);
  }
  return result.order;
};

export const handlePaymentWebhook = async (externalId: string, status: 'SUCCESS' | 'FAILED') => {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { externalId },
      include: {
        order: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });

    if (!payment) throw new Error('Payment not found');

    if (payment.status === status) {
      return { payment, successEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string }, failureEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string } };
    }
    if (payment.status === 'SUCCESS' || payment.status === 'FAILED') {
      return { payment, successEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string }, failureEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string } };
    }

    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status },
    });

    if (updated.count === 0) {
      const latest = await tx.payment.findUnique({ where: { id: payment.id } });
      if (!latest) throw new Error('Payment not found');
      return { payment: latest, successEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string }, failureEmail: null as null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string } };
    }

    let successEmail: null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string } = null;
    let failureEmail: null | { to: string; name?: string | null; orderId: string; total: number; actionUrl: string } = null;

    if (status === 'SUCCESS') {
      const latestOrder = await tx.order.findUnique({ where: { id: payment.orderId }, select: { id: true, status: true } });
      if (!latestOrder) throw new Error('Order not found');
      if (latestOrder.status === 'PENDING') {
        const finalized = await finalizeOrderPaidTx(tx as any, payment.orderId);
        successEmail = finalized.successEmail;
      } else {
        const admins = await tx.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: 'Pembayaran Masuk (Butuh Tinjauan)',
              message: [`Order: ${payment.orderId}`, `Status Order: ${latestOrder.status}`, `PaymentId: ${payment.id}`, `Provider: ${payment.provider}`, 'LINK:/dashboard/admin/orders']
                .filter(Boolean)
                .join('\n'),
              read: false,
            })),
          });
        }
      }
    } else if (payment.order?.user?.email) {
      failureEmail = {
        to: payment.order.user.email,
        name: payment.order.user.name || null,
        orderId: String(payment.orderId),
        total: Number(payment.order?.total || 0),
        actionUrl: `${getAppUrl()}/dashboard/student/orders?orderId=${encodeURIComponent(String(payment.orderId))}`,
      };
    }

    const final = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!final) throw new Error('Payment not found');
    return { payment: final, successEmail, failureEmail };
  });
  if (result.successEmail) {
    await sendStudentPaymentConfirmedEmail(result.successEmail);
  }
  if (result.failureEmail) {
    await sendStudentPaymentFailedEmail(result.failureEmail);
  }
  return result.payment;
};

export const RefundOrderSchema = z.object({
  orderId: z.string(),
  amount: z.number().min(0.01),
});

export const refundOrder = async (data: z.infer<typeof RefundOrderSchema>) => {
  const parsed = RefundOrderSchema.parse(data);

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: parsed.orderId },
      include: { items: true },
    });
    if (!order) throw new Error('Order not found');
    if (order.status !== 'PAID') throw new Error('Order is not paid');

    const alreadyRefunded = Number(order.refundTotal || 0);
    const refundable = Math.max(0, Number(order.total || 0) - alreadyRefunded);
    const amount = Math.min(parsed.amount, refundable);
    if (amount <= 0) throw new Error('No refundable amount left');

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const getTotalDiscountAmount = (it: any) => {
      const store = Number(it?.discountStoreAmount || 0);
      const marketplace = Number(it?.discountMarketplaceAmount || 0);
      if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
      return store + marketplace;
    };
    const refundableByItem = order.items.map((it) => {
      const lineSubtotal = Number(it.price || 0) * Number(it.quantity || 0);
      const netLine = Math.max(0, lineSubtotal - getTotalDiscountAmount(it));
      const already = Number(it.refundAmount || 0);
      return Math.max(0, netLine - already);
    });

    const totalRefundableItems = refundableByItem.reduce((sum, n) => sum + n, 0);
    if (totalRefundableItems <= 0) throw new Error('No refundable items');

    let remaining = amount;
    const lastIndex = order.items.length - 1;
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const canRefund = refundableByItem[i] || 0;
      if (canRefund <= 0) continue;
      const alloc = i === lastIndex ? remaining : round2((amount * canRefund) / totalRefundableItems);
      const bounded = Math.max(0, Math.min(canRefund, alloc));
      if (bounded <= 0) continue;
      await tx.orderItem.update({
        where: { id: item.id },
        data: { refundAmount: { increment: bounded } },
      });
      remaining = round2(remaining - bounded);
      if (remaining <= 0) break;
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        refundTotal: { increment: amount - Math.max(0, remaining) },
        refundedAt: alreadyRefunded + amount >= Number(order.total || 0) - 0.0001 ? new Date() : order.refundedAt,
      },
      include: { items: true },
    });

    const affiliateCodeRaw = typeof (updated as any).affiliateCode === 'string' ? String((updated as any).affiliateCode).trim().toUpperCase() : '';
    if (affiliateCodeRaw) {
      const commission = await tx.commission.findUnique({
        where: { orderId: updated.id },
        select: { id: true, affiliateId: true, amount: true, status: true },
      });

      if (commission?.id) {
        const aff = await getAffiliateSettingsTx(tx);
        const commissionRate = Math.max(0, Math.min(100, Number(aff.defaultCommissionPercent || 0))) / 100;
        const total = Math.max(0, Math.round(Number((updated as any).total || 0)));
        const refundTotal = Math.max(0, Math.round(Number((updated as any).refundTotal || 0)));
        const net = Math.max(0, total - refundTotal);
        const newAmount = Math.max(0, Math.round(net * commissionRate));
        const oldAmount = Math.max(0, Math.round(Number(commission.amount || 0)));
        const delta = newAmount - oldAmount;

        if (delta !== 0 || (newAmount <= 0 && String(commission.status || '').toUpperCase() !== 'REVERSED')) {
          const profile = await tx.affiliateProfile.findUnique({
            where: { id: commission.affiliateId },
            select: { id: true, balance: true, pendingBalance: true, conversions: true },
          });
          if (profile?.id) {
            const status = String(commission.status || '').toUpperCase();
            const applyToPending = status === 'EARNED';
            const nextBalance = applyToPending ? Number(profile.balance || 0) : Math.max(0, Number(profile.balance || 0) + delta);
            const nextPendingBalance = applyToPending ? Math.max(0, Number(profile.pendingBalance || 0) + delta) : Number(profile.pendingBalance || 0);
            const shouldDecrementConversion = oldAmount > 0 && newAmount <= 0;
            const nextConversions = shouldDecrementConversion ? Math.max(0, Number(profile.conversions || 0) - 1) : Number(profile.conversions || 0);

            await tx.affiliateProfile.update({
              where: { id: profile.id },
              data: { balance: nextBalance, pendingBalance: nextPendingBalance, conversions: nextConversions },
            });
          }

          await tx.commission.update({
            where: { id: commission.id },
            data: {
              amount: newAmount,
              status: newAmount <= 0 ? 'REVERSED' : String(commission.status || 'EARNED'),
            },
          });
        }
      }
    }

    const courseIds = updated.items.map((it) => it.courseId).filter(Boolean) as string[];
    for (const courseId of courseIds) {
      const paidItems = await tx.orderItem.findMany({
        where: { courseId, order: { is: { userId: updated.userId, status: 'PAID' } } },
        select: { price: true, quantity: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      });
      const netPaid = paidItems.reduce((sum, it) => {
        const lineSubtotal = Number(it.price || 0) * Number(it.quantity || 0);
        const netLine = Math.max(0, lineSubtotal - getTotalDiscountAmount(it));
        const remainingPaid = Math.max(0, netLine - Number(it.refundAmount || 0));
        return sum + remainingPaid;
      }, 0);

      if (netPaid <= 0) {
        await tx.enrollment.deleteMany({ where: { userId: updated.userId, courseId } });
      }
    }

    return updated;
  });
};
