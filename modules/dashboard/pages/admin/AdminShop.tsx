"use client";

import { useEffect, useMemo, useState } from 'react';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, Edit2, Trash2, Eye, ShoppingBag, Image as ImageIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';

interface AdminShopProps {
  products: any[];
}

type ProductForm = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  type: 'PHYSICAL' | 'SERVICE' | 'RENTAL';
  price: number;
  stock: number;
  category: 'BOOKS' | 'MERCH' | 'OTHER';
  categoryIds: string[];
  vendorId: string;
  imageUrl: string;
  imageUrls: string[];
};

function normalizeImageUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:')) return '';
  return trimmed;
}

function normalizeProductForm(value: any): ProductForm {
  const rawUrls = Array.isArray(value?.imageUrls) ? value.imageUrls : [];
  const normalizedUrls = rawUrls.map(normalizeImageUrl).filter(Boolean).slice(0, 4);
  const fallbackUrl = normalizeImageUrl(value?.imageUrl);
  const imageUrls = normalizedUrls.length > 0 ? normalizedUrls : (fallbackUrl ? [fallbackUrl] : []);
  const categoryIds = Array.isArray(value?.categoryIds)
    ? value.categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean)
    : typeof value?.categoryId === 'string' && value.categoryId
      ? [String(value.categoryId)]
      : typeof value?.categoryRef?.id === 'string' && value.categoryRef.id
        ? [String(value.categoryRef.id)]
        : [];

  return {
    id: typeof value?.id === 'string' ? value.id : undefined,
    name: typeof value?.name === 'string' ? value.name : '',
    slug: typeof value?.slug === 'string' ? value.slug : '',
    description: typeof value?.description === 'string' ? value.description : '',
    type: value?.type === 'SERVICE' || value?.type === 'RENTAL' || value?.type === 'PHYSICAL' ? value.type : 'PHYSICAL',
    price: typeof value?.price === 'number' && Number.isFinite(value.price) ? value.price : 0,
    stock: typeof value?.stock === 'number' && Number.isFinite(value.stock) ? value.stock : 0,
    category: value?.category === 'BOOKS' || value?.category === 'MERCH' || value?.category === 'OTHER' ? value.category : 'OTHER',
    categoryIds,
    vendorId: typeof value?.vendorId === 'string' ? value.vendorId : (typeof value?.vendor?.id === 'string' ? value.vendor.id : ''),
    imageUrl: imageUrls[0] || '',
    imageUrls,
  };
}

export default function AdminShop({ products: initialProducts }: AdminShopProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterVendor, setFilterVendor] = useState<string>('ALL');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editorValue, setEditorValue] = useState<ProductForm>({
    name: '',
    slug: '',
    description: '',
    type: 'PHYSICAL',
    price: 0,
    stock: 0,
    category: 'OTHER',
    categoryIds: [],
    vendorId: '',
    imageUrl: '',
    imageUrls: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [mediaTargetIndex, setMediaTargetIndex] = useState<number | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (!editId) return;
    const row = products.find((p: any) => p?.id === editId);
    if (!row) return;
    setEditorMode('EDIT');
    setEditorValue(normalizeProductForm(row));
    setEditorOpen(true);
    const path = typeof window !== 'undefined' ? window.location.pathname : '/dashboard/vendor/shop';
    router.replace(path);
  }, [searchParams, products, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [categoriesRes, vendorsRes] = await Promise.all([fetch('/api/shop/categories'), fetch('/api/shop/vendors')]);
        const categoriesData = await categoriesRes.json().catch(() => []);
        const vendorsData = await vendorsRes.json().catch(() => []);
        if (!active) return;
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setVendors(Array.isArray(vendorsData) ? vendorsData : []);
      } catch {
        if (!active) return;
        setCategories([]);
        setVendors([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return products.filter((product: any) => {
      const matchesSearch = (product.name || '').toLowerCase().includes(q);

      const matchesCategory =
        filterCategory === 'ALL'
          ? true
          : filterCategory === 'BOOKS' || filterCategory === 'MERCH' || filterCategory === 'OTHER'
            ? product.category === filterCategory
            : (Array.isArray(product.categoryIds) ? product.categoryIds.map(String).includes(filterCategory) : product.categoryId === filterCategory);

      const matchesVendor = filterVendor === 'ALL' ? true : product.vendorId === filterVendor;

      return matchesSearch && matchesCategory && matchesVendor;
    });
  }, [products, searchQuery, filterCategory, filterVendor]);

  const visibleIds = useMemo(() => filteredProducts.map((p: any) => p.id as string), [filteredProducts]);
  const isAllVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    const set = new Set(selectedIds);
    return visibleIds.every((id) => set.has(id));
  }, [selectedIds, visibleIds]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  };

  const metrics = [
    { label: 'Total Produk', value: products.length, color: 'bg-blue-500' },
    { label: 'Stok Menipis', value: products.filter(p => (p.stock || 0) < 10).length, color: 'bg-red-500' },
    { label: 'Total Penjualan', value: products.reduce((acc, p) => acc + (p.sold || 0), 0), color: 'bg-green-500' },
    { label: 'Total Pendapatan', value: `IDR ${products.reduce((acc, p) => acc + (p.revenue || 0), 0).toLocaleString('id-ID')}`, color: 'bg-indigo-500' },
  ];

  const columns = useMemo(() => {
    return [
      {
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/40"
              checked={isAllVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visibleIds.length === 0 || isBulkDeleting}
              aria-label="Pilih semua produk"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-14',
        cell: (_val: unknown, row: any) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={selectedIds.includes(row.id)}
              onChange={() => toggleOne(row.id)}
              disabled={isBulkDeleting}
              aria-label={`Pilih produk ${row.name}`}
            />
          </div>
        ),
      },
      {
        header: 'Produk',
        accessorKey: 'name',
      cell: (val: string, row: any) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
            {row.imageUrl ? (
              <Image src={row.imageUrl} alt={row.name} fill unoptimized className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <ImageIcon className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate">{val}</div>
            {row.description ? <div className="text-xs text-slate-500 line-clamp-1">{row.description}</div> : null}
          </div>
        </div>
      )
      },
      { header: 'Harga', accessorKey: 'price', cell: (val: number) => `IDR ${val.toLocaleString('id-ID')}` },
      {
        header: 'Jenis',
        accessorKey: 'type',
        cell: (val: string) => (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
            {val === 'SERVICE' ? 'Jasa' : val === 'RENTAL' ? 'Sewa' : 'Fisik'}
          </span>
        ),
      },
      {
        header: 'Kategori',
        accessorKey: 'category',
        cell: (val: string, row: any) => (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
            {(() => {
              const ids: string[] = Array.isArray(row.categoryIds) ? row.categoryIds.map(String).filter(Boolean) : row.categoryId ? [String(row.categoryId)] : [];
              const map = new Map(categories.map((c) => [String(c.id), String(c.name)] as const));
              if (ids.length > 0) {
                const names = ids.map((id: string) => map.get(id)).filter(Boolean) as string[];
                if (names.length > 0) return `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}`;
              }
              return row.categoryRef?.name || (val === 'BOOKS' ? 'Buku' : val === 'MERCH' ? 'Merchandise' : 'Lainnya');
            })()}
          </span>
        ),
      },
      {
        header: 'Vendor',
        accessorKey: 'vendorId',
        cell: (_val: string, row: any) => <div className="text-sm text-slate-700">{row.vendor?.name || '-'}</div>,
      },
      { header: 'Stok', accessorKey: 'stock', 
      cell: (val: number, row: any) => (
        <span className={twMerge(
          "px-2.5 py-0.5 rounded-full text-xs font-medium border",
          row?.type === 'SERVICE'
            ? 'bg-slate-50 text-slate-600 border-slate-200'
            : val < 10
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
        )}>
          {row?.type === 'SERVICE' ? '-' : `${val} Unit`}
        </span>
      )
      },
      { header: 'Terjual', accessorKey: 'sold', cell: (val: number) => `${val} Unit` },
      { header: 'Aksi', accessorKey: 'id',
      cell: (id: string, row: any) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/shop/products/${row?.slug || id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Lihat"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => handleDelete(id)}
            title="Hapus"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
      }
    ];
  }, [isAllVisibleSelected, isBulkDeleting, selectedIds, toggleAllVisible, visibleIds.length, categories]);

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) {
      setDeleteConfirm({ isOpen: false, id: null });
      return;
    }

    try {
      const res = await fetch(`/api/shop/products/${deleteConfirm.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk');
      setProducts((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirm.id));
      toast.success(data.message || 'Produk berhasil dihapus');
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus produk');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 produk');
      return;
    }
    if (!confirm(`Hapus ${selectedIds.length} produk terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;

    setIsBulkDeleting(true);
    const ids = [...selectedIds];
    const deletedIds = new Set<string>();
    let failed = 0;

    try {
      for (const id of ids) {
        const res = await fetch(`/api/shop/products/${id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed += 1;
          continue;
        }
        deletedIds.add(id);
        if (data?.message) toast.success(data.message);
      }

      if (deletedIds.size > 0) setProducts((prev) => prev.filter((p) => !deletedIds.has(p.id)));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.has(id)));

      if (failed === 0) toast.success(`Berhasil menghapus ${ids.length} produk`);
      else toast.error(`${failed} produk gagal dihapus`);
    } catch {
      toast.error('Gagal menghapus produk terpilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openCreate = () => {
    setEditorMode('CREATE');
    setEditorValue({
      name: '',
      slug: '',
      description: '',
      type: 'PHYSICAL',
      price: 0,
      stock: 0,
      category: 'OTHER',
      categoryIds: categories[0]?.id ? [categories[0].id] : [],
      vendorId: vendors[0]?.id || '',
      imageUrl: '',
      imageUrls: [],
    });
    setEditorOpen(true);
  };

  const openEdit = (row: any) => {
    setEditorMode('EDIT');
    setEditorValue(normalizeProductForm(row));
    setEditorOpen(true);
  };

  const saveProduct = async () => {
    if (!editorValue.name.trim()) {
      toast.error('Nama produk wajib diisi');
      return;
    }
    const vendorId = typeof editorValue.vendorId === 'string' ? editorValue.vendorId.trim() : '';
    if (!vendorId) {
      toast.error('Vendor wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const imageUrls = (Array.isArray(editorValue.imageUrls) ? editorValue.imageUrls : [])
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
        .slice(0, 4);
      const categoryIds = Array.isArray(editorValue.categoryIds) ? editorValue.categoryIds.map((v) => String(v || '').trim()).filter(Boolean) : [];

      const payload = {
        name: editorValue.name.trim(),
        slug: editorValue.slug.trim() || undefined,
        description: editorValue.description.trim() || undefined,
        type: editorValue.type,
        price: Number(editorValue.price) || 0,
        stock: Number(editorValue.stock) || 0,
        category: editorValue.category,
        categoryId: categoryIds[0] || null,
        categoryIds,
        vendorId,
        imageUrl: imageUrls[0] || null,
        imageUrls,
      };

      const isEdit = editorMode === 'EDIT' && !!editorValue.id;
      const url = isEdit ? `/api/shop/products/${editorValue.id}` : '/api/shop/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan produk');

      if (isEdit) {
        setProducts((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)));
        toast.success('Produk berhasil diperbarui');
      } else {
        setProducts((prev) => [{ ...data, sold: 0, revenue: 0 }, ...prev]);
        toast.success('Produk berhasil ditambahkan');
      }

      setEditorOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan produk');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Toko</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola produk fisik, jasa, sewa alat, stok, dan penjualan.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      {/* Search & Filter Bar - Floating Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Cari produk..." 
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between">
             <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
              >
                <option value="ALL">Semua Kategori</option>
                {categories.length > 0
                  ? categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  : null}
                <option value="BOOKS">Buku (Bawaan)</option>
                <option value="MERCH">Merchandise (Bawaan)</option>
                <option value="OTHER">Lainnya (Bawaan)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value as any)}
              >
                <option value="ALL">Semua Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={isAllVisibleSelected}
                onChange={toggleAllVisible}
                disabled={visibleIds.length === 0 || isBulkDeleting}
              />
              Pilih semua
            </label>
            <div className="text-xs text-slate-500 font-medium">{selectedIds.length ? `${selectedIds.length} dipilih` : `${filteredProducts.length} item`}</div>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0 || isBulkDeleting}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
            >
              Hapus Terpilih
            </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        {filteredProducts.length > 0 ? (
          <Table 
            columns={columns} 
            data={filteredProducts} 
            isLoading={false}
          />
        ) : (
           <EmptyState 
            icon={ShoppingBag} 
            title="Tidak ada produk ditemukan" 
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : "Belum ada produk yang ditambahkan."}
            action={!searchQuery ? {
              label: "Tambah Produk Baru",
              onClick: openCreate 
            } : undefined}
          />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredProducts.length === 0 ? (
          <EmptyState 
            icon={ShoppingBag} 
            title="Tidak ada produk" 
            description="Belum ada data produk untuk ditampilkan."
          />
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 mt-1"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleOne(product.id)}
                  disabled={isBulkDeleting}
                  aria-label={`Pilih produk ${product.name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 line-clamp-2">{product.name}</h3>
                    {product.description ? <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{product.description}</div> : null}
                  </div>
                </div>
                <span className={twMerge(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                  product.stock < 10 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                )}>
                  Stok: {product.stock}
                </span>
              </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>Terjual: {product.sold}</span>
                <span className="font-medium text-slate-900">IDR {product.price.toLocaleString('id-ID')}</span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <Link
                  href={`/shop/products/${product.slug || product.id}`}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Lihat
                </Link>
                <button
                  type="button"
                  onClick={() => openEdit(product)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(product.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">
                {editorMode === 'CREATE' ? 'Tambah Produk' : 'Edit Produk'}
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-sm font-extrabold text-slate-900">Informasi Produk</div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Nama Produk</label>
                  <input
                    value={editorValue.name}
                    onChange={(e) => setEditorValue((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Contoh: Buku Geologi"
                  />
                </div>
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                  <input
                    value={editorValue.slug}
                    onChange={(e) => setEditorValue((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="buku-geologi"
                  />
                </div>
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Jenis Produk</label>
                  <select
                    value={editorValue.type}
                    onChange={(e) => setEditorValue((prev) => ({ ...prev, type: e.target.value as any }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="PHYSICAL">Produk Fisik</option>
                    <option value="SERVICE">Jasa</option>
                    <option value="RENTAL">Sewa Alat</option>
                  </select>
                </div>
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Harga (IDR)</label>
                  <input
                    type="number"
                    min={0}
                    value={editorValue.price}
                    onChange={(e) => setEditorValue((prev) => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">{editorValue.type === 'SERVICE' ? 'Kapasitas (opsional)' : 'Stok'}</label>
                  <input
                    type="number"
                    min={0}
                    value={editorValue.stock}
                    onChange={(e) => setEditorValue((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Kategori Produk</label>
                  <select
                    multiple
                    value={editorValue.categoryIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => String(o.value));
                      setEditorValue((prev) => ({ ...prev, categoryIds: selected }));
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {editorValue.categoryIds.length === 0 ? (
                    <select
                      value={editorValue.category}
                      onChange={(e) => setEditorValue((prev) => ({ ...prev, category: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="BOOKS">Buku</option>
                      <option value="MERCH">Merchandise</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  ) : null}
                </div>
                  <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Vendor</label>
                  <select
                    value={editorValue.vendorId}
                    onChange={(e) => setEditorValue((prev) => ({ ...prev, vendorId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">Pilih vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Foto Produk</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">Klik thumbnail untuk pilih/ganti foto. Maksimal 4 foto.</div>
                  </div>
                  <div className="text-xs font-bold text-slate-500">Foto 1 = Utama</div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((idx) => {
                    const url = editorValue.imageUrls?.[idx] || '';
                    const label = `Foto ${idx + 1}`;
                    return (
                      <div key={idx} className="min-w-0">
                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setMediaTargetIndex(idx);
                              setIsMediaOpen(true);
                            }}
                            className="absolute inset-0 w-full h-full"
                            aria-label={label}
                          >
                            {url ? (
                              <Image src={url} alt={editorValue.name || 'Produk'} fill unoptimized className="object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                                <ImageIcon className="w-6 h-6" />
                                <div className="text-xs font-bold">Pilih Foto</div>
                              </div>
                            )}
                          </button>

                          {idx === 0 ? (
                            <div className="absolute left-2 top-2 px-2 py-1 rounded-lg text-[11px] font-extrabold bg-white/90 text-slate-900 border border-slate-200">
                              Utama
                            </div>
                          ) : null}

                          {url ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditorValue((prev) => {
                                  const next = Array.isArray(prev.imageUrls) ? prev.imageUrls.slice() : [];
                                  next[idx] = '';
                                  return { ...prev, imageUrls: next, imageUrl: (next[0] || '').trim() };
                                });
                              }}
                              className="absolute right-2 top-2 p-2 rounded-xl bg-white/90 border border-slate-200 text-slate-700 hover:bg-white"
                              aria-label="Hapus foto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs font-bold text-slate-600">{label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-sm font-extrabold text-slate-900">Deskripsi Produk</div>
                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Deskripsi (opsional)</label>
                  <textarea
                    rows={5}
                    value={editorValue.description}
                    onChange={(e) => setEditorValue((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Deskripsi singkat produk"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-white">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveProduct}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
          <MediaPickerModal
            isOpen={isMediaOpen}
            onClose={() => {
              setIsMediaOpen(false);
              setMediaTargetIndex(null);
            }}
            onSelect={(item) => {
              const idx = typeof mediaTargetIndex === 'number' ? mediaTargetIndex : 0;
              setEditorValue((prev) => {
                const next = Array.isArray(prev.imageUrls) ? prev.imageUrls.slice() : [];
                while (next.length < 4) next.push('');
                next[idx] = item.url;
                return { ...prev, imageUrls: next, imageUrl: next[0] || '' };
              });
              setIsMediaOpen(false);
              setMediaTargetIndex(null);
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Produk?"
        description="Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
