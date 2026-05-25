import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';

const SETTINGS_SLUG = '__course_settings__';
const SITE_SETTINGS_SLUG = '__site_settings__';

function safeParseJson(value: unknown) {
  try {
    if (typeof value !== 'string') return {};
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toInt(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toBool(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function getStoreDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
  return store;
}

async function computeAvailableNet(userId: string, role: string) {
  const settingsPage = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
  const settings = safeParseJson(settingsPage?.content);
  const enableRevenueSharing = toBool((settings as any).enableRevenueSharing, false);
  const instructorRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).instructorRevenueSharePercent, 90)));
  const adminRevenueSharePercent = Math.max(0, Math.min(100, toInt((settings as any).adminRevenueSharePercent, 10)));
  const minimumWithdrawalAmount = Math.max(0, toInt((settings as any).minimumWithdrawalAmount, 100000));
  const minimumDaysBeforeBalanceAvailable = Math.max(0, toInt((settings as any).minimumDaysBeforeBalanceAvailable, 7));
  const feePercent = enableRevenueSharing ? adminRevenueSharePercent : 0;
  const mentorPercent = enableRevenueSharing ? instructorRevenueSharePercent : 100;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - minimumDaysBeforeBalanceAvailable);

  const myCourseIds = (
    await prisma.course.findMany({
      where: { instructorId: userId, deletedAt: null },
      select: { id: true },
    })
  ).map((c) => c.id);
  const coCourseIds = (
    await prisma.courseCoInstructor.findMany({
      where: { userId },
      select: { courseId: true },
    })
  ).map((x) => x.courseId);
  const courseIds = Array.from(new Set([...myCourseIds, ...coCourseIds]));

  const courseItems = courseIds.length
    ? await prisma.orderItem.findMany({
        where: { courseId: { in: courseIds }, order: { is: { status: 'PAID', createdAt: { lte: cutoff } } } },
        select: { quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      })
    : [];
  const courseGross = courseItems.reduce((sum, it) => {
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    return sum + Math.max(0, lineSubtotal - discount - refund);
  }, 0);
  const courseFee = Math.max(0, (courseGross * feePercent) / 100);
  const courseNet = Math.max(0, (courseGross * mentorPercent) / 100);

  const approvedVendors = await prisma.shopVendor.findMany({
    where: role === 'ADMIN' ? undefined : { status: 'APPROVED', OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, commissionType: true, commissionRate: true },
  });
  const vendorIds = approvedVendors.map((v) => v.id);
  const vendorById = new Map(approvedVendors.map((v) => [v.id, v] as const));

  const products = vendorIds.length
    ? await prisma.product.findMany({
        where: { vendorId: { in: vendorIds } },
        select: { id: true, vendorId: true },
      })
    : [];
  const productIds = products.map((p) => p.id);
  const productItems = productIds.length
    ? await prisma.orderItem.findMany({
        where: { productId: { in: productIds }, order: { is: { status: 'PAID', createdAt: { lte: cutoff } } } },
        select: { productId: true, quantity: true, price: true, discountAmount: true, discountStoreAmount: true, discountMarketplaceAmount: true, refundAmount: true },
      })
    : [];

  const productVendorByProductId = new Map(products.map((p) => [p.id, p.vendorId] as const));
  const productGrossByVendor = new Map<string, { gross: number; sold: number }>();
  for (const it of productItems) {
    const productId = it.productId;
    if (!productId) continue;
    const vendorId = productVendorByProductId.get(productId);
    if (!vendorId) continue;
    const prev = productGrossByVendor.get(vendorId) || { gross: 0, sold: 0 };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const discount = getStoreDiscountAmount(it);
    const refund = Number(it.refundAmount || 0);
    const gross = Math.max(0, lineSubtotal - discount - refund);
    productGrossByVendor.set(vendorId, { gross: prev.gross + gross, sold: prev.sold + qty });
  }

  let productGross = 0;
  let productFee = 0;
  let productNet = 0;
  for (const [vendorId, agg] of productGrossByVendor.entries()) {
    const vendor = vendorById.get(vendorId);
    if (!vendor) continue;
    const commissionType = vendor.commissionType || 'PERCENT';
    const commissionRate = Number(vendor.commissionRate || 0);
    const fee =
      commissionType === 'FLAT' ? Math.max(0, commissionRate * agg.sold) : Math.max(0, (agg.gross * commissionRate) / 100);
    const net = Math.max(0, agg.gross - fee);
    productGross += agg.gross;
    productFee += fee;
    productNet += net;
  }

  const totals = {
    courses: { gross: courseGross, fee: courseFee, net: courseNet },
    products: { gross: productGross, fee: productFee, net: productNet },
    all: { gross: courseGross + productGross, fee: courseFee + productFee, net: courseNet + productNet },
  };

  const reservedAgg = await prisma.mentorWithdrawal.aggregate({
    where: {
      userId,
      status: { in: ['PENDING', 'PROCESSING', 'SUCCESS'] },
    },
    _sum: { amount: true },
  });
  const reserved = Number(reservedAgg._sum.amount || 0);
  const availableNet = Math.max(0, Number(totals.all.net || 0) - reserved);

  return {
    minimumWithdrawalAmount,
    reserved,
    availableNet,
    totals,
  };
}

async function getWithdrawConfig() {
  const site = await prisma.page.findUnique({ where: { slug: SITE_SETTINGS_SLUG }, select: { content: true } });
  const obj = safeParseJson(site?.content);
  const withdrawRaw = typeof (obj as any).withdrawMode === 'string' ? String((obj as any).withdrawMode).trim().toUpperCase() : '';
  const methodRaw = typeof (obj as any).paymentMethod === 'string' ? String((obj as any).paymentMethod).trim().toUpperCase() : '';
  const paymentMethod = methodRaw === 'MIDTRANS' || methodRaw === 'MANUAL' ? methodRaw : 'XENDIT';
  const requested = withdrawRaw === 'AUTO' ? 'AUTO' : 'MANUAL';
  const withdrawMode = requested === 'AUTO' && paymentMethod !== 'XENDIT' ? 'MANUAL' : requested;
  return { withdrawMode, paymentMethod };
}

async function createXenditDisbursement(args: {
  externalId: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  description: string;
}) {
  const secretKey = String(process.env.XENDIT_SECRET_KEY || process.env.XENDIT_API_KEY || '').trim();
  if (!secretKey) throw new Error('XENDIT_SECRET_KEY not configured');

  const auth = Buffer.from(`${secretKey}:`, 'utf8').toString('base64');
  const res = await fetch('https://api.xendit.co/disbursements', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      external_id: args.externalId,
      amount: Math.max(1, Math.round(args.amount)),
      bank_code: args.bankCode,
      account_holder_name: args.accountHolderName,
      account_number: args.accountNumber,
      description: args.description,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof (data as any)?.message === 'string' ? (data as any).message : typeof (data as any)?.error === 'string' ? (data as any).error : 'Gagal membuat disbursement';
    throw new Error(msg);
  }
  return data as any;
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      amount?: unknown;
      note?: unknown;
      bankCode?: unknown;
      bankAccountNumber?: unknown;
      bankAccountHolderName?: unknown;
    };
    const amountRaw = typeof body.amount === 'number' ? body.amount : typeof body.amount === 'string' ? Number(body.amount) : NaN;
    const amount = Number.isFinite(amountRaw) ? Math.max(0, Math.round(amountRaw)) : 0;
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const bankCode = typeof body.bankCode === 'string' ? body.bankCode.trim().toUpperCase() : '';
    const bankAccountNumber = typeof body.bankAccountNumber === 'string' ? body.bankAccountNumber.trim() : '';
    const bankAccountHolderName = typeof body.bankAccountHolderName === 'string' ? body.bankAccountHolderName.trim() : '';

    const computed = await computeAvailableNet(String(user.id), String(user.role));
    const min = Number(computed.minimumWithdrawalAmount || 0);
    const available = Number(computed.availableNet || 0);

    if (amount <= 0) return NextResponse.json({ error: 'Jumlah tidak valid' }, { status: 400 });
    if (amount < min) return NextResponse.json({ error: `Minimum withdraw adalah IDR ${min.toLocaleString('id-ID')}` }, { status: 400 });
    if (amount > available) return NextResponse.json({ error: 'Jumlah melebihi saldo tersedia' }, { status: 400 });

    const { withdrawMode, paymentMethod } = await getWithdrawConfig();

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    const me = await prisma.user.findUnique({ where: { id: String(user.id) }, select: { id: true, name: true, email: true } });
    const who = me?.name || me?.email || String(user.id);

    if (withdrawMode === 'AUTO') {
      if (paymentMethod !== 'XENDIT') return NextResponse.json({ error: 'Withdraw otomatis hanya tersedia untuk paymentMethod XENDIT' }, { status: 400 });
      if (!bankCode) return NextResponse.json({ error: 'Bank wajib diisi untuk withdraw otomatis' }, { status: 400 });
      if (!bankAccountNumber) return NextResponse.json({ error: 'Nomor rekening wajib diisi untuk withdraw otomatis' }, { status: 400 });
      if (!bankAccountHolderName) return NextResponse.json({ error: 'Nama pemilik rekening wajib diisi untuk withdraw otomatis' }, { status: 400 });

      const externalId = `mw_${String(user.id)}_${Date.now()}`;
      const created = await prisma.mentorWithdrawal.create({
        data: {
          userId: String(user.id),
          amount,
          status: 'PROCESSING',
          mode: 'AUTO',
          provider: 'XENDIT',
          externalId,
          bankCode,
          bankAccountNumber,
          bankAccountHolderName,
          note: note || null,
        },
        select: { id: true },
      });

      try {
        const disbursement = await createXenditDisbursement({
          externalId,
          amount,
          bankCode,
          accountNumber: bankAccountNumber,
          accountHolderName: bankAccountHolderName,
          description: `Withdraw mentor ${who}`,
        });

        const statusRaw = typeof disbursement?.status === 'string' ? String(disbursement.status).toUpperCase() : '';
        const nextStatus = statusRaw === 'COMPLETED' ? 'SUCCESS' : statusRaw === 'FAILED' ? 'FAILED' : 'PROCESSING';
        const disbursementId = typeof disbursement?.id === 'string' ? disbursement.id : null;

        await prisma.mentorWithdrawal.update({
          where: { id: created.id },
          data: {
            status: nextStatus,
            disbursementId,
            metadata: disbursement ?? undefined,
          },
        });

        await prisma.notification.create({
          data: {
            userId: String(user.id),
            title: 'Withdraw Diproses Otomatis',
            message: [
              `Jumlah: IDR ${amount.toLocaleString('id-ID')}`,
              `Status: ${nextStatus}`,
              `Metode: XENDIT`,
              'LINK:/dashboard/mentor/sales/withdraw',
            ].join('\n'),
            read: false,
          },
        });

        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: 'Withdraw Otomatis Mentor',
              message: [
                `Mentor: ${who}`,
                `UserId: ${String(user.id)}`,
                `Jumlah: IDR ${amount.toLocaleString('id-ID')}`,
                `Status: ${nextStatus}`,
                disbursementId ? `XenditId: ${disbursementId}` : '',
                `LINK:/dashboard/admin/sales/withdraw`,
              ]
                .filter(Boolean)
                .join('\n'),
              read: false,
            })),
          });
        }

        await writeAuditLog({
          req,
          actor: { id: String(user.id), role: user.role },
          action: 'MENTOR_WITHDRAW_AUTO',
          entityType: 'MentorWithdrawal',
          entityId: created.id,
          metadata: { amount, status: nextStatus, provider: 'XENDIT', disbursementId, bankCode },
        });

        return NextResponse.json({ ok: true, mode: 'AUTO', id: created.id, status: nextStatus }, { status: 200 });
      } catch (e: any) {
        await prisma.mentorWithdrawal.update({
          where: { id: created.id },
          data: {
            status: 'FAILED',
            metadata: { error: e?.message || 'Gagal membuat disbursement' },
          },
        });
        await writeAuditLog({
          req,
          actor: { id: String(user.id), role: user.role },
          action: 'MENTOR_WITHDRAW_AUTO_FAILED',
          entityType: 'MentorWithdrawal',
          entityId: created.id,
          metadata: { amount, provider: 'XENDIT', error: e?.message || 'Gagal membuat disbursement' },
        });
        return NextResponse.json({ error: e?.message || 'Gagal memproses withdraw otomatis' }, { status: 400 });
      }
    }

    const created = await prisma.mentorWithdrawal.create({
      data: {
        userId: String(user.id),
        amount,
        status: 'PENDING',
        mode: 'MANUAL',
        note: note || null,
      },
      select: { id: true },
    });

    const lines = [
      `Mentor: ${who}`,
      `UserId: ${String(user.id)}`,
      `Jumlah: IDR ${amount.toLocaleString('id-ID')}`,
      note ? `Catatan: ${note}` : '',
      `Saldo tersedia (bersih): IDR ${Math.round(available).toLocaleString('id-ID')}`,
      `WithdrawalId: ${created.id}`,
      `LINK:/dashboard/admin/sales/withdraw`,
    ]
      .filter(Boolean)
      .join('\n');

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: 'Permintaan Withdraw Mentor',
          message: lines,
          read: false,
        })),
      });
    }

    await prisma.notification.create({
      data: {
        userId: String(user.id),
        title: 'Withdraw Diajukan',
        message: [`Jumlah: IDR ${amount.toLocaleString('id-ID')}`, 'Status: Menunggu admin', 'LINK:/dashboard/mentor/sales/withdraw'].join('\n'),
        read: false,
      },
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'MENTOR_WITHDRAW_REQUEST',
      entityType: 'MentorWithdrawal',
      entityId: created.id,
      metadata: { amount, mode: 'MANUAL' },
    });

    return NextResponse.json({ ok: true, mode: 'MANUAL', id: created.id, status: 'PENDING' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal mengirim permintaan withdraw' }, { status: 500 });
  }
}
