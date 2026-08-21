"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { normalizeImageUrl } from '@/modules/core/utils/image';

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
    const normalized = list.map((value) => normalizeImageUrl(value, { fallback: '' }) || '').filter(Boolean);
    const first = normalizeImageUrl(imageUrl, { fallback: '' }) || '';
    const merged = first && !normalized.includes(first) ? [first, ...normalized] : normalized;
    return merged.slice(0, 4);
  }, [imageUrl, imageUrls]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const activeSrc = images[activeIndex] || '';
  const canShowActiveImage = Boolean(activeSrc && !brokenImages[activeSrc]);

  const markBroken = (src: string) => {
    if (!src) return;
    setBrokenImages((prev) => {
      if (prev[src]) return prev;
      return {
        ...prev,
        [src]: true,
      };
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="flex-1 min-h-[320px] sm:min-h-[360px] lg:min-h-[420px] bg-slate-100 relative">
        {canShowActiveImage ? (
          <Image
            src={activeSrc}
            alt={name}
            fill
            priority={activeIndex === 0}
            quality={75}
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-cover"
            onError={() => markBroken(activeSrc)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm font-bold">No Image</div>
        )}
      </div>

      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((idx) => {
            const src = images[idx] || '';
            const isActive = idx === activeIndex;
            const canShowThumbnail = Boolean(src && !brokenImages[src]);
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
                {canShowThumbnail ? (
                  <Image
                    src={src}
                    alt={`${name} ${idx + 1}`}
                    fill
                    quality={50}
                    sizes="(max-width: 640px) 22vw, 140px"
                    className="object-cover"
                    onError={() => markBroken(src)}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
