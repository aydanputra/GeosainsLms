"use client";

import { useCartStore } from '../store/useCartStore';
import { toast } from 'sonner';

export default function AddToCartButton({
  product,
  className,
  children,
}: {
  product: { id: string; name: string; price: number; imageUrl: string | null; type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL' };
  className?: string;
  children?: React.ReactNode;
}) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <button
      type="button"
      onClick={() => {
        addItem({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.imageUrl,
          type: product.type || 'PHYSICAL',
        });
        toast.success('Produk ditambahkan ke keranjang');
      }}
      className={
        className ||
        'w-full sm:w-auto bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors'
      }
    >
      {children || 'Tambah ke Keranjang'}
    </button>
  );
}
