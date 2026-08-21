"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { normalizeImageUrl, toOptimizedImageUrl } from '@/modules/core/utils/image';

function withAutoplay(embedUrl: string) {
  const url = embedUrl.trim();
  if (!url) return url;
  const joiner = url.includes('?') ? '&' : '?';
  const lower = url.toLowerCase();
  if (lower.includes('youtube')) return `${url}${joiner}autoplay=1&rel=0`;
  if (lower.includes('vimeo')) return `${url}${joiner}autoplay=1`;
  return `${url}${joiner}autoplay=1`;
}

function toPrivacyEmbed(url: string) {
  const u = url.trim();
  if (!u) return u;
  return u.replace('https://www.youtube.com/embed/', 'https://www.youtube-nocookie.com/embed/');
}

export default function CourseHeroMedia({
  title,
  embedUrl,
  thumbnailUrl,
}: {
  title: string;
  embedUrl: string | null;
  thumbnailUrl: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imgError, setImgError] = useState(false);

  const canPlay = Boolean(embedUrl && String(embedUrl).trim());
  const poster = useMemo(() => {
    const safeUrl = normalizeImageUrl(thumbnailUrl, { fallback: '/placeholder-course.jpg' }) || '/placeholder-course.jpg';
    if (imgError) return '/placeholder-course.jpg';
    return toOptimizedImageUrl(safeUrl, { width: 1280, height: 720, fit: 'fill' }) || safeUrl;
  }, [imgError, thumbnailUrl]);
  const src = useMemo(() => (canPlay ? withAutoplay(toPrivacyEmbed(String(embedUrl))) : null), [canPlay, embedUrl]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="aspect-video bg-black relative">
        {isPlaying && src ? (
          <iframe
            src={src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        ) : (
          <>
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width: 1024px) 100vw, 960px"
              className="object-cover"
              onError={() => setImgError(true)}
            />
            {canPlay ? (
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className={twMerge(
                  'absolute inset-0 flex items-center justify-center',
                  'bg-black/25 hover:bg-black/35 transition-colors'
                )}
                aria-label="Putar video"
              >
                <span className="h-14 w-14 rounded-2xl bg-white/95 border border-white shadow-sm inline-flex items-center justify-center">
                  <Play className="w-6 h-6 text-slate-900 ml-0.5" />
                </span>
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
