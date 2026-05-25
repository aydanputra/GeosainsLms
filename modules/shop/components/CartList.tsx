"use client";

import { useCartStore } from '../store/useCartStore';
import Link from 'next/link';

export default function CartList() {
  const { items, removeItem, updateQuantity } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-lg shadow-sm border p-8">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <Link href="/shop" className="text-indigo-600 hover:text-indigo-800 font-medium">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border divide-y divide-gray-200">
      {items.map((item) => (
        <div key={item.id} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4 w-full sm:w-auto">
            <div className="h-16 w-16 bg-gray-200 rounded object-cover flex-shrink-0 overflow-hidden">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Img</div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
              <p className="text-xs text-gray-500">{(item.type || 'PHYSICAL') === 'SERVICE' ? 'Jasa' : (item.type || 'PHYSICAL') === 'RENTAL' ? 'Sewa' : 'Produk'}</p>
              <p className="text-sm text-gray-500">IDR {item.price.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center border rounded">
              <button
                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                disabled={(item.type || 'PHYSICAL') === 'SERVICE'}
                className="px-3 py-1 text-gray-600 hover:bg-gray-100"
              >
                -
              </button>
              <span className="px-3 py-1 text-gray-900 text-sm w-8 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={(item.type || 'PHYSICAL') === 'SERVICE'}
                className="px-3 py-1 text-gray-600 hover:bg-gray-100"
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
