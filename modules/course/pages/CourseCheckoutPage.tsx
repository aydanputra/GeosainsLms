/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Tag, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type PaymentMethod = 'XENDIT' | 'MIDTRANS' | 'MANUAL';
type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  birthDate: string;
  city: string;
  address: string;
};

export default function CourseCheckoutPage({
  course,
  initialPaymentMethod,
  userName,
  initialProfile,
  initialProfileComplete,
  checkoutSettings,
}: {
  course: { id: string; slug: string; title: string; price: number; normalPrice: number | null; thumbnailUrl: string | null };
  initialPaymentMethod: PaymentMethod;
  userName?: string;
  initialProfile: ProfileForm;
  initialProfileComplete: boolean;
  checkoutSettings: {
    checkoutServiceFeeEnabled: boolean;
    checkoutServiceFeeAmount: number;
    checkoutUniqueCodeEnabled: boolean;
    checkoutUniqueCodeDigits: number;
  };
}) {
  const router = useRouter();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: 'PERCENT' | 'FIXED';
    amount: number;
    maxDiscount: number | null;
    discountTotal: number;
  } | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [agree, setAgree] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfile);
  const [isProfileComplete, setIsProfileComplete] = useState(initialProfileComplete);
  const [showProfileForm, setShowProfileForm] = useState(!initialProfileComplete);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const methodLabel = initialPaymentMethod === 'MANUAL' ? 'Manual' : 'Otomatis';
  const safeName = (userName || '').trim() || 'Akun Anda';
  const canEditEmail = initialProfile.email.trim().length === 0;
  const isProfileFormComplete = (value: ProfileForm) => {
    if (value.name.trim().length < 2) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) return false;
    if (value.phone.trim().length < 8) return false;
    const gender = value.gender.trim().toUpperCase();
    if (gender !== 'MALE' && gender !== 'FEMALE') return false;
    if (!value.birthDate.trim()) return false;
    const birthDate = new Date(`${value.birthDate.trim()}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime())) return false;
    if (value.city.trim().length < 2) return false;
    if (value.address.trim().length < 5) return false;
    return true;
  };

  const updateProfileField = (key: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
  };

  const subtotal = useMemo(() => {
    const price = Number.isFinite(course.price) ? course.price : 0;
    return Math.max(0, Math.round(price));
  }, [course.price]);

  const discountTotalRaw = useMemo(() => {
    const raw = Number(appliedCoupon?.discountTotal || 0);
    return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  }, [appliedCoupon?.discountTotal]);

  const netAmount = useMemo(() => {
    return Math.max(0, Math.round(subtotal - discountTotalRaw));
  }, [discountTotalRaw, subtotal]);

  const displayDiscountTotal = useMemo(() => {
    return Math.max(0, Math.round(discountTotalRaw));
  }, [discountTotalRaw]);

  const serviceFeeAmount = useMemo(() => {
    const raw = Number(checkoutSettings?.checkoutServiceFeeAmount || 0);
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }, [checkoutSettings?.checkoutServiceFeeAmount]);

  const serviceFee = useMemo(() => {
    if (!checkoutSettings?.checkoutServiceFeeEnabled) return 0;
    if (netAmount <= 0) return 0;
    return serviceFeeAmount;
  }, [checkoutSettings?.checkoutServiceFeeEnabled, netAmount, serviceFeeAmount]);

  const [uniqueCode, setUniqueCode] = useState(0);
  useEffect(() => {
    if (!checkoutSettings?.checkoutUniqueCodeEnabled) {
      setUniqueCode(0);
      return;
    }
    const digitsRaw = Number(checkoutSettings?.checkoutUniqueCodeDigits || 3);
    const digits = Number.isFinite(digitsRaw) ? Math.min(3, Math.max(1, Math.floor(digitsRaw))) : 3;
    const max = Math.pow(10, digits) - 1;
    setUniqueCode(Math.floor(Math.random() * max) + 1);
  }, [checkoutSettings?.checkoutUniqueCodeDigits, checkoutSettings?.checkoutUniqueCodeEnabled]);

  const effectiveUniqueCode = useMemo(() => {
    if (!checkoutSettings?.checkoutUniqueCodeEnabled) return 0;
    const baseWithFee = Math.max(0, netAmount + serviceFee);
    if (baseWithFee <= 0) return 0;
    return Math.min(uniqueCode, Math.max(0, baseWithFee - 1));
  }, [checkoutSettings?.checkoutUniqueCodeEnabled, netAmount, serviceFee, uniqueCode]);

  const totalTransfer = useMemo(() => {
    const base = Math.max(0, netAmount + serviceFee);
    const next = checkoutSettings?.checkoutUniqueCodeEnabled ? Math.max(0, base - effectiveUniqueCode) : base;
    return Math.round(next);
  }, [checkoutSettings?.checkoutUniqueCodeEnabled, effectiveUniqueCode, netAmount, serviceFee]);

  const displayNormalPrice = typeof course.normalPrice === 'number' && Number.isFinite(course.normalPrice) && course.normalPrice > subtotal;

  const onCouponChange = (value: string) => {
    setCouponCode(value);
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
    if (appliedCoupon && normalized !== appliedCoupon.code) {
      setAppliedCoupon(null);
    }
    if (couponFeedback) setCouponFeedback(null);
  };

  const applyCoupon = async () => {
    const normalized = couponCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
      setAppliedCoupon(null);
      setCouponFeedback(null);
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(course.id)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: normalized, preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Kupon tidak valid');

      const coupon = data?.coupon;
      const code = typeof coupon?.code === 'string' ? coupon.code.trim().toUpperCase().replace(/\s+/g, '') : '';
      const type = coupon?.type === 'FIXED' ? 'FIXED' : 'PERCENT';
      const amount = Number(coupon?.amount || 0);
      const maxDiscount =
        typeof coupon?.maxDiscount === 'number' && Number.isFinite(coupon.maxDiscount) ? Number(coupon.maxDiscount) : null;

      const discount = Number(data?.discountTotal || 0);
      if (!Number.isFinite(discount)) throw new Error('Respon kupon tidak valid');
      if (!code) throw new Error('Respon kupon tidak valid');

      setCouponCode(code);
      setAppliedCoupon({ code, type, amount: Number.isFinite(amount) ? amount : 0, maxDiscount, discountTotal: discount });
      setCouponFeedback({ kind: 'success', message: `Kupon ${code} berhasil divalidasi` });
      toast.success(`Kupon ${code} berhasil diterapkan`);
    } catch (e: unknown) {
      setAppliedCoupon(null);
      const msg = e instanceof Error ? e.message : 'Kupon tidak valid';
      setCouponFeedback({ kind: 'error', message: msg });
      toast.error(msg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const saveProfile = async () => {
    const payload = {
      name: profileForm.name.trim(),
      ...(canEditEmail ? { email: profileForm.email.trim().toLowerCase() } : {}),
      phone: profileForm.phone.trim(),
      gender: profileForm.gender.trim().toUpperCase(),
      birthDate: profileForm.birthDate.trim(),
      city: profileForm.city.trim(),
      address: profileForm.address.trim(),
    };

    if (!isProfileFormComplete({ ...profileForm, ...payload, email: canEditEmail ? String((payload as any).email || '') : profileForm.email })) {
      throw new Error('Lengkapi nama, email, nomor WhatsApp, gender, tanggal lahir, kota, dan alamat terlebih dahulu.');
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan profil');
      setProfileForm((prev) => ({
        ...prev,
        ...payload,
        email: canEditEmail ? String((payload as any).email || '') : prev.email,
      }));
      setIsProfileComplete(true);
      setShowProfileForm(false);
      toast.success('Profil berhasil dilengkapi. Anda bisa lanjut pembayaran.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const pay = async () => {
    if (!agree) return;
    if (!isProfileComplete) {
      setShowProfileForm(true);
      toast.error('Lengkapi profil singkat terlebih dahulu sebelum lanjut pembayaran.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(course.id)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
          ...(checkoutSettings?.checkoutUniqueCodeEnabled ? { uniqueCode: effectiveUniqueCode } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.requiresProfile === true) {
          setShowProfileForm(true);
          setIsProfileComplete(false);
          toast.error(data?.error || 'Lengkapi profil terlebih dahulu sebelum melakukan pembelian.');
          return;
        }
        throw new Error(data?.error || 'Gagal membuat checkout');
      }

      if (typeof data?.paymentUrl === 'string' && data.paymentUrl.trim()) {
        window.location.assign(data.paymentUrl.trim());
        return;
      }

      if (typeof data?.redirectUrl === 'string' && data.redirectUrl.trim()) {
        router.push(data.redirectUrl.trim());
        return;
      }

      router.push('/dashboard/student/orders');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal memproses pembayaran');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 overflow-visible">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-slate-900">Metode Pembayaran</div>
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-extrabold">
                {methodLabel}
              </div>
            </div>

            {showProfileForm ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 space-y-4">
                <div className="text-sm font-extrabold text-slate-900">Lengkapi profil singkat</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama lengkap</label>
                    <input
                      value={profileForm.name}
                      onChange={(e) => updateProfileField('name', e.target.value)}
                      disabled={isSavingProfile || isLoading}
                      placeholder="Masukkan nama lengkap"
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => updateProfileField('email', e.target.value)}
                      disabled={!canEditEmail || isSavingProfile || isLoading}
                      placeholder="nama@email.com"
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nomor WhatsApp</label>
                    <input
                      value={profileForm.phone}
                      onChange={(e) => updateProfileField('phone', e.target.value)}
                      disabled={isSavingProfile || isLoading}
                      placeholder="08xxxxxxxxxx"
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Gender</label>
                    <select
                      value={profileForm.gender}
                      onChange={(e) => updateProfileField('gender', e.target.value)}
                      disabled={isSavingProfile || isLoading}
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                    >
                      <option value="">Pilih gender</option>
                      <option value="MALE">Laki-laki</option>
                      <option value="FEMALE">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal lahir</label>
                    <input
                      type="date"
                      value={profileForm.birthDate}
                      onChange={(e) => updateProfileField('birthDate', e.target.value)}
                      disabled={isSavingProfile || isLoading}
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Kota</label>
                    <input
                      value={profileForm.city}
                      onChange={(e) => updateProfileField('city', e.target.value)}
                      disabled={isSavingProfile || isLoading}
                      placeholder="Contoh: Jakarta"
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Alamat</label>
                    <textarea
                      value={profileForm.address}
                      onChange={(e) => updateProfileField('address', e.target.value)}
                      disabled={isSavingProfile || isLoading}
                      placeholder="Masukkan alamat lengkap"
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await saveProfile();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan profil');
                      }
                    }}
                    disabled={isSavingProfile || isLoading}
                    className={twMerge(
                      'h-11 px-4 rounded-2xl text-sm font-extrabold inline-flex items-center justify-center gap-2',
                      isSavingProfile || isLoading ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                  >
                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Simpan
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-extrabold text-slate-900">Kode Promo</div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={couponCode}
                    onChange={(e) => onCouponChange(e.target.value)}
                    disabled={isLoading || isApplyingCoupon}
                    placeholder="Masukkan kode promo agar lebih hemat"
                    className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={isLoading || isApplyingCoupon}
                  className={twMerge(
                    'h-12 px-4 rounded-2xl border text-sm font-extrabold inline-flex items-center justify-center gap-2',
                    isLoading || isApplyingCoupon
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  )}
                >
                  {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Apply
                </button>
              </div>
              {couponFeedback ? (
                <div
                  className={twMerge(
                    'text-xs font-semibold',
                    couponFeedback.kind === 'success' ? 'text-emerald-700' : 'text-rose-600'
                  )}
                >
                  {couponFeedback.message}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Klik Apply untuk validasi kode promo.</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-slate-900">Payment details</div>
              <div className="space-y-2 text-sm">
                {displayNormalPrice || (appliedCoupon?.code && displayDiscountTotal > 0 && netAmount < subtotal) ? (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-slate-500">Harga normal</div>
                    <div className="font-extrabold text-rose-600 line-through">
                      Rp {(displayNormalPrice ? Math.round(Number(course.normalPrice || 0)) : subtotal).toLocaleString('id-ID')}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <div className="text-slate-600 flex items-center gap-2">
                    Harga kelas
                    {displayNormalPrice || (appliedCoupon?.code && displayDiscountTotal > 0 && netAmount < subtotal) ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-extrabold">
                        Discount
                      </span>
                    ) : null}
                  </div>
                  <div className="font-extrabold text-slate-900">Rp {netAmount.toLocaleString('id-ID')}</div>
                </div>

                {appliedCoupon?.code && displayDiscountTotal > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-600">Kode promo</div>
                    <div className="font-extrabold text-emerald-700">- Rp {displayDiscountTotal.toLocaleString('id-ID')}</div>
                  </div>
                ) : null}

                {checkoutSettings?.checkoutUniqueCodeEnabled && effectiveUniqueCode > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-600">Kode unik</div>
                    <div className="font-extrabold text-emerald-700">- Rp {effectiveUniqueCode.toLocaleString('id-ID')}</div>
                  </div>
                ) : null}
                {checkoutSettings?.checkoutServiceFeeEnabled && serviceFee > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-600 flex items-center gap-2">
                      Service fee per student
                      <button
                        type="button"
                        aria-label="Info service fee"
                        className="group relative inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-extrabold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        ?
                        <span className="pointer-events-none absolute left-1/2 top-7 z-[9999] w-72 max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xl opacity-0 translate-y-1 transition-all duration-150 whitespace-normal break-words group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0">
                          Biaya untuk fee payment gateway dan service platform lainnya
                        </span>
                      </button>
                    </div>
                    <div className="font-extrabold text-emerald-700">+ Rp {serviceFee.toLocaleString('id-ID')}</div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-slate-900 font-extrabold text-base">Total transfer</div>
                  <div className="font-extrabold text-slate-900 text-base">Rp {totalTransfer.toLocaleString('id-ID')}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 rounded bg-slate-200" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-semibold">Give Course Access to</div>
                  <div className="text-sm font-extrabold text-slate-900 truncate">{safeName}</div>
                </div>
              </div>
              <div className="mt-3 text-xs font-bold text-slate-700 line-clamp-2">{course.title}</div>
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                disabled={isLoading}
                className="mt-1 h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              <div className="text-sm text-slate-700">
                Saya setuju dengan <span className="text-indigo-700 font-extrabold">Terms & Conditions</span>
              </div>
            </label>

            <button
              type="button"
              onClick={pay}
              disabled={!agree || isLoading || isSavingProfile}
              className={twMerge(
                'w-full h-12 rounded-2xl font-extrabold text-sm transition-colors flex items-center justify-center gap-2',
                !agree || isLoading || isSavingProfile ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {isProfileComplete ? 'Bayar & gabung kelas' : 'Lengkapi profil untuk lanjut bayar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
