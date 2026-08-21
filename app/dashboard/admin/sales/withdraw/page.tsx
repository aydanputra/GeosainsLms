import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import type { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

type AdminActor = {
  id: string;
  role: Role;
};

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export async function syncMentorWithdrawalByAdmin(actor: AdminActor, id: string) {
  const safeId = String(id || '').trim();
  if (!safeId) return { updated: false, notified: false };

  const withdrawal = await prisma.mentorWithdrawal.findUnique({
    where: { id: safeId },
    select: { id: true, userId: true, amount: true, status: true, provider: true, disbursementId: true, externalId: true },
  });
  if (!withdrawal) return { updated: false, notified: false };

  const provider = String(withdrawal.provider || '').toUpperCase();
  const status = String(withdrawal.status || '').toUpperCase();
  if (provider !== 'XENDIT') return { updated: false, notified: false };
  if (status === 'SUCCESS' || status === 'FAILED') return { updated: false, notified: false };

  const disbursementId = String(withdrawal.disbursementId || '').trim();
  if (!disbursementId) return { updated: false, notified: false };

  const secretKey = String(process.env.XENDIT_SECRET_KEY || process.env.XENDIT_API_KEY || '').trim();
  if (!secretKey) return { updated: false, notified: false };

  const auth = Buffer.from(`${secretKey}:`, 'utf8').toString('base64');
  const res = await fetch(`https://api.xendit.co/disbursements/${encodeURIComponent(disbursementId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { updated: false, notified: false };

  const raw = typeof (data as any)?.status === 'string' ? String((data as any).status).toUpperCase() : '';
  const responseDisbursementId = typeof (data as any)?.id === 'string' ? String((data as any).id).trim() : '';
  const responseExternalId = typeof (data as any)?.external_id === 'string' ? String((data as any).external_id).trim() : '';
  const responseAmount =
    typeof (data as any)?.amount === 'number'
      ? Number((data as any).amount)
      : typeof (data as any)?.amount === 'string'
        ? Number((data as any).amount)
        : NaN;
  if (responseDisbursementId && responseDisbursementId !== disbursementId) return { updated: false, notified: false };
  if (withdrawal.externalId && responseExternalId && responseExternalId !== String(withdrawal.externalId)) {
    return { updated: false, notified: false };
  }
  if (!Number.isFinite(responseAmount) || Math.abs(Number(withdrawal.amount || 0) - Number(responseAmount)) > 0.01) {
    return { updated: false, notified: false };
  }
  const nextStatus = raw === 'COMPLETED' ? 'SUCCESS' : raw === 'FAILED' ? 'FAILED' : 'PROCESSING';

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.mentorWithdrawal.findUnique({
      where: { id: safeId },
      select: { id: true, userId: true, amount: true, status: true, externalId: true },
    });
    if (!current) return { updated: false, notified: false, userId: '', amount: 0 };

    const currentStatus = String(current.status || '').toUpperCase();
    if (currentStatus === 'SUCCESS' || currentStatus === 'FAILED') {
      return { updated: false, notified: false, userId: String(current.userId || ''), amount: Number(current.amount || 0) };
    }

    const updated = await tx.mentorWithdrawal.updateMany({
      where: { id: safeId, status: { notIn: ['SUCCESS', 'FAILED'] } },
      data: {
        status: nextStatus,
        metadata: data as any,
      },
    });
    if (updated.count === 0) {
      return { updated: false, notified: false, userId: String(current.userId || ''), amount: Number(current.amount || 0) };
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'MENTOR_WITHDRAW_SYNC',
        entityType: 'MentorWithdrawal',
        entityId: safeId,
        metadata: {
          previousStatus: currentStatus,
          provider: 'XENDIT',
          disbursementId,
          externalId: current.externalId || withdrawal.externalId || null,
          amount: Number(responseAmount),
          status: raw || null,
          normalized: nextStatus,
        } as any,
      },
    });

    return {
      updated: true,
      notified: nextStatus !== currentStatus && (nextStatus === 'SUCCESS' || nextStatus === 'FAILED'),
      userId: String(current.userId || ''),
      amount: Number(current.amount || 0),
    };
  });

  if (result.updated && result.notified && result.userId) {
    await prisma.notification.create({
      data: {
        userId: result.userId,
        title: nextStatus === 'SUCCESS' ? 'Withdraw Selesai' : 'Withdraw Gagal',
        message: [`Jumlah: ${formatIdr(result.amount)}`, `Status: ${nextStatus}`, 'LINK:/dashboard/mentor/sales/withdraw'].join('\n'),
        read: false,
      },
    });
  }

  return result;
}

export async function markAffiliateWithdrawalByAdmin(actor: AdminActor, id: string, nextStatus: string) {
  const safeId = String(id || '').trim();
  const safeStatus = String(nextStatus || '').toUpperCase();
  if (!safeId) return { updated: false, notified: false };
  if (safeStatus !== 'SUCCESS' && safeStatus !== 'FAILED') return { updated: false, notified: false };

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.withdrawal.findUnique({
      where: { id: safeId },
      select: { id: true, amount: true, status: true, affiliateId: true, affiliate: { select: { userId: true } } },
    });
    if (!existing) return { updated: false, notified: false, targetUserId: '', amount: 0 };

    const prevStatus = String(existing.status || '').toUpperCase();
    if (prevStatus === 'SUCCESS' || prevStatus === 'FAILED') {
      return {
        updated: false,
        notified: false,
        targetUserId: existing.affiliate?.userId ? String(existing.affiliate.userId) : '',
        amount: Number(existing.amount || 0),
      };
    }

    const updated = await tx.withdrawal.updateMany({
      where: { id: safeId, status: { notIn: ['SUCCESS', 'FAILED'] } },
      data: { status: safeStatus },
    });
    if (updated.count === 0) {
      return {
        updated: false,
        notified: false,
        targetUserId: existing.affiliate?.userId ? String(existing.affiliate.userId) : '',
        amount: Number(existing.amount || 0),
      };
    }

    if (safeStatus === 'FAILED') {
      await tx.affiliateProfile.update({
        where: { id: existing.affiliateId },
        data: { balance: { increment: Number(existing.amount || 0) } },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'AFFILIATE_WITHDRAW_MARK',
        entityType: 'Withdrawal',
        entityId: safeId,
        metadata: { previousStatus: prevStatus, status: safeStatus, amount: Number(existing.amount || 0) } as any,
      },
    });

    return {
      updated: true,
      notified: Boolean(existing.affiliate?.userId),
      targetUserId: existing.affiliate?.userId ? String(existing.affiliate.userId) : '',
      amount: Number(existing.amount || 0),
    };
  });

  if (result.updated && result.notified && result.targetUserId) {
    await prisma.notification.create({
      data: {
        userId: result.targetUserId,
        title: safeStatus === 'SUCCESS' ? 'Withdraw Affiliate Selesai' : 'Withdraw Affiliate Gagal',
        message: [`Jumlah: ${formatIdr(result.amount)}`, `Status: ${safeStatus}`, 'LINK:/dashboard/student/affiliate'].join('\n'),
        read: false,
      },
    });
  }

  return result;
}

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  const syncMentorWithdrawal = async (formData: FormData) => {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyToken(token);
    if (!payload?.id || payload.role !== 'ADMIN') return;
    const id = String(formData.get('id') || '');
    if (!id) return;
    await syncMentorWithdrawalByAdmin({ id: String(payload.id), role: payload.role }, id);
  };

  const markMentorWithdrawal = async (formData: FormData) => {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyToken(token);
    if (!payload?.id || payload.role !== 'ADMIN') return;
    const id = String(formData.get('id') || '');
    const nextStatus = String(formData.get('status') || '').toUpperCase();
    if (!id) return;
    if (nextStatus !== 'SUCCESS' && nextStatus !== 'FAILED') return;

    const existing = await prisma.mentorWithdrawal.findUnique({ where: { id }, select: { id: true, userId: true, amount: true, status: true } });
    if (!existing) return;
    const prevStatus = String(existing.status || '').toUpperCase();
    if (prevStatus === 'SUCCESS' || prevStatus === 'FAILED') return;

    const updated = await prisma.mentorWithdrawal.updateMany({
      where: { id, status: { notIn: ['SUCCESS', 'FAILED'] } },
      data: { status: nextStatus },
    });
    if (updated.count === 0) return;

    await prisma.notification.create({
      data: {
        userId: existing.userId,
        title: nextStatus === 'SUCCESS' ? 'Withdraw Selesai' : 'Withdraw Gagal',
        message: [`Jumlah: IDR ${Math.round(Number(existing.amount || 0)).toLocaleString('id-ID')}`, `Status: ${nextStatus}`, 'LINK:/dashboard/mentor/sales/withdraw'].join('\n'),
        read: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: String(payload.id),
        actorRole: payload.role,
        action: 'MENTOR_WITHDRAW_MARK',
        entityType: 'MentorWithdrawal',
        entityId: id,
        metadata: { previousStatus: prevStatus, status: nextStatus, amount: Number(existing.amount || 0) } as any,
      },
    });
  };

  const markAffiliateWithdrawal = async (formData: FormData) => {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyToken(token);
    if (!payload?.id || payload.role !== 'ADMIN') return;
    const actorId = String(payload.id);

    const id = String(formData.get('id') || '');
    const nextStatus = String(formData.get('status') || '').toUpperCase();
    if (!id) return;
    if (nextStatus !== 'SUCCESS' && nextStatus !== 'FAILED') return;
    await markAffiliateWithdrawalByAdmin({ id: actorId, role: payload.role }, id, nextStatus);
  };

  const [withdrawals, mentorWithdrawNotifications, mentorWithdrawals] = await Promise.all([
    prisma.withdrawal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        status: true,
        note: true,
        createdAt: true,
        affiliate: {
          select: {
            id: true,
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.notification.findMany({
      where: { userId, title: 'Permintaan Withdraw Mentor' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, message: true, read: true, createdAt: true },
    }),
    prisma.mentorWithdrawal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        mode: true,
        provider: true,
        externalId: true,
        disbursementId: true,
        bankCode: true,
        bankAccountNumber: true,
        bankAccountHolderName: true,
        note: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-10 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Withdraw</h1>
        <p className="text-sm text-slate-600 mt-1">Daftar penarikan dan permintaan withdraw secara global.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="text-lg font-extrabold text-slate-900 mb-4">Withdraw Affiliate</div>
        {withdrawals.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada data withdraw affiliate.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Affiliate</th>
                  <th className="py-2 pr-4">Jumlah</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Catatan</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-700">{formatDate(w.createdAt.toISOString())}</td>
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-slate-900">{w.affiliate?.user?.name || w.affiliate?.user?.email || 'Affiliate'}</div>
                      <div className="text-xs text-slate-500">{w.affiliate?.user?.email || ''}</div>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(Number(w.amount || 0))}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-slate-100 text-slate-700 border-slate-200">
                        {String(w.status || '-')}
                      </span>
                    </td>
                    <td className="py-2 text-slate-700">{w.note || '-'}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {String(w.status || '').toUpperCase() === 'SUCCESS' || String(w.status || '').toUpperCase() === 'FAILED' ? (
                        <span className="text-xs text-slate-400">-</span>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <form action={markAffiliateWithdrawal}>
                            <input type="hidden" name="id" value={w.id} />
                            <input type="hidden" name="status" value="SUCCESS" />
                            <button
                              type="submit"
                              className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700"
                            >
                              Selesai
                            </button>
                          </form>
                          <form action={markAffiliateWithdrawal}>
                            <input type="hidden" name="id" value={w.id} />
                            <input type="hidden" name="status" value="FAILED" />
                            <button
                              type="submit"
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-rose-700 font-extrabold text-xs hover:bg-rose-50"
                            >
                              Gagal
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="text-lg font-extrabold text-slate-900 mb-4">Permintaan Withdraw Mentor</div>
        {mentorWithdrawals.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada data withdraw mentor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Jumlah</th>
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Rekening</th>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Catatan</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {mentorWithdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-slate-700">{formatDate(w.createdAt.toISOString())}</td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">{w.user?.name || w.user?.email || 'Mentor'}</div>
                      <div className="text-xs text-slate-500">{w.user?.email || ''}</div>
                      <div className="text-[11px] text-slate-400 mt-1">ID: {w.id}</div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap font-extrabold text-slate-900">{formatIdr(Number(w.amount || 0))}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-slate-50 text-slate-700 border-slate-200">
                        {String(w.mode || '-')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-slate-100 text-slate-700 border-slate-200">
                        {String(w.status || '-')}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-xs text-slate-700 whitespace-nowrap">{w.bankCode || '-'}</div>
                      <div className="text-xs text-slate-700 whitespace-nowrap">{w.bankAccountNumber ? `••••${String(w.bankAccountNumber).slice(-4)}` : '-'}</div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">{w.bankAccountHolderName || '-'}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-xs text-slate-700 whitespace-nowrap">{w.provider || '-'}</div>
                      <div className="text-[11px] text-slate-500 whitespace-nowrap">{w.disbursementId || w.externalId || '-'}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 max-w-[320px]">
                      <div className="whitespace-pre-line">{w.note || '-'}</div>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {String(w.status || '').toUpperCase() === 'SUCCESS' || String(w.status || '').toUpperCase() === 'FAILED' ? (
                        <span className="text-xs text-slate-400">-</span>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {String(w.provider || '').toUpperCase() === 'XENDIT' && String(w.disbursementId || '').trim() ? (
                            <form action={syncMentorWithdrawal}>
                              <input type="hidden" name="id" value={w.id} />
                              <button
                                type="submit"
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50"
                              >
                                Sync
                              </button>
                            </form>
                          ) : null}
                          <form action={markMentorWithdrawal}>
                            <input type="hidden" name="id" value={w.id} />
                            <input type="hidden" name="status" value="SUCCESS" />
                            <button
                              type="submit"
                              className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700"
                            >
                              Selesai
                            </button>
                          </form>
                          <form action={markMentorWithdrawal}>
                            <input type="hidden" name="id" value={w.id} />
                            <input type="hidden" name="status" value="FAILED" />
                            <button
                              type="submit"
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-rose-700 font-extrabold text-xs hover:bg-rose-50"
                            >
                              Gagal
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="h-px bg-slate-200 my-6"></div>
        {mentorWithdrawNotifications.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada permintaan withdraw mentor.</div>
        ) : (
          <div className="space-y-3">
            {mentorWithdrawNotifications.map((n) => (
              <div key={n.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-extrabold text-slate-900">{n.title}</div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">{formatDate(n.createdAt.toISOString())}</div>
                </div>
                <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">{n.message}</div>
                <div className="mt-3 text-xs text-slate-500">{n.read ? 'Status: Dibaca' : 'Status: Belum dibaca'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
