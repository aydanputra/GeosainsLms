"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Cards from '@/modules/dashboard/components/Cards';
import Table from '@/modules/dashboard/components/Tables';
import ConfirmDialog from '@/modules/dashboard/components/ConfirmDialog';
import { toast } from 'sonner';
import { Box, GraduationCap, MoreHorizontal, Pencil, Eye, ExternalLink, Trash2, Search, Filter } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type CourseRow = {
  id: string;
  title: string;
  type: 'KURSUS';
  status: string;
  stock: number | null;
  price: number;
  normalPrice?: number | null;
  slug?: string | null;
  imageUrl?: string | null;
  sold: number;
  gross: number;
  platformFeePercent: number;
  platformFee: number;
  affiliateFee?: number;
  net: number;
};

type ProductRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  stock: number | null;
  price: number;
  slug?: string | null;
  imageUrl?: string | null;
  sold: number;
  gross: number;
  platformFeePercent: number | null;
  platformFeeFlat: number | null;
  platformFee: number;
  affiliateFee?: number;
  net: number;
};

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

function statusBadge(status: string) {
  const s = typeof status === 'string' ? status.toUpperCase() : '';
  const label =
    s === 'PUBLISHED' || s === 'AKTIF'
      ? 'Published'
      : s === 'DRAFT'
        ? 'Draft'
        : s === 'HABIS'
          ? 'Out of stock'
          : s || '-';
  const cls =
    s === 'PUBLISHED' || s === 'AKTIF'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : s === 'HABIS'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : s === 'DRAFT'
          ? 'bg-slate-100 text-slate-700 border-slate-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${cls}`}>{label}</span>;
}

type ProductListItem = {
  id: string;
  kind: 'COURSE' | 'PRODUCT';
  name: string;
  sku: string;
  imageUrl: string | null;
  typeLabel: string;
  typeKey: string;
  stockLabel: string;
  stockTone: 'GOOD' | 'BAD' | 'NEUTRAL';
  status: string;
  isPublished: boolean;
  isDraft: boolean;
  isInStock: boolean;
  isOutOfStock: boolean;
  price: number;
  normalPrice: number | null;
  sold: number;
  gross: number;
  platformFee: number;
  affiliateFee: number;
  earning: number;
  editHref: string;
  viewHref: string | null;
  canDelete: boolean;
};

function typeIcon(typeKey: string) {
  if (typeKey === 'COURSE') return GraduationCap;
  return Box;
}

function normalizeSku(id: string) {
  const s = String(id || '');
  const tail = s.length > 8 ? s.slice(-8) : s;
  return tail.toUpperCase();
}

export default function ProductsClient({
  mode,
  variant,
  platform,
  defaultRangeLabel = 'Hari ini',
  courseRows,
  productRows,
}: {
  mode: 'COURSE_ONLY' | 'VENDOR_ACTIVE';
  variant?: 'MENTOR' | 'ADMIN';
  platform: { feePercent: number; mentorPercent: number };
  defaultRangeLabel?: string;
  courseRows: CourseRow[];
  productRows: ProductRow[];
}) {
  const router = useRouter();
  const view = variant === 'ADMIN' ? 'ADMIN' : 'MENTOR';
  const safeCourseRows = useMemo(() => (Array.isArray(courseRows) ? courseRows : []), [courseRows]);
  const safeProductRows = useMemo(() => (Array.isArray(productRows) ? productRows : []), [productRows]);

  const allItems: ProductListItem[] = useMemo(() => {
    const courseEditBase = view === 'ADMIN' ? '/dashboard/admin/courses' : '/dashboard/mentor/courses';
    const list: ProductListItem[] = [];

    for (const c of safeCourseRows) {
      const st = String(c.status || '').toUpperCase();
      const isDraft = st === 'DRAFT';
      const isPublished = st === 'PUBLISHED';
      const slug = typeof (c as any).slug === 'string' ? String((c as any).slug) : null;
      const thumb = typeof (c as any).imageUrl === 'string' ? String((c as any).imageUrl) : null;
      const normalPrice = (c as any).normalPrice === null || (c as any).normalPrice === undefined ? null : Number((c as any).normalPrice || 0);
      list.push({
        id: c.id,
        kind: 'COURSE',
        name: c.title,
        sku: normalizeSku(c.id),
        imageUrl: thumb,
        typeLabel: 'Kursus',
        typeKey: 'COURSE',
        stockLabel: 'In stock',
        stockTone: 'GOOD',
        status: st || 'DRAFT',
        isPublished,
        isDraft,
        isInStock: true,
        isOutOfStock: false,
        price: Number(c.price || 0),
        normalPrice: normalPrice && normalPrice > Number(c.price || 0) ? normalPrice : null,
        sold: Number(c.sold || 0),
        gross: Number(c.gross || 0),
        platformFee: Number(c.platformFee || 0),
        affiliateFee: Number((c as any).affiliateFee || 0),
        earning: Number(c.net || 0),
        editHref: `${courseEditBase}/${c.id}/edit`,
        viewHref: slug ? `/courses/${slug}` : null,
        canDelete: false,
      });
    }

    for (const p of safeProductRows) {
      const type = String(p.type || '').toUpperCase();
      const isPhysical = type === 'PHYSICAL';
      const stock = p.stock === null ? null : Number(p.stock || 0);
      const inStock = !isPhysical || (stock !== null && stock > 0);
      const outOfStock = isPhysical && (stock === null || stock <= 0);
      const slug = typeof (p as any).slug === 'string' ? String((p as any).slug) : null;
      const imageUrl = typeof (p as any).imageUrl === 'string' ? String((p as any).imageUrl) : null;
      const label = type === 'SERVICE' ? 'Jasa' : type === 'RENTAL' ? 'Sewa' : 'Fisik';
      list.push({
        id: p.id,
        kind: 'PRODUCT',
        name: p.name,
        sku: normalizeSku(p.id),
        imageUrl,
        typeLabel: label,
        typeKey: type || 'PRODUCT',
        stockLabel: outOfStock ? 'Out of stock' : inStock ? 'In stock' : '-',
        stockTone: outOfStock ? 'BAD' : inStock ? 'GOOD' : 'NEUTRAL',
        status: 'PUBLISHED',
        isPublished: true,
        isDraft: false,
        isInStock: inStock,
        isOutOfStock: outOfStock,
        price: Number(p.price || 0),
        normalPrice: null,
        sold: Number(p.sold || 0),
        gross: Number(p.gross || 0),
        platformFee: Number(p.platformFee || 0),
        affiliateFee: Number((p as any).affiliateFee || 0),
        earning: Number(p.net || 0),
        editHref: `/dashboard/vendor/shop?edit=${p.id}`,
        viewHref: `/shop/products/${p.id}`,
        canDelete: true,
      });
      void slug;
    }

    return list;
  }, [safeCourseRows, safeProductRows, view]);

  const [activeTab, setActiveTab] = useState<'ALL' | 'PUBLISHED' | 'PENDING' | 'DRAFT' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [quickView, setQuickView] = useState<ProductListItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: ProductListItem | null }>({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const actionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = actionRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpenActionId(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const tabs = useMemo(() => {
    const total = allItems.length;
    const published = allItems.filter((x) => x.isPublished).length;
    const draft = allItems.filter((x) => x.isDraft).length;
    const inStock = allItems.filter((x) => x.isInStock).length;
    const outOfStock = allItems.filter((x) => x.isOutOfStock).length;
    const pending = 0;
    return [
      { key: 'ALL' as const, label: `All (${total})` },
      { key: 'PUBLISHED' as const, label: `Published (${published})` },
      { key: 'PENDING' as const, label: `Pending Review (${pending})` },
      { key: 'DRAFT' as const, label: `Draft (${draft})` },
      { key: 'IN_STOCK' as const, label: `In stock (${inStock})` },
      { key: 'OUT_OF_STOCK' as const, label: `Out of stock (${outOfStock})` },
    ];
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((it) => {
      const okTab =
        activeTab === 'ALL'
          ? true
          : activeTab === 'PUBLISHED'
            ? it.isPublished
            : activeTab === 'DRAFT'
              ? it.isDraft
              : activeTab === 'IN_STOCK'
                ? it.isInStock
                : activeTab === 'OUT_OF_STOCK'
                  ? it.isOutOfStock
                  : false;
      if (!okTab) return false;
      if (!q) return true;
      return it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q);
    });
  }, [allItems, activeTab, search]);

  const visibleIds = useMemo(() => filteredItems.map((x) => x.id), [filteredItems]);
  const isAllVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    const set = new Set(selectedIds);
    return visibleIds.every((id) => set.has(id));
  }, [selectedIds, visibleIds]);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  }, [visibleIds]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const metrics = useMemo(() => {
    const totalCourses = safeCourseRows.length;
    const totalProducts = safeProductRows.length;
    const published = allItems.filter((x) => x.isPublished).length;
    const draft = allItems.filter((x) => x.isDraft).length;
    const sold = allItems.reduce((sum, r) => sum + Number(r.sold || 0), 0);
    const earning = allItems.reduce((sum, r) => sum + Number(r.earning || 0), 0);
    const gross = allItems.reduce((sum, r) => sum + Number(r.gross || 0), 0);
    const fee = allItems.reduce((sum, r) => sum + Number(r.platformFee || 0), 0);
    const affiliateFee = allItems.reduce((sum, r) => sum + Number(r.affiliateFee || 0), 0);
    return [
      { label: 'Total Kursus', value: totalCourses, color: 'bg-blue-500' },
      { label: 'Total Produk', value: totalProducts, color: 'bg-cyan-500' },
      { label: 'Published', value: published, color: 'bg-emerald-500' },
      { label: 'Draft', value: draft, color: 'bg-slate-500' },
      { label: 'Terjual', value: sold, color: 'bg-indigo-500' },
      { label: 'Order Total', value: formatIdr(gross), color: 'bg-yellow-500' },
      { label: 'Fee Platform', value: formatIdr(fee), color: 'bg-rose-500' },
      ...(affiliateFee > 0 ? [{ label: 'Fee Affiliate', value: formatIdr(affiliateFee), color: 'bg-rose-600' }] : []),
      { label: 'Pendapatan Bersih', value: formatIdr(earning), color: 'bg-green-500' },
    ];
  }, [allItems, safeCourseRows.length, safeProductRows.length]);

  const doDelete = async () => {
    const it = deleteConfirm.item;
    if (!it || it.kind !== 'PRODUCT') return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/shop/products/${it.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk');
      toast.success(data.message || 'Produk dihapus');
      setDeleteConfirm({ open: false, item: null });
      setOpenActionId(null);
      setSelectedIds((prev) => prev.filter((id) => id !== it.id));
      setQuickView((prev) => (prev?.id === it.id ? null : prev));
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus produk');
    } finally {
      setIsDeleting(false);
    }
  };

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
              disabled={visibleIds.length === 0}
              aria-label="Pilih semua"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-14',
        cell: (_val: unknown, row: ProductListItem) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={selectedIds.includes(row.id)}
              onChange={() => toggleOne(row.id)}
              aria-label={`Pilih ${row.name}`}
            />
          </div>
        ),
      },
      {
        header: 'Products',
        accessorKey: 'name',
        cell: (_val: unknown, row: ProductListItem) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
              {row.imageUrl ? (
                <Image src={row.imageUrl} alt={row.name} fill unoptimized className="object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-50" />
              )}
            </div>
            <div className="min-w-0">
              <Link href={row.editHref} className="font-bold text-slate-900 truncate hover:text-indigo-600">
                {row.name}
              </Link>
              <div className="text-xs text-slate-500">SKU: {row.sku || '—'}</div>
              <div className="text-xs text-slate-500">Sold: {Number(row.sold || 0)}</div>
            </div>
          </div>
        ),
      },
      {
        header: 'Type',
        accessorKey: 'typeKey',
        className: 'w-24',
        cell: (_val: unknown, row: ProductListItem) => {
          const Icon = typeIcon(row.kind === 'COURSE' ? 'COURSE' : row.typeKey);
          return (
            <div className="flex items-center justify-center">
              <Icon className="w-4 h-4 text-slate-600" aria-label={row.typeLabel} />
            </div>
          );
        },
      },
      {
        header: 'Stock',
        accessorKey: 'stockLabel',
        className: 'w-28 whitespace-nowrap',
        cell: (_val: unknown, row: ProductListItem) => (
          <span
            className={twMerge(
              'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border',
              row.stockTone === 'GOOD'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : row.stockTone === 'BAD'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200',
            )}
          >
            {row.stockLabel}
          </span>
        ),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        className: 'w-28 whitespace-nowrap',
        cell: (val: string) => statusBadge(String(val || '')),
      },
      {
        header: 'Price',
        accessorKey: 'price',
        className: 'w-36 whitespace-nowrap',
        cell: (_val: unknown, row: ProductListItem) => (
          <div className="text-right">
            {row.normalPrice ? <div className="text-xs font-extrabold text-rose-500 line-through">{formatIdr(row.normalPrice)}</div> : null}
            <div className={twMerge('font-extrabold', row.normalPrice ? 'text-emerald-700' : 'text-slate-900')}>{formatIdr(row.price)}</div>
          </div>
        ),
      },
      {
        header: 'Pendapatan Bersih',
        accessorKey: 'earning',
        className: 'w-40 whitespace-nowrap',
        cell: (_val: unknown, row: ProductListItem) => (
          <div className="text-right font-extrabold text-slate-900">{formatIdr(row.earning)}</div>
        ),
      },
    ];
  }, [isAllVisibleSelected, selectedIds, toggleAllVisible, visibleIds]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Produk</h1>
          <p className="text-sm text-slate-600 mt-1">
            {view === 'ADMIN'
              ? 'Ringkasan pendapatan kursus dan produk secara global.'
              : mode === 'VENDOR_ACTIVE'
                ? 'Ringkasan pendapatan kursus dan produk vendor Anda.'
                : 'Vendor belum aktif. Halaman ini menampilkan produk kursus Anda.'}
          </p>
          <div className="text-xs text-slate-500 mt-2">Perhitungan default: {defaultRangeLabel}</div>
          <div className="text-xs text-slate-500 mt-2">
            Kursus: Fee platform {Number(platform.feePercent || 0)}% • Mentor {Number(platform.mentorPercent || 0)}%
          </div>
        </div>
        {view !== 'ADMIN' && mode !== 'VENDOR_ACTIVE' ? (
          <Link href="/dashboard/vendor" className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700">
            Aktifkan Vendor
          </Link>
        ) : null}
      </div>

      <Cards metrics={metrics as any} isLoading={false} />

      <div className="bg-white rounded-2xl border border-slate-200">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={twMerge(
                    'px-3.5 py-2 rounded-xl text-sm font-extrabold transition-colors',
                    activeTab === t.key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search"
                  className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                aria-label="Filter"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div ref={actionRef}>
            <Table
              columns={columns as any}
              data={filteredItems as any}
              isLoading={false}
              actions={(row: ProductListItem) => (
                <div className="relative inline-flex justify-end w-full">
                  <button
                    type="button"
                    onClick={() => setOpenActionId((prev) => (prev === row.id ? null : row.id))}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl hover:bg-slate-50 border border-slate-200 bg-white"
                    aria-label="Actions"
                  >
                    <MoreHorizontal className="w-4 h-4 text-slate-700" />
                  </button>
                  {openActionId === row.id ? (
                    <div className="absolute right-0 top-10 z-20 w-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionId(null);
                          router.push(row.editHref);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" /> Edit details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionId(null);
                          setQuickView(row);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" /> Quick view
                      </button>
                      <button
                        type="button"
                        disabled={!row.viewHref}
                        onClick={() => {
                          setOpenActionId(null);
                          if (row.viewHref) window.open(row.viewHref, '_blank', 'noopener,noreferrer');
                        }}
                        className={twMerge(
                          'w-full px-3.5 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2',
                          row.viewHref ? 'text-slate-700' : 'text-slate-400 cursor-not-allowed',
                        )}
                      >
                        <ExternalLink className="w-4 h-4" /> View in site
                      </button>
                      {row.canDelete ? (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ open: true, item: row })}
                          className="w-full px-3.5 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Permanently
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            />
          </div>
        </div>
      </div>

      {quickView ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setQuickView(null)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-slate-900 truncate">{quickView.name}</div>
                <div className="text-sm text-slate-600 mt-0.5">
                  {quickView.kind === 'COURSE' ? 'Kursus' : `Produk ${quickView.typeLabel}`} • SKU: {quickView.sku}
                </div>
              </div>
              <button type="button" onClick={() => setQuickView(null)} className="h-9 w-9 rounded-xl border border-slate-200 hover:bg-slate-50" aria-label="Close">
                ×
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
                <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Ringkasan</div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Status</div>
                  <div>{statusBadge(quickView.status)}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Stock</div>
                  <div className="font-extrabold text-slate-900">{quickView.stockLabel}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Terjual</div>
                  <div className="font-extrabold text-slate-900">{quickView.sold}</div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
                <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Keuangan</div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Price</div>
                  <div className="font-extrabold text-slate-900">{formatIdr(quickView.price)}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Order Total</div>
                  <div className="font-extrabold text-slate-900">{formatIdr(quickView.gross)}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Fee Platform</div>
                  <div className="font-extrabold text-slate-900">{formatIdr(quickView.platformFee)}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Fee Affiliate</div>
                  <div className="font-extrabold text-slate-900">{formatIdr(quickView.affiliateFee)}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">Pendapatan Bersih</div>
                  <div className="font-extrabold text-emerald-700">{formatIdr(quickView.earning)}</div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
              {quickView.viewHref ? (
                <button
                  type="button"
                  onClick={() => window.open(quickView.viewHref as string, '_blank', 'noopener,noreferrer')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-sm text-slate-700"
                >
                  View in site
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setQuickView(null);
                  router.push(quickView.editHref);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-extrabold text-sm text-white"
              >
                Edit details
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, item: null })}
        onConfirm={doDelete}
        title="Hapus produk?"
        description="Produk yang dihapus tidak bisa dikembalikan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
