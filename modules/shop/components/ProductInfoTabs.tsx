"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ProductCard from './ProductCard';

type VendorInfo = {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

type MoreProduct = {
  id: string;
  slug?: string | null;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  imageUrls?: string[] | null;
  type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL';
};

type TabId = 'DETAIL' | 'REVIEWS' | 'VENDOR' | 'MORE';

export default function ProductInfoTabs({
  categoryName,
  productName,
  productDescription,
  vendor,
  moreProducts,
  adminWhatsAppNumber,
}: {
  categoryName: string;
  productName: string;
  productDescription: string | null;
  vendor: VendorInfo | null;
  moreProducts: MoreProduct[];
  adminWhatsAppNumber?: string | null;
}) {
  const [active, setActive] = useState<TabId>('DETAIL');

  const vendorLocation = useMemo(() => {
    if (!vendor) return '';
    return [vendor.city, vendor.province, vendor.country].filter((x) => typeof x === 'string' && x.trim()).join(', ');
  }, [vendor]);

  const tabs: Array<{ id: TabId; label: string }> = useMemo(
    () => [
      { id: 'DETAIL', label: 'Detail Produk' },
      { id: 'REVIEWS', label: 'Reviews' },
      { id: 'VENDOR', label: 'Vendor Info' },
      { id: 'MORE', label: 'More Produk' },
    ],
    []
  );

  return (
    <div className="mt-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={[
              'px-4 py-2 rounded-xl text-sm font-extrabold transition-colors',
              active === t.id ? 'bg-white text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:bg-white',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'DETAIL' ? (
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-500">Kategori</div>
              <div className="mt-1 text-sm font-extrabold text-slate-900">{categoryName}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-500">Nama Produk</div>
              <div className="mt-1 text-sm font-extrabold text-slate-900">{productName}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <div className="text-xs font-bold text-slate-500">Deskripsi Produk</div>
              <div className="mt-1 text-sm font-semibold text-slate-700 whitespace-pre-line">{productDescription || '-'}</div>
            </div>
          </div>
        </div>
      ) : null}

      {active === 'REVIEWS' ? (
        <div className="p-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            Belum ada ulasan untuk produk ini.
          </div>
        </div>
      ) : null}

      {active === 'VENDOR' ? (
        <div className="p-6">
          {vendor ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="text-sm font-extrabold text-slate-900">Tentang Vendor</div>
                <div className="mt-2 text-sm text-slate-600 leading-relaxed">{vendor.description || 'Belum ada deskripsi vendor.'}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="text-sm font-extrabold text-slate-900">Informasi</div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">Nama Vendor</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">{vendor.name || '-'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">Lokasi</div>
                    <div className="mt-1 text-sm font-semibold text-slate-700">{vendorLocation || '-'}</div>
                  </div>
                  {vendor.contactEmail ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-bold text-slate-500">Email</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700 break-all">{vendor.contactEmail}</div>
                    </div>
                  ) : null}
                  {vendor.contactPhone ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-bold text-slate-500">Telepon</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700 break-all">{vendor.contactPhone}</div>
                    </div>
                  ) : null}
                  {vendor.slug ? (
                    <Link
                      href={`/vendor/${encodeURIComponent(vendor.slug)}`}
                      className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold hover:opacity-90 transition-opacity"
                    >
                      Lihat Profil Vendor
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              Informasi vendor tidak tersedia.
            </div>
          )}
        </div>
      ) : null}

      {active === 'MORE' ? (
        <div className="p-6">
          {moreProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 min-w-0">
              {moreProducts.map((p) => (
                <ProductCard key={p.id} product={p} addToCartVariant="icon" adminWhatsAppNumber={adminWhatsAppNumber} />
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              Belum ada produk lain untuk ditampilkan.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
