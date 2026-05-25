"use client";

import CartList from '../components/CartList';
import CheckoutSummary from '../components/CheckoutSummary';

export default function CartPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Shopping Cart</h1>
          <p className="text-sm text-slate-600 mt-1">Cek item, ubah jumlah, lalu lanjutkan ke checkout.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-2">
            <CartList />
          </div>
          <div>
            <CheckoutSummary />
          </div>
        </div>
      </div>
    </div>
  );
}
