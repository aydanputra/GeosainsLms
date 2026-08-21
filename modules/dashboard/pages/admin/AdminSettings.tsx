"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, CheckCircle, XCircle, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import { toast } from 'sonner';
import Image from 'next/image';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useSearchParams } from 'next/navigation';

export default function AdminSettings({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('general');
  const [siteName, setSiteName] = useState('GeoSains LMS');
  const [siteDescription, setSiteDescription] = useState('Platform pembelajaran geosains terdepan.');
  const [contactEmail, setContactEmail] = useState('admin@geosains.id');
  const [contactPhone, setContactPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'XENDIT' | 'MIDTRANS' | 'MANUAL'>('XENDIT');
  const [withdrawMode, setWithdrawMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');
  const [affiliateDefaultCommissionPercent, setAffiliateDefaultCommissionPercent] = useState('10');
  const [affiliateMarketplaceSharePercent, setAffiliateMarketplaceSharePercent] = useState('20');
  const [affiliateHoldDays, setAffiliateHoldDays] = useState('7');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaInitialTab, setMediaInitialTab] = useState<'GALLERY' | 'UPLOAD'>('UPLOAD');
  const [mediaTarget, setMediaTarget] = useState<'LOGO' | 'FAVICON' | null>(null);

  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const reauthResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const requestReauth = () =>
    new Promise<boolean>((resolve) => {
      setReauthPassword('');
      setReauthOpen(true);
      reauthResolverRef.current = resolve;
    });

  const closeReauth = () => {
    setReauthOpen(false);
    const resolver = reauthResolverRef.current;
    reauthResolverRef.current = null;
    if (resolver) resolver(false);
  };

  const confirmReauth = async () => {
    if (reauthLoading) return;
    const password = reauthPassword;
    if (!password) return;
    setReauthLoading(true);
    try {
      const res = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Gagal konfirmasi password');
        return;
      }
      setReauthOpen(false);
      const resolver = reauthResolverRef.current;
      reauthResolverRef.current = null;
      if (resolver) resolver(true);
    } finally {
      setReauthLoading(false);
    }
  };

  const inputControlClass =
    'block w-full rounded-xl border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:placeholder:text-slate-400 disabled:cursor-not-allowed';
  const textareaControlClass =
    'block w-full rounded-xl border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';

  const tabs = useMemo(
    () => [
      { id: 'general', label: 'Umum' },
      { id: 'payment', label: 'Pembayaran' },
      ...(isSuperAdmin ? [{ id: 'affiliate', label: 'Affiliate' }] : []),
      { id: 'roles', label: 'Role & Izin' },
      { id: 'notifications', label: 'Notifikasi' },
    ],
    [isSuperAdmin]
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) return;
    const allowed = new Set(tabs.map((t) => t.id));
    if (!allowed.has(tab)) return;
    setActiveTab((prev) => (prev === tab ? prev : tab));
  }, [searchParams, tabs]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/site-settings');
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (typeof data?.siteName === 'string' && data.siteName.trim()) setSiteName(data.siteName.trim());
        if (typeof data?.siteDescription === 'string' && data.siteDescription.trim()) setSiteDescription(data.siteDescription.trim());
        if (typeof data?.contactEmail === 'string' && data.contactEmail.trim()) setContactEmail(data.contactEmail.trim());
        if (typeof data?.contactPhone === 'string') setContactPhone(data.contactPhone);
        if (typeof data?.logoUrl === 'string') setLogoUrl(data.logoUrl);
        if (typeof data?.faviconUrl === 'string') setFaviconUrl(data.faviconUrl);
        if (data?.paymentMethod === 'XENDIT' || data?.paymentMethod === 'MIDTRANS' || data?.paymentMethod === 'MANUAL') {
          setPaymentMethod(data.paymentMethod);
        }
        if (data?.withdrawMode === 'AUTO' || data?.withdrawMode === 'MANUAL') {
          setWithdrawMode(data.withdrawMode);
        }
        if (typeof data?.affiliateDefaultCommissionPercent === 'number' && Number.isFinite(data.affiliateDefaultCommissionPercent)) {
          setAffiliateDefaultCommissionPercent(String(Math.max(0, Math.min(100, Math.floor(data.affiliateDefaultCommissionPercent)))));
        }
        if (typeof data?.affiliateMarketplaceSharePercent === 'number' && Number.isFinite(data.affiliateMarketplaceSharePercent)) {
          setAffiliateMarketplaceSharePercent(String(Math.max(0, Math.min(100, Math.floor(data.affiliateMarketplaceSharePercent)))));
        }
        if (typeof data?.affiliateHoldDays === 'number' && Number.isFinite(data.affiliateHoldDays)) {
          setAffiliateHoldDays(String(Math.max(0, Math.min(30, Math.floor(data.affiliateHoldDays)))));
        }
      } catch {
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openMedia = (target: 'LOGO' | 'FAVICON', initialTab: 'GALLERY' | 'UPLOAD') => {
    setMediaTarget(target);
    setMediaInitialTab(initialTab);
    setMediaOpen(true);
  };

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName, siteDescription, contactEmail, contactPhone, logoUrl, faviconUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      toast.success('Pengaturan tersimpan');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePayment = async () => {
    setIsSaving(true);
    try {
      const doRequest = async () => {
        const res = await fetch('/api/site-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod, withdrawMode }),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

      let { res, data } = await doRequest();
      if (!res.ok && res.status === 401 && data?.code === 'REAUTH_REQUIRED') {
        const ok = await requestReauth();
        if (!ok) return;
        ({ res, data } = await doRequest());
      }
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      toast.success('Pengaturan pembayaran diperbarui');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAffiliate = async () => {
    setIsSaving(true);
    try {
      const toInt = (v: string) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) ? n : NaN;
      };
      const defaultPct = toInt(affiliateDefaultCommissionPercent);
      const marketplacePct = toInt(affiliateMarketplaceSharePercent);
      const holdDays = toInt(affiliateHoldDays);
      if (!Number.isFinite(defaultPct) || defaultPct < 0 || defaultPct > 100) throw new Error('Default komisi harus 0-100');
      if (!Number.isFinite(marketplacePct) || marketplacePct < 0 || marketplacePct > 100) throw new Error('Marketplace share harus 0-100');
      if (!Number.isFinite(holdDays) || holdDays < 0 || holdDays > 30) throw new Error('Hold periode maksimal 30 hari');

      const doRequest = async () => {
        const res = await fetch('/api/site-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affiliateDefaultCommissionPercent: defaultPct,
            affiliateMarketplaceSharePercent: marketplacePct,
            affiliateHoldDays: holdDays,
          }),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

      let { res, data } = await doRequest();
      if (!res.ok && res.status === 401 && data?.code === 'REAUTH_REQUIRED') {
        const ok = await requestReauth();
        if (!ok) return;
        ({ res, data } = await doRequest());
      }
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      toast.success('Pengaturan affiliate diperbarui');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola konfigurasi situs dan preferensi sistem.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-4 flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={twMerge(
                "pb-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nama Situs</label>
                <input 
                  type="text" 
                  className={inputControlClass}
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Deskripsi Situs</label>
                <textarea 
                  className={textareaControlClass}
                  rows={3} 
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Email Kontak</label>
                <input 
                  type="email" 
                  className={inputControlClass}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Telepon / WhatsApp</label>
                <input
                  type="text"
                  className={inputControlClass}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-5 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">Logo Website</div>
                      <div className="text-xs text-slate-500 mt-0.5">Digunakan di header dan sebagai ikon Apple.</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden relative flex items-center justify-center shrink-0">
                      {logoUrl ? (
                        <Image src={logoUrl} alt="Logo" fill unoptimized className="object-contain" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500 truncate">{logoUrl || 'Belum dipilih'}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openMedia('LOGO', 'UPLOAD')}
                          className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 whitespace-nowrap"
                          disabled={isLoading}
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => openMedia('LOGO', 'GALLERY')}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 whitespace-nowrap"
                          disabled={isLoading}
                        >
                          Pilih Media
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-red-600 font-bold text-xs hover:bg-red-50 whitespace-nowrap"
                          disabled={isLoading || !logoUrl}
                        >
                          <Trash2 className="w-4 h-4 inline-block mr-1" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-5 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">Favicon</div>
                      <div className="text-xs text-slate-500 mt-0.5">Ikon tab browser. Disarankan PNG 32×32 atau 48×48.</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden relative flex items-center justify-center shrink-0">
                      {faviconUrl ? (
                        <Image src={faviconUrl} alt="Favicon" fill unoptimized className="object-contain" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500 truncate">{faviconUrl || 'Belum dipilih'}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openMedia('FAVICON', 'UPLOAD')}
                          className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 whitespace-nowrap"
                          disabled={isLoading}
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => openMedia('FAVICON', 'GALLERY')}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 whitespace-nowrap"
                          disabled={isLoading}
                        >
                          Pilih Media
                        </button>
                        <button
                          type="button"
                          onClick={() => setFaviconUrl('')}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-red-600 font-bold text-xs hover:bg-red-50 whitespace-nowrap"
                          disabled={isLoading || !faviconUrl}
                        >
                          <Trash2 className="w-4 h-4 inline-block mr-1" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleSaveGeneral}
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium shadow-sm hover:shadow hover:-translate-y-0.5 transition-all disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Perubahan
                </button>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-top-2">
              <div>
                <div className="text-base font-extrabold text-slate-900">Metode Pembayaran Aktif</div>
                <div className="text-sm text-slate-500 mt-1">Pilih satu metode pembayaran yang berlaku untuk pembelian kursus dan produk.</div>
              </div>

              <div className="grid gap-3">
                <label className={twMerge("flex items-center justify-between gap-4 p-5 border rounded-2xl transition-colors cursor-pointer", paymentMethod === 'XENDIT' ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Xendit</div>
                    <div className="text-sm text-slate-500 mt-0.5">Otomatis (VA, E-Wallet, QRIS)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {paymentMethod === 'XENDIT' ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold">
                        <CheckCircle className="w-3.5 h-3.5" /> Aktif
                      </span>
                    ) : null}
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'XENDIT'}
                      onChange={() => setPaymentMethod('XENDIT')}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </div>
                </label>

                <label className={twMerge("flex items-center justify-between gap-4 p-5 border rounded-2xl transition-colors cursor-pointer", paymentMethod === 'MIDTRANS' ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Midtrans</div>
                    <div className="text-sm text-slate-500 mt-0.5">Otomatis (VA, E-Wallet, QRIS)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {paymentMethod === 'MIDTRANS' ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold">
                        <CheckCircle className="w-3.5 h-3.5" /> Aktif
                      </span>
                    ) : null}
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'MIDTRANS'}
                      onChange={() => setPaymentMethod('MIDTRANS')}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </div>
                </label>

                <label className={twMerge("flex items-center justify-between gap-4 p-5 border rounded-2xl transition-colors cursor-pointer", paymentMethod === 'MANUAL' ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Bank Transfer / Manual</div>
                    <div className="text-sm text-slate-500 mt-0.5">User mengirim bukti transfer untuk diverifikasi admin</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {paymentMethod === 'MANUAL' ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold">
                        <CheckCircle className="w-3.5 h-3.5" /> Aktif
                      </span>
                    ) : null}
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'MANUAL'}
                      onChange={() => setPaymentMethod('MANUAL')}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <div className="text-base font-extrabold text-slate-900">Proses Withdraw</div>
                <div className="text-sm text-slate-500 mt-1">
                  Atur apakah withdraw diproses manual oleh admin atau otomatis menggunakan disbursement (Xendit).
                </div>
              </div>

              <div className="grid gap-3">
                <label
                  className={twMerge(
                    "flex items-center justify-between gap-4 p-5 border rounded-2xl transition-colors cursor-pointer",
                    withdrawMode === 'MANUAL' ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Manual</div>
                    <div className="text-sm text-slate-500 mt-0.5">Mentor mengajukan withdraw, admin memproses secara manual</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {withdrawMode === 'MANUAL' ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold">
                        <CheckCircle className="w-3.5 h-3.5" /> Aktif
                      </span>
                    ) : null}
                    <input
                      type="radio"
                      name="withdrawMode"
                      checked={withdrawMode === 'MANUAL'}
                      onChange={() => setWithdrawMode('MANUAL')}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </div>
                </label>

                <label
                  className={twMerge(
                    "flex items-center justify-between gap-4 p-5 border rounded-2xl transition-colors cursor-pointer",
                    withdrawMode === 'AUTO' ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Otomatis</div>
                    <div className="text-sm text-slate-500 mt-0.5">Sistem memproses withdraw otomatis via disbursement (Xendit)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {withdrawMode === 'AUTO' ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold">
                        <CheckCircle className="w-3.5 h-3.5" /> Aktif
                      </span>
                    ) : null}
                    <input
                      type="radio"
                      name="withdrawMode"
                      checked={withdrawMode === 'AUTO'}
                      onChange={() => setWithdrawMode('AUTO')}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </div>
                </label>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSavePayment}
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium shadow-sm hover:shadow hover:-translate-y-0.5 transition-all disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Metode Pembayaran
                </button>
              </div>
            </div>
          )}

          {activeTab === 'affiliate' && (
            <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Default Komisi (%)</label>
                  <input
                    value={affiliateDefaultCommissionPercent}
                    onChange={(e) => setAffiliateDefaultCommissionPercent(e.target.value)}
                    disabled={isLoading}
                    inputMode="numeric"
                    className={inputControlClass}
                    placeholder="10"
                  />
                  <div className="text-xs text-slate-500 mt-1">Default: 10%</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Marketplace Menanggung (%)</label>
                  <input
                    value={affiliateMarketplaceSharePercent}
                    onChange={(e) => setAffiliateMarketplaceSharePercent(e.target.value)}
                    disabled={isLoading}
                    inputMode="numeric"
                    className={inputControlClass}
                    placeholder="20"
                  />
                  <div className="text-xs text-slate-500 mt-1">Default: 20% (sisanya ditanggung mentor/vendor)</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Hold Periode (hari)</label>
                  <input
                    value={affiliateHoldDays}
                    onChange={(e) => setAffiliateHoldDays(e.target.value)}
                    disabled={isLoading}
                    inputMode="numeric"
                    className={inputControlClass}
                    placeholder="7"
                  />
                  <div className="text-xs text-slate-500 mt-1">Default: 7 hari</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleSaveAffiliate}
                  disabled={isLoading || isSaving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-70 transition-all flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-slate-500">Kelola izin akses untuk setiap role pengguna.</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Akses Dashboard</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Buat Kursus</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Beli Produk</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">ADMIN</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">MENTOR</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">STUDENT</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                        <td className="px-6 py-4 text-sm text-slate-400"><XCircle className="w-4 h-4 inline mr-1" /> Tidak</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Ya</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <div className="flex items-center h-5">
                  <input id="email_notif" type="checkbox" className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 rounded" defaultChecked />
                </div>
                <div className="ml-1">
                  <label htmlFor="email_notif" className="font-medium text-slate-700 text-sm">Notifikasi Email</label>
                  <p className="text-slate-500 text-xs">Terima email untuk setiap pembelian atau pendaftaran baru.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center h-5">
                  <input id="push_notif" type="checkbox" className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 rounded" />
                </div>
                <div className="ml-1">
                  <label htmlFor="push_notif" className="font-medium text-slate-700 text-sm">Web Push Notification</label>
                  <p className="text-slate-500 text-xs">Terima notifikasi langsung di browser saat sedang online.</p>
                </div>
              </div>
              <div className="pt-4">
                <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm hover:shadow transition-colors">
                  <Save className="w-4 h-4" /> Simpan Preferensi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MediaPickerModal
        isOpen={mediaOpen}
        onClose={() => {
          setMediaOpen(false);
          setMediaTarget(null);
        }}
        initialTab={mediaInitialTab}
        onSelect={(asset) => {
          if (mediaTarget === 'LOGO') setLogoUrl(asset.url);
          if (mediaTarget === 'FAVICON') setFaviconUrl(asset.url);
          setMediaOpen(false);
          setMediaTarget(null);
        }}
      />

      <ConfirmDialog
        isOpen={reauthOpen}
        onClose={closeReauth}
        onConfirm={confirmReauth}
        title="Konfirmasi Password"
        variant="warning"
        confirmText="Konfirmasi"
        cancelText="Batal"
        isLoading={reauthLoading}
        content={
          <div className="space-y-3">
            <div>Masukkan password Super Admin untuk melanjutkan.</div>
            <input
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              autoComplete="current-password"
              className={inputControlClass}
              placeholder="Password"
            />
          </div>
        }
      />
    </div>
  );
}
