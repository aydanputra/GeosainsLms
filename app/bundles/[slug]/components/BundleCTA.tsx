'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

function formatCurrency(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  if (n <= 0) return 'Gratis';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function BundleCTA({
  bundleId,
  bundleSlug,
  courseCount,
  subtotal,
  price,
  isLoggedIn,
  enrolledCount,
}: {
  bundleId: string;
  bundleSlug: string;
  courseCount: number;
  subtotal: number;
  price: number;
  isLoggedIn: boolean;
  enrolledCount: number;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const discount = useMemo(() => Math.max(0, Math.round((Number(subtotal || 0) - Number(price || 0)) * 100) / 100), [subtotal, price]);
  const alreadyOwnedAll = courseCount > 0 && enrolledCount >= courseCount;

  const handleBuy = async () => {
    if (!isLoggedIn) {
      toast.error('Silakan login terlebih dahulu');
      router.push(`/login?redirect=/bundles/${encodeURIComponent(bundleSlug)}`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/course-bundles/${bundleId}/purchase`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = typeof err?.error === 'string' && err.error.trim() ? err.error.trim() : 'Gagal membeli bundel';
        if (res.status === 401) {
          toast.error(message);
          router.push(`/login?redirect=/bundles/${encodeURIComponent(bundleSlug)}`);
          return;
        }
        throw new Error(message);
      }

      const data = await res.json().catch(() => ({}));
      toast.success(typeof data?.message === 'string' ? data.message : 'Pembelian bundel berhasil');
      const paymentUrl = typeof data?.paymentUrl === 'string' ? data.paymentUrl.trim() : '';
      if (paymentUrl) {
        router.push(paymentUrl);
      } else {
        const redirectUrl = typeof data?.redirectUrl === 'string' && data.redirectUrl.trim() ? data.redirectUrl.trim() : '/dashboard/student/courses';
        router.push(redirectUrl);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membeli bundel');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden sticky top-24">
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{formatCurrency(price)}</span>
            {subtotal > 0 && discount > 0 ? (
              <span className="text-sm text-slate-500 line-through">{formatCurrency(subtotal)}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
              {courseCount} Kursus
            </span>
            {discount > 0 ? (
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                Hemat {formatCurrency(discount)}
              </span>
            ) : null}
            {enrolledCount > 0 && !alreadyOwnedAll ? (
              <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-full">
                {enrolledCount}/{courseCount} sudah dimiliki
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {alreadyOwnedAll ? (
            <button
              type="button"
              onClick={() => router.push('/dashboard/student/courses')}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Sudah Dimiliki
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBuy}
              disabled={isLoading || courseCount <= 0}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
              {isLoggedIn ? 'Beli Bundel' : 'Login untuk Membeli'}
            </button>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            Setelah pembayaran berhasil, Anda otomatis terdaftar ke semua kursus di dalam bundel.
          </div>
        </div>
      </div>
    </div>
  );
}
