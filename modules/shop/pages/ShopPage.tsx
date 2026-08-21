"use client";

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  imageUrls?: string[] | null;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  vendor?: { contactPhone?: string | null } | null;
  createdAt?: string | null;
};

type ShopProductsPage = {
  items: ShopProduct[];
  total: number;
  take: number;
  skip: number;
  hasMore: boolean;
  nextOffset: number;
};

const PRODUCTS_PER_BATCH = 12;

export default function ShopPage({
  initialProductsPage,
  initialCategories = [],
}: {
  initialProductsPage?: ShopProductsPage;
  initialCategories?: CategoryOption[];
}) {
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
  const defaultProductsPage = initialProductsPage ?? {
    items: [],
    total: 0,
    take: PRODUCTS_PER_BATCH,
    skip: 0,
    hasMore: false,
    nextOffset: PRODUCTS_PER_BATCH,
  };
  const useInitialProducts =
    !search.trim() && category === 'ALL' && sort === 'NEWEST' && onlyInStock === false;

  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery<ShopProductsPage>({
    queryKey: ['shop-products', search, category, sort, onlyInStock],
    initialPageParam: 0,
    initialData: useInitialProducts
      ? {
          pages: [defaultProductsPage],
          pageParams: [0],
        }
      : undefined,
    queryFn: async ({ signal, pageParam }) => {
      const params = new URLSearchParams();
      params.set('paginated', '1');
      params.set('take', String(PRODUCTS_PER_BATCH));
      params.set('skip', String(pageParam));
      params.set('sort', sort);
      if (search.trim()) params.set('q', search.trim());
      if (category !== 'ALL') params.set('categoryId', category);
      if (onlyInStock) params.set('onlyInStock', 'true');

      const res = await fetch(`/api/shop/products?${params.toString()}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
    staleTime: 60_000,
  });

  const { data: categoriesData = initialCategories } = useQuery({
    queryKey: ['shop-categories-public'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/shop/categories/public', { signal });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    initialData: initialCategories,
    staleTime: 60_000,
  });

  const loadedProducts = useMemo<ShopProduct[]>(
    () => data?.pages.flatMap((page) => (Array.isArray(page.items) ? page.items : [])) ?? [],
    [data]
  );
  const totalProducts = data?.pages?.[0]?.total ?? 0;

  const categoryOptions = useMemo(() => {
    const base = Array.isArray(categoriesData) ? categoriesData : [];
    return base
      .map((c) => c as Partial<CategoryOption>)
      .filter((c): c is CategoryOption => typeof c.id === 'string' && typeof c.name === 'string')
      .map((c) => ({ id: c.id, name: c.name }));
  }, [categoriesData]);

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
            Menampilkan <span className="font-bold text-slate-700">{loadedProducts.length}</span> dari{' '}
            <span className="font-bold text-slate-700">{totalProducts}</span> produk
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

        {loadedProducts.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {loadedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  adminWhatsAppNumber={product.vendor && typeof product.vendor.contactPhone === 'string' ? product.vendor.contactPhone : ''}
                />
              ))}
            </div>

            {hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-gradient text-white text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isFetchingNextPage ? 'Memuat...' : 'Load More'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            Produk tidak ditemukan untuk filter yang dipilih.
          </div>
        )}
      </div>
    </div>
  );
}
