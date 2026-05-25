"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';
import Link from 'next/link';

interface PostDetailProps {
  post: {
    id: string;
    title: string;
    content: string;
    excerpt?: string | null;
    publishedAt: string | null;
    featuredImageUrl?: string | null;
    thumbnailUrl?: string | null;
    category?: { name: string; slug: string } | null;
    tags?: { tag?: { name: string; slug: string } }[];
    author: {
      name: string;
      email?: string;
    };
  };
}

export default function PostDetail({ post }: PostDetailProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const authorName = typeof post.author?.name === 'string' && post.author.name.trim() ? post.author.name : 'GeoSains';

  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Draft';

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
  <rect x="90" y="80" width="1020" height="220" rx="36" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)"/>
  <text x="120" y="160" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="44" fill="rgba(255,255,255,0.92)" font-weight="800">${title.replace(
      /&/g,
      '&amp;'
    )}</text>
  <text x="120" y="220" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="24" fill="rgba(255,255,255,0.65)">GeoSains LMS</text>
  <rect x="90" y="360" width="160" height="160" rx="32" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.12)"/>
  <text x="170" y="462" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="56" fill="rgba(255,255,255,0.9)" font-weight="800">${initials ||
      'GS'}</text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [post.title]);

  const imageUrlRawCandidate =
    (typeof post.featuredImageUrl === 'string' && post.featuredImageUrl.trim() ? post.featuredImageUrl : '') ||
    (typeof post.thumbnailUrl === 'string' && post.thumbnailUrl.trim() ? post.thumbnailUrl : '');
  const imageUrlRaw = imageUrlRawCandidate && !imageUrlRawCandidate.startsWith('blob:') ? imageUrlRawCandidate : '';
  const imageSrc = !imageBroken && imageUrlRaw ? imageUrlRaw : placeholderDataUri;

  return (
    <div className="min-h-screen bg-slate-50">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="aspect-video bg-slate-100 relative">
            <Image src={imageSrc} alt={post.title} fill unoptimized className="object-cover" onError={() => setImageBroken(true)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
          </div>

          <header className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-500">
              <span className="text-slate-900 font-bold">{authorName}</span>
              <span className="text-slate-300">•</span>
              <time dateTime={post.publishedAt || ''}>{formattedDate}</time>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-[800] tracking-tight text-slate-900">{post.title}</h1>

            {(post.category?.name || (Array.isArray(post.tags) && post.tags.length)) ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {post.category?.name ? (
                  <Link
                    href={`/blog/category/${post.category.slug}`}
                    className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-xs hover:bg-indigo-100"
                  >
                    {post.category.name}
                  </Link>
                ) : null}
                {Array.isArray(post.tags) && post.tags.length
                  ? post.tags
                      .map((t) => t?.tag)
                      .filter((t) => Boolean(t?.name && t?.slug))
                      .slice(0, 10)
                      .map((t) => (
                        <Link
                          key={String(t!.slug).toLowerCase()}
                          href={`/blog/tag/${t!.slug}`}
                          className="px-3 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 font-extrabold text-xs hover:bg-slate-100"
                        >
                          {t!.name}
                        </Link>
                      ))
                  : null}
              </div>
            ) : null}
          </header>

          <div className="px-6 sm:px-8 pb-8">
            <div className="rte-content text-slate-700">
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
