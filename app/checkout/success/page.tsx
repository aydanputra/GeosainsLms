"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CheckoutSuccessPage() {
  const sp = useSearchParams();
  const externalId = useMemo(() => {
    const v = sp.get('externalId') || sp.get('external_id') || '';
    return v.trim();
  }, [sp]);
  const [sync, setSync] = useState<{
    externalId: string;
    status: 'idle' | 'synced' | 'pending' | 'error';
    message: string;
  }>({ externalId: '', status: 'idle', message: '' });

  const current = useMemo(() => {
    if (sync.externalId === externalId) return sync;
    return { externalId, status: 'idle' as const, message: '' };
  }, [externalId, sync]);

  useEffect(() => {
    if (!externalId) return;
    let active = true;
    fetch('/api/payment/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || 'Gagal memverifikasi pembayaran');
        const inv = String(body?.invoiceStatus || '').toUpperCase();
        if (!active) return;
        if (inv === 'PAID' || inv === 'SETTLED') {
          setSync({
            externalId,
            status: 'synced',
            message: 'Pembayaran terverifikasi. Status pesanan akan segera ter-update.',
          });
          return;
        }
        setSync({
          externalId,
          status: 'pending',
          message: inv ? `Status invoice: ${inv}` : 'Pembayaran masih diproses. Silakan cek kembali di Riwayat Pembelian.',
        });
      })
      .catch((e: any) => {
        if (!active) return;
        setSync({
          externalId,
          status: 'error',
          message: e?.message || 'Gagal memverifikasi pembayaran',
        });
      });
    return () => {
      active = false;
    };
  }, [externalId]);

  return (
    <section className="bg-slate-50 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_25px_70px_rgba(15,23,42,0.14)] sm:p-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50">
            <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="mb-3 inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-200">
            Pembayaran Berhasil
          </div>

          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Pembayaran berhasil diverifikasi
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            {externalId && current.status === 'idle'
              ? 'Kami sedang memverifikasi pembayaran Anda. Mohon tunggu sebentar.'
              : current.message
                ? current.message
                : 'Terima kasih. Silakan cek Riwayat Pembelian untuk melihat status pesanan Anda.'}
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard/student/orders"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-indigo-600 px-6 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700"
            >
              Lihat Pesanan
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Belanja Lagi
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
