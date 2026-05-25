"use client";

import { useQuery } from '@tanstack/react-query';
import PostCard from '../components/PostCard';
import { useState } from 'react';
import { Search } from 'lucide-react';

export default function BlogListPage({
  categorySlug,
  categoryName,
  tagSlug,
  tagName,
}: {
  categorySlug?: string;
  categoryName?: string;
  tagSlug?: string;
  tagName?: string;
}) {
  const [search, setSearch] = useState('');
  
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['blog-posts', search, categorySlug || '', tagSlug || ''],
    queryFn: async () => {
      // In a real app, use a debounce hook for search
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categorySlug) params.append('category', categorySlug);
      if (tagSlug) params.append('tag', tagSlug);
      
      const res = await fetch(`/api/blog/posts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    },
  });

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
                Menampilkan {Array.isArray(posts) ? posts.length : 0} artikel
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-video bg-slate-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-2/3 bg-slate-100 rounded" />
                    <div className="h-4 w-full bg-slate-100 rounded" />
                    <div className="h-4 w-4/5 bg-slate-100 rounded" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              Gagal memuat artikel.
            </div>
          ) : Array.isArray(posts) && posts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
              Tidak ada artikel ditemukan.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(Array.isArray(posts) ? posts : []).map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
