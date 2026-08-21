"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Table from '../../components/Tables';
import EmptyState from '../../components/EmptyState';
import { Loader2, Plus, Search, Trash2, Ticket, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';

interface CouponRow {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  amount: number;
  funding?: 'STORE' | 'MARKETPLACE' | 'SPLIT';
  marketplaceSharePercent?: number;
  allowMentorOptIn?: boolean;
  scope?: 'ALL' | 'COURSES' | 'PRODUCTS' | 'COURSE_CATEGORIES' | 'PRODUCT_CATEGORIES' | 'VENDORS';
  courseIds?: string[];
  productIds?: string[];
  vendorIds?: string[];
  courseCategoryIds?: string[];
  productCategoryIds?: string[];
  maxDiscount?: number | null;
  usageLimitPerUser?: number | null;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  minSubtotal: number | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminCouponsProps {
  coupons: CouponRow[];
  variant?: 'ADMIN' | 'MENTOR';
}

export default function AdminCoupons({ coupons: initialCoupons, variant = 'ADMIN' }: AdminCouponsProps) {
  const isMentorVariant = variant === 'MENTOR';
  const pageSearchParams = useSearchParams();
  const view = (pageSearchParams.get('view') || 'coupons').toLowerCase();
  const isDiscountView = view === 'discounts';

  const [coupons, setCoupons] = useState(initialCoupons);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newCoupon, setNewCoupon] = useState<{
    code: string;
    amount: number;
    type: 'PERCENT' | 'FIXED';
    expiresAt: string;
    funding: 'STORE' | 'MARKETPLACE' | 'SPLIT';
    marketplaceSharePercent: number;
    allowMentorOptIn: boolean;
    scope: 'ALL' | 'COURSES' | 'PRODUCTS' | 'COURSE_CATEGORIES' | 'PRODUCT_CATEGORIES' | 'VENDORS';
    targetIds: string;
    minSubtotal: number;
    maxRedemptions: number;
    usageLimitPerUser: number;
    maxDiscount: number;
  }>(
    {
      code: '',
      amount: 0,
      type: 'PERCENT',
      expiresAt: '',
      funding: 'STORE',
      marketplaceSharePercent: 50,
      allowMentorOptIn: false,
      scope: 'ALL',
      targetIds: '',
      minSubtotal: 0,
      maxRedemptions: 0,
      usageLimitPerUser: 0,
      maxDiscount: 0,
    }
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerOptions, setPickerOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const baseCoupons = useMemo(() => {
    if (isMentorVariant) return coupons;
    if (!isDiscountView) return coupons;
    return coupons.filter((c) => {
      const funding = String(c.funding || '').toUpperCase();
      return Boolean(c.allowMentorOptIn) || funding === 'MARKETPLACE' || funding === 'SPLIT';
    });
  }, [coupons, isDiscountView, isMentorVariant]);

  const filteredCoupons = baseCoupons.filter((c) => c.code.toLowerCase().includes(searchQuery.toLowerCase()));

  const scopeNeedsTargets = newCoupon.scope !== 'ALL' && !(newCoupon.scope === 'COURSES' && Boolean(newCoupon.allowMentorOptIn));

  useEffect(() => {
    setSelectedTargetIds([]);
    setNewCoupon((prev) => ({ ...prev, targetIds: '' }));
  }, [newCoupon.scope]);

  useEffect(() => {
    setNewCoupon((prev) => ({ ...prev, targetIds: selectedTargetIds.join(', ') }));
  }, [selectedTargetIds]);

  const loadPickerOptions = async () => {
    if (!scopeNeedsTargets) return;
    setPickerLoading(true);
    setPickerError(null);
    try {
      const scope = newCoupon.scope;
      const fetchJson = async (url: string) => {
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat data');
        return data;
      };

      if (scope === 'COURSES') {
        const data = await fetchJson(isMentorVariant ? '/api/dashboard/mentor/courses' : '/api/courses?published=false');
        const options = (Array.isArray(data) ? data : [])
          .map((c: any) => ({ id: String(c.id), label: String(c.title || c.slug || c.id) }))
          .filter((o: any) => Boolean(o.id));
        setPickerOptions(options);
        return;
      }
      if (scope === 'PRODUCTS') {
        const vendors = isMentorVariant ? await fetchJson('/api/shop/vendors') : [];
        const allowedVendorIds = new Set(
          (Array.isArray(vendors) ? vendors : [])
            .map((v: any) => String(v?.id || '').trim())
            .filter(Boolean)
        );

        const data = await fetchJson('/api/shop/products');
        const options = (Array.isArray(data) ? data : [])
          .filter((p: any) => {
            if (!isMentorVariant) return true;
            const vendorId = String(p?.vendorId || p?.vendor?.id || '').trim();
            if (!vendorId) return false;
            return allowedVendorIds.has(vendorId);
          })
          .map((p: any) => ({ id: String(p.id), label: String(p.name || p.slug || p.id) }))
          .filter((o: any) => Boolean(o.id));
        setPickerOptions(options);
        return;
      }
      if (scope === 'VENDORS') {
        const data = await fetchJson('/api/shop/vendors');
        const options = (Array.isArray(data) ? data : [])
          .map((v: any) => ({ id: String(v.id), label: String(v.name || v.slug || v.id) }))
          .filter((o: any) => Boolean(o.id));
        setPickerOptions(options);
        return;
      }
      if (scope === 'COURSE_CATEGORIES') {
        const data = await fetchJson('/api/categories');
        const options = (Array.isArray(data) ? data : [])
          .map((cat: any) => ({ id: String(cat.id), label: String(cat.name || cat.slug || cat.id) }))
          .filter((o: any) => Boolean(o.id));
        setPickerOptions(options);
        return;
      }
      if (scope === 'PRODUCT_CATEGORIES') {
        const data = await fetchJson('/api/shop/categories/public');
        const options = (Array.isArray(data) ? data : [])
          .map((cat: any) => ({ id: String(cat.id), label: String(cat.name || cat.slug || cat.id) }))
          .filter((o: any) => Boolean(o.id));
        setPickerOptions(options);
        return;
      }

      setPickerOptions([]);
    } catch (e: any) {
      setPickerError(e?.message || 'Gagal memuat data');
      setPickerOptions([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const openPicker = async () => {
    if (!scopeNeedsTargets) return;
    setPickerQuery('');
    setPickerOpen(true);
    await loadPickerOptions();
  };

  const toggleTarget = (id: string) => {
    setSelectedTargetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearTargets = () => setSelectedTargetIds([]);

  const visibleIds = useMemo(() => filteredCoupons.map((c) => c.id), [filteredCoupons]);
  const isAllVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    const set = new Set(selectedIds);
    return visibleIds.every((id) => set.has(id));
  }, [selectedIds, visibleIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  }, [visibleIds]);

  const getStatus = useCallback((c: CouponRow) => {
    if (!c.isActive) return 'INACTIVE';
    if (c.expiresAt) {
      const d = new Date(c.expiresAt);
      if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) return 'EXPIRED';
    }
    return 'ACTIVE';
  }, []);

  const openCreate = () => {
    const defaults = isMentorVariant
      ? {
          code: '',
          amount: 0,
          type: 'PERCENT' as const,
          expiresAt: '',
          funding: 'STORE' as const,
          marketplaceSharePercent: 0,
          allowMentorOptIn: false,
          scope: 'COURSES' as const,
          targetIds: '',
          minSubtotal: 0,
          maxRedemptions: 0,
          usageLimitPerUser: 0,
          maxDiscount: 0,
        }
      : isDiscountView
      ? {
          code: '',
          amount: 0,
          type: 'PERCENT' as const,
          expiresAt: '',
          funding: 'MARKETPLACE' as const,
          marketplaceSharePercent: 50,
          allowMentorOptIn: true,
          scope: 'COURSES' as const,
          targetIds: '',
          minSubtotal: 0,
          maxRedemptions: 0,
          usageLimitPerUser: 0,
          maxDiscount: 0,
        }
      : {
          code: '',
          amount: 0,
          type: 'PERCENT' as const,
          expiresAt: '',
          funding: 'STORE' as const,
          marketplaceSharePercent: 50,
          allowMentorOptIn: false,
          scope: 'ALL' as const,
          targetIds: '',
          minSubtotal: 0,
          maxRedemptions: 0,
          usageLimitPerUser: 0,
          maxDiscount: 0,
        };
    setSelectedTargetIds([]);
    setNewCoupon(defaults);
    setIsAdding(true);
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
              disabled={visibleIds.length === 0 || isBulkDeleting}
              aria-label="Pilih semua kupon"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-14',
        cell: (_val: unknown, row: CouponRow) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={selectedIds.includes(row.id)}
              onChange={() => toggleOne(row.id)}
              disabled={isBulkDeleting}
              aria-label={`Pilih kupon ${row.code}`}
            />
          </div>
        ),
      },
      {
        header: 'Kode Kupon',
        accessorKey: 'code',
        cell: (val: string) => (
          <div className="font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg inline-block text-xs border border-indigo-100">
            {val}
          </div>
        ),
      },
      {
        header: 'Diskon',
        accessorKey: 'amount',
        cell: (val: number, row: CouponRow) => (
          <div className="font-medium text-slate-900">
            {row.type === 'PERCENT' ? `${Number(val || 0)}%` : `IDR ${Number(val || 0).toLocaleString('id-ID')}`}
          </div>
        ),
      },
      {
        header: 'Pendanaan',
        accessorKey: 'funding',
        className: 'whitespace-nowrap',
        cell: (_val: unknown, row: CouponRow) => {
          const funding = String(row.funding || 'STORE').toUpperCase();
          if (funding === 'MARKETPLACE') return <span className="text-xs font-extrabold text-indigo-700">Marketplace</span>;
          if (funding === 'SPLIT') return <span className="text-xs font-extrabold text-slate-700">Split ({Number(row.marketplaceSharePercent || 0)}%)</span>;
          return <span className="text-xs font-extrabold text-slate-700">Toko</span>;
        },
      },
      {
        header: 'Cakupan',
        accessorKey: 'scope',
        className: 'whitespace-nowrap',
        cell: (_val: unknown, row: CouponRow) => {
          const scope = String(row.scope || 'ALL').toUpperCase();
          if (scope === 'COURSES') return <span className="text-xs font-extrabold text-slate-700">Kursus tertentu</span>;
          if (scope === 'PRODUCTS') return <span className="text-xs font-extrabold text-slate-700">Produk tertentu</span>;
          if (scope === 'VENDORS') return <span className="text-xs font-extrabold text-slate-700">Vendor tertentu</span>;
          if (scope === 'COURSE_CATEGORIES') return <span className="text-xs font-extrabold text-slate-700">Kategori kursus</span>;
          if (scope === 'PRODUCT_CATEGORIES') return <span className="text-xs font-extrabold text-slate-700">Kategori produk</span>;
          return <span className="text-xs font-extrabold text-slate-700">Semua item</span>;
        },
      },
      { header: 'Tipe', accessorKey: 'type', cell: (val: string) => (val === 'PERCENT' ? 'Persen (%)' : 'Nominal (IDR)') },
      {
        header: 'Status',
        accessorKey: 'isActive',
        cell: (_val: unknown, row: CouponRow) => (
          <span
            className={twMerge(
              "px-2.5 py-0.5 rounded-full text-xs font-medium border",
              getStatus(row) === 'ACTIVE'
                ? "bg-green-50 text-green-700 border-green-200"
                : getStatus(row) === 'EXPIRED'
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
            )}
          >
            {getStatus(row) === 'ACTIVE' ? 'Aktif' : getStatus(row) === 'EXPIRED' ? 'Kedaluwarsa' : 'Nonaktif'}
          </span>
        ),
      },
      {
        header: 'Berlaku Hingga',
        accessorKey: 'expiresAt',
        cell: (val: string | null) => (
          <span className="text-slate-500 text-sm">
            {val ? new Date(val).toLocaleDateString('id-ID') : '-'}
          </span>
        ),
      },
      {
        header: 'Terpakai',
        accessorKey: 'redeemedCount',
        cell: (val: number, row: CouponRow) => (
          <span className="text-slate-600 text-sm">
            {Number(val || 0).toLocaleString('id-ID')}
            {typeof row.maxRedemptions === 'number' && Number.isFinite(row.maxRedemptions) ? ` / ${row.maxRedemptions.toLocaleString('id-ID')}` : ''}
          </span>
        ),
      },
    ];
  }, [getStatus, isAllVisibleSelected, isBulkDeleting, selectedIds, toggleAllVisible, toggleOne, visibleIds]);

  const handleAddCoupon = async () => {
    const code = newCoupon.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) return;
    const amount = Number(newCoupon.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setIsAdding(false);
    try {
      const ids = newCoupon.targetIds
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const scope = newCoupon.scope;
      const scopePayload: any =
        scope === 'COURSES'
          ? { courseIds: ids }
          : scope === 'PRODUCTS'
            ? { productIds: ids }
            : scope === 'VENDORS'
              ? { vendorIds: ids }
              : scope === 'COURSE_CATEGORIES'
                ? { courseCategoryIds: ids }
                : scope === 'PRODUCT_CATEGORIES'
                  ? { productCategoryIds: ids }
                  : {};

      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          type: newCoupon.type,
          amount,
          funding: isMentorVariant ? 'STORE' : newCoupon.funding,
          marketplaceSharePercent: isMentorVariant ? 0 : newCoupon.funding === 'SPLIT' ? Number(newCoupon.marketplaceSharePercent || 0) : undefined,
          allowMentorOptIn: isMentorVariant ? false : Boolean((newCoupon as any).allowMentorOptIn),
          scope,
          ...scopePayload,
          minSubtotal: newCoupon.minSubtotal > 0 ? Number(newCoupon.minSubtotal) : null,
          maxRedemptions: newCoupon.maxRedemptions > 0 ? Number(newCoupon.maxRedemptions) : null,
          usageLimitPerUser: newCoupon.usageLimitPerUser > 0 ? Number(newCoupon.usageLimitPerUser) : null,
          maxDiscount: newCoupon.maxDiscount > 0 ? Number(newCoupon.maxDiscount) : null,
          expiresAt: newCoupon.expiresAt ? new Date(newCoupon.expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal membuat kupon');
      const row = data as CouponRow;
      setCoupons((prev) => [row, ...prev]);
      setNewCoupon({
        code: '',
        amount: 0,
        type: 'PERCENT',
        expiresAt: '',
        funding: 'STORE',
        marketplaceSharePercent: 50,
        allowMentorOptIn: false,
        scope: isMentorVariant ? 'COURSES' : 'ALL',
        targetIds: '',
        minSubtotal: 0,
        maxRedemptions: 0,
        usageLimitPerUser: 0,
        maxDiscount: 0,
      });
      toast.success('Kupon berhasil ditambahkan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membuat kupon');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ isOpen: false, id: null });
    if (!id) return;
    try {
      const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus kupon');
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      toast.success('Kupon berhasil dihapus');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus kupon');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 kupon');
      return;
    }
    if (!confirm(`Hapus ${selectedIds.length} kupon terpilih?`)) return;
    setIsBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      for (const id of ids) {
        const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Gagal menghapus kupon');
        }
      }
      const toDelete = new Set(ids);
      setCoupons((prev) => prev.filter((c) => !toDelete.has(c.id)));
      toast.success(`Kupon berhasil dihapus: ${ids.length}`);
      setSelectedIds([]);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isDiscountView ? 'Manajemen Diskon' : 'Manajemen Kupon'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isMentorVariant
              ? 'Buat dan kelola promo untuk kursus/produk milik Anda.'
              : isDiscountView
                ? 'Kelola promosi/diskon yang ditanggung marketplace atau promo platform.'
                : 'Buat dan kelola kode diskon untuk promosi.'}
          </p>
        </div>
        <button 
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> {isDiscountView ? 'Buat Diskon' : 'Buat Kupon'}
        </button>
      </div>

      {isAdding ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">{isDiscountView ? 'Buat Diskon Baru' : 'Buat Kupon Baru'}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {isMentorVariant
                    ? 'Atur diskon, cakupan, dan batasan penggunaan promo.'
                    : isDiscountView
                      ? 'Atur diskon, pendanaan, cakupan, dan batasan penggunaan promosi.'
                      : 'Atur diskon, pendanaan, cakupan, dan batasan penggunaan kupon.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[78vh] overflow-auto p-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Informasi</div>
                    <div className="text-sm text-slate-600 mt-1">Gunakan kode yang mudah diingat dan nilai diskon yang sesuai.</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Kode</label>
                      <input
                        type="text"
                        placeholder="Contoh: MERDEKA45"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm uppercase text-slate-900 placeholder:text-slate-400"
                        value={newCoupon.code}
                        onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Kedaluwarsa (opsional)</label>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900"
                        value={newCoupon.expiresAt}
                        onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Tipe Diskon</label>
                      <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900"
                        value={newCoupon.type}
                        onChange={(e) => setNewCoupon({ ...newCoupon, type: e.target.value as any })}
                      >
                        <option value="PERCENT">Persentase (%)</option>
                        <option value="FIXED">Nominal Tetap (IDR)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nilai Diskon</label>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
                        value={newCoupon.amount}
                        onChange={(e) => setNewCoupon({ ...newCoupon, amount: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {!isMentorVariant ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Pendanaan</div>
                    <div className="text-sm text-slate-600 mt-1">Tentukan siapa yang menanggung diskon.</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Diskon Ditanggung</label>
                      <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900"
                        value={newCoupon.funding}
                        onChange={(e) => setNewCoupon({ ...newCoupon, funding: e.target.value as any })}
                      >
                        <option value="STORE">Toko (penjual)</option>
                        <option value="MARKETPLACE">Marketplace (platform)</option>
                        <option value="SPLIT">Split (bagi dua)</option>
                      </select>
                    </div>

                    <div className={newCoupon.funding === 'SPLIT' ? '' : 'opacity-60'}>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Porsi Marketplace (%)</label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
                        value={newCoupon.marketplaceSharePercent}
                        onChange={(e) => setNewCoupon({ ...newCoupon, marketplaceSharePercent: Number(e.target.value) })}
                        disabled={newCoupon.funding !== 'SPLIT'}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Mode Split berarti diskon dibagi: Marketplace {Number(newCoupon.marketplaceSharePercent || 0)}% • Toko{' '}
                    {Math.max(0, 100 - Number(newCoupon.marketplaceSharePercent || 0))}%.
                  </div>
                </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 xl:col-span-2">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Cakupan</div>
                    <div className="text-sm text-slate-600 mt-1">Atur item yang bisa memakai diskon/kupon ini.</div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Cakupan</label>
                      <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900"
                        value={newCoupon.scope}
                        onChange={(e) => setNewCoupon({ ...newCoupon, scope: e.target.value as any })}
                      >
                        {!isMentorVariant ? <option value="ALL">Semua item</option> : null}
                        <option value="COURSES">Kursus tertentu</option>
                        <option value="PRODUCTS">Produk tertentu</option>
                        <option value="VENDORS">Vendor tertentu</option>
                        {!isMentorVariant ? <option value="COURSE_CATEGORIES">Kategori kursus</option> : null}
                        {!isMentorVariant ? <option value="PRODUCT_CATEGORIES">Kategori produk</option> : null}
                      </select>

                      {!isMentorVariant && newCoupon.scope === 'COURSES' ? (
                        <div className="mt-4">
                          <label className="block text-sm font-semibold text-slate-900 mb-1.5">Promo Platform (Opt-in Mentor)</label>
                          <label className="inline-flex w-full items-start gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 mt-0.5"
                              checked={Boolean((newCoupon as any).allowMentorOptIn)}
                              onChange={(e) => setNewCoupon({ ...(newCoupon as any), allowMentorOptIn: e.target.checked } as any)}
                            />
                            <span className="font-semibold">Mentor bisa memilih kursus yang ikut promo ini</span>
                          </label>
                          <div className="mt-2 text-sm text-slate-600">
                            Jika aktif, Admin tidak wajib memilih kursus saat membuat kupon. Mentor nanti yang memilih kursus mana yang ikut.
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className={newCoupon.scope === 'ALL' ? 'opacity-60' : ''}>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Target</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={openPicker}
                          disabled={!scopeNeedsTargets}
                          className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                        >
                          Pilih Target
                        </button>
                        <button
                          type="button"
                          onClick={clearTargets}
                          disabled={!scopeNeedsTargets || selectedTargetIds.length === 0}
                          className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100 disabled:opacity-60"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="mt-3 text-sm text-slate-700">
                        {scopeNeedsTargets
                          ? selectedTargetIds.length
                            ? `${selectedTargetIds.length} target dipilih`
                            : 'Belum ada target dipilih'
                          : 'Tidak perlu target untuk cakupan Semua item.'}
                      </div>

                      {scopeNeedsTargets && selectedTargetIds.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedTargetIds.slice(0, 12).map((id) => {
                            const opt = pickerOptions.find((o) => o.id === id);
                            const label = opt?.label || id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => toggleTarget(id)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                                title="Klik untuk hapus"
                              >
                                <span className="max-w-[260px] truncate">{label}</span>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            );
                          })}
                          {selectedTargetIds.length > 12 ? (
                            <div className="text-xs text-slate-700 px-2 py-1.5">+{selectedTargetIds.length - 12} lainnya</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Min Subtotal (opsional)</label>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
                        value={newCoupon.minSubtotal}
                        onChange={(e) => setNewCoupon({ ...newCoupon, minSubtotal: Number(e.target.value) })}
                      />
                      <div className="mt-2 text-sm text-slate-600">Dihitung berdasarkan subtotal item yang memenuhi syarat kupon.</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 xl:col-span-2">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Batasan</div>
                    <div className="text-sm text-slate-600 mt-1">Batasi jumlah penggunaan untuk kontrol promo.</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Maks Penggunaan (opsional)</label>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
                        value={newCoupon.maxRedemptions}
                        onChange={(e) => setNewCoupon({ ...newCoupon, maxRedemptions: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Limit per User (opsional)</label>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
                        value={newCoupon.usageLimitPerUser}
                        onChange={(e) => setNewCoupon({ ...newCoupon, usageLimitPerUser: Number(e.target.value) })}
                      />
                    </div>
                    <div className={newCoupon.type === 'PERCENT' ? '' : 'opacity-60'}>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Maks Diskon (opsional)</label>
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
                        value={newCoupon.maxDiscount}
                        onChange={(e) => setNewCoupon({ ...newCoupon, maxDiscount: Number(e.target.value) })}
                        disabled={newCoupon.type !== 'PERCENT'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddCoupon}
                className="h-11 px-6 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition-all shadow-sm"
              >
                {isDiscountView ? 'Simpan Diskon' : 'Simpan Kupon'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Pilih Target Kupon</div>
                <div className="text-lg font-extrabold text-slate-900">
                  {newCoupon.scope === 'COURSES'
                    ? 'Kursus'
                    : newCoupon.scope === 'PRODUCTS'
                      ? 'Produk'
                      : newCoupon.scope === 'VENDORS'
                        ? 'Vendor'
                        : newCoupon.scope === 'COURSE_CATEGORIES'
                          ? 'Kategori Kursus'
                          : newCoupon.scope === 'PRODUCT_CATEGORIES'
                            ? 'Kategori Produk'
                            : 'Target'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Cari..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadPickerOptions}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
                >
                  Muat Ulang
                </button>
                <div className="text-xs font-extrabold text-slate-600 text-right">Dipilih: {selectedTargetIds.length}</div>
              </div>

              {pickerError ? <div className="text-sm text-rose-700">{pickerError}</div> : null}
              {pickerLoading ? (
                <div className="p-8 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat...
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[55vh] overflow-auto divide-y divide-slate-200">
                    {(() => {
                      const q = pickerQuery.trim().toLowerCase();
                      const list = q ? pickerOptions.filter((o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) : pickerOptions;
                      if (list.length === 0) return <div className="p-6 text-sm text-slate-600">Tidak ada data.</div>;
                      return list.map((o) => (
                        <label key={o.id} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={selectedTargetIds.includes(o.id)}
                            onChange={() => toggleTarget(o.id)}
                          />
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 text-sm truncate">{o.label}</div>
                            <div className="text-xs text-slate-500 font-mono truncate">{o.id}</div>
                          </div>
                        </label>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder={isDiscountView ? 'Cari kode diskon...' : 'Cari kode kupon...'} 
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between">
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
          <div className="text-xs text-slate-500 font-medium">{selectedIds.length ? `${selectedIds.length} dipilih` : `${filteredCoupons.length} item`}</div>
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
        {filteredCoupons.length > 0 ? (
          <Table 
            columns={columns} 
            data={filteredCoupons} 
            isLoading={false}
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
                <button 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => handleDelete(row.id)}
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          />
        ) : (
          <EmptyState 
            icon={Ticket} 
            title="Tidak ada kupon ditemukan" 
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : "Belum ada kupon yang dibuat."}
          />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredCoupons.length === 0 ? (
          <EmptyState 
            icon={Ticket} 
            title="Tidak ada kupon" 
            description="Belum ada data kupon untuk ditampilkan."
          />
        ) : (
          filteredCoupons.map((coupon) => (
            <div key={coupon.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 mt-1"
                  checked={selectedIds.includes(coupon.id)}
                  onChange={() => toggleOne(coupon.id)}
                  disabled={isBulkDeleting}
                  aria-label={`Pilih kupon ${coupon.code}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg inline-block text-xs border border-indigo-100 mb-1">{coupon.code}</div>
                      <div className="text-sm font-semibold text-slate-900">
                        Diskon: {coupon.type === 'PERCENT' ? `${coupon.amount}%` : `IDR ${coupon.amount.toLocaleString('id-ID')}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Ditanggung:{' '}
                        {String(coupon.funding || 'STORE').toUpperCase() === 'MARKETPLACE'
                          ? 'Marketplace'
                          : String(coupon.funding || 'STORE').toUpperCase() === 'SPLIT'
                            ? `Split (Marketplace ${Number(coupon.marketplaceSharePercent || 0)}%)`
                            : 'Toko'}
                      </div>
                    </div>
                    <span
                      className={twMerge(
                        "px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
                        getStatus(coupon) === 'ACTIVE'
                          ? "bg-green-50 text-green-700 border-green-200"
                          : getStatus(coupon) === 'EXPIRED'
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {getStatus(coupon) === 'ACTIVE' ? 'Aktif' : getStatus(coupon) === 'EXPIRED' ? 'Expired' : 'Nonaktif'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-slate-500">
                Berlaku hingga: {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('id-ID') : '-'}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <button 
                  onClick={() => handleDelete(coupon.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title={isDiscountView ? 'Hapus Diskon?' : 'Hapus Kupon?'}
        description={
          isDiscountView
            ? 'Apakah Anda yakin ingin menghapus diskon ini? Tindakan ini tidak dapat dibatalkan.'
            : 'Apakah Anda yakin ingin menghapus kupon ini? Tindakan ini tidak dapat dibatalkan.'
        }
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
