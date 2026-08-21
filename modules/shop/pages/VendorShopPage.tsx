"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import ServiceCard from '../components/ServiceCard';
import { CheckCircle2, Mail, MapPin, Phone, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeImageUrl } from '@/modules/core/utils/image';

type CategoryOption = { id: string; name: string };

type VendorProduct = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  price: number;
  stock?: number | null;
  type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL';
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  createdAt?: string | null;
};

type VendorPublic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  ratingAvg: number;
  ratingCount: number;
  products: VendorProduct[];
};

export default function VendorShopPage({
  initialVendor,
  initialCategories = [],
}: {
  slug: string;
  initialVendor: VendorPublic | null;
  initialCategories?: CategoryOption[];
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [sort, setSort] = useState<'NEWEST' | 'NAME_ASC'>('NEWEST');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const vendor = initialVendor;
  const categoriesData = initialCategories;

  const products = useMemo(() => (Array.isArray(vendor?.products) ? vendor.products : []), [vendor]);

  const categoryOptions = useMemo(() => {
    const base = Array.isArray(categoriesData) ? categoriesData : [];
    if (base.length > 0) {
      return base
        .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
        .map((c) => ({ id: c.id, name: c.name }));
    }

    const map = new Map<string, { id: string; name: string }>();
    for (const p of products) {
      const c = p.categoryRef;
      if (c?.id && c?.name) map.set(String(c.id), { id: String(c.id), name: String(c.name) });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [categoriesData, products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = products.slice().filter((p) => p.type !== 'SERVICE');

    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (category !== 'ALL') list = list.filter((p) => String(p.categoryRef?.id || p.categoryId || '') === category);
    if (onlyInStock) list = list.filter((p) => Number(p.stock || 0) > 0);

    list.sort((a, b) => {
      if (sort === 'NAME_ASC') return String(a.name || '').localeCompare(String(b.name || ''), 'id');
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return list;
  }, [products, search, category, onlyInStock, sort]);

  const serviceProducts = useMemo(() => {
    return products.filter((p) => p.type === 'SERVICE');
  }, [products]);

  if (!vendor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <div className="text-slate-900 font-extrabold">Toko tidak tersedia</div>
          <div className="text-sm text-slate-500 mt-1">Vendor belum aktif atau tidak ditemukan.</div>
          <Link href="/shop" className="inline-block mt-4 text-sm font-bold text-indigo-700 hover:text-indigo-800">
            Kembali ke Toko
          </Link>
        </div>
      </div>
    );
  }

  const coverUrl = normalizeImageUrl(vendor?.coverUrl, { fallback: '' }) || '';
  const logoUrl = normalizeImageUrl(vendor?.logoUrl, { fallback: '' }) || '';

  const ratingAvg = typeof vendor?.ratingAvg === 'number' && Number.isFinite(vendor.ratingAvg) ? vendor.ratingAvg : 0;
  const ratingCount = typeof vendor?.ratingCount === 'number' && Number.isFinite(vendor.ratingCount) ? vendor.ratingCount : 0;
  const status = typeof vendor?.status === 'string' ? vendor.status : 'PENDING';
  const contactEmail = typeof vendor?.contactEmail === 'string' ? vendor.contactEmail : '';
  const contactPhone = typeof vendor?.contactPhone === 'string' ? vendor.contactPhone : '';
  const addressLine1 = typeof vendor?.addressLine1 === 'string' ? vendor.addressLine1 : '';
  const addressLine2 = typeof vendor?.addressLine2 === 'string' ? vendor.addressLine2 : '';
  const city = typeof vendor?.city === 'string' ? vendor.city : '';
  const province = typeof vendor?.province === 'string' ? vendor.province : '';
  const postalCode = typeof vendor?.postalCode === 'string' ? vendor.postalCode : '';
  const country = typeof vendor?.country === 'string' ? vendor.country : '';
  const fullAddress = [addressLine1, addressLine2, city, province, postalCode, country].map((v: string) => v.trim()).filter(Boolean).join(', ');
  const waPhone = contactPhone.replace(/[^\d]/g, '');
  const waLink = waPhone ? `https://wa.me/${waPhone}` : '';
  const hasContact = Boolean(waLink || contactEmail);
  const isApproved = status === 'APPROVED';
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative">
        <div className="h-56 sm:h-96 bg-slate-200 relative overflow-hidden">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={vendor?.name || 'Vendor'}
              fill
              priority
              sizes="100vw"
              quality={70}
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-slate-50" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 sm:-mt-20">
            <div className="w-full bg-white/80 supports-[backdrop-filter]:bg-white/70 supports-[backdrop-filter]:backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg">
              <div className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-5">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-20 h-20 rounded-full bg-white border border-slate-200 overflow-hidden relative shrink-0">
                      {logoUrl ? <Image src={logoUrl} alt={vendor?.name || 'Vendor'} fill sizes="80px" quality={60} className="object-cover" /> : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 break-words leading-tight">
                            {vendor?.name || 'Toko'}
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                                <CheckCircle2 className="w-4 h-4" />
                                Terverifikasi
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
                                {status === 'PENDING' ? 'Dalam Verifikasi' : status === 'REJECTED' ? 'Ditolak' : 'Suspended'}
                              </span>
                            )}

                            <div className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
                              <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                              {ratingAvg.toFixed(1)}
                              <span className="text-slate-500 font-bold text-xs">({ratingCount} ulasan)</span>
                            </div>
                          </div>
                        </div>

                        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => toast.success('Berhasil mengikuti toko')}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold hover:opacity-90 transition-opacity"
                          >
                            <Plus className="w-4 h-4" />
                            Ikuti
                          </button>

                          {hasContact ? (
                            <a
                              href={waLink || `mailto:${contactEmail}`}
                              target={waLink ? '_blank' : undefined}
                              rel={waLink ? 'noreferrer' : undefined}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-extrabold hover:bg-slate-50"
                              onClick={() => {
                                if (!isApproved) toast.info('Toko masih dalam verifikasi');
                              }}
                            >
                              <Mail className="w-4 h-4" />
                              Hubungi Penjual
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toast.info('Kontak penjual belum tersedia')}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-extrabold hover:bg-slate-50"
                            >
                              <Mail className="w-4 h-4" />
                              Hubungi Penjual
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-slate-700 mt-3 leading-relaxed">
                        {vendor?.description || 'Belum ada deskripsi toko.'}
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-slate-700">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                          <div className="truncate">{fullAddress || '-'}</div>
                        </div>
                        <div className="hidden sm:block w-px h-4 bg-slate-200" />
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-4 h-4 text-blue-700 shrink-0" />
                          <div className="truncate">{contactEmail || '-'}</div>
                        </div>
                        <div className="hidden sm:block w-px h-4 bg-slate-200" />
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-4 h-4 text-blue-700 shrink-0" />
                          <div className="truncate">{contactPhone || '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {isApproved && serviceProducts.length > 0 ? (
          <div className="mb-10">
            <div className="mb-6">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">Layanan Kami</div>
              <div className="text-sm text-slate-600 mt-1">
                Solusi profesional untuk kebutuhan geospasial, lingkungan, dan digital Anda
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {serviceProducts.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900">Produk Toko</div>
            <div className="text-sm text-slate-500 mt-1">
              Menampilkan <span className="font-bold text-slate-700">{filteredProducts.length}</span> dari{' '}
              <span className="font-bold text-slate-700">{products.filter((p) => p.type !== 'SERVICE').length}</span> produk
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              Ready Stock
            </label>
            <select
              value={sort}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'NEWEST' || v === 'NAME_ASC') setSort(v);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            >
              <option value="NEWEST">Terbaru</option>
              <option value="NAME_ASC">Nama A–Z</option>
            </select>
          </div>
        </div>

        <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-7">
              <div className="text-xs font-bold text-slate-500 mb-1">Cari Produk</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                placeholder="Cari berdasarkan nama produk..."
              />
            </div>
            <div className="lg:col-span-3">
              <div className="text-xs font-bold text-slate-500 mb-1">Kategori</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
              >
                <option value="ALL">Semua Kategori</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2 flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('ALL');
                  setSort('NEWEST');
                  setOnlyInStock(false);
                }}
                className="w-full lg:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </div>

        {!isApproved ? (
          <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-slate-900 font-extrabold">Toko sedang dalam proses verifikasi</div>
            <div className="text-sm text-slate-500 mt-1">Produk akan tampil setelah vendor disetujui oleh admin.</div>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p) => (
              <ProductCard key={p.id} product={p} adminWhatsAppNumber={contactPhone} />
            ))}
          </div>
        ) : (
          <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            Produk tidak ditemukan untuk filter yang dipilih.
          </div>
        )}
      </div>
    </div>
  );
}
