"use client";

import { useCartStore } from '../store/useCartStore';
import Link from 'next/link';

export default function CheckoutSummary() {
  const { getTotal } = useCartStore();
  const total = getTotal();

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">IDR {total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Tax (0%)</span>
          <span className="font-medium">IDR 0</span>
        </div>
      </div>
      <div className="border-t pt-4 mb-6">
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>IDR {total.toLocaleString()}</span>
        </div>
      </div>
      <Link
        href="/checkout"
        className={`block w-full text-center bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors ${
          total === 0 ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        Proceed to Checkout
      </Link>
    </div>
  );
}
