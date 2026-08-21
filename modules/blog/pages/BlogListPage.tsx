"use client";

import PostCard from '../components/PostCard';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

type BlogPostPreview = {
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

export default function BlogListPage({
  categorySlug,
  categoryName,
  tagSlug,
  tagName,
  initialPosts = [],
}: {
  categorySlug?: string;
  categoryName?: string;
  tagSlug?: string;
  tagName?: string;
  initialPosts?: BlogPostPreview[];
}) {
  const [search, setSearch] = useState('');
  
  const posts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return initialPosts;
    return initialPosts.filter((post) => String(post?.title || '').toLowerCase().includes(query));
  }, [initialPosts, search]);

  const archiveLabel = categoryName || tagName || categorySlug || tagSlug || '';
  const archiveType = categorySlug ? 'Kategori' : tagSlug ? 'Tag' : '';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-[800] tracking-tight text-slate-900">
                {archiveType && archiveLabel ? `${archiveType}: ${archiveLabel}` : 'Artikel & Berita'}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                {archiveType && archiveLabel
                  ? `Menampilkan artikel dengan ${archiveType.toLowerCase()} "${archiveLabel}".`
                  : 'Update terbaru, wawasan, dan artikel edukasi dari GeoSains.'}
              </p>
            </div>

            <div className="w-full lg:w-[360px]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Cari artikel..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-slate-900 placeholder:text-slate-500 outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Menampilkan {posts.length} artikel
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {posts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              Tidak ada artikel ditemukan.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
