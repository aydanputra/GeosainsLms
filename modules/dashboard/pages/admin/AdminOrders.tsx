"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import { Search, Filter, Eye, ShoppingCart } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

interface AdminOrdersProps {
  orders: any[];
}

export default function AdminOrders({ orders: initialOrders }: AdminOrdersProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'PENDING' | 'SHIPPED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewLoading, setReviewLoading] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [shipCourier, setShipCourier] = useState('');
  const [shipTracking, setShipTracking] = useState('');
  const [shipLoading, setShipLoading] = useState(false);
  const [opsNote, setOpsNote] = useState('');
  const [serviceOpsLoadingId, setServiceOpsLoadingId] = useState<string | null>(null);
  const [rentalOpsLoadingId, setRentalOpsLoadingId] = useState<string | null>(null);

  const openDetail = async (orderId: string) => {
    if (!orderId) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setReviewNote('');
    setShipCourier('');
    setShipTracking('');
    setOpsNote('');
    try {
      const res = await fetch(`/api/dashboard/admin/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat detail pesanan');
      setDetail(data);
      const note = typeof data?.manualPaymentNote === 'string' ? data.manualPaymentNote : '';
      setReviewNote(note);
      setShipCourier(typeof data?.shippingCourier === 'string' ? data.shippingCourier : '');
      setShipTracking(typeof data?.shippingTrackingNumber === 'string' ? data.shippingTrackingNumber : '');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat detail pesanan');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const review = async (action: 'APPROVE' | 'REJECT') => {
    const orderId = typeof detail?.id === 'string' ? detail.id : '';
    if (!orderId) return;
    setReviewLoading(action);
    try {
      const res = await fetch(`/api/dashboard/admin/orders/${encodeURIComponent(orderId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: reviewNote.trim() ? reviewNote.trim() : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memproses pesanan');

      if (action === 'APPROVE') {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'PAID', manualPaymentStatus: 'APPROVED' } : o)));
        toast.success('Pembayaran dikonfirmasi');
      } else {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, manualPaymentStatus: 'REJECTED' } : o)));
        toast.success('Pembayaran ditolak');
      }
      setDetailOpen(false);
      setDetail(null);
      setReviewNote('');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memproses pesanan');
    } finally {
      setReviewLoading(null);
    }
  };

  const ship = async () => {
    const orderId = typeof detail?.id === 'string' ? detail.id : '';
    if (!orderId) return;
    const courier = shipCourier.trim();
    const trackingNumber = shipTracking.trim();
    if (!courier) {
      toast.error('Kurir wajib diisi');
      return;
    }
    if (!trackingNumber) {
      toast.error('Nomor resi wajib diisi');
      return;
    }
    setShipLoading(true);
    try {
      const res = await fetch(`/api/dashboard/admin/orders/${encodeURIComponent(orderId)}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier, trackingNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal mengirim pesanan');
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'SHIPPED' } : o)));
      toast.success('Pesanan ditandai sebagai DIKIRIM');
      setDetailOpen(false);
      setDetail(null);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengirim pesanan');
    } finally {
      setShipLoading(false);
    }
  };

  const serviceOps = async (bookingId: string, action: 'CONFIRM' | 'START' | 'COMPLETE' | 'CANCEL') => {
    if (!bookingId) return;
    setServiceOpsLoadingId(bookingId);
    try {
      const res = await fetch(`/api/dashboard/admin/service-bookings/${encodeURIComponent(bookingId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: opsNote.trim() ? opsNote.trim() : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal update jasa');
      const updated = data?.booking;
      if (updated && detail) {
        setDetail((prev: any) => {
          if (!prev) return prev;
          const items = Array.isArray(prev.items)
            ? prev.items.map((it: any) =>
                it?.serviceBooking?.id === bookingId ? { ...it, serviceBooking: { ...it.serviceBooking, ...updated } } : it
              )
            : prev.items;
          return { ...prev, items };
        });
      }
      toast.success('Status jasa diperbarui');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal update jasa');
    } finally {
      setServiceOpsLoadingId(null);
    }
  };

  const rentalOps = async (reservationId: string, action: 'APPROVE' | 'START' | 'RETURN' | 'CANCEL') => {
    if (!reservationId) return;
    setRentalOpsLoadingId(reservationId);
    try {
      const res = await fetch(`/api/dashboard/admin/rental-reservations/${encodeURIComponent(reservationId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: opsNote.trim() ? opsNote.trim() : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal update sewa');
      const updated = data?.reservation;
      if (updated && detail) {
        setDetail((prev: any) => {
          if (!prev) return prev;
          const items = Array.isArray(prev.items)
            ? prev.items.map((it: any) =>
                it?.rentalReservation?.id === reservationId ? { ...it, rentalReservation: { ...it.rentalReservation, ...updated } } : it
              )
            : prev.items;
          return { ...prev, items };
        });
      }
      toast.success('Status sewa diperbarui');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal update sewa');
    } finally {
      setRentalOpsLoadingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'ALL' ? true : order.status === filterStatus;
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const metrics = [
    { label: 'Total Pesanan', value: orders.length, color: 'bg-blue-500' },
    { label: 'Lunas', value: orders.filter(o => o.status === 'PAID').length, color: 'bg-green-500' },
    { label: 'Menunggu', value: orders.filter(o => o.status === 'PENDING').length, color: 'bg-yellow-500' },
    { label: 'Dikirim', value: orders.filter(o => o.status === 'SHIPPED').length, color: 'bg-indigo-500' },
  ];

  const columns = [
    { header: 'ID Pesanan', accessorKey: 'id',
      cell: (val: string) => <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{val.substring(0, 8)}...</span>
    },
    { header: 'Pembeli', accessorKey: 'userName',
      cell: (val: string) => <div className="font-medium text-slate-900">{val}</div>
    },
    { header: 'Produk', accessorKey: 'productCount',
      cell: (val: number) => <div className="text-sm text-slate-600">{val} Item</div>
    },
    { header: 'Total', accessorKey: 'total', cell: (val: number) => <span className="font-medium text-slate-900">IDR {val.toLocaleString('id-ID')}</span> },
    { header: 'Status', accessorKey: 'status', 
      cell: (val: string, row: any) => {
        const statusText = val === 'PAID' ? 'LUNAS' : val === 'PENDING' ? 'MENUNGGU' : val === 'SHIPPED' ? 'DIKIRIM' : val;
        const proofStatus = typeof row?.manualPaymentStatus === 'string' ? row.manualPaymentStatus : 'NONE';
        const proofBadge =
          val === 'PENDING' && proofStatus === 'SUBMITTED'
            ? { text: 'BUKTI MASUK', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
            : val === 'PENDING' && proofStatus === 'REJECTED'
              ? { text: 'DITOLAK', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
              : null;

        return (
          <div className="flex items-center gap-2">
            <span className={twMerge(
              "px-3 py-1 rounded-full text-xs font-medium border",
              val === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : 
              val === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
              val === 'SHIPPED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
              'bg-slate-100 text-slate-600 border-slate-200'
            )}>
              {statusText}
            </span>
            {proofBadge ? (
              <span className={twMerge("px-2 py-1 rounded-full text-[10px] font-extrabold border", proofBadge.cls)}>
                {proofBadge.text}
              </span>
            ) : null}
          </div>
        );
      } 
    },
    { header: 'Aksi', accessorKey: 'id',
      cell: (val: string) => (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => openDetail(val)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Lihat"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Pesanan</h1>
        <p className="text-slate-500 text-sm mt-1">Pantau dan kelola semua transaksi pesanan.</p>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      {/* Search & Filter Bar - Floating Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Cari ID atau nama pembeli..." 
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
              <Filter className="w-4 h-4 text-slate-500" />
              <select 
                className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="ALL">Semua Status</option>
                <option value="PAID">Lunas</option>
                <option value="PENDING">Menunggu</option>
                <option value="SHIPPED">Dikirim</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
            </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        {filteredOrders.length > 0 ? (
          <Table 
            columns={columns} 
            data={filteredOrders} 
            isLoading={false}
          />
        ) : (
          <EmptyState 
            icon={ShoppingCart} 
            title="Tidak ada pesanan ditemukan" 
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : "Belum ada pesanan masuk."}
          />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredOrders.length === 0 ? (
          <EmptyState 
            icon={ShoppingCart} 
            title="Tidak ada pesanan" 
            description="Belum ada data pesanan untuk ditampilkan."
          />
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                   <div className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg inline-block mb-2">
                    {order.id.substring(0, 8)}...
                   </div>
                   <h3 className="font-semibold text-slate-900">{order.userName}</h3>
                </div>
                <span className={twMerge(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap",
                  order.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : 
                  order.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                  'bg-slate-100 text-slate-600 border-slate-200'
                )}>
                  {order.status === 'PAID' ? 'LUNAS' : order.status === 'PENDING' ? 'MENUNGGU' : order.status}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>{order.productCount} Item</span>
                <span className="font-medium text-slate-900">IDR {order.total.toLocaleString('id-ID')}</span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                {order.status === 'PENDING' && order.manualPaymentStatus === 'SUBMITTED' ? (
                  <button
                    type="button"
                    onClick={() => openDetail(order.id)}
                    className={twMerge(
                      "text-xs font-extrabold px-3 py-1.5 rounded-lg transition-colors",
                      'text-emerald-700 hover:bg-emerald-50'
                    )}
                  >
                    Verifikasi Bukti
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openDetail(order.id)}
                  className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Lihat Detail
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDetailOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-slate-900">Detail Pesanan</div>
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
          {detail?.status === 'SHIPPED' ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Pesanan sudah dikirim.
            </div>
          ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-extrabold text-slate-700">Pembeli</div>
                      <div className="text-sm text-slate-800 mt-1 font-semibold">
                        {detail?.user?.name || detail?.user?.email || '-'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{detail?.user?.email || ''}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-extrabold text-slate-700">Total</div>
                      <div className="text-sm text-slate-900 mt-1 font-extrabold">
                        IDR {Number(detail?.total || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Status: {detail?.status === 'PAID' ? 'LUNAS' : detail?.status === 'PENDING' ? 'MENUNGGU' : String(detail?.status || '-')}
                      </div>
                    </div>
                  </div>

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
                    {detail?.shippingCourier ? `${detail.shippingCourier} - ` : ''}{detail?.shippingTrackingNumber || '-'}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-extrabold text-slate-900">Item</div>
                    <div className="mt-2 space-y-2">
                      {Array.isArray(detail?.items) && detail.items.length ? (
                        detail.items.map((it: any) => {
                          const name = it?.product?.name || it?.course?.title || it?.productId || it?.courseId || '-';
                          const qty = Number(it?.quantity || 0);
                          const price = Number(it?.price || 0);
                          const type = it?.product?.type;
                          const serviceStart = it?.serviceBooking?.scheduledStart || it?.meta?.service?.start || '';
                          const serviceEnd = it?.serviceBooking?.scheduledEnd || it?.meta?.service?.end || '';
                          const rentalStart = it?.rentalReservation?.startDate || it?.meta?.rental?.start || '';
                          const rentalEnd = it?.rentalReservation?.endDate || it?.meta?.rental?.end || '';
                          const rentalPickup = it?.rentalReservation?.pickupMethod || it?.meta?.rental?.pickupMethod || '';
                          const serviceStatus = it?.serviceBooking?.status;
                          const rentalStatus = it?.rentalReservation?.status;
                          return (
                            <div key={String(it.id)} className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 truncate">{name}</div>
                                <div className="text-xs text-slate-500">
                                  {(type === 'SERVICE' ? 'Jasa' : type === 'RENTAL' ? 'Sewa' : type === 'PHYSICAL' ? 'Produk' : it?.courseId ? 'Kursus' : '-')}{' '}
                                  • Qty {qty}
                                  {type === 'SERVICE' && serviceStart && serviceEnd ? ` • ${serviceStart} → ${serviceEnd}` : ''}
                                  {type === 'RENTAL' && rentalStart && rentalEnd ? ` • ${rentalStart} → ${rentalEnd}${rentalPickup ? ` • ${rentalPickup}` : ''}` : ''}
                                </div>
                                {type === 'SERVICE' && it?.serviceBooking?.id ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="px-2 py-1 rounded-lg text-[11px] font-extrabold border bg-slate-50 text-slate-700 border-slate-200">
                                      {serviceStatus}
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={serviceOpsLoadingId === it.serviceBooking.id}
                                        onClick={() => serviceOps(String(it.serviceBooking.id), 'CONFIRM')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        disabled={serviceOpsLoadingId === it.serviceBooking.id}
                                        onClick={() => serviceOps(String(it.serviceBooking.id), 'START')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                      >
                                        Start
                                      </button>
                                      <button
                                        type="button"
                                        disabled={serviceOpsLoadingId === it.serviceBooking.id}
                                        onClick={() => serviceOps(String(it.serviceBooking.id), 'COMPLETE')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                      >
                                        Complete
                                      </button>
                                      <button
                                        type="button"
                                        disabled={serviceOpsLoadingId === it.serviceBooking.id}
                                        onClick={() => serviceOps(String(it.serviceBooking.id), 'CANCEL')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                {type === 'RENTAL' && it?.rentalReservation?.id ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="px-2 py-1 rounded-lg text-[11px] font-extrabold border bg-slate-50 text-slate-700 border-slate-200">
                                      {rentalStatus}
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={rentalOpsLoadingId === it.rentalReservation.id}
                                        onClick={() => rentalOps(String(it.rentalReservation.id), 'APPROVE')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rentalOpsLoadingId === it.rentalReservation.id}
                                        onClick={() => rentalOps(String(it.rentalReservation.id), 'START')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                      >
                                        Start
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rentalOpsLoadingId === it.rentalReservation.id}
                                        onClick={() => rentalOps(String(it.rentalReservation.id), 'RETURN')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                      >
                                        Return
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rentalOpsLoadingId === it.rentalReservation.id}
                                        onClick={() => rentalOps(String(it.rentalReservation.id), 'CANCEL')}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              <div className="font-extrabold text-slate-900">IDR {(price * qty).toLocaleString('id-ID')}</div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-sm text-slate-500">Tidak ada item.</div>
                      )}
                    </div>
                  </div>

                  {Array.isArray(detail?.items) && detail.items.some((it: any) => it?.serviceBooking?.id || it?.rentalReservation?.id) ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                      <div className="text-xs font-extrabold text-slate-900">Catatan Operasional (opsional)</div>
                      <textarea
                        value={opsNote}
                        onChange={(e) => setOpsNote(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                        placeholder="Catatan untuk customer terkait update status jasa/sewa…"
                        disabled={Boolean(serviceOpsLoadingId || rentalOpsLoadingId)}
                      />
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">Bukti Pembayaran</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {detail?.manualPaymentStatus === 'SUBMITTED'
                          ? 'Bukti sudah dikirim, siap direview.'
                          : detail?.manualPaymentStatus === 'REJECTED'
                            ? 'Bukti pernah ditolak.'
                            : detail?.manualPaymentStatus === 'APPROVED'
                              ? 'Pembayaran sudah dikonfirmasi.'
                              : 'Belum ada bukti.'}
                      </div>
                    </div>

                    {typeof detail?.manualPaymentProofUrl === 'string' && detail.manualPaymentProofUrl.trim() ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <a
                          href={detail.manualPaymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-bold text-indigo-700 hover:text-indigo-900 break-all"
                        >
                          {detail.manualPaymentProofUrl}
                        </a>
                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 bg-white">
                          <img src={detail.manualPaymentProofUrl} alt="Bukti pembayaran" className="w-full h-auto max-h-72 object-contain" />
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <div className="text-xs font-extrabold text-slate-700">Catatan Admin (opsional)</div>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                        placeholder="Contoh: Bukti belum jelas, mohon kirim ulang..."
                        disabled={reviewLoading !== null}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {detail?.status === 'PENDING' && detail?.manualPaymentStatus === 'SUBMITTED' ? (
                        <>
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
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Konfirmasi
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

          {detail?.status === 'PAID' &&
          Array.isArray(detail?.items) &&
          detail.items.some((it: any) => it?.productId && it?.product?.type === 'PHYSICAL') ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-xs font-extrabold text-slate-900">Kirim Pesanan</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-extrabold text-slate-700">Kurir</div>
                  <input
                    value={shipCourier}
                    onChange={(e) => setShipCourier(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                    placeholder="JNE / J&T / SiCepat / dll"
                    disabled={shipLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-extrabold text-slate-700">Nomor Resi</div>
                  <input
                    value={shipTracking}
                    onChange={(e) => setShipTracking(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
                    placeholder="Nomor resi"
                    disabled={shipLoading}
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
    </div>
  );
}
