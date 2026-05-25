"use client";

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { Mail, MapPin, Phone, Star } from 'lucide-react';

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
  contactEmail?: string | null;
  contactPhone?: string | null;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
};

type VendorsContent = {
  heading?: string;
  subheading?: string;
  limit?: number;
  sort?: 'TOP' | 'NEWEST' | 'NAME_ASC';
  cta?: { text?: string; href?: string };
};

export default function VendorsBlock({ content }: { content: VendorsContent }) {
  const heading = typeof content?.heading === 'string' ? content.heading : 'Vendor Terverifikasi';
  const subheading = typeof content?.subheading === 'string' ? content.subheading : '';
  const limit = typeof content?.limit === 'number' && Number.isFinite(content.limit) ? Math.max(1, Math.min(24, content.limit)) : 6;
  const sort: 'TOP' | 'NEWEST' | 'NAME_ASC' = content?.sort === 'NEWEST' || content?.sort === 'NAME_ASC' ? content.sort : 'TOP';
  const ctaText = typeof content?.cta?.text === 'string' ? content.cta.text : '';
  const ctaHref = typeof content?.cta?.href === 'string' ? content.cta.href : '';

  const { data, isLoading, error } = useQuery<VendorRow[]>({
    queryKey: ['vendors-block', 'shop-vendors-public'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/shop/vendors/public', { signal });
      if (!res.ok) throw new Error('Failed to fetch vendors');
      const json = await res.json().catch(() => []);
      return Array.isArray(json) ? (json as VendorRow[]) : [];
    },
    staleTime: 60_000,
  });

  const vendors = useMemo(() => {
    let list = Array.isArray(data) ? data.slice() : [];
    list = list.filter((v) => v && typeof v.id === 'string' && typeof v.slug === 'string' && typeof v.name === 'string');

    list.sort((a, b) => {
      if (sort === 'NAME_ASC') return a.name.localeCompare(b.name, 'id');
      if (sort === 'NEWEST') return String(b.id).localeCompare(String(a.id));
      if ((b.ratingAvg || 0) !== (a.ratingAvg || 0)) return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if ((b.ratingCount || 0) !== (a.ratingCount || 0)) return (b.ratingCount || 0) - (a.ratingCount || 0);
      return (b.productCount || 0) - (a.productCount || 0);
    });

    return list.slice(0, limit);
  }, [data, limit, sort]);

  return (
    <section className="w-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-[700] leading-[36px] text-slate-900">{heading}</h2>
            {subheading ? <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">{subheading}</p> : null}
          </div>
          {ctaText && ctaHref ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-brand-gradient text-white font-extrabold text-sm hover:opacity-90 transition-opacity w-full sm:w-auto"
            >
              {ctaText}
            </Link>
          ) : null}
        </div>

        <div className="mt-10">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              Gagal memuat daftar vendor.
            </div>
          ) : vendors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map((v) => {
                const logoUrl = typeof v.logoUrl === 'string' && v.logoUrl.trim() ? v.logoUrl : '';
                const coverUrl = typeof v.coverUrl === 'string' && v.coverUrl.trim() ? v.coverUrl : '';
                const location = [v.city, v.province, v.country].filter(Boolean).join(', ');
                const email = typeof v.contactEmail === 'string' ? v.contactEmail : '';
                const phone = typeof v.contactPhone === 'string' ? v.contactPhone : '';
                const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : 'Vendor';
                const initials = name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join('');
                const ratingAvg = typeof v.ratingAvg === 'number' && Number.isFinite(v.ratingAvg) ? v.ratingAvg : 0;
                const ratingCount = typeof v.ratingCount === 'number' && Number.isFinite(v.ratingCount) ? v.ratingCount : 0;
                const productCount = typeof v.productCount === 'number' && Number.isFinite(v.productCount) ? v.productCount : 0;

                return (
                  <div key={v.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-28 bg-slate-100 relative">
                      {coverUrl ? <Image src={coverUrl} alt={name} fill unoptimized className="object-cover" /> : null}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-white/0" />
                    </div>
                    <div className="p-5">
                      <div className="-mt-12 flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-white border border-slate-200 overflow-hidden relative shrink-0">
                          {logoUrl ? (
                            <Image src={logoUrl} alt={name} fill unoptimized className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-700 font-extrabold">
                              {initials || 'V'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 font-extrabold text-slate-900">{name}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-700 mt-1">
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                          {Number(ratingAvg || 0).toFixed(1)}
                          <span className="text-slate-500 font-semibold">({ratingCount})</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-semibold">{productCount} produk</span>
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
              Belum ada vendor yang ditampilkan.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
