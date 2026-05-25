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
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Successful!</h1>
      <p className="text-gray-600 mb-8">
        {externalId && current.status === 'idle'
          ? 'Memverifikasi pembayaran...'
          : current.message
            ? current.message
            : 'Terima kasih. Silakan cek Riwayat Pembelian untuk melihat status pesanan.'}
      </p>
      <div className="space-x-4">
        <Link
          href="/dashboard/student/orders"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Lihat Pesanan
        </Link>
        <Link
          href="/shop"
          className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Belanja Lagi
        </Link>
      </div>
    </div>
  );
}
