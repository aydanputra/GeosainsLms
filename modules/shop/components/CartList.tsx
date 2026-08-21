"use client";

/* eslint-disable @next/next/no-img-element */

import { useCartStore } from '../store/useCartStore';
import Link from 'next/link';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';

export default function CartList() {
  const { items, removeItem, updateQuantity } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div className="mt-4 text-lg font-extrabold text-slate-900">Keranjang masih kosong</div>
          <div className="mt-1 text-sm text-slate-500">Mulai belanja untuk menambahkan produk atau jasa.</div>
          <Link
            href="/shop"
            className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
          >
            Mulai Belanja
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {items.map((item) => (
        <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="h-16 w-16 bg-slate-100 rounded-2xl border border-slate-200 flex-shrink-0 overflow-hidden">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  NO IMG
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-start gap-2">
                <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug truncate">{item.name}</h4>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-slate-200 bg-slate-50 text-slate-700">
                  {(item.type || 'PHYSICAL') === 'SERVICE' ? 'Jasa' : (item.type || 'PHYSICAL') === 'RENTAL' ? 'Sewa' : 'Produk'}
                </span>
              </div>
              <div className="mt-1 text-sm font-bold text-slate-700">IDR {Number(item.price || 0).toLocaleString()}</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <div className="flex items-center border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <button
                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                disabled={(item.type || 'PHYSICAL') === 'SERVICE'}
                className="h-10 w-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                aria-label="Kurangi jumlah"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="h-10 min-w-10 px-2 flex items-center justify-center text-slate-900 text-sm font-extrabold">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={(item.type || 'PHYSICAL') === 'SERVICE'}
                className="h-10 w-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                aria-label="Tambah jumlah"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="h-10 px-3 rounded-2xl border border-slate-200 bg-white hover:bg-red-50 text-red-700 font-extrabold text-sm inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
