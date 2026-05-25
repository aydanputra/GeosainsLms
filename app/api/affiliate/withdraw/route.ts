import { NextRequest, NextResponse } from 'next/server';
import { requestWithdrawal, WithdrawalSchema } from '@/modules/affiliate/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';
import { prisma } from '@/utils/prisma';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { amount?: unknown; note?: unknown };
    const amountRaw = typeof body.amount === 'number' ? body.amount : typeof body.amount === 'string' ? Number(body.amount) : NaN;
    const parsed = WithdrawalSchema.safeParse({
      amount: Number.isFinite(amountRaw) ? Math.round(amountRaw) : NaN,
      note: typeof body.note === 'string' ? body.note.trim() : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Jumlah withdraw minimal IDR 50.000' }, { status: 400 });
    }

    const withdrawal = await requestWithdrawal(user.id, parsed.data.amount, parsed.data.note);
    const withdrawalId = Array.isArray(withdrawal) ? ((withdrawal as any)?.[0]?.id ? String((withdrawal as any)[0].id) : null) : null;

    const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    if (adminUsers.length > 0) {
      await prisma.notification.createMany({
        data: adminUsers.map((a) => ({
          userId: a.id,
          title: 'Permintaan Withdraw Affiliate',
          message: [`UserId: ${String(user.id)}`, `Jumlah: IDR ${Math.round(parsed.data.amount).toLocaleString('id-ID')}`, withdrawalId ? `Withdrawal: ${withdrawalId}` : '', 'LINK:/dashboard/admin/sales/withdraw']
            .filter(Boolean)
            .join('\n'),
          read: false,
        })),
      });
    }
    await prisma.notification.create({
      data: {
        userId: String(user.id),
        title: 'Permintaan Withdraw Dikirim',
        message: [`Jumlah: IDR ${Math.round(parsed.data.amount).toLocaleString('id-ID')}`, 'Status: PENDING', 'LINK:/dashboard/student/affiliate'].join('\n'),
        read: false,
      },
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'AFFILIATE_WITHDRAW_REQUEST',
      entityType: 'Withdrawal',
      entityId: withdrawalId,
      metadata: { amount: parsed.data.amount },
    });
    return NextResponse.json(withdrawal, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
