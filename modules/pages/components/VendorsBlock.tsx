"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
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

function VendorCard({ vendor, index }: { vendor: VendorRow; index: number }) {
  const [coverError, setCoverError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const logoUrl = typeof vendor.logoUrl === 'string' && vendor.logoUrl.trim() && !logoError ? vendor.logoUrl : '';
  const coverUrl = typeof vendor.coverUrl === 'string' && vendor.coverUrl.trim() && !coverError ? vendor.coverUrl : '';
  const location = [vendor.city, vendor.province, vendor.country].filter(Boolean).join(', ');
  const email = typeof vendor.contactEmail === 'string' ? vendor.contactEmail : '';
  const phone = typeof vendor.contactPhone === 'string' ? vendor.contactPhone : '';
  const name = typeof vendor.name === 'string' && vendor.name.trim() ? vendor.name.trim() : 'Vendor';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const ratingAvg = typeof vendor.ratingAvg === 'number' && Number.isFinite(vendor.ratingAvg) ? vendor.ratingAvg : 0;
  const ratingCount = typeof vendor.ratingCount === 'number' && Number.isFinite(vendor.ratingCount) ? vendor.ratingCount : 0;
  const productCount = typeof vendor.productCount === 'number' && Number.isFinite(vendor.productCount) ? vendor.productCount : 0;

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '360px' }}
    >
      <div className="h-28 bg-slate-100 relative">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) calc(50vw - 2rem), 360px"
            priority={index < 2}
            className="object-cover"
            onError={() => setCoverError(true)}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-white/0" />
      </div>
      <div className="p-5">
        <div className="-mt-12 flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-white border border-slate-200 overflow-hidden relative shrink-0">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={name}
                fill
                sizes="64px"
                className="object-cover"
                onError={() => setLogoError(true)}
              />
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

        <div className="mt-4 text-sm text-slate-600 line-clamp-2 min-h-[40px]">{vendor.description || ' '}</div>

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
            href={`/vendor/${encodeURIComponent(vendor.slug)}`}
            className="px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold hover:opacity-90 transition-opacity"
          >
            Lihat Vendor
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VendorsBlock({
  content,
  initialVendors = [],
}: {
  content: VendorsContent;
  initialVendors?: VendorRow[];
  hydratedFromServer?: boolean;
}) {
  const heading = typeof content?.heading === 'string' ? content.heading : 'Vendor Terverifikasi';
  const subheading = typeof content?.subheading === 'string' ? content.subheading : '';
  const limit = typeof content?.limit === 'number' && Number.isFinite(content.limit) ? Math.max(1, Math.min(24, content.limit)) : 6;
  const sort: 'TOP' | 'NEWEST' | 'NAME_ASC' = content?.sort === 'NEWEST' || content?.sort === 'NAME_ASC' ? content.sort : 'TOP';
  const ctaText = typeof content?.cta?.text === 'string' ? content.cta.text : '';
  const ctaHref = typeof content?.cta?.href === 'string' ? content.cta.href : '';
  const [vendorsData] = useState<VendorRow[]>(Array.isArray(initialVendors) ? initialVendors : []);

  const vendors = useMemo(() => {
    let list = Array.isArray(vendorsData) ? vendorsData.slice() : [];
    list = list.filter((v) => v && typeof v.id === 'string' && typeof v.slug === 'string' && typeof v.name === 'string');

    list.sort((a, b) => {
      if (sort === 'NAME_ASC') return a.name.localeCompare(b.name, 'id');
      if (sort === 'NEWEST') return String(b.id).localeCompare(String(a.id));
      if ((b.ratingAvg || 0) !== (a.ratingAvg || 0)) return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if ((b.ratingCount || 0) !== (a.ratingCount || 0)) return (b.ratingCount || 0) - (a.ratingCount || 0);
      return (b.productCount || 0) - (a.productCount || 0);
    });

    return list.slice(0, limit);
  }, [vendorsData, limit, sort]);

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
          {vendors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map((vendor, index) => (
                <VendorCard key={vendor.id} vendor={vendor} index={index} />
              ))}
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
