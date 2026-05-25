"use client";

import { useCartStore } from '../store/useCartStore';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: {
    id: string;
    slug?: string | null;
    name: string;
    description?: string | null;
    price: number;
    imageUrl?: string | null;
    type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL';
  };
  addToCartVariant?: 'text' | 'icon';
}

export default function ProductCard({ product, addToCartVariant = 'icon' }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const href = `/shop/products/${product.slug || product.id}`;

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      type: product.type || 'PHYSICAL',
    });
  };

  const imageUrl =
    typeof product.imageUrl === 'string' && product.imageUrl.trim() && !product.imageUrl.startsWith('blob:') ? product.imageUrl : '';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col min-w-0">
      <Link href={href} className="block bg-slate-100 w-full">
        <div className="aspect-[4/3] bg-slate-100 w-full relative">
          {imageUrl ? (
            <Image src={imageUrl} alt={product.name} fill unoptimized className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-bold">No Image</div>
          )}
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <Link href={href} className="block text-lg font-[700] text-slate-900 mb-1 hover:text-blue-800 line-clamp-2 leading-[27px] min-h-[54px]">
          {product.name}
        </Link>
        <p className="text-sm text-slate-500 mb-4 line-clamp-2 min-h-[40px]">{product.description || ' '}</p>
        <div className="mt-auto flex items-center justify-between gap-3 min-w-0">
          <span className="text-blue-700 font-extrabold">IDR {product.price.toLocaleString('id-ID')}</span>
          {addToCartVariant === 'icon' ? (
            <button
              type="button"
              onClick={handleAddToCart}
              className="bg-brand-gradient text-white p-2.5 rounded-xl hover:opacity-90 transition-opacity shrink-0"
              aria-label="Tambah ke Keranjang"
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className="bg-brand-gradient text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
