"use client";

import { useCartStore } from '../store/useCartStore';
import Link from 'next/link';

export default function CheckoutSummary() {
  const { getTotal } = useCartStore();
  const total = getTotal();
  const isEmpty = total === 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-24">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Order Summary</h3>
        <p className="text-xs text-slate-500 mt-1">Ringkasan total pembayaran.</p>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-bold">Subtotal</span>
            <span className="text-slate-900 font-extrabold">IDR {total.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-bold">Tax</span>
            <span className="text-slate-900 font-extrabold">IDR 0</span>
          </div>
        </div>

        <div className="border-t border-slate-200 mt-5 pt-5">
          <div className="flex items-center justify-between">
            <span className="text-slate-900 font-extrabold">Total</span>
            <span className="text-slate-900 text-lg font-extrabold">IDR {total.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/checkout"
            className={[
              'block w-full text-center py-3 rounded-2xl font-extrabold text-sm transition-colors',
              isEmpty
                ? 'bg-slate-100 text-slate-400 border border-slate-200 pointer-events-none'
                : 'bg-indigo-600 text-white hover:bg-indigo-700',
            ].join(' ')}
          >
            Proceed to Checkout
          </Link>
          {isEmpty ? <div className="text-[11px] text-slate-500 mt-2 text-center">Tambahkan item agar bisa checkout.</div> : null}
        </div>
      </div>
    </div>
  );
}
