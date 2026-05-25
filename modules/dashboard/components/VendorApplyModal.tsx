"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';

type VendorDraft = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  idNumber: string;
  idDocumentUrl: string;
};

function normalize(v?: Partial<VendorDraft> | null): VendorDraft {
  return {
    name: typeof v?.name === 'string' ? v.name : '',
    slug: typeof v?.slug === 'string' ? v.slug : '',
    description: typeof v?.description === 'string' ? v.description : '',
    logoUrl: typeof v?.logoUrl === 'string' ? v.logoUrl : '',
    coverUrl: typeof v?.coverUrl === 'string' ? v.coverUrl : '',
    contactEmail: typeof v?.contactEmail === 'string' ? v.contactEmail : '',
    contactPhone: typeof v?.contactPhone === 'string' ? v.contactPhone : '',
    addressLine1: typeof v?.addressLine1 === 'string' ? v.addressLine1 : '',
    addressLine2: typeof v?.addressLine2 === 'string' ? v.addressLine2 : '',
    city: typeof v?.city === 'string' ? v.city : '',
    province: typeof v?.province === 'string' ? v.province : '',
    postalCode: typeof v?.postalCode === 'string' ? v.postalCode : '',
    country: typeof v?.country === 'string' ? v.country : '',
    idNumber: typeof v?.idNumber === 'string' ? v.idNumber : '',
    idDocumentUrl: typeof v?.idDocumentUrl === 'string' ? v.idDocumentUrl : '',
  };
}

export default function VendorApplyModal({
  triggerLabel,
  initialValue,
  defaultOpen = false,
}: {
  triggerLabel: string;
  initialValue?: Partial<VendorDraft> | null;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [value, setValue] = useState<VendorDraft>(normalize(initialValue));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<'LOGO' | 'COVER' | 'ID'>('LOGO');

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!value.name.trim()) m.push('Nama Toko');
    if (!value.description.trim()) m.push('Deskripsi');
    if (!value.logoUrl.trim()) m.push('Logo URL');
    if (!value.coverUrl.trim()) m.push('Cover URL');
    if (!value.contactEmail.trim()) m.push('Email');
    if (!value.contactPhone.trim()) m.push('Telepon');
    if (!value.addressLine1.trim()) m.push('Alamat Baris 1');
    if (!value.addressLine2.trim()) m.push('Alamat Baris 2');
    if (!value.city.trim()) m.push('Kota');
    if (!value.province.trim()) m.push('Provinsi');
    if (!value.postalCode.trim()) m.push('Kode Pos');
    if (!value.country.trim()) m.push('Negara');
    if (!value.idNumber.trim()) m.push('Nomor Identitas');
    if (!value.idDocumentUrl.trim()) m.push('Dokumen Identitas URL');
    return m;
  }, [value]);

  const resetAndClose = () => {
    setOpen(false);
    setStep(1);
    setValue(normalize(initialValue));
    setIsSubmitting(false);
    setResult(null);
  };

  const canNext = useMemo(() => {
    if (step === 1) {
      return Boolean(value.name.trim() && value.description.trim() && value.logoUrl.trim() && value.coverUrl.trim());
    }
    if (step === 2) {
      return Boolean(
        value.contactEmail.trim() &&
          value.contactPhone.trim() &&
          value.addressLine1.trim() &&
          value.addressLine2.trim() &&
          value.city.trim() &&
          value.province.trim() &&
          value.postalCode.trim() &&
          value.country.trim()
      );
    }
    return true;
  }, [step, value]);

  const submit = async () => {
    const email = value.contactEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setResult({ ok: false, message: 'Format email tidak valid.' });
      return;
    }
    if (missing.length > 0) {
      setResult({ ok: false, message: `Lengkapi field wajib: ${missing.join(', ')}.` });
      return;
    }

    setIsSubmitting(true);
    setResult(null);
    try {
      const payload = {
        name: value.name.trim(),
        slug: value.slug.trim(),
        description: value.description.trim(),
        logoUrl: value.logoUrl.trim(),
        coverUrl: value.coverUrl.trim(),
        contactEmail: email,
        contactPhone: value.contactPhone.trim(),
        addressLine1: value.addressLine1.trim(),
        addressLine2: value.addressLine2.trim(),
        city: value.city.trim(),
        province: value.province.trim(),
        postalCode: value.postalCode.trim(),
        country: value.country.trim(),
        idNumber: value.idNumber.trim(),
        idDocumentUrl: value.idDocumentUrl.trim(),
      };

      const res = await fetch('/api/shop/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal mengajukan vendor');

      setResult({
        ok: true,
        message:
          'Pengajuan vendor berhasil dikirim. Admin akan memeriksa dan memberikan persetujuan. Anda akan menerima notifikasi setelah ada keputusan.',
      });

      router.replace('/dashboard/vendor?submitted=1');
      router.refresh();
    } catch (e: any) {
      setResult({ ok: false, message: e?.message || 'Gagal mengajukan vendor' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue(normalize(initialValue));
          setStep(1);
          setResult(null);
          setOpen(true);
        }}
        className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={resetAndClose} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-900">Pengajuan Vendor</div>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  Tutup
                </button>
              </div>

              <div className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                      step === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    1. Profil
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                      step === 2 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    2. Kontak & Alamat
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                      step === 3 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    3. Verifikasi
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                {result ? (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {result.ok ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 mt-0.5" />
                        <div>{result.message}</div>
                      </div>
                    ) : (
                      result.message
                    )}
                  </div>
                ) : null}

                {step === 1 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Nama</label>
                        <input
                          value={value.name}
                          onChange={(e) => setValue((p) => ({ ...p, name: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Contoh: GeoSains Store"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                        <input
                          value={value.slug}
                          onChange={(e) => setValue((p) => ({ ...p, slug: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="geosains-store"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Deskripsi</label>
                      <textarea
                        value={value.description}
                        onChange={(e) => setValue((p) => ({ ...p, description: e.target.value }))}
                        className="w-full min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Ceritakan tentang toko/vendor Anda"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Logo URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            value={value.logoUrl}
                            onChange={(e) => setValue((p) => ({ ...p, logoUrl: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="https://..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setMediaTarget('LOGO');
                              setIsMediaOpen(true);
                            }}
                            className="shrink-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Cover URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            value={value.coverUrl}
                            onChange={(e) => setValue((p) => ({ ...p, coverUrl: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="https://..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setMediaTarget('COVER');
                              setIsMediaOpen(true);
                            }}
                            className="shrink-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Email</label>
                        <input
                          value={value.contactEmail}
                          onChange={(e) => setValue((p) => ({ ...p, contactEmail: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="vendor@email.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Telepon</label>
                        <input
                          value={value.contactPhone}
                          onChange={(e) => setValue((p) => ({ ...p, contactPhone: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="08xxxxxxxxxx"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Alamat Baris 1</label>
                      <input
                        value={value.addressLine1}
                        onChange={(e) => setValue((p) => ({ ...p, addressLine1: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Jalan, nomor, RT/RW"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Alamat Baris 2</label>
                      <input
                        value={value.addressLine2}
                        onChange={(e) => setValue((p) => ({ ...p, addressLine2: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Kecamatan/Kelurahan"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Kota</label>
                        <input
                          value={value.city}
                          onChange={(e) => setValue((p) => ({ ...p, city: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Bandung"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Provinsi</label>
                        <input
                          value={value.province}
                          onChange={(e) => setValue((p) => ({ ...p, province: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Jawa Barat"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Kode Pos</label>
                        <input
                          value={value.postalCode}
                          onChange={(e) => setValue((p) => ({ ...p, postalCode: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="40111"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Negara</label>
                        <input
                          value={value.country}
                          onChange={(e) => setValue((p) => ({ ...p, country: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Indonesia"
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Nomor Identitas</label>
                        <input
                          value={value.idNumber}
                          onChange={(e) => setValue((p) => ({ ...p, idNumber: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="KTP/SIM/Paspor"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Dokumen Identitas URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            value={value.idDocumentUrl}
                            onChange={(e) => setValue((p) => ({ ...p, idDocumentUrl: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="https://..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setMediaTarget('ID');
                              setIsMediaOpen(true);
                            }}
                            className="shrink-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Pastikan data yang Anda isi sudah benar. Setelah dikirim, admin akan melakukan verifikasi.
                    </div>
                  </>
                ) : null}
              </div>

              <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as any)))}
                  disabled={step === 1 || isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Kembali
                </button>

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s === 3 ? 3 : ((s + 1) as any)))}
                    disabled={!canNext || isSubmitting}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Lanjut
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <MediaPickerModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        initialTab="UPLOAD"
        onSelect={(item) => {
          if (mediaTarget === 'LOGO') setValue((p) => ({ ...p, logoUrl: item.url }));
          if (mediaTarget === 'COVER') setValue((p) => ({ ...p, coverUrl: item.url }));
          if (mediaTarget === 'ID') setValue((p) => ({ ...p, idDocumentUrl: item.url }));
        }}
      />
    </>
  );
}
