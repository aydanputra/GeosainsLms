"use client";

import { useMemo, useState } from 'react';

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:')) return '';
  return trimmed;
}

export default function ProductImageGallery({
  name,
  imageUrl,
  imageUrls,
}: {
  name: string;
  imageUrl: string | null;
  imageUrls: string[] | null;
}) {
  const images = useMemo(() => {
    const list = Array.isArray(imageUrls) ? imageUrls : [];
    const normalized = list.map(normalizeUrl).filter(Boolean);
    const first = normalizeUrl(imageUrl);
    const merged = first && !normalized.includes(first) ? [first, ...normalized] : normalized;
    return merged.slice(0, 4);
  }, [imageUrl, imageUrls]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeSrc = images[activeIndex] || '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="flex-1 min-h-[320px] sm:min-h-[360px] lg:min-h-[420px] bg-slate-100 relative">
        {activeSrc ? (
          <img src={activeSrc} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm font-bold">No Image</div>
        )}
      </div>

      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((idx) => {
            const src = images[idx] || '';
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!src) return;
                  setActiveIndex(idx);
                }}
                disabled={!src}
                className={[
                  'aspect-video rounded-xl overflow-hidden border bg-slate-100 relative',
                  src ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed',
                  isActive ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                {src ? <img src={src} alt={name} className="absolute inset-0 w-full h-full object-cover" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
