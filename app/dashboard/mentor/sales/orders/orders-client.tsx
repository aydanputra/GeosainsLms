"use client";

import Table from '@/modules/dashboard/components/Tables';
import { Filter, MoreVertical, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import ConfirmDialog from '@/modules/dashboard/components/ConfirmDialog';

type Row = {
  createdAt: string;
  orderId: string;
  customer: string;
  orderTotal: number;
  earning: number;
  status: 'PENDING_PAYMENT' | 'PROCESSING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'FAILED';
};

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getStatusMeta(status: Row['status']) {
  const s = String(status || '').toUpperCase();
  if (s === 'COMPLETED') return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' };
  if (s === 'CANCELLED') return { label: 'Cancelled', cls: 'bg-slate-100 text-slate-700' };
  if (s === 'FAILED') return { label: 'Failed', cls: 'bg-rose-50 text-rose-700' };
  if (s === 'REFUNDED') return { label: 'Refunded', cls: 'bg-violet-50 text-violet-700' };
  if (s === 'ON_HOLD') return { label: 'On hold', cls: 'bg-amber-50 text-amber-700' };
  if (s === 'PROCESSING') return { label: 'Processing', cls: 'bg-indigo-50 text-indigo-700' };
  return { label: 'Pending payment', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
}

function statusPill(status: Row['status']) {
  const meta = getStatusMeta(status);
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold border ${meta.cls}`}>{meta.label}</span>;
}

function formatOrderNumber(orderId: string) {
  const id = String(orderId || '').trim();
  if (!id) return '#-';
  return `#${id.slice(-4).toUpperCase()}`;
}

function getDiscountMeta(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  const fallbackTotal = Number(it?.discountAmount || 0);
  const total = store === 0 && marketplace === 0 ? fallbackTotal : store + marketplace;
  const storeOnly = store === 0 && marketplace === 0 ? fallbackTotal : store;
  return { totalDiscount: Math.max(0, total), storeDiscount: Math.max(0, storeOnly) };
}

export default function OrdersClient({ rows, variant }: { rows: Row[]; variant?: 'MENTOR' | 'ADMIN' }) {
  const view = variant === 'ADMIN' ? 'ADMIN' : 'MENTOR';
  const safeRows = Array.isArray(rows) ? rows : [];
  const [dataRows, setDataRows] = useState<Row[]>(safeRows);
  useEffect(() => setDataRows(safeRows), [rows]);

  const [activeTab, setActiveTab] = useState<
    'ALL' | 'PENDING_PAYMENT' | 'PROCESSING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'FAILED'
  >('ALL');
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewLoading, setReviewLoading] = useState<null | 'APPROVE' | 'REJECT'>(null);
  const [shipCourier, setShipCourier] = useState('');
  const [shipTracking, setShipTracking] = useState('');
  const [shipLoading, setShipLoading] = useState(false);

  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const reauthResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const requestReauth = () =>
    new Promise<boolean>((resolve) => {
      setReauthPassword('');
      setReauthOpen(true);
      reauthResolverRef.current = resolve;
    });

  const closeReauth = () => {
    setReauthOpen(false);
    const resolver = reauthResolverRef.current;
    reauthResolverRef.current = null;
    if (resolver) resolver(false);
  };

  const confirmReauth = async () => {
    if (reauthLoading) return;
    const password = reauthPassword;
    if (!password) return;
    setReauthLoading(true);
    try {
      const res = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Gagal konfirmasi password');
        return;
      }
      setReauthOpen(false);
      const resolver = reauthResolverRef.current;
      reauthResolverRef.current = null;
      if (resolver) resolver(true);
    } finally {
      setReauthLoading(false);
    }
  };

  const openDetail = async (orderId: string) => {
    const id = String(orderId || '').trim();
    if (!id) return;
    setOpenMenuId(null);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setReviewNote('');
    setReviewLoading(null);
    setShipLoading(false);
    try {
      const url =
        view === 'ADMIN'
          ? `/api/dashboard/admin/orders/${encodeURIComponent(id)}`
          : `/api/dashboard/mentor/orders/${encodeURIComponent(id)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat detail order');
      setDetail(data);
      setShipCourier(typeof data?.shippingCourier === 'string' ? data.shippingCourier : '');
      setShipTracking(typeof data?.shippingTrackingNumber === 'string' ? data.shippingTrackingNumber : '');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat detail order');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const review = async (action: 'APPROVE' | 'REJECT') => {
    if (view !== 'ADMIN') return;
    const orderId = typeof detail?.id === 'string' ? detail.id : '';
    if (!orderId) return;
    setReviewLoading(action);
    try {
      const doRequest = async () => {
        const res = await fetch(`/api/dashboard/admin/orders/${encodeURIComponent(orderId)}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, note: reviewNote.trim() ? reviewNote.trim() : null }),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

      let { res, data } = await doRequest();
      if (!res.ok && res.status === 401 && data?.code === 'REAUTH_REQUIRED') {
        const ok = await requestReauth();
        if (!ok) return;
        ({ res, data } = await doRequest());
      }
      if (!res.ok) throw new Error(data?.error || 'Gagal memproses order');

      const updated = data?.order || null;
      if (updated) setDetail((prev: any) => ({ ...(prev || {}), ...updated }));
      setDataRows((prev) =>
        prev.map((r) =>
          r.orderId === orderId
            ? {
                ...r,
                status: action === 'APPROVE' ? 'COMPLETED' : 'PENDING_PAYMENT',
              }
            : r
        )
      );
      toast.success(action === 'APPROVE' ? 'Pembayaran dikonfirmasi' : 'Pembayaran ditolak');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memproses order');
    } finally {
      setReviewLoading(null);
    }
  };

  const ship = async () => {
    if (view !== 'ADMIN') return;
    const orderId = typeof detail?.id === 'string' ? detail.id : '';
    if (!orderId) return;
    setShipLoading(true);
    try {
      const res = await fetch(`/api/dashboard/admin/orders/${encodeURIComponent(orderId)}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier: shipCourier.trim(), trackingNumber: shipTracking.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim pesanan');
      const updated = data?.order || null;
      if (updated) setDetail((prev: any) => ({ ...(prev || {}), ...updated }));
      setDataRows((prev) => prev.map((r) => (r.orderId === orderId ? { ...r, status: 'PROCESSING' } : r)));
      toast.success('Pesanan ditandai dikirim');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim pesanan');
    } finally {
      setShipLoading(false);
    }
  };

  const counts = useMemo(() => {
    const base = {
      ALL: dataRows.length,
      PENDING_PAYMENT: 0,
      PROCESSING: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      REFUNDED: 0,
      FAILED: 0,
    };
    for (const r of dataRows) {
      const k = String(r.status || '').toUpperCase() as keyof typeof base;
      if (k in base && k !== 'ALL') base[k] += 1;
    }
    return base;
  }, [dataRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dataRows.filter((r) => {
      if (activeTab !== 'ALL' && r.status !== activeTab) return false;
      if (!q) return true;
      const orderKey = formatOrderNumber(r.orderId).toLowerCase();
      const rawId = String(r.orderId || '').toLowerCase();
      const customer = String(r.customer || '').toLowerCase();
      return rawId.includes(q) || orderKey.includes(q) || customer.includes(q);
    });
  }, [activeTab, query, dataRows]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleIds = filtered.map((r) => r.orderId);
  const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING_PAYMENT', label: 'Pending payment' },
    { key: 'PROCESSING', label: 'Processing' },
    { key: 'ON_HOLD', label: 'On hold' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
    { key: 'REFUNDED', label: 'Refunded' },
    { key: 'FAILED', label: 'Failed' },
  ];

  const columns = useMemo(() => {
    return [
      {
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/40"
              checked={isAllSelected}
              onChange={toggleAll}
              aria-label="Pilih semua order"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-16',
        cell: (_val: unknown, row: Row) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={selectedIds.includes(row.orderId)}
              onChange={() => toggleOne(row.orderId)}
              aria-label={`Pilih order ${row.orderId}`}
            />
          </div>
        ),
      },
      {
        header: 'Order',
        accessorKey: 'orderId',
        cell: (val: string, row: Row) => (
          <div>
            <div className="font-extrabold text-indigo-600">{formatOrderNumber(String(val || ''))}</div>
            <div className="text-xs text-slate-500 mt-1">{formatDate(String(row.createdAt || ''))}</div>
          </div>
        ),
      },
      {
        header: 'Order Total',
        accessorKey: 'orderTotal',
        className: 'whitespace-nowrap',
        cell: (val: number) => <span className="font-extrabold text-slate-900">{formatIdr(Number(val || 0))}</span>,
      },
      {
        header: view === 'ADMIN' ? 'Komisi Platform' : 'Hasil Bersih',
        accessorKey: 'earning',
        className: 'whitespace-nowrap',
        cell: (val: number) => <span className="font-extrabold text-slate-900">{formatIdr(Number(val || 0))}</span>,
      },
      {
        header: 'Status',
        accessorKey: 'status',
        className: 'whitespace-nowrap',
        cell: (val: Row['status']) => statusPill(val),
      },
      {
        header: 'Customer',
        accessorKey: 'customer',
        cell: (val: string) => <span className="font-semibold text-slate-900">{String(val || '-')}</span>,
      },
    ];
  }, [isAllSelected, selectedIds, toggleAll, toggleOne]);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Order Penjualan</h1>
        <p className="text-slate-500 text-sm mt-1">{view === 'ADMIN' ? 'Daftar order penjualan secara global.' : 'Daftar order yang berisi kursus/produk Anda.'}</p>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              const count = counts[t.key] ?? 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(t.key);
                    setSelectedIds([]);
                  }}
                  className={twMerge(
                    'px-3 py-2 rounded-xl text-sm font-extrabold transition-colors',
                    isActive ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {t.label} <span className={isActive ? 'text-white/80' : 'text-slate-400'}>({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Orders"
                className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-white transition-colors"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4">
        <Table
          columns={columns as any}
          data={filtered as any}
          isLoading={false}
          actions={(row: Row) => (
            <div className="relative flex justify-end" ref={openMenuId === row.orderId ? menuRef : null}>
              <button
                type="button"
                onClick={() => setOpenMenuId((prev) => (prev === row.orderId ? null : row.orderId))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                aria-label="Aksi"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {openMenuId === row.orderId ? (
                <div className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => openDetail(row.orderId)}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    {view === 'ADMIN' && row.status === 'ON_HOLD' ? 'Verifikasi Bukti' : 'Lihat Detail'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        />
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDetailOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-slate-900">Detail Order</div>
                <div className="text-xs text-slate-500 mt-1 font-mono break-all">{typeof detail?.id === 'string' ? detail.id : ''}</div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {detailLoading ? (
                <div className="text-sm text-slate-600">Memuat…</div>
              ) : detail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-extrabold text-slate-700">Customer</div>
                      <div className="text-sm text-slate-800 mt-1 font-semibold">{detail?.user?.name || detail?.user?.email || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{detail?.user?.email || ''}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-extrabold text-slate-700">Status</div>
                      <div className="mt-2">
                        {(() => {
                          const raw = String(detail?.status || '').toUpperCase();
                          const manual = String(detail?.manualPaymentStatus || '').toUpperCase();
                          const payment = String(detail?.payment?.status || '').toUpperCase();
                          const refunded = Number(detail?.refundTotal || 0) > 0 || Boolean(detail?.refundedAt);
                          let ui: Row['status'] = 'PENDING_PAYMENT';
                          if (payment === 'FAILED') ui = 'FAILED';
                          else if (refunded) ui = 'REFUNDED';
                          else if (raw === 'CANCELLED') ui = 'CANCELLED';
                          else if (raw === 'SHIPPED') ui = 'PROCESSING';
                          else if (manual === 'SUBMITTED') ui = 'ON_HOLD';
                          else if (raw === 'PAID') ui = 'COMPLETED';
                          return statusPill(ui);
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-900">Ringkasan</div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-extrabold text-slate-700">Order Total</div>
                        <div className="text-sm text-slate-900 mt-1 font-extrabold">{formatIdr(Number(detail?.total || 0))}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-extrabold text-slate-700">{view === 'ADMIN' ? 'Komisi Platform' : 'Hasil Bersih'}</div>
                        <div className="text-sm text-slate-900 mt-1 font-extrabold">
                          {(() => {
                            const id = typeof detail?.id === 'string' ? detail.id : '';
                            const r = dataRows.find((x) => x.orderId === id);
                            return formatIdr(Number(r?.earning || 0));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {view === 'MENTOR' && detail?.pricing ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-extrabold text-slate-900">Perhitungan Penjualan</div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-extrabold text-slate-700">Rincian Total Pembayaran</div>
                          <div className="mt-2 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Subtotal</div>
                              <div className="text-slate-900 font-extrabold">{formatIdr(Number(detail?.pricing?.order?.subtotal || 0))}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Diskon Toko</div>
                              <div className="text-slate-900 font-extrabold">- {formatIdr(Number(detail?.pricing?.order?.discountStoreTotal || 0))}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Diskon Marketplace</div>
                              <div className="text-slate-900 font-extrabold">- {formatIdr(Number(detail?.pricing?.order?.discountMarketplaceTotal || 0))}</div>
                            </div>
                            {Number(detail?.pricing?.order?.serviceFee || 0) ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-slate-600 font-semibold">Biaya Layanan</div>
                                <div className="text-slate-900 font-extrabold">+ {formatIdr(Number(detail?.pricing?.order?.serviceFee || 0))}</div>
                              </div>
                            ) : null}
                            {Number(detail?.pricing?.order?.uniqueCode || 0) ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-slate-600 font-semibold">Kode Unik</div>
                                <div className="text-slate-900 font-extrabold">+ {formatIdr(Number(detail?.pricing?.order?.uniqueCode || 0))}</div>
                              </div>
                            ) : null}
                            <div className="h-px bg-slate-200" />
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-700 font-extrabold">Total Dibayar Pembeli</div>
                              <div className="text-slate-900 font-extrabold">{formatIdr(Number(detail?.pricing?.order?.total || 0))}</div>
                            </div>
                            {Number(detail?.pricing?.order?.refundTotal || 0) ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-slate-600 font-semibold">Refund Total</div>
                                <div className="text-rose-700 font-extrabold">- {formatIdr(Number(detail?.pricing?.order?.refundTotal || 0))}</div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-extrabold text-slate-700">Rincian Hasil untuk Mentor</div>
                          <div className="mt-2 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Harga Awal Item</div>
                              <div className="text-slate-900 font-extrabold">{formatIdr(Number(detail?.pricing?.earnings?.gross || 0))}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Diskon Toko</div>
                              <div className="text-slate-900 font-extrabold">- {formatIdr(Number(detail?.pricing?.earnings?.discountStore || 0))}</div>
                            </div>
                            {Number(detail?.pricing?.earnings?.refund || 0) ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-slate-600 font-semibold">Refund Item</div>
                                <div className="text-rose-700 font-extrabold">- {formatIdr(Number(detail?.pricing?.earnings?.refund || 0))}</div>
                              </div>
                            ) : null}
                            <div className="h-px bg-slate-200" />
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-700 font-extrabold">Dasar Penjualan</div>
                              <div className="text-slate-900 font-extrabold">{formatIdr(Number(detail?.pricing?.earnings?.sellerBase || 0))}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Potongan Platform</div>
                              <div className="text-slate-900 font-extrabold">- {formatIdr(Number(detail?.pricing?.earnings?.platformFee || 0))}</div>
                            </div>
                            {Number(detail?.pricing?.earnings?.affiliateFee || 0) ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-slate-600 font-semibold">Fee Affiliate</div>
                                <div className="text-slate-900 font-extrabold">- {formatIdr(Number(detail?.pricing?.earnings?.affiliateFee || 0))}</div>
                              </div>
                            ) : null}
                            <div className="h-px bg-slate-200" />
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-700 font-extrabold">Hasil Bersih Mentor</div>
                              <div className="text-emerald-700 font-extrabold">
                                {formatIdr(Number(detail?.pricing?.earnings?.mentorNetEarning ?? detail?.pricing?.earnings?.mentorEarning ?? 0))}
                              </div>
                            </div>
                            {detail?.pricing?.settings?.enableRevenueSharing ? (
                              <div className="text-[11px] text-slate-500 font-semibold">
                                Kursus: Mentor {Number(detail?.pricing?.settings?.courseMentorPercent || 0)}% • Platform{' '}
                                {Number(detail?.pricing?.settings?.coursePlatformPercent || 0)}%
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {Array.isArray(detail?.pricing?.items) && detail.pricing.items.length ? (
                        <div className="mt-4">
                          <div className="text-xs font-extrabold text-slate-900">Rincian per Item</div>
                          <div className="mt-2 space-y-2">
                            {detail.pricing.items.map((it: any) => {
                              const kind = String(it?.kind || it?.meta?.kind || '').toUpperCase();
                              const feeLabel = kind === 'COURSE' ? 'Fee Platform' : 'Komisi Marketplace';
                              const feeHint =
                                kind === 'COURSE'
                                  ? `${Number(it?.meta?.platformPercent || 0)}%`
                                  : String(it?.meta?.commissionType || '').toUpperCase() === 'FLAT'
                                  ? `Flat ${formatIdr(Number(it?.meta?.commissionRate || 0))}`
                                  : `${Number(it?.meta?.commissionRate || 0)}%`;
                              return (
                                <div key={String(it?.id || it?.name)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-extrabold text-slate-900 truncate">{it?.name || '-'}</div>
                                      <div className="text-xs text-slate-600 mt-1">
                                        {kind || '-'} • Qty {Number(it?.quantity || 0)} • {formatIdr(Number(it?.unitPrice || 0))}
                                      </div>
                                    </div>
                                        <div className="text-sm font-extrabold text-emerald-700 whitespace-nowrap">
                                          {formatIdr(Number(it?.mentorNetEarning ?? it?.mentorEarning ?? 0))}
                                        </div>
                                  </div>

                                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <div className="text-[11px] text-slate-500 font-bold">Gross</div>
                                      <div className="text-xs font-extrabold text-slate-900">{formatIdr(Number(it?.gross || 0))}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <div className="text-[11px] text-slate-500 font-bold">Diskon Toko</div>
                                      <div className="text-xs font-extrabold text-slate-900">- {formatIdr(Number(it?.discountStore || 0))}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <div className="text-[11px] text-slate-500 font-bold">Diskon MP</div>
                                      <div className="text-xs font-extrabold text-slate-900">- {formatIdr(Number(it?.discountMarketplace || 0))}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <div className="text-[11px] text-slate-500 font-bold">Refund</div>
                                      <div className="text-xs font-extrabold text-slate-900">- {formatIdr(Number(it?.refund || 0))}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <div className="text-[11px] text-slate-500 font-bold">Net Pembeli</div>
                                      <div className="text-xs font-extrabold text-slate-900">{formatIdr(Number(it?.buyerPaid || 0))}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <div className="text-[11px] text-slate-500 font-bold">Dasar Penjual</div>
                                      <div className="text-xs font-extrabold text-slate-900">{formatIdr(Number(it?.sellerBase || 0))}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <div className="text-[11px] text-slate-500 font-bold">
                                        {feeLabel} {feeHint ? `(${feeHint})` : ''}
                                      </div>
                                      <div className="text-xs font-extrabold text-slate-900">- {formatIdr(Number(it?.platformFee || 0))}</div>
                                    </div>
                                        {Number(it?.affiliateFee || 0) ? (
                                          <div className="rounded-xl border border-slate-200 bg-white p-2">
                                            <div className="text-[11px] text-slate-500 font-bold">Fee Affiliate</div>
                                            <div className="text-xs font-extrabold text-slate-900">- {formatIdr(Number(it?.affiliateFee || 0))}</div>
                                          </div>
                                        ) : (
                                          <div className="rounded-xl border border-slate-200 bg-white p-2">
                                            <div className="text-[11px] text-slate-500 font-bold">Fee Affiliate</div>
                                            <div className="text-xs font-extrabold text-slate-900">- {formatIdr(0)}</div>
                                          </div>
                                        )}
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                          <div className="text-[11px] text-slate-500 font-bold">Hasil Mentor</div>
                                          <div className="text-xs font-extrabold text-emerald-700">
                                            {formatIdr(Number(it?.mentorNetEarning ?? it?.mentorEarning ?? 0))}
                                          </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {detail?.affiliateCode || detail?.commission ? (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-extrabold text-slate-900">Affiliate</div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Kode</div>
                              <div className="text-slate-900 font-extrabold">{String(detail?.affiliateCode || '-')}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-slate-600 font-semibold">Komisi</div>
                              <div className="text-slate-900 font-extrabold">{formatIdr(Number(detail?.commission?.amount || 0))}</div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {view !== 'MENTOR' || !detail?.pricing ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-extrabold text-slate-900">Item</div>
                      <div className="mt-3 space-y-2">
                        {(Array.isArray(detail?.items) ? detail.items : []).map((it: any) => {
                          const name = it?.course?.title || it?.product?.name || '-';
                          const qty = Number(it?.quantity || 0);
                          const price = Number(it?.price || 0);
                          const gross = Math.max(0, qty * price);
                          const refund = Number(it?.refundAmount || 0);
                          const { totalDiscount } = getDiscountMeta(it);
                          const lineTotal = Math.max(0, gross - totalDiscount - refund);
                          return (
                            <div
                              key={String(it?.id || `${name}-${qty}-${price}`)}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">{name}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Qty {qty} • {formatIdr(price)}
                                </div>
                              </div>
                              <div className="text-sm font-extrabold text-slate-900 whitespace-nowrap">{formatIdr(lineTotal)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {detail?.shippingRecipientName || detail?.shippingAddressLine1 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-extrabold text-slate-900">Pengiriman</div>
                      <div className="mt-2 text-sm text-slate-800 font-semibold">{detail?.shippingRecipientName || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{detail?.shippingPhone || ''}</div>
                      <div className="text-sm text-slate-700 mt-2 whitespace-pre-line">
                        {[
                          detail?.shippingAddressLine1,
                          detail?.shippingAddressLine2,
                          [detail?.shippingCity, detail?.shippingProvince].filter(Boolean).join(', '),
                          detail?.shippingPostalCode,
                          detail?.shippingCountry,
                        ]
                          .filter((v: any) => typeof v === 'string' && v.trim())
                          .join('\n')}
                      </div>
                      {detail?.shippingCourier || detail?.shippingTrackingNumber ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div className="font-extrabold text-slate-900 text-xs">Resi</div>
                          <div className="mt-1 text-slate-800">
                            {detail?.shippingCourier ? `${detail.shippingCourier} - ` : ''}
                            {detail?.shippingTrackingNumber || '-'}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {detail?.manualPaymentProofUrl ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <div className="text-xs font-extrabold text-slate-900">Bukti Pembayaran</div>
                      <a
                        href={String(detail.manualPaymentProofUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-extrabold text-indigo-600 hover:text-indigo-700"
                      >
                        Buka Bukti Pembayaran
                      </a>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <img
                          src={String(detail.manualPaymentProofUrl)}
                          alt="Bukti pembayaran"
                          className="w-full max-h-[420px] object-contain rounded-lg"
                        />
                      </div>

                      {view === 'ADMIN' && String(detail?.status || '').toUpperCase() === 'PENDING' && String(detail?.manualPaymentStatus || '').toUpperCase() === 'SUBMITTED' ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                          <div className="text-xs font-extrabold text-slate-900">Verifikasi Pembayaran</div>
                          <textarea
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            placeholder="Catatan (opsional)"
                            className="w-full min-h-[90px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => review('REJECT')}
                              disabled={reviewLoading !== null}
                              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-sm hover:bg-rose-100 disabled:opacity-60"
                            >
                              Tolak
                            </button>
                            <button
                              type="button"
                              onClick={() => review('APPROVE')}
                              disabled={reviewLoading !== null}
                              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                            >
                              Konfirmasi
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {view === 'ADMIN' &&
                  String(detail?.status || '').toUpperCase() === 'PAID' &&
                  Array.isArray(detail?.items) &&
                  detail.items.some((it: any) => it?.product?.type === 'PHYSICAL') ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <div className="text-xs font-extrabold text-slate-900">Tandai Dikirim</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-extrabold text-slate-700">Kurir</label>
                          <input
                            value={shipCourier}
                            onChange={(e) => setShipCourier(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="Contoh: JNE"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-extrabold text-slate-700">Nomor Resi</label>
                          <input
                            value={shipTracking}
                            onChange={(e) => setShipTracking(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="Masukkan resi"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={ship}
                          disabled={shipLoading}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                        >
                          Tandai Dikirim
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-slate-600">Tidak ada data.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={reauthOpen}
        onClose={closeReauth}
        onConfirm={confirmReauth}
        title="Konfirmasi Password"
        variant="warning"
        confirmText="Konfirmasi"
        cancelText="Batal"
        isLoading={reauthLoading}
        content={
          <div className="space-y-3">
            <div>Masukkan password Super Admin untuk melanjutkan.</div>
            <input
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Password"
            />
          </div>
        }
      />
    </div>
  );
}
