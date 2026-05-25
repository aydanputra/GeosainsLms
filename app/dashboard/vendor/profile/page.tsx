import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import VendorBrandingFields, { VendorImageField } from './VendorBrandingFields';

export const dynamic = 'force-dynamic';

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
  }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawTab = typeof sp?.tab === 'string' ? sp.tab : '';
  const activeTab =
    rawTab === 'store' || rawTab === 'branding' || rawTab === 'contact' || rawTab === 'address' || rawTab === 'verification'
      ? rawTab
      : 'store';

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/dashboard/vendor/profile');

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  if (!userId) redirect('/login?redirect=/dashboard/vendor/profile');

  const vendors = await prisma.shopVendor.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ownerId: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      coverUrl: true,
      status: true,
      contactEmail: true,
      contactPhone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,
      idNumber: true,
      idDocumentUrl: true,
      verificationNote: true,
    },
  });

  if (vendors.length === 0) redirect('/dashboard/vendor');

  const vendor = vendors[0];
  const canEdit = String(vendor.ownerId || '') === userId;

  const missing: string[] = [];
  if (!vendor.description) missing.push('Deskripsi');
  if (!vendor.contactEmail) missing.push('Email Kontak');
  if (!vendor.contactPhone) missing.push('Telepon/WhatsApp');
  if (!vendor.addressLine1) missing.push('Alamat');
  if (!vendor.city) missing.push('Kota');
  if (!vendor.province) missing.push('Provinsi');
  if (!vendor.postalCode) missing.push('Kode Pos');
  if (!vendor.country) missing.push('Negara');
  const isProfileComplete = missing.length === 0;

  const save = async (formData: FormData) => {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyToken(token);
    const userId = payload?.id ? String(payload.id) : null;
    if (!userId) return;

    const vendorId = String(formData.get('vendorId') || '');
    if (!vendorId) return;

    const membership = await prisma.shopVendor.findFirst({
      where: {
        id: vendorId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, ownerId: true },
    });

    const isAdmin = payload?.role === 'ADMIN';
    if (!membership && !isAdmin) return;
    const isOwner = Boolean(membership?.ownerId && String(membership.ownerId) === userId);

    const data: any = {};
    const name = normalizeString(formData.get('name'));
    const slugRaw = normalizeString(formData.get('slug'));
    const description = normalizeString(formData.get('description'));
    const logoUrl = normalizeString(formData.get('logoUrl'));
    const coverUrl = normalizeString(formData.get('coverUrl'));
    const contactEmail = normalizeString(formData.get('contactEmail'));
    const contactPhone = normalizeString(formData.get('contactPhone'));
    const addressLine1 = normalizeString(formData.get('addressLine1'));
    const addressLine2 = normalizeString(formData.get('addressLine2'));
    const city = normalizeString(formData.get('city'));
    const province = normalizeString(formData.get('province'));
    const postalCode = normalizeString(formData.get('postalCode'));
    const country = normalizeString(formData.get('country'));
    const idNumber = normalizeString(formData.get('idNumber'));
    const idDocumentUrl = normalizeString(formData.get('idDocumentUrl'));

    if (isOwner) {
      if (name) data.name = name;
      if (slugRaw) data.slug = slugify(slugRaw);
    }
    if (typeof formData.get('description') === 'string') data.description = description || null;
    if (typeof formData.get('logoUrl') === 'string') data.logoUrl = logoUrl || null;
    if (typeof formData.get('coverUrl') === 'string') data.coverUrl = coverUrl || null;
    if (typeof formData.get('contactEmail') === 'string') data.contactEmail = contactEmail || null;
    if (typeof formData.get('contactPhone') === 'string') data.contactPhone = contactPhone || null;
    if (typeof formData.get('addressLine1') === 'string') data.addressLine1 = addressLine1 || null;
    if (typeof formData.get('addressLine2') === 'string') data.addressLine2 = addressLine2 || null;
    if (typeof formData.get('city') === 'string') data.city = city || null;
    if (typeof formData.get('province') === 'string') data.province = province || null;
    if (typeof formData.get('postalCode') === 'string') data.postalCode = postalCode || null;
    if (typeof formData.get('country') === 'string') data.country = country || null;
    if (typeof formData.get('idNumber') === 'string') data.idNumber = idNumber || null;
    if (typeof formData.get('idDocumentUrl') === 'string') data.idDocumentUrl = idDocumentUrl || null;

    if (Object.keys(data).length === 0) return;
    await prisma.shopVendor.update({ where: { id: vendorId }, data });
  };

  const statusLabel =
    vendor.status === 'APPROVED'
      ? 'Aktif'
      : vendor.status === 'PENDING'
        ? 'Menunggu Persetujuan'
        : vendor.status === 'REJECTED'
          ? 'Ditolak'
          : 'Suspended';

  const statusTone =
    vendor.status === 'APPROVED'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : vendor.status === 'PENDING'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : vendor.status === 'REJECTED'
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';

  const surfaceClass = 'bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden';
  const cardClass = 'bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6';
  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:placeholder:text-slate-400 disabled:cursor-not-allowed';
  const textareaClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'store', label: 'Toko' },
    { id: 'branding', label: 'Branding' },
    { id: 'contact', label: 'Kontak' },
    { id: 'address', label: 'Alamat' },
    { id: 'verification', label: 'Verifikasi' },
  ];

  const summary = (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-extrabold text-slate-900">Ringkasan Vendor</div>
          <div className="text-xs text-slate-500">{vendor.name}</div>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-extrabold border ${
            isProfileComplete ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {isProfileComplete ? 'Lengkap' : 'Perlu dilengkapi'}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="text-xs text-slate-600">
          <span className="font-bold">Slug:</span> {vendor.slug || '-'}
        </div>

        <Link
          href="/dashboard/vendor/shop"
          className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-xs hover:bg-slate-50 inline-flex items-center justify-center w-full"
        >
          Kelola Produk
        </Link>
      </div>

      {!isProfileComplete ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-extrabold text-amber-900">Wajib dilengkapi</div>
          <div className="text-sm text-amber-900 mt-1">{missing.join(', ')}</div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-extrabold text-emerald-900">Siap untuk penjualan</div>
          <div className="text-sm text-emerald-900 mt-1">Profil vendor sudah memenuhi syarat minimal.</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className={surfaceClass}>
        <div className="px-6 py-5 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-xl font-extrabold text-slate-900">Pengaturan Vendor</div>
            <div className="text-sm text-slate-500 mt-1">Kelola profil vendor untuk kebutuhan penjualan.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusTone}`}>{statusLabel}</span>
            <Link
              href="/dashboard/vendor"
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-xs hover:bg-slate-50 inline-flex items-center justify-center"
            >
              Kembali
            </Link>
          </div>
        </div>

        <div className="border-b border-slate-200/70 px-4 sm:px-6 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            {tabs.map((t) => {
              const isActive = t.id === activeTab;
              return (
                <Link
                  key={t.id}
                  href={`/dashboard/vendor/profile?tab=${t.id}`}
                  className={
                    isActive
                      ? 'py-3 text-[13px] sm:text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap text-indigo-700 border-indigo-600'
                      : 'py-3 text-[13px] sm:text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200'
                  }
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <form action={save} className="space-y-6">
            <input type="hidden" name="vendorId" value={vendor.id} />

            {activeTab === 'store' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardClass}>
                  <div className="text-sm font-extrabold text-slate-900">Informasi Toko</div>
                  <div className="text-xs text-slate-500 mt-1">Nama dan slug digunakan sebagai identitas vendor.</div>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Nama Toko</label>
                      <input name="name" defaultValue={vendor.name || ''} className={inputClass} disabled={!canEdit} />
                      <div className="text-[11px] text-slate-500">
                        {canEdit ? 'Anda bisa mengubah nama toko.' : 'Nama toko hanya bisa diubah oleh owner.'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Slug</label>
                      <input name="slug" defaultValue={vendor.slug || ''} className={inputClass} disabled={!canEdit} />
                      <div className="text-[11px] text-slate-500">Gunakan huruf kecil dan strip (-). Contoh: toko-anda</div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-600">Deskripsi</label>
                      <textarea
                        name="description"
                        rows={4}
                        defaultValue={vendor.description || ''}
                        className={textareaClass}
                        placeholder="Ceritakan singkat tentang toko Anda, layanan/produk utama, dan keunggulannya."
                      />
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
                    {canEdit ? 'Hanya owner vendor yang bisa mengubah Nama/Slug.' : 'Anda bukan owner vendor. Nama/Slug dikunci.'}
                  </div>
                </div>

                <div className="space-y-6">
                  {summary}
                  {vendor.verificationNote ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
                      <div className="text-sm font-extrabold">Catatan Verifikasi</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{vendor.verificationNote}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'branding' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardClass}>
                  <div className="text-sm font-extrabold text-slate-900">Branding</div>
                  <div className="text-xs text-slate-500 mt-1">Logo dan cover membantu tampilan toko lebih meyakinkan.</div>
                  <div className="mt-5">
                    <VendorBrandingFields initialLogoUrl={vendor.logoUrl} initialCoverUrl={vendor.coverUrl} />
                  </div>
                </div>
                <div className="space-y-6">
                  {summary}
                  {vendor.verificationNote ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
                      <div className="text-sm font-extrabold">Catatan Verifikasi</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{vendor.verificationNote}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'contact' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardClass}>
                  <div className="text-sm font-extrabold text-slate-900">Kontak</div>
                  <div className="text-xs text-slate-500 mt-1">Informasi ini tampil untuk pembeli yang membutuhkan bantuan.</div>
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Email Kontak</label>
                      <input name="contactEmail" defaultValue={vendor.contactEmail || ''} className={inputClass} placeholder="toko@email.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Telepon/WhatsApp</label>
                      <input name="contactPhone" defaultValue={vendor.contactPhone || ''} className={inputClass} placeholder="08xxxx" />
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  {summary}
                  {vendor.verificationNote ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
                      <div className="text-sm font-extrabold">Catatan Verifikasi</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{vendor.verificationNote}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'address' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardClass}>
                  <div className="text-sm font-extrabold text-slate-900">Alamat</div>
                  <div className="text-xs text-slate-500 mt-1">Dibutuhkan untuk administrasi dan kebutuhan pengiriman (jika ada).</div>
                  <div className="mt-5 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Alamat</label>
                      <input name="addressLine1" defaultValue={vendor.addressLine1 || ''} className={inputClass} placeholder="Jl. ..." />
                      <input name="addressLine2" defaultValue={vendor.addressLine2 || ''} className={inputClass} placeholder="Detail tambahan (opsional)" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Kota</label>
                        <input name="city" defaultValue={vendor.city || ''} className={inputClass} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Provinsi</label>
                        <input name="province" defaultValue={vendor.province || ''} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Kode Pos</label>
                        <input name="postalCode" defaultValue={vendor.postalCode || ''} className={inputClass} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Negara</label>
                        <input name="country" defaultValue={vendor.country || ''} className={inputClass} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  {summary}
                  {vendor.verificationNote ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
                      <div className="text-sm font-extrabold">Catatan Verifikasi</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{vendor.verificationNote}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'verification' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardClass}>
                  <div className="text-sm font-extrabold text-slate-900">Verifikasi</div>
                  <div className="text-xs text-slate-500 mt-1">Opsional, diisi jika diperlukan untuk proses verifikasi vendor.</div>
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Nomor Identitas (opsional)</label>
                      <input name="idNumber" defaultValue={vendor.idNumber || ''} className={inputClass} />
                    </div>
                    <VendorImageField inputName="idDocumentUrl" label="Dokumen Identitas" initialUrl={vendor.idDocumentUrl} icon="IMAGE" aspectClassName="aspect-[4/3]" />
                  </div>
                </div>
                <div className="space-y-6">
                  {summary}
                  {vendor.verificationNote ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
                      <div className="text-sm font-extrabold">Catatan Verifikasi</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{vendor.verificationNote}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200/70 pt-6">
              <button type="submit" className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700">
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
