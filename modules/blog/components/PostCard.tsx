"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { normalizeImageUrl } from '@/modules/core/utils/image';

interface PostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    content?: string | null;
    excerpt?: string | null;
    publishedAt: string | null;
    featuredImageUrl?: string | null;
    thumbnailUrl?: string | null;
    category?: { name: string; slug: string } | null;
    tags?: { tag?: { name: string; slug: string } }[];
    author: {
      name: string;
    };
  };
}

export default function PostCard({ post }: PostCardProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const authorName = typeof post.author?.name === 'string' && post.author.name.trim() ? post.author.name : 'GeoSains';

  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Draft';

  const summary = useMemo(() => {
    const excerptRaw = typeof post.excerpt === 'string' ? post.excerpt.trim() : '';
    if (excerptRaw) return excerptRaw;
    const raw = typeof post.content === 'string' ? post.content : '';
    const stripped = raw.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    return stripped;
  }, [post.content, post.excerpt]);

  const placeholderDataUri = useMemo(() => {
    const title = typeof post.title === 'string' ? post.title : 'Artikel';
    const initials = title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B1B3A"/>
      <stop offset="1" stop-color="#0A0F23"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <circle cx="980" cy="130" r="240" fill="rgba(255,255,255,0.06)"/>
  <circle cx="230" cy="560" r="260" fill="rgba(99,102,241,0.10)"/>
  <text x="90" y="190" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="38" fill="rgba(255,255,255,0.85)" font-weight="700">Artikel &amp; Berita</text>
  <text x="90" y="250" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="24" fill="rgba(255,255,255,0.65)">GeoSains LMS</text>
  <rect x="90" y="340" width="140" height="140" rx="28" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.12)"/>
  <text x="160" y="428" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="56" fill="rgba(255,255,255,0.9)" font-weight="800">${initials || 'GS'}</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [post.title]);

  const imageUrlRawCandidate =
    (typeof post.featuredImageUrl === 'string' && post.featuredImageUrl.trim() ? post.featuredImageUrl : '') ||
    (typeof post.thumbnailUrl === 'string' && post.thumbnailUrl.trim() ? post.thumbnailUrl : '');
  const imageUrlRaw = normalizeImageUrl(imageUrlRawCandidate, { fallback: '' }) || '';
  const imageSrc = !imageBroken && imageUrlRaw ? imageUrlRaw : placeholderDataUri;
  const isLocalWebp = imageUrlRaw.startsWith('/uploads/media/') && imageUrlRaw.endsWith('.webp');

  return (
    <article className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="aspect-video bg-slate-100 relative">
          <Image
            src={imageSrc}
            alt={post.title}
            fill
            unoptimized={isLocalWebp}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={65}
            className="object-cover"
            onError={() => setImageBroken(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>

      <div className="p-5 flex flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
          {post.category?.name ? (
            <>
              <Link
                href={`/blog/category/${post.category.slug}`}
                className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-[11px] hover:bg-indigo-100"
              >
                {post.category.name}
              </Link>
              <span className="text-slate-300">•</span>
            </>
          ) : null}
          <span>{formattedDate}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-600">{authorName}</span>
        </div>

        <Link href={`/blog/${post.slug}`} className="block mt-2">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-2">
            {post.title}
          </h3>
        </Link>

        <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3 min-h-[60px]">{summary || ' '}</p>

        {Array.isArray(post.tags) && post.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags
              .map((t) => t?.tag)
              .filter((t) => Boolean(t?.name && t?.slug))
              .slice(0, 5)
              .map((t) => (
                <Link
                  key={String(t!.slug).toLowerCase()}
                  href={`/blog/tag/${t!.slug}`}
                  className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 font-extrabold text-[11px] hover:bg-slate-100"
                >
                  {t!.name}
                </Link>
              ))}
          </div>
        ) : null}

        <div className="mt-4">
          <Link href={`/blog/${post.slug}`} className="text-sm font-extrabold text-indigo-700 hover:text-indigo-800">
            Baca selengkapnya →
          </Link>
        </div>
      </div>
    </article>
  );
}
