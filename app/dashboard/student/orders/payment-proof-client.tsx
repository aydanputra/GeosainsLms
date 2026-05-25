"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, Upload, X, MoreVertical, FileText, ExternalLink, RefreshCw, Ban, LogIn, Download } from 'lucide-react';
import { createPortal } from 'react-dom';

type Props = {
  orderId: string;
  currentStatus: string;
  proofUrl: string | null;
  triggerLabel?: string;
  triggerClassName?: string;
  onTrigger?: () => void;
};

export default function PaymentProofClient({ orderId, currentStatus, proofUrl, triggerLabel, triggerClassName, onTrigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const canSubmit = useMemo(() => currentStatus !== 'APPROVED', [currentStatus]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const maxBytes = 10 * 1024 * 1024;

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = () => {
    if (loading) return;
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    if (loading) return;
    setFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setSelectedFile = (next: File | null) => {
    if (!next) {
      clearFile();
      return;
    }
    if (!next.type?.startsWith('image/')) {
      setFile(null);
      setFileError('File harus berupa gambar.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (next.size > maxBytes) {
      setFile(null);
      setFileError('Ukuran file melebihi 10MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFileError('');
    setFile(next);
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt', `Bukti pembayaran order ${orderId}`);

      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: fd });
      const uploaded = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploaded?.error || 'Gagal upload bukti');

      const attachRes = await fetch(`/api/shop/orders/${encodeURIComponent(orderId)}/payment-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: String(uploaded.id),
          note: note.trim() ? note.trim() : null,
        }),
      });
      const attached = await attachRes.json().catch(() => ({}));
      if (!attachRes.ok) throw new Error(attached?.error || 'Gagal menyimpan bukti');

      setOpen(false);
      setFile(null);
      setNote('');
      router.refresh();
    } catch (e: any) {
      alert(e?.message || 'Gagal mengirim bukti');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!canSubmit) return;
          try {
            onTrigger?.();
          } catch {
          }
          setOpen(true);
        }}
        disabled={!canSubmit}
        className={
          triggerClassName
            ? triggerClassName
            : [
                'inline-flex w-full sm:w-auto items-center justify-center px-4 py-2.5 rounded-xl text-sm font-extrabold transition-colors',
                canSubmit ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400',
              ].join(' ')
        }
      >
        {typeof triggerLabel === 'string' && triggerLabel.trim() ? triggerLabel.trim() : proofUrl ? 'Lihat / Kirim Ulang' : 'Upload Bukti'}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => (loading ? null : setOpen(false))}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-extrabold text-slate-900">Bukti Pembayaran</div>
                <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  Cantumkan ID pesanan saat transfer. Maksimal 10MB.
                </div>
              </div>
              <button
                type="button"
                onClick={() => (loading ? null : setOpen(false))}
                className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 sm:px-5 py-4 space-y-4 max-h-[70vh] sm:max-h-[75vh] overflow-auto">
              {proofUrl ? (
                <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer select-none list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-extrabold text-slate-800">Bukti terakhir</div>
                        <div className="text-[11px] text-slate-500">Ketuk untuk lihat</div>
                      </div>
                      <a
                        href={proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-extrabold text-indigo-700 hover:text-indigo-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Buka
                      </a>
                    </div>
                  </summary>
                  <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-white">
                    <img src={proofUrl} alt="Bukti pembayaran" className="w-full h-auto max-h-72 object-contain" />
                  </div>
                </details>
              ) : null}

              <div className="space-y-1.5">
                <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">File bukti</div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={pickFile}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), pickFile()) : null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (loading) return;
                    const dropped = e.dataTransfer.files?.[0] || null;
                    setSelectedFile(dropped);
                  }}
                  className={[
                    'w-full rounded-2xl border px-4 py-3 transition-colors outline-none',
                    file ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50 hover:bg-white',
                    loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-500">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 truncate" title={file ? file.name : undefined}>
                            {file ? file.name : 'Pilih file bukti pembayaran'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'Ketuk untuk pilih atau drag & drop'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {file ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            clearFile();
                          }}
                          disabled={loading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60"
                        >
                          <X className="w-4 h-4" />
                          Hapus
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          pickFile();
                        }}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 disabled:opacity-60"
                      >
                        <Upload className="w-4 h-4" />
                        {file ? 'Ganti File' : 'Upload File'}
                      </button>
                    </div>
                  </div>
                </div>

                {filePreviewUrl ? (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                    <img src={filePreviewUrl} alt="Preview bukti pembayaran" className="w-full h-auto max-h-80 object-contain" />
                  </div>
                ) : null}

                {fileError ? <div className="text-[11px] font-semibold text-rose-600">{fileError}</div> : null}
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">Catatan (opsional)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 bg-white text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                  placeholder="Contoh: Transfer via BCA a.n. ..., tanggal/jam ..."
                  disabled={loading}
                />
              </div>
            </div>

            <div className="px-4 sm:px-5 py-4 border-t border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => (loading ? null : setOpen(false))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60"
                  disabled={loading}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !file}
                  className="w-full px-4 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? 'Mengirim...' : 'Kirim'}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Dengan mengirim bukti, status akan menjadi “menunggu verifikasi”.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function OrderActionsClient({
  orderId,
  orderStatus,
  paymentUrl,
  paymentExternalId,
  paymentStatus,
  canCreatePayment,
  canCancel,
  isExpired,
}: {
  orderId: string;
  orderStatus: string;
  paymentUrl: string | null;
  paymentExternalId: string | null;
  paymentStatus: string;
  canCreatePayment: boolean;
  canCancel: boolean;
  isExpired: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isPendingOrder = String(orderStatus || '').toUpperCase() === 'PENDING';

  const pay = async () => {
    if (loading) return;
    if (!isPendingOrder) return;
    if (isExpired) {
      alert('Pesanan sudah melewati batas waktu pembayaran. Silakan batalkan pesanan dan buat pesanan baru.');
      return;
    }
    if (paymentUrl) {
      window.location.assign(paymentUrl);
      return;
    }
    if (!canCreatePayment) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Gagal membuat pembayaran');
      const url = typeof body?.paymentUrl === 'string' ? body.paymentUrl : '';
      if (!url) throw new Error('Link pembayaran tidak tersedia');
      window.location.assign(url);
    } catch (e: any) {
      alert(e?.message || 'Gagal memproses pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    if (loading) return;
    if (!isPendingOrder) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payment/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, externalId: paymentExternalId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Gagal mengecek status pembayaran');
      const inv = String(body?.invoiceStatus || '').toUpperCase();
      if (inv === 'PAID' || inv === 'SETTLED') {
        router.refresh();
        return;
      }
      alert(inv ? `Status invoice: ${inv}` : 'Pembayaran masih diproses. Silakan coba lagi sebentar.');
      router.refresh();
    } catch (e: any) {
      alert(e?.message || 'Gagal mengecek status pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (loading) return;
    if (!isPendingOrder) return;
    if (!canCancel) return;
    const ok = window.confirm('Batalkan pesanan ini?');
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shop/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Gagal membatalkan pesanan');
      router.refresh();
    } catch (e: any) {
      alert(e?.message || 'Gagal membatalkan pesanan');
    } finally {
      setLoading(false);
    }
  };

  if (!isPendingOrder) return null;
  if (!paymentUrl && !canCreatePayment && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-end">
      {paymentUrl && String(paymentStatus || '').toUpperCase() === 'PENDING' ? (
        <button
          type="button"
          onClick={sync}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-extrabold transition-colors border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Perbarui Status
        </button>
      ) : null}
      {paymentUrl || canCreatePayment ? (
        <button
          type="button"
          onClick={pay}
          disabled={loading || isExpired}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-extrabold transition-colors bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {paymentUrl ? 'Lanjutkan Pembayaran' : 'Buat Pembayaran'}
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          onClick={cancel}
          disabled={loading}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-extrabold transition-colors border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Batalkan Pesanan
        </button>
      ) : null}
    </div>
  );
}

function formatIdr(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

function statusPill(status: string) {
  const s = String(status || '').toUpperCase();
  const label = s === 'PAID' ? 'Success' : s === 'PENDING' ? 'Pending' : s === 'CANCELLED' ? 'Cancelled' : s === 'SHIPPED' ? 'Shipped' : s || '-';
  const cls =
    s === 'PAID'
      ? 'bg-emerald-100 text-emerald-800'
      : s === 'PENDING'
        ? 'bg-amber-100 text-amber-800'
        : s === 'CANCELLED'
          ? 'bg-slate-200 text-slate-800'
          : 'bg-slate-200 text-slate-800';
  return <span className={['inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold', cls].join(' ')}>{label}</span>;
}

function downloadTransactionHtml(args: {
  title: string;
  code: string;
  fullId: string;
  paidAmount: number;
  status: string;
  method: string;
  promo: string;
  dateLabel: string;
}) {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Invoice ${args.code}</title></head><body style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; padding:24px; color:#0f172a;">
  <h2 style="margin:0 0 8px 0;">Invoice</h2>
  <div style="color:#64748b; font-size:12px; margin-bottom:16px;">Transaction ${args.code} • ${args.dateLabel}</div>
  <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
    <div style="font-weight:800; margin-bottom:8px;">${args.title}</div>
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr><td style="padding:6px 0; color:#64748b;">Kode Transaksi</td><td style="padding:6px 0; font-weight:800; text-align:right;">${args.code}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Order ID</td><td style="padding:6px 0; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; text-align:right;">${args.fullId}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Harga Dibayar</td><td style="padding:6px 0; font-weight:800; text-align:right;">${formatIdr(args.paidAmount)}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Status</td><td style="padding:6px 0; font-weight:800; text-align:right;">${args.status}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Jenis Transaksi</td><td style="padding:6px 0; font-weight:700; text-align:right;">${args.method}</td></tr>
      <tr><td style="padding:6px 0; color:#64748b;">Promo Code</td><td style="padding:6px 0; font-weight:700; text-align:right;">${args.promo}</td></tr>
    </table>
  </div></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${args.code}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function StudentOrderActionsMenu({
  order,
  contactEmail,
}: {
  order: {
    id: string;
    status: string;
    createdAtLabel: string;
    dueLabel: string | null;
    isExpired: boolean;
    total: number;
    subtotal: number;
    couponCode: string | null;
    payment: { provider: string | null; status: string | null; paymentUrl: string | null; externalId: string | null } | null;
    manualPaymentStatus: string | null;
    manualPaymentProofUrl: string | null;
    manualPaymentNote: string | null;
    course: { title: string; thumbnailUrl: string | null; price: number } | null;
    product: { name: string; imageUrl: string | null; price: number } | null;
    itemSummary: string;
    courseSlug: string | null;
  };
  contactEmail: string;
}) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailOpen]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current && menuRef.current.contains(t)) return;
      if (buttonRef.current && buttonRef.current.contains(t)) return;
      setOpenMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const update = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const width = 256;
      const pad = 8;
      const left = Math.max(pad, Math.min(window.innerWidth - width - pad, rect.right - width));
      const top = Math.min(window.innerHeight - pad, rect.bottom + pad);
      setMenuPos({ top, left, width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!openMenu) return;
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    if (rect.bottom > window.innerHeight - pad && buttonRef.current) {
      const btnRect = buttonRef.current.getBoundingClientRect();
      const nextTop = Math.max(pad, btnRect.top - rect.height - pad);
      setMenuPos((prev) => (prev ? { ...prev, top: nextTop } : prev));
    }
  }, [openMenu, menuPos?.top]);

  const orderStatus = String(order.status || '').toUpperCase();
  const paymentStatus = String(order.payment?.status || '').toUpperCase();
  const paymentProvider = String(order.payment?.provider || '').toUpperCase();
  const paymentUrl = order.payment?.paymentUrl ? String(order.payment.paymentUrl) : '';
  const isPending = orderStatus === 'PENDING';
  const isPaid = orderStatus === 'PAID';
  const isManual = !paymentUrl;
  const manualStatus = String(order.manualPaymentStatus || '').toUpperCase();
  const canCancel = isPending && !order.isExpired && paymentStatus !== 'SUCCESS' && manualStatus !== 'APPROVED';
  const canCreatePayment = isPending && !order.isExpired && paymentStatus !== 'SUCCESS' && !paymentUrl;
  const canSync = isPending && !order.isExpired && Boolean(paymentUrl) && paymentStatus === 'PENDING';

  const txCode = useMemo(() => String(order.id).slice(0, 8).toUpperCase(), [order.id]);
  const txMethod = paymentUrl ? (paymentProvider || 'ONLINE') : 'MANUAL';
  const promo = order.couponCode ? order.couponCode : 'Tidak menggunakan promo';
  const itemTitle = order.course?.title || order.product?.name || order.itemSummary || 'Transaksi';
  const itemBadge = order.course ? (order.total > 0 ? 'Premium' : 'Gratis') : order.product ? 'Produk' : order.total > 0 ? 'Premium' : 'Gratis';
  const imageUrl = order.course?.thumbnailUrl || order.product?.imageUrl || null;

  const pay = async () => {
    if (loading) return;
    if (!isPending) return;
    if (order.isExpired) {
      alert('Pesanan sudah melewati batas waktu pembayaran.');
      return;
    }
    if (paymentUrl) {
      window.location.assign(paymentUrl);
      return;
    }
    if (!canCreatePayment) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Gagal membuat pembayaran');
      const url = typeof body?.paymentUrl === 'string' ? body.paymentUrl : '';
      if (!url) throw new Error('Link pembayaran tidak tersedia');
      window.location.assign(url);
    } catch (e: any) {
      alert(e?.message || 'Gagal memproses pembayaran');
    } finally {
      setLoading(false);
      setOpenMenu(false);
    }
  };

  const sync = async () => {
    if (loading) return;
    if (!canSync) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payment/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, externalId: order.payment?.externalId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Gagal mengecek status pembayaran');
      const inv = String(body?.invoiceStatus || '').toUpperCase();
      if (inv === 'PAID' || inv === 'SETTLED') {
        router.refresh();
        setOpenMenu(false);
        return;
      }
      alert(inv ? `Status invoice: ${inv}` : 'Pembayaran masih diproses.');
      router.refresh();
      setOpenMenu(false);
    } catch (e: any) {
      alert(e?.message || 'Gagal mengecek status pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (loading) return;
    if (!canCancel) return;
    const ok = window.confirm('Batalkan pesanan ini?');
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shop/orders/${encodeURIComponent(order.id)}/cancel`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Gagal membatalkan pesanan');
      router.refresh();
      setOpenMenu(false);
    } catch (e: any) {
      alert(e?.message || 'Gagal membatalkan pesanan');
    } finally {
      setLoading(false);
    }
  };

  const goToCourse = () => {
    const slug = typeof order.courseSlug === 'string' ? order.courseSlug.trim() : '';
    if (slug) {
      router.push(`/courses/${encodeURIComponent(slug)}/learn`);
      return;
    }
    router.push('/dashboard/student/courses');
  };

  return (
    <>
      <div className="relative flex justify-end">
        <button
          type="button"
          onClick={() => setOpenMenu((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          aria-label="Aksi"
          ref={buttonRef}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {openMenu && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] w-64 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden"
              style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
            >
              <button
                type="button"
                onClick={() => {
                  setDetailOpen(true);
                  setOpenMenu(false);
                }}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-slate-500" /> Detail Transaksi
              </button>

              {isPending && paymentUrl ? (
                <button
                  type="button"
                  onClick={pay}
                  disabled={loading || order.isExpired}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-60"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" /> Lanjutkan Pembayaran
                </button>
              ) : null}

              {isPending && canCreatePayment ? (
                <button
                  type="button"
                  onClick={pay}
                  disabled={loading || order.isExpired}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-60"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" /> Buat Pembayaran
                </button>
              ) : null}

              {isPending && canSync ? (
                <button
                  type="button"
                  onClick={sync}
                  disabled={loading}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" /> Cek Status Pembayaran
                </button>
              ) : null}

              {isPending && isManual ? (
                <div className="px-2 py-2">
                  <PaymentProofClient
                    orderId={order.id}
                    currentStatus={String(order.manualPaymentStatus || 'NONE')}
                    proofUrl={order.manualPaymentProofUrl}
                    triggerLabel={order.manualPaymentProofUrl ? 'Lihat / Kirim Ulang Bukti' : 'Upload Bukti Pembayaran'}
                    triggerClassName="w-full px-4 py-3 rounded-xl text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 flex items-center gap-2"
                    onTrigger={() => setOpenMenu(false)}
                  />
                </div>
              ) : null}

              {canCancel ? (
                <button
                  type="button"
                  onClick={cancel}
                  disabled={loading}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 disabled:opacity-60"
                >
                  <Ban className="w-4 h-4" /> Batalkan Pesanan
                </button>
              ) : null}

              {isPaid ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(false);
                    goToCourse();
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-slate-500" /> Masuk Kelas
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}

      {detailOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setDetailOpen(false)}
            >
              <div
                className="w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 sm:px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl font-extrabold text-slate-900">Transaction Details</div>
                    <div className="text-sm text-slate-500 mt-1">Informasi transaksi {order.course ? 'kelas' : 'pesanan'}.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailOpen(false)}
                    className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    aria-label="Tutup"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-4 sm:px-6 py-5 space-y-5 max-h-[72vh] overflow-auto">
                  <div className="text-sm font-semibold text-slate-500">Informasi transaksi {order.course ? 'kelas' : 'pesanan'}</div>
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {imageUrl ? <img src={imageUrl} alt={itemTitle} className="w-full h-full object-cover" /> : <div className="w-6 h-6 rounded bg-slate-200" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-extrabold text-slate-900 line-clamp-2">{itemTitle}</div>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-extrabold">{itemBadge}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="text-lg font-extrabold text-slate-900">Detail Transaksi</div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">Kode Transaksi</div>
                        <div className="font-extrabold text-slate-900">{txCode}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">Harga {order.course ? 'Kelas' : 'Barang'}</div>
                        <div className="font-semibold text-slate-900">{formatIdr(order.subtotal)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">Harga Dibayar</div>
                        <div className="font-extrabold text-slate-900">{formatIdr(order.total)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">Status</div>
                        <div>{statusPill(order.status)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">{order.course ? 'Tipe Kelas' : 'Jenis Pesanan'}</div>
                        <div className="font-semibold text-slate-900">{itemBadge}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">Promo Code</div>
                        <div className="font-semibold text-slate-900">{promo}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">Jenis Transaksi</div>
                        <div className="font-semibold text-slate-900">{txMethod}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500">Tanggal</div>
                        <div className="font-semibold text-slate-900">{order.createdAtLabel}</div>
                      </div>
                      {isPending && order.dueLabel ? (
                        <div className="flex items-center justify-between gap-3 sm:col-span-2">
                          <div className="text-slate-500">Batas Bayar</div>
                          <div className="font-semibold text-slate-900">{order.dueLabel}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-white">
                  <div className="flex flex-col sm:flex-row gap-2">
                    {isPaid ? (
                      <button
                        type="button"
                        onClick={() =>
                          downloadTransactionHtml({
                            title: itemTitle,
                            code: txCode,
                            fullId: order.id,
                            paidAmount: order.total,
                            status: orderStatus,
                            method: txMethod,
                            promo,
                            dateLabel: order.createdAtLabel,
                          })
                        }
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
                      >
                        <Download className="w-4 h-4" /> Download Invoice
                      </button>
                    ) : null}
                    <a
                      href={contactEmail ? `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(`Bantuan Transaksi ${txCode}`)}` : '#'}
                      onClick={(e) => {
                        if (!contactEmail) e.preventDefault();
                      }}
                      className="inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-slate-100 text-slate-800 font-extrabold text-sm hover:bg-slate-200"
                    >
                      Bantuan Admin
                    </a>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function PendingPaymentAutoSyncClient({
  payments,
}: {
  payments: Array<{ orderId: string; externalId: string | null }>;
}) {
  const router = useRouter();
  const startedRef = useRef(false);
  const paymentsKey = useMemo(() => {
    if (!payments?.length) return '';
    return payments
      .map((p) => `${String(p.orderId)}:${p.externalId ? String(p.externalId) : ''}`)
      .sort()
      .join('|');
  }, [payments]);

  useEffect(() => {
    if (!payments.length) return;
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    let tries = 0;
    const maxTries = 12;

    const runOnce = async () => {
      if (cancelled) return;
      tries += 1;
      for (const p of payments) {
        if (cancelled) return;
        await fetch('/api/payment/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: p.orderId, externalId: p.externalId }),
        })
          .then((r) => r.json().catch(() => ({})))
          .catch(() => null);
      }
      router.refresh();
    };

    runOnce();
    const t = setInterval(() => {
      if (cancelled) return;
      if (tries >= maxTries) {
        clearInterval(t);
        return;
      }
      runOnce();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [payments, paymentsKey, router]);

  return null;
}
