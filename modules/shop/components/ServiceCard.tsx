"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { normalizeImageUrl } from '@/modules/core/utils/image';

type ServiceProduct = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
};

export default function ServiceCard({ service }: { service: ServiceProduct }) {
  // imageUrl = icon khusus layanan, imageUrls[0] = foto sampul
  const iconImage = service.imageUrl ? normalizeImageUrl(service.imageUrl, { fallback: '' }) : '';
  const coverImage = Array.isArray(service.imageUrls) && service.imageUrls.length > 0
    ? normalizeImageUrl(service.imageUrls[0], { fallback: '' })
    : '';

  // Parse description untuk extract features (format: "Description\n\nFeature1\nFeature2")
  const descLines = (service.description || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const mainDesc = descLines[0] || '';
  const features = descLines.slice(1).filter((line) => line.length > 0 && line.length < 100);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-visible shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Cover Image 16:9 */}
      <div className="relative w-full aspect-video bg-slate-100 overflow-visible z-10 rounded-t-2xl">
        {coverImage ? (
          <Image src={coverImage} alt={service.name} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
          </div>
        )}
        {/* Icon overlapping di pojok kiri bawah */}
        {iconImage ? (
          <div className="absolute left-4 -bottom-6 w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 shadow-md z-10 p-1.5">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image src={iconImage} alt={service.name} fill sizes="64px" quality={60} className="object-contain" />
            </div>
          </div>
        ) : (
          <div className="absolute left-4 -bottom-6 w-14 h-14 rounded-2xl bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center z-10">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 pt-8 flex flex-col flex-1">
        <div className="text-lg font-extrabold text-slate-900">{service.name}</div>
        <div className="text-sm text-slate-600 mt-1 line-clamp-2">{mainDesc}</div>

        {features.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="flex-1">{feature}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-4 pt-4 border-t border-slate-100">
          <Link
            href={`/shop/products/${service.id}`}
            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl border-2 border-indigo-600 text-indigo-700 font-extrabold hover:bg-indigo-50 transition-colors"
          >
            Selengkapnya
          </Link>
        </div>
      </div>
    </div>
  );
}
