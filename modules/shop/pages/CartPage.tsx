"use client";

import CartList from '../components/CartList';
import CheckoutSummary from '../components/CheckoutSummary';

export default function CartPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CartList />
        </div>
        <div>
          <CheckoutSummary />
        </div>
      </div>
    </div>
  );
}
