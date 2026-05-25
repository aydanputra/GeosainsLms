"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';

type GalleryItem = {
  imageUrl?: string;
  caption?: string;
  href?: string;
};

type GalleryContent = {
  heading?: string;
  subheading?: string;
  columns?: number;
  mobileColumns?: 1 | 2;
  imageHeightPx?: number;
  showCaptions?: boolean;
  items?: GalleryItem[];
};

export default function GalleryBlock({ content }: { content: GalleryContent }) {
  const heading = typeof content?.heading === 'string' ? content.heading : 'Galeri';
  const subheading = typeof content?.subheading === 'string' ? content.subheading : '';
  const columnsRaw = typeof content?.columns === 'number' && Number.isFinite(content.columns) ? content.columns : 4;
  const columns = Math.max(2, Math.min(6, Math.round(columnsRaw)));
  const mobileColumns: 1 | 2 = content?.mobileColumns === 2 ? 2 : 1;
  const imageHeightPx = typeof content?.imageHeightPx === 'number' && Number.isFinite(content.imageHeightPx) ? content.imageHeightPx : 220;
  const showCaptions = content?.showCaptions !== false;

  const items = useMemo(
    () =>
      (Array.isArray(content?.items) ? content.items : [])
        .map((it) => ({
          imageUrl: typeof it?.imageUrl === 'string' ? it.imageUrl : '',
          caption: typeof it?.caption === 'string' ? it.caption : '',
          href: typeof it?.href === 'string' ? it.href : '',
        }))
        .filter((it) => it.imageUrl || it.caption),
    [content]
  );

  const colsClass =
    columns === 2
      ? 'lg:grid-cols-2'
      : columns === 3
        ? 'lg:grid-cols-3'
        : columns === 4
          ? 'lg:grid-cols-4'
          : columns === 5
            ? 'lg:grid-cols-5'
            : 'lg:grid-cols-6';

  const mobileColsClass = mobileColumns === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <section className="w-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-[700] leading-[36px] text-slate-900">{heading}</h2>
          {subheading ? (
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">{subheading}</p>
          ) : null}
        </div>

        <div className="mt-10">
          {items.length > 0 ? (
            <div className={`grid ${mobileColsClass} sm:grid-cols-2 ${colsClass} gap-4`}>
              {items.map((it, idx) => {
                const node = (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="relative w-full bg-slate-100" style={{ height: `${imageHeightPx}px` }}>
                      {it.imageUrl ? <Image src={it.imageUrl} alt={it.caption || 'Gallery'} fill unoptimized className="object-cover" /> : null}
                    </div>
                    {showCaptions && it.caption ? (
                      <div className="px-4 py-3 text-sm font-semibold text-slate-700 line-clamp-2">{it.caption}</div>
                    ) : null}
                  </div>
                );

                if (it.href) {
                  return (
                    <Link key={`${it.href}-${idx}`} href={it.href} className="block">
                      {node}
                    </Link>
                  );
                }

                return <div key={`${it.imageUrl || 'item'}-${idx}`}>{node}</div>;
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              Belum ada gambar yang ditambahkan.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

