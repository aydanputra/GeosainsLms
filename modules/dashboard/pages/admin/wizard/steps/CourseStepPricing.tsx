"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

const pricingSchema = z.object({
  type: z.enum(['FREE', 'PAID']),
  price: z.number().min(0).optional(),
  normalPrice: z.number().min(0).optional().nullable(),
  subscriptionEligible: z.boolean().optional(),
});

type PricingFormData = z.infer<typeof pricingSchema>;

interface CourseStepPricingProps {
  initialData?: any;
  courseId?: string;
  onNext: (data: any) => void;
  onBack: () => void;
}

type PlatformPromo = {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  amount: number;
  funding: 'MARKETPLACE' | 'SPLIT' | 'STORE';
  marketplaceSharePercent: number;
  maxDiscount: number | null;
  minSubtotal: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  joined: boolean;
};

export default function CourseStepPricing({ initialData, courseId, onNext, onBack }: CourseStepPricingProps) {
  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<PricingFormData>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      type: initialData?.price > 0 ? 'PAID' : 'FREE',
      price: initialData?.price || 0,
      normalPrice: typeof initialData?.normalPrice === 'number' ? initialData.normalPrice : null,
      subscriptionEligible: Boolean(initialData?.subscriptionEligible),
    }
  });

  const type = watch('type');
  const [promoVisible, setPromoVisible] = useState(true);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promos, setPromos] = useState<PlatformPromo[]>([]);
  const [promoQuery, setPromoQuery] = useState('');
  const [promoMutating, setPromoMutating] = useState<string | null>(null);

  useEffect(() => {
    if (type === 'FREE') setValue('price', 0, { shouldDirty: true });
  }, [type, setValue]);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    (async () => {
      setPromoLoading(true);
      try {
        const res = await fetch(`/api/mentor/platform-promos?courseId=${encodeURIComponent(courseId)}`, { cache: 'no-store' });
        if (!active) return;
        if (res.status === 401 || res.status === 403) {
          setPromoVisible(false);
          setPromos([]);
          return;
        }
        const data = await res.json().catch(() => []);
        if (!Array.isArray(data)) throw new Error('Data promo tidak valid');
        setPromoVisible(true);
        setPromos(data as PlatformPromo[]);
      } catch {
        if (!active) return;
      } finally {
        if (active) setPromoLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [courseId]);

  const formatIdr = (n: number) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;
  const formatPromoLabel = (p: PlatformPromo) => {
    if (p.type === 'PERCENT') {
      const cap = typeof p.maxDiscount === 'number' && Number.isFinite(p.maxDiscount) ? ` (maks ${formatIdr(p.maxDiscount)})` : '';
      return `${Number(p.amount || 0)}%${cap}`;
    }
    return formatIdr(Number(p.amount || 0));
  };

  const filteredPromos = useMemo(() => {
    const q = promoQuery.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter((p) => p.code.toLowerCase().includes(q));
  }, [promos, promoQuery]);

  const togglePromo = async (promo: PlatformPromo) => {
    if (!courseId) return;
    if (type === 'FREE') {
      toast.error('Kursus masih Gratis. Ubah menjadi Berbayar untuk ikut promo.');
      return;
    }
    setPromoMutating(promo.id);
    try {
      const res = await fetch('/api/mentor/platform-promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: promo.joined ? 'LEAVE' : 'JOIN', couponId: promo.id, courseId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan promo');
      setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, joined: Boolean(data?.joined) } : p)));
      toast.success(promo.joined ? 'Promo dilepas' : 'Promo diaktifkan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan promo');
    } finally {
      setPromoMutating(null);
    }
  };

  const onSubmit = (data: PricingFormData) => {
    const safeNormalPrice =
      typeof data.normalPrice === 'number' && Number.isFinite(data.normalPrice) ? data.normalPrice : null;
    const safePrice = typeof data.price === 'number' && Number.isFinite(data.price) ? data.price : 0;
    onNext({ ...data, normalPrice: safeNormalPrice, price: data.type === 'FREE' ? 0 : safePrice });
  };

  return (
    <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900">Harga & Monetisasi</h3>
          <p className="text-slate-500">Tentukan model harga untuk kursus ini.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${type === 'FREE' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}
              onClick={() => setValue('type', 'FREE')}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-lg text-slate-900">Gratis</span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${type === 'FREE' ? 'border-indigo-600' : 'border-slate-300'}`}>
                  {type === 'FREE' && <div className="w-3 h-3 bg-indigo-600 rounded-full" />}
                </div>
              </div>
              <p className="text-sm text-slate-500">Kursus dapat diakses oleh siapa saja tanpa biaya.</p>
            </div>

            <div 
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${type === 'PAID' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}
              onClick={() => setValue('type', 'PAID')}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-lg text-slate-900">Berbayar</span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${type === 'PAID' ? 'border-indigo-600' : 'border-slate-300'}`}>
                  {type === 'PAID' && <div className="w-3 h-3 bg-indigo-600 rounded-full" />}
                </div>
              </div>
              <p className="text-sm text-slate-500">Tetapkan harga untuk akses kursus (sekali bayar).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Harga Normal (IDR)</label>
              <div className="relative">
                <div className="absolute left-4 top-3.5 font-bold text-slate-500">Rp</div>
                <input
                  type="number"
                  {...register('normalPrice', {
                    setValueAs: (v) => {
                      if (v === '' || v === null || v === undefined) return null;
                      const n = Number(v);
                      return Number.isFinite(n) ? n : null;
                    },
                  })}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none font-medium text-lg text-slate-900"
                  placeholder="0"
                  min={0}
                />
              </div>
              {errors.normalPrice && <p className="text-red-500 text-xs mt-1">{errors.normalPrice.message}</p>}
            </div>

            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Harga Diskon (IDR)</label>
              <div className="relative">
                <div className="absolute left-4 top-3.5 font-bold text-slate-500">Rp</div>
                <input
                  type="number"
                  {...register('price', {
                    setValueAs: (v) => {
                      if (v === '' || v === null || v === undefined) return 0;
                      const n = Number(v);
                      return Number.isFinite(n) ? n : 0;
                    },
                  })}
                  disabled={type === 'FREE'}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none font-medium text-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="0"
                  min={0}
                />
              </div>
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
            </div>
          </div>

          {promoVisible ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">Promo Platform (Opsional)</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Pilih promo yang dibuat Platform. Anda bisa memutuskan kursus ini ikut promo atau tidak.
                  </div>
                </div>
                <div className="text-xs font-bold text-slate-500">{promos.filter((p) => p.joined).length} aktif</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    value={promoQuery}
                    onChange={(e) => setPromoQuery(e.target.value)}
                    placeholder="Cari kode promo..."
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none text-sm"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {type === 'FREE' ? 'Nonaktif saat kursus Gratis.' : 'Aktif saat kursus Berbayar.'}
                </div>
              </div>

              {promoLoading ? (
                <div className="py-6 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat promo...
                </div>
              ) : filteredPromos.length === 0 ? (
                <div className="py-6 text-sm text-slate-600">Belum ada promo platform yang tersedia.</div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  {filteredPromos.map((p) => (
                    <div key={p.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-extrabold text-slate-900">{p.code}</div>
                          <div className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                            {formatPromoLabel(p)}
                          </div>
                          {p.funding === 'SPLIT' ? (
                            <div className="text-xs font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              Split (Marketplace {Number(p.marketplaceSharePercent || 0)}%)
                            </div>
                          ) : (
                            <div className="text-xs font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              Ditanggung Marketplace
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                          {typeof p.minSubtotal === 'number' && Number.isFinite(p.minSubtotal) && p.minSubtotal > 0 ? (
                            <div>Minimal pembelian item eligible: {formatIdr(p.minSubtotal)}</div>
                          ) : null}
                          {p.startsAt || p.expiresAt ? (
                            <div>
                              Periode: {p.startsAt ? new Date(p.startsAt).toLocaleDateString('id-ID') : '-'} –{' '}
                              {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('id-ID') : '-'}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePromo(p)}
                        disabled={promoMutating === p.id || type === 'FREE'}
                        className={`h-10 px-4 rounded-xl font-extrabold text-sm transition-all disabled:opacity-60 ${
                          p.joined
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {promoMutating === p.id ? (
                          <span className="inline-flex items-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Menyimpan
                          </span>
                        ) : p.joined ? (
                          'Mengikuti'
                        ) : (
                          'Ikuti'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-900">Subscription Eligible</div>
                <div className="text-xs text-slate-500 mt-1">Kursus dapat diakses via paket langganan (jika fitur langganan diaktifkan).</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register('subscriptionEligible')} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-200 mt-10">
            <button 
              type="button" 
              onClick={onBack}
              className="h-11 px-8 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Kembali
            </button>
            <button 
              type="submit" 
              className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              Lanjut <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
