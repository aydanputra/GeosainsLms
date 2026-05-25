"use client";

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';

type CategoryOption = { id: string; name: string };

type ShopProduct = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  price: number;
  stock?: number | null;
  type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL';
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  createdAt?: string | null;
};

export default function ShopPage() {
  const sortOptions = useMemo(
    () =>
      [
        { id: 'NEWEST', label: 'Terbaru' },
        { id: 'PRICE_ASC', label: 'Harga Termurah' },
        { id: 'PRICE_DESC', label: 'Harga Termahal' },
        { id: 'NAME_ASC', label: 'Nama A–Z' },
      ] as const,
    []
  );

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [sort, setSort] = useState<'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME_ASC'>('NEWEST');
  const [onlyInStock, setOnlyInStock] = useState(false);

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['shop-products'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/shop/products', { signal });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['shop-categories-public'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/shop/categories/public', { signal });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const normalizedProducts = useMemo<ShopProduct[]>(() => (Array.isArray(products) ? (products as ShopProduct[]) : []), [products]);

  const categoryOptions = useMemo(() => {
    const base = Array.isArray(categoriesData) ? categoriesData : [];
    return base
      .map((c) => c as Partial<CategoryOption>)
      .filter((c): c is CategoryOption => typeof c.id === 'string' && typeof c.name === 'string')
      .map((c) => ({ id: c.id, name: c.name }));
  }, [categoriesData]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = normalizedProducts.slice();

    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (category !== 'ALL') list = list.filter((p) => String(p.categoryRef?.id || p.categoryId || '') === category);
    if (onlyInStock) list = list.filter((p) => Number(p.stock || 0) > 0);

    list.sort((a, b) => {
      if (sort === 'PRICE_ASC') return Number(a.price || 0) - Number(b.price || 0);
      if (sort === 'PRICE_DESC') return Number(b.price || 0) - Number(a.price || 0);
      if (sort === 'NAME_ASC') return String(a.name || '').localeCompare(String(b.name || ''), 'id');
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return list;
  }, [normalizedProducts, search, category, onlyInStock, sort]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse h-24" />
          <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse h-24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <div className="text-slate-900 font-extrabold">Geoshop tidak tersedia</div>
          <div className="text-sm text-slate-500 mt-1">Gagal memuat produk. Coba refresh halaman.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="text-xs font-bold text-slate-500">Geoshop</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Belanja Produk</div>
          <div className="text-sm text-slate-600 mt-1">
            Menampilkan <span className="font-bold text-slate-700">{filteredProducts.length}</span> dari{' '}
            <span className="font-bold text-slate-700">{normalizedProducts.length}</span> produk
          </div>
        </div>

        <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6">
              <div className="text-xs font-bold text-slate-500 mb-1">Cari Produk</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                placeholder="Cari berdasarkan nama produk..."
              />
            </div>

            <div className="lg:col-span-3">
              <div className="text-xs font-bold text-slate-500 mb-1">Kategori</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
              >
                <option value="ALL">Semua Kategori</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="text-xs font-bold text-slate-500 mb-1">Urutkan</div>
              <select
                value={sort}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'NEWEST' || v === 'PRICE_ASC' || v === 'PRICE_DESC' || v === 'NAME_ASC') setSort(v);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-1 flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('ALL');
                  setSort('NEWEST');
                  setOnlyInStock(false);
                }}
                className="w-full lg:w-auto px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold text-sm hover:opacity-90 transition-opacity"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              Ready Stock
            </label>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            Produk tidak ditemukan untuk filter yang dipilih.
          </div>
        )}
      </div>
    </div>
  );
}
