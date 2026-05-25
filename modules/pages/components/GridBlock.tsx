"use client";

import Image from 'next/image';
import Link from 'next/link';

type GridItem = {
  title: string;
  description: string;
  imageUrl?: string;
  href?: string;
  bgColor?: string;
  textColor?: string;
};

export type GridContent = {
  heading?: string;
  subheading?: string;
  columns?: number;
  rows?: number;
  maxItems?: number;
  mobileTwoColumns?: boolean;
  highlightEnabled?: boolean;
  highlightIndex?: number | null;
  highlightIndexes?: number[];
  highlightBgColor?: string;
  highlightTextColor?: string;
  items: GridItem[];
};

export default function GridBlock({ content }: { content: GridContent }) {
  const items = Array.isArray(content.items) ? content.items : [];
  const rawColumns =
    typeof content.columns === 'number' && Number.isFinite(content.columns)
      ? Math.min(10, Math.max(1, Math.round(content.columns)))
      : 4;
  const rows =
    typeof content.rows === 'number' && Number.isFinite(content.rows)
      ? Math.min(50, Math.max(1, Math.round(content.rows)))
      : undefined;
  const rawMaxItems =
    typeof content.maxItems === 'number' && Number.isFinite(content.maxItems)
      ? Math.min(500, Math.max(1, Math.round(content.maxItems)))
      : undefined;

  const inferredMaxItems = rows && !rawMaxItems && rawColumns === items.length && rawColumns > 4 ? rawColumns : undefined;
  const maxItems = rawMaxItems || inferredMaxItems;
  const columns = inferredMaxItems ? Math.min(10, Math.max(1, Math.ceil(inferredMaxItems / (rows || 1)))) : rawColumns;

  const mobileTwoColumns = content.mobileTwoColumns === true;
  const highlightEnabled = content.highlightEnabled === true;

  const baseColsClass = mobileTwoColumns ? 'grid-cols-2' : 'grid-cols-1';
  const smColsClass = columns >= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1';
  const lgColsClass =
    columns === 1
      ? 'lg:grid-cols-1'
      : columns === 2
        ? 'lg:grid-cols-2'
        : columns === 3
          ? 'lg:grid-cols-3'
          : columns === 4
            ? 'lg:grid-cols-4'
            : columns === 5
              ? 'lg:grid-cols-5'
              : columns === 6
                ? 'lg:grid-cols-6'
                : columns === 7
                  ? 'lg:grid-cols-7'
                  : columns === 8
                    ? 'lg:grid-cols-8'
                    : columns === 9
                      ? 'lg:grid-cols-9'
                      : 'lg:grid-cols-10';

  const highlightIndexesRaw = Array.isArray(content.highlightIndexes) ? content.highlightIndexes : undefined;
  const highlightIndexes =
    highlightEnabled && highlightIndexesRaw
      ? Array.from(
          new Set(
            highlightIndexesRaw
              .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
              .map((v) => Math.round(v))
              .filter((v) => v >= 0 && v < items.length)
          )
        )
      : highlightEnabled && typeof content.highlightIndex === 'number' && Number.isFinite(content.highlightIndex)
        ? [Math.round(content.highlightIndex)]
        : [];
  const highlightBgColor = typeof content.highlightBgColor === 'string' && content.highlightBgColor.trim() ? content.highlightBgColor.trim() : '#2563eb';
  const highlightTextColor =
    typeof content.highlightTextColor === 'string' && content.highlightTextColor.trim() ? content.highlightTextColor.trim() : '#ffffff';

  const limit = rows ? rows * columns : undefined;
  const visibleItems = items.slice(0, limit ? (maxItems ? Math.min(maxItems, limit) : limit) : maxItems || items.length);

  return (
    <section className="w-full bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {(content.heading || content.subheading) ? (
          <div className="text-center max-w-3xl mx-auto">
            {content.heading ? <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{content.heading}</h2> : null}
            {content.subheading ? <p className="text-sm sm:text-base text-slate-600 mt-2">{content.subheading}</p> : null}
          </div>
        ) : null}

        <div className={`mt-8 grid grid-flow-row ${baseColsClass} ${smColsClass} ${lgColsClass} gap-4 sm:gap-6`}>
          {visibleItems.map((item, idx) => {
            const isHighlight = highlightEnabled && highlightIndexes.includes(idx);
            const itemBgColor = typeof item.bgColor === 'string' && item.bgColor.trim() ? item.bgColor.trim() : undefined;
            const itemTextColor = typeof item.textColor === 'string' && item.textColor.trim() ? item.textColor.trim() : undefined;
            const cardStyle =
              itemBgColor || itemTextColor
                ? { ...(itemBgColor ? { backgroundColor: itemBgColor } : {}), ...(itemTextColor ? { color: itemTextColor } : {}) }
                : isHighlight
                  ? { backgroundColor: highlightBgColor, color: highlightTextColor }
                  : undefined;
            const isClickable = typeof item.href === 'string' && item.href.trim().length > 0;
            const cardClass = `block rounded-2xl shadow-sm p-6 sm:p-7 hover:shadow-lg transition-shadow no-underline ${
              isHighlight || itemBgColor || itemTextColor ? 'border border-transparent' : 'bg-white border border-slate-200'
            } ${isClickable ? 'cursor-pointer' : ''}`;

            const inner = (
              <div className="flex flex-col items-center text-center gap-3">
                {item.imageUrl ? (
                  <div className="relative w-full h-14 sm:h-16">
                    <Image src={item.imageUrl} alt={item.title} fill unoptimized className="object-contain" />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <div
                    className={`text-base font-extrabold ${
                      itemTextColor || itemBgColor || isHighlight ? '' : 'text-slate-900'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div
                    className={`text-sm leading-relaxed ${
                      itemTextColor || itemBgColor || isHighlight ? '' : 'text-slate-600'
                    }`}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
            );

            return isClickable ? (
              <Link key={`${item.title}-${idx}`} href={item.href!.trim()} className={cardClass} style={cardStyle}>
                {inner}
              </Link>
            ) : (
              <div key={`${item.title}-${idx}`} className={cardClass} style={cardStyle}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
