"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PendingPaymentAutoSyncClient, StudentOrderActionsMenu } from './payment-proof-client';

type StudentOrdersClientProps = {
  orders: any[];
  contactEmail: string;
  initialStatus?: string;
  initialQuery?: string;
  highlightId?: string;
};

type OrderStatus = 'ALL' | 'PENDING' | 'PAID' | 'CANCELLED' | 'SHIPPED';

function normalizeStatus(value: unknown): OrderStatus {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return raw === 'PENDING' || raw === 'PAID' || raw === 'CANCELLED' || raw === 'SHIPPED' ? raw : 'ALL';
}

function buildOrdersUrl(status: OrderStatus, query: string, orderId: string) {
  const params = new URLSearchParams();
  if (status !== 'ALL') params.set('status', status);
  if (query.trim()) params.set('q', query.trim());
  if (orderId.trim()) params.set('orderId', orderId.trim());
  const qs = params.toString();
  return qs ? `/dashboard/student/orders?${qs}` : '/dashboard/student/orders';
}

export default function StudentOrdersClient({
  orders,
  contactEmail,
  initialStatus = 'ALL',
  initialQuery = '',
  highlightId = '',
}: StudentOrdersClientProps) {
  const [status, setStatus] = useState<OrderStatus>(normalizeStatus(initialStatus));
  const [query, setQuery] = useState(initialQuery);
  const [currentHighlightId, setCurrentHighlightId] = useState(highlightId);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    setStatus(normalizeStatus(initialStatus));
  }, [initialStatus]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setCurrentHighlightId(highlightId);
  }, [highlightId]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setStatus(normalizeStatus(params.get('status')));
      setQuery(params.get('q') || '');
      setCurrentHighlightId(params.get('orderId') || '');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const updateUrl = (nextStatus: OrderStatus, nextQuery: string, nextHighlightId = currentHighlightId) => {
    const nextUrl = buildOrdersUrl(nextStatus, nextQuery, nextHighlightId);
    window.history.replaceState(window.history.state, '', nextUrl);
  };

  const handleTabChange = (nextStatus: OrderStatus) => {
    setStatus(nextStatus);
    updateUrl(nextStatus, query);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateUrl(status, query);
  };

  const q = query.trim().toLowerCase();

  const hasManualPending = useMemo(
    () => orders.some((o: any) => String(o?.status || '').toUpperCase() === 'PENDING' && !o?.payment?.paymentUrl),
    [orders]
  );

  const pendingOnlinePayments = useMemo(
    () =>
      orders
        .filter(
          (o: any) =>
            String(o?.status || '').toUpperCase() === 'PENDING' &&
            String(o?.payment?.status || '').toUpperCase() === 'PENDING' &&
            Boolean(o?.payment?.paymentUrl)
        )
        .map((o: any) => ({
          orderId: String(o.id),
          externalId: typeof o?.payment?.externalId === 'string' ? String(o.payment.externalId) : null,
        })),
    [orders]
  );

  const filteredOrders = useMemo(
    () =>
      orders
        .filter((o: any) => (status === 'ALL' ? true : String(o?.status || '').toUpperCase() === status))
        .filter((o: any) => {
          if (!q) return true;
          const id = String(o?.id || '').toLowerCase();
          if (id.includes(q)) return true;
          const items = Array.isArray(o?.items) ? o.items : [];
          return items.some((it: any) => {
            const courseTitle = typeof it?.course?.title === 'string' ? it.course.title : '';
            const productName = typeof it?.product?.name === 'string' ? it.product.name : '';
            return String(courseTitle).toLowerCase().includes(q) || String(productName).toLowerCase().includes(q);
          });
        }),
    [orders, q, status]
  );

  return (
    <div className="space-y-6 pb-12">
      <PendingPaymentAutoSyncClient payments={pendingOnlinePayments} />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Riwayat Pembelian</h1>
          <p className="text-slate-500 text-sm mt-1">
            Semua transaksi pembelian kursus dan produk Anda.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Link
            href="/courses"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50"
          >
            Beli Kursus
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
          >
            Belanja Produk
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="grid grid-cols-2 sm:flex gap-2">
            {(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'PENDING', label: 'Menunggu' },
                { id: 'PAID', label: 'Lunas' },
                { id: 'CANCELLED', label: 'Dibatalkan' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id)}
                className={[
                  'inline-flex items-center justify-center px-3 py-2 rounded-2xl text-xs font-extrabold border transition-colors',
                  status === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="w-full sm:w-80">
            <input
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari ID pesanan / kursus / produk…"
              className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </form>
        </div>
        <div className="text-xs text-slate-500">
          Menampilkan <span className="font-extrabold text-slate-900">{filteredOrders.length}</span> dari{' '}
          <span className="font-extrabold text-slate-900">{orders.length}</span> transaksi.
        </div>
      </div>

      {hasManualPending ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-sm font-extrabold text-slate-900">Pembayaran Manual</div>
          <div className="text-sm text-slate-600 mt-1">
            Cantumkan ID pesanan saat mengirim bukti pembayaran. {contactEmail ? `Kontak admin: ${contactEmail}` : 'Kontak admin bisa Anda lihat di halaman pengaturan situs.'}
          </div>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-600">
          Belum ada riwayat pembelian.
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl p-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-600">
              Tidak ada transaksi yang cocok dengan filter/pencarian.
            </div>
          ) : (
            <div className="w-full overflow-x-auto pb-4">
              <table className="w-full border-separate border-spacing-y-3 px-1">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-900 to-blue-600 rounded-2xl shadow-sm">
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider rounded-l-2xl whitespace-nowrap">Tanggal</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Order</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Item</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Pembayaran</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider rounded-r-2xl whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="space-y-4">
                  {filteredOrders.map((order: any) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const itemCount = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
                    const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
                    const createdAtLabel = createdAt && !Number.isNaN(createdAt.getTime())
                      ? createdAt.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '-';
                    const isHighlight = currentHighlightId && String(order.id) === currentHighlightId;
                    const orderCode = String(order.id).slice(0, 8).toUpperCase();

                    const statusLabel =
                      order.status === 'PAID' ? 'LUNAS' : order.status === 'PENDING' ? 'MENUNGGU' : order.status === 'SHIPPED' ? 'DIKIRIM' : order.status === 'CANCELLED' ? 'DIBATALKAN' : order.status;
                    const statusClass =
                      order.status === 'PAID'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : order.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : order.status === 'SHIPPED'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : order.status === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200';

                    const dueAt = order?.paymentDueAt ? new Date(order.paymentDueAt) : null;
                    const isExpired = Boolean(dueAt && !Number.isNaN(dueAt.getTime()) && nowMs > dueAt.getTime());
                    const dueLabel =
                      dueAt && !Number.isNaN(dueAt.getTime())
                        ? dueAt.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '-';

                    const paymentStatus = String(order?.payment?.status || '').toUpperCase();
                    const paymentProvider = String(order?.payment?.provider || '').toUpperCase();
                    const paymentUrl = typeof order?.payment?.paymentUrl === 'string' ? String(order.payment.paymentUrl) : null;
                    const paymentExternalId = typeof order?.payment?.externalId === 'string' ? String(order.payment.externalId) : null;

                    const courseItems = items.filter((it: any) => it.courseId);
                    const productItems = items.filter((it: any) => it.productId);
                    const courseNames = courseItems.map((it: any) => (it.course?.title ? String(it.course.title) : String(it.courseId))).filter(Boolean);
                    const productNames = productItems.map((it: any) => (it.product?.name ? String(it.product.name) : String(it.productId))).filter(Boolean);
                    const allNames = [...courseNames, ...productNames];
                    const displayNames = allNames.slice(0, 2).join(', ');
                    const extraCount = Math.max(0, allNames.length - 2);
                    const summaryParts: string[] = [];
                    if (courseItems.length) summaryParts.push(`${courseItems.length} kursus`);
                    if (productItems.length) summaryParts.push(`${productItems.length} produk`);
                    if (!summaryParts.length) summaryParts.push(`${itemCount} item`);
                    const summaryLine = summaryParts.join(' • ');

                    const paymentLabel = paymentUrl ? (paymentProvider || 'ONLINE') : 'MANUAL';
                    const manualStatus = String(order.manualPaymentStatus || '').toUpperCase();
                    const manualLabel =
                      manualStatus === 'APPROVED'
                        ? 'Disetujui'
                        : manualStatus === 'SUBMITTED'
                          ? 'Menunggu Verifikasi'
                          : manualStatus === 'REJECTED'
                            ? 'Ditolak'
                            : 'Belum Upload';

                    const firstCourse = courseItems.length ? courseItems[0]?.course : null;
                    const firstProduct = !firstCourse && productItems.length ? productItems[0]?.product : null;
                    const couponCode = typeof order?.coupon?.code === 'string' && order.coupon.code.trim() ? order.coupon.code.trim() : null;

                    return (
                      <tr
                        key={String(order.id)}
                        className={[
                          'group bg-white hover:bg-indigo-50/30 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 rounded-2xl',
                          isHighlight ? 'ring-2 ring-indigo-100' : '',
                        ].join(' ')}
                      >
                        <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-l border-slate-100 first:rounded-l-2xl group-hover:border-indigo-100/50 transition-colors whitespace-nowrap">
                          <div className="text-slate-700 font-semibold">{createdAtLabel}</div>
                          {order.status === 'PENDING' ? <div className="text-xs text-slate-500 mt-1">Batas: {dueLabel}</div> : null}
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 group-hover:border-indigo-100/50 transition-colors">
                          <div className="font-extrabold text-indigo-600 font-mono text-xs" title={String(order.id)}>{orderCode}</div>
                          <div className="text-xs text-slate-500 mt-1">{summaryLine}</div>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 group-hover:border-indigo-100/50 transition-colors min-w-[260px]">
                          <div className="font-semibold text-slate-900 line-clamp-2">{displayNames || '-'}</div>
                          {extraCount > 0 ? <div className="text-xs text-slate-500 mt-1">+{extraCount} lainnya</div> : null}
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 group-hover:border-indigo-100/50 transition-colors whitespace-nowrap">
                          <span className="font-extrabold text-slate-900">IDR {Number(order.total || 0).toLocaleString('id-ID')}</span>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 group-hover:border-indigo-100/50 transition-colors whitespace-nowrap">
                          <span className={['px-3 py-1 rounded-full text-xs font-extrabold border', statusClass].join(' ')}>{statusLabel}</span>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 group-hover:border-indigo-100/50 transition-colors whitespace-nowrap">
                          <div className="font-extrabold text-slate-900">{paymentLabel}</div>
                          {paymentUrl ? (
                            <div className="text-xs text-slate-500 mt-1">{paymentStatus || 'PENDING'}</div>
                          ) : (
                            <div className="text-xs text-slate-500 mt-1">{manualLabel}</div>
                          )}
                          {order.status === 'PENDING' && isExpired ? <div className="text-xs text-rose-600 mt-1 font-extrabold">Kadaluarsa</div> : null}
                        </td>
                        <td className="px-6 py-5 text-right border-t border-b border-r border-slate-100 rounded-r-2xl group-hover:border-indigo-100/50 transition-colors">
                          <StudentOrderActionsMenu
                            contactEmail={contactEmail}
                            order={{
                              id: String(order.id),
                              status: String(order.status || ''),
                              createdAtLabel,
                              dueLabel: String(order.status || '').toUpperCase() === 'PENDING' ? dueLabel : null,
                              isExpired,
                              total: Number(order.total || 0),
                              subtotal: Number(order.subtotal || 0),
                              couponCode,
                              payment: order.payment
                                ? {
                                    provider: typeof order.payment.provider === 'string' ? order.payment.provider : null,
                                    status: typeof order.payment.status === 'string' ? order.payment.status : null,
                                    paymentUrl,
                                    externalId: paymentExternalId,
                                  }
                                : null,
                              manualPaymentStatus: typeof order.manualPaymentStatus === 'string' ? order.manualPaymentStatus : null,
                              manualPaymentProofUrl: typeof order.manualPaymentProofUrl === 'string' ? order.manualPaymentProofUrl : null,
                              manualPaymentNote: typeof order.manualPaymentNote === 'string' ? order.manualPaymentNote : null,
                              course: firstCourse
                                ? {
                                    title: String(firstCourse.title || ''),
                                    thumbnailUrl: typeof firstCourse.thumbnailUrl === 'string' ? firstCourse.thumbnailUrl : null,
                                    price: Number(firstCourse.price || 0),
                                  }
                                : null,
                              product: firstProduct
                                ? {
                                    name: String(firstProduct.name || ''),
                                    imageUrl: typeof firstProduct.imageUrl === 'string' ? firstProduct.imageUrl : null,
                                    price: Number(firstProduct.price || 0),
                                  }
                                : null,
                              itemSummary: summaryLine,
                              courseSlug: firstCourse && typeof firstCourse.slug === 'string' ? String(firstCourse.slug) : null,
                            } as any}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
