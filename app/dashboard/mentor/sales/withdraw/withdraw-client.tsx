"use client";

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Cards from '@/modules/dashboard/components/Cards';

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

export default function WithdrawClient({
  me,
  config,
  totals,
}: {
  me: { id: string; name: string; email: string };
  config: {
    enableRevenueSharing: boolean;
    feePercent: number;
    mentorPercent: number;
    minimumWithdrawalAmount: number;
    minimumDaysBeforeBalanceAvailable: number;
    enabledWithdrawMethods: string[];
    bankInstructions: string;
    withdrawMode: 'AUTO' | 'MANUAL';
  };
  totals: {
    courses: { gross: number; fee: number; net: number };
    products: { gross: number; fee: number; net: number; enabled: boolean };
    all: { gross: number; fee: number; affiliateFee?: number; net: number; reserved: number; hold: number; paidNet: number };
  };
}) {
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [bankCode, setBankCode] = useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minAmount = Number(config.minimumWithdrawalAmount || 0);
  const available = Number(totals?.all?.net || 0);
  const reserved = Number(totals?.all?.reserved || 0);
  const hold = Number(totals?.all?.hold || 0);
  const paidNet = Number(totals?.all?.paidNet || 0);
  const affiliateFee = Number((totals as any)?.all?.affiliateFee || 0);
  const isAuto = config.withdrawMode === 'AUTO';

  const canSubmit = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return false;
    if (n < minAmount) return false;
    if (n > available) return false;
    if (isAuto) {
      if (!bankCode.trim()) return false;
      if (!bankAccountNumber.trim()) return false;
      if (!bankAccountHolderName.trim()) return false;
    }
    return !isSubmitting;
  }, [amount, available, bankAccountHolderName, bankAccountNumber, bankCode, isAuto, minAmount, isSubmitting]);

  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/mentor/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          note: note.trim() ? note.trim() : null,
          ...(isAuto
            ? {
                bankCode: bankCode.trim(),
                bankAccountNumber: bankAccountNumber.trim(),
                bankAccountHolderName: bankAccountHolderName.trim(),
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim permintaan withdraw');
      toast.success(isAuto ? 'Withdraw diproses otomatis' : 'Permintaan withdraw berhasil dikirim');
      setAmount('');
      setNote('');
      setBankCode('');
      setBankAccountNumber('');
      setBankAccountHolderName('');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim permintaan withdraw');
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods = Array.isArray(config.enabledWithdrawMethods) ? config.enabledWithdrawMethods : [];
  const methodsLabel = methods.length ? methods.join(', ') : 'BANK_TRANSFER';

  const metrics = [
    { label: 'Saldo Bersih (Lunas)', value: formatIdr(paidNet), color: 'bg-blue-500' },
    { label: 'Saldo Tersedia', value: formatIdr(available), color: 'bg-emerald-600' },
    ...(affiliateFee > 0 ? [{ label: 'Fee Affiliate', value: formatIdr(affiliateFee), color: 'bg-rose-500' }] : []),
    ...(hold > 0 ? [{ label: 'Masa Tunggu', value: formatIdr(hold), color: 'bg-yellow-500' }] : []),
    ...(reserved > 0 ? [{ label: 'Tertahan (Withdraw)', value: formatIdr(reserved), color: 'bg-slate-500' }] : []),
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Withdraw</h1>
        <p className="text-sm text-slate-600 mt-1">Ajukan penarikan dana dari pendapatan penjualan Anda.</p>
        <div className="text-xs text-slate-500 mt-2">
          Mode: <span className="font-extrabold text-slate-700">{isAuto ? 'Otomatis (Xendit)' : 'Manual (Admin)'}</span>
        </div>
        {paidNet > 0 && available === 0 ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Saldo ada, tetapi belum tersedia untuk withdraw. Biasanya karena masa tunggu {Number(config.minimumDaysBeforeBalanceAvailable || 0)} hari.
          </div>
        ) : null}
      </div>

      <Cards metrics={metrics as any} isLoading={false} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="text-lg font-extrabold text-slate-900">Rincian Saldo</div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Kursus (bersih lunas)</span>
              <span className="font-extrabold text-slate-900">{formatIdr(Number(totals?.courses?.net || 0))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Produk (bersih lunas)</span>
              <span className="font-extrabold text-slate-900">
                {totals?.products?.enabled ? formatIdr(Number(totals?.products?.net || 0)) : 'Vendor belum aktif'}
              </span>
            </div>
            {hold > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Dalam masa tunggu</span>
                <span className="font-extrabold text-slate-900">{formatIdr(hold)}</span>
              </div>
            ) : null}
            {reserved > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Tertahan (withdraw)</span>
                <span className="font-extrabold text-slate-900">{formatIdr(reserved)}</span>
              </div>
            ) : null}
            {affiliateFee > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Fee affiliate</span>
                <span className="font-extrabold text-slate-900">- {formatIdr(affiliateFee)}</span>
              </div>
            ) : null}
            <div className="h-px bg-slate-200 my-2"></div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-semibold">Saldo tersedia</span>
              <span className="font-extrabold text-emerald-700">{formatIdr(available)}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <div>Fee kursus: {config.enableRevenueSharing ? `${Number(config.feePercent || 0)}%` : '0%'} • Mentor: {Number(config.mentorPercent || 0)}%</div>
            <div>Minimum withdraw: {formatIdr(minAmount)} • Saldo tersedia setelah {Number(config.minimumDaysBeforeBalanceAvailable || 0)} hari</div>
            <div>Metode withdraw: {isAuto ? 'XENDIT' : methodsLabel}</div>
          </div>

          {config.bankInstructions ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-extrabold text-slate-900">Instruksi / Informasi Bank</div>
              <div className="text-sm text-slate-700 mt-2 whitespace-pre-line">{config.bankInstructions}</div>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="text-lg font-extrabold text-slate-900">Ajukan Withdraw</div>
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-700">Jumlah (IDR)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder={`Minimal ${minAmount}`}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              disabled={isSubmitting}
            />
            <div className="text-[11px] text-slate-500">Saldo tersedia: {formatIdr(available)}</div>
          </div>

          {isAuto ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2 sm:col-span-1">
                <label className="text-xs font-extrabold text-slate-700">Bank</label>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  disabled={isSubmitting}
                >
                  <option value="">Pilih Bank</option>
                  <option value="BCA">BCA</option>
                  <option value="BNI">BNI</option>
                  <option value="BRI">BRI</option>
                  <option value="MANDIRI">Mandiri</option>
                  <option value="PERMATA">Permata</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-1">
                <label className="text-xs font-extrabold text-slate-700">Nomor Rekening</label>
                <input
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  inputMode="numeric"
                  placeholder="Contoh: 1234567890"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <label className="text-xs font-extrabold text-slate-700">Nama Pemilik</label>
                <input
                  value={bankAccountHolderName}
                  onChange={(e) => setBankAccountHolderName(e.target.value)}
                  placeholder="Nama sesuai rekening"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-700">Catatan (opsional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={isAuto ? 'Catatan tambahan (opsional).' : 'Cantumkan detail rekening / instruksi (mis. Bank, No Rek, Nama Pemilik, dll).'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Mengirim...' : `Kirim Permintaan Withdraw (${me.name})`}
          </button>
        </div>
      </div>
    </div>
  );
}
