import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

export const dynamic = 'force-dynamic';

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
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
    const actorId = String(payload.id);

    const id = String(formData.get('id') || '');
    if (!id) return;

    const withdrawal = await prisma.mentorWithdrawal.findUnique({
      where: { id },
      select: { id: true, userId: true, amount: true, status: true, provider: true, disbursementId: true, externalId: true },
    });
    if (!withdrawal) return;

    const provider = String(withdrawal.provider || '').toUpperCase();
    const status = String(withdrawal.status || '').toUpperCase();
    if (provider !== 'XENDIT') return;
    if (status === 'SUCCESS' || status === 'FAILED') return;

    const disbursementId = String(withdrawal.disbursementId || '').trim();
    if (!disbursementId) return;

    const secretKey = String(process.env.XENDIT_SECRET_KEY || process.env.XENDIT_API_KEY || '').trim();
    if (!secretKey) return;

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
    if (!res.ok) return;

    const raw = typeof (data as any)?.status === 'string' ? String((data as any).status).toUpperCase() : '';
    const nextStatus = raw === 'COMPLETED' ? 'SUCCESS' : raw === 'FAILED' ? 'FAILED' : 'PROCESSING';

    const changed = nextStatus !== status;
    await prisma.mentorWithdrawal.update({
      where: { id },
      data: {
        status: nextStatus,
        metadata: data as any,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: String(payload.id),
        actorRole: payload.role,
        action: 'MENTOR_WITHDRAW_SYNC',
        entityType: 'MentorWithdrawal',
        entityId: id,
        metadata: { provider: 'XENDIT', disbursementId, externalId: withdrawal.externalId || null, status: raw || null, normalized: nextStatus } as any,
      },
    });

    if (changed && (nextStatus === 'SUCCESS' || nextStatus === 'FAILED')) {
      await prisma.notification.create({
        data: {
          userId: withdrawal.userId,
          title: nextStatus === 'SUCCESS' ? 'Withdraw Selesai' : 'Withdraw Gagal',
          message: [`Jumlah: ${formatIdr(Number(withdrawal.amount || 0))}`, `Status: ${nextStatus}`, 'LINK:/dashboard/mentor/sales/withdraw'].join('\n'),
          read: false,
        },
      });
    }
  };

  const markMentorWithdrawal = async (formData: FormData) => {
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

    const existing = await prisma.mentorWithdrawal.findUnique({ where: { id }, select: { id: true, userId: true, amount: true, status: true } });
    if (!existing) return;

    await prisma.mentorWithdrawal.update({
      where: { id },
      data: { status: nextStatus },
    });

    await prisma.notification.create({
      data: {
        userId: existing.userId,
        title: nextStatus === 'SUCCESS' ? 'Withdraw Selesai' : 'Withdraw Gagal',
        message: [`Jumlah: IDR ${Math.round(Number(existing.amount || 0)).toLocaleString('id-ID')}`, `Status: ${nextStatus}`, 'LINK:/dashboard/mentor/sales/withdraw'].join('\n'),
        read: false,
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

    const existing = await prisma.withdrawal.findUnique({
      where: { id },
      select: { id: true, amount: true, status: true, affiliateId: true, affiliate: { select: { userId: true } } },
    });
    if (!existing) return;
    const prevStatus = String(existing.status || '').toUpperCase();
    if (prevStatus === 'SUCCESS' || prevStatus === 'FAILED') return;

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({ where: { id }, data: { status: nextStatus } });

      if (nextStatus === 'FAILED') {
        await tx.affiliateProfile.update({
          where: { id: existing.affiliateId },
          data: { balance: { increment: Number(existing.amount || 0) } },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          actorRole: payload.role,
          action: 'AFFILIATE_WITHDRAW_MARK',
          entityType: 'Withdrawal',
          entityId: id,
          metadata: { status: nextStatus, amount: Number(existing.amount || 0) } as any,
        },
      });
    });

    const targetUserId = existing.affiliate?.userId ? String(existing.affiliate.userId) : '';
    if (targetUserId) {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: nextStatus === 'SUCCESS' ? 'Withdraw Affiliate Selesai' : 'Withdraw Affiliate Gagal',
          message: [`Jumlah: ${formatIdr(Number(existing.amount || 0))}`, `Status: ${nextStatus}`, 'LINK:/dashboard/student/affiliate'].join('\n'),
          read: false,
        },
      });
    }
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
