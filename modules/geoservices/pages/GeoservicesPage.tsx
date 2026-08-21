"use client";

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone, Star } from 'lucide-react';
import { normalizeImageUrl } from '@/modules/core/utils/image';

type VendorRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  ratingAvg: number;
  ratingCount: number;
  serviceCount: number;
  productCount: number;
};

export default function GeoservicesPage({ initialVendors = [] }: { initialVendors?: VendorRow[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'TOP' | 'NEWEST' | 'NAME_ASC'>('TOP');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = initialVendors.slice();
    if (q) list = list.filter((v) => (typeof v?.name === 'string' ? v.name : '').toLowerCase().includes(q));

    list.sort((a, b) => {
      if (sort === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '', 'id');
      if (sort === 'NEWEST') return String(b.id).localeCompare(String(a.id));
      if (b.ratingAvg !== a.ratingAvg) return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if (b.ratingCount !== a.ratingCount) return (b.ratingCount || 0) - (a.ratingCount || 0);
      return b.serviceCount - a.serviceCount;
    });

    return list;
  }, [initialVendors, search, sort]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative">
        <div className="h-56 sm:h-72 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-slate-900 to-slate-900" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.8),transparent_55%),radial-gradient(circle_at_70%_60%,rgba(56,189,248,0.6),transparent_55%)]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 sm:-mt-20 bg-white/90 supports-[backdrop-filter]:bg-white/70 supports-[backdrop-filter]:backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-500">Geoservices</div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Cari Vendor Layanan</h1>
                <div className="text-sm text-slate-600 mt-1">
                  Menampilkan <span className="font-bold text-slate-700">{filtered.length}</span> vendor
                </div>
              </div>
              <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  placeholder="Cari vendor..."
                />
                <select
                  value={sort}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'TOP' || v === 'NEWEST' || v === 'NAME_ASC') setSort(v);
                  }}
                  className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
                >
                  <option value="TOP">Teratas</option>
                  <option value="NEWEST">Terbaru</option>
                  <option value="NAME_ASC">Nama A–Z</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((v) => {
              const logoUrl = normalizeImageUrl(v.logoUrl, { fallback: '' }) || '';
              const coverUrl = normalizeImageUrl(v.coverUrl, { fallback: '' }) || '';
              const location = [v.city, v.province, v.country].filter(Boolean).join(', ');
              const email = v.contactEmail || '';
              const phone = v.contactPhone || '';
              const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : 'Vendor';
              const initials = name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join('');

              return (
                <div key={v.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-28 bg-slate-100 relative">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        quality={65}
                        className="object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-white/0" />
                  </div>
                  <div className="p-5">
                    <div className="-mt-12 flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-white border border-slate-200 overflow-hidden relative shrink-0">
                        {logoUrl ? (
                          <Image src={logoUrl} alt={name} fill sizes="64px" quality={60} className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-700 font-extrabold">
                            {initials || 'V'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 font-extrabold text-slate-900">{name}</div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mt-1">
                      <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                      {Number(v.ratingAvg || 0).toFixed(1)}
                      <span className="text-slate-500 font-semibold">({v.ratingCount || 0})</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600 font-semibold">{v.serviceCount} layanan</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600 font-semibold">{v.productCount} produk</span>
                    </div>

                    <div className="mt-4 text-sm text-slate-600 line-clamp-2 min-h-[40px]">{v.description || ' '}</div>

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                        <div className="truncate">{location || '-'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-700 shrink-0" />
                        <div className="truncate">{email || '-'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-700 shrink-0" />
                        <div className="truncate">{phone || '-'}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end">
                      <Link
                        href={`/vendor/${encodeURIComponent(v.slug)}`}
                        className="px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold hover:opacity-90 transition-opacity"
                      >
                        Lihat Vendor
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            Tidak ada vendor yang cocok dengan pencarian.
          </div>
        )}
      </div>
    </div>
  );
}
