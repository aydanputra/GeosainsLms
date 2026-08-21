"use client";

import { useCartStore } from '../store/useCartStore';
import { toast } from 'sonner';
import { buildWhatsAppUrl } from '@/modules/core/utils/whatsapp';

export default function AddToCartButton({
  product,
  className,
  children,
  adminWhatsAppNumber,
}: {
  product: { id: string; name: string; price: number; imageUrl: string | null; type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL' };
  className?: string;
  children?: React.ReactNode;
  adminWhatsAppNumber?: string | null;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const isRentalChatOnly = (product.type || 'PHYSICAL') === 'RENTAL' && Number(product.price || 0) <= 0;
  const chatHref = isRentalChatOnly
    ? buildWhatsAppUrl(adminWhatsAppNumber, `Halo Admin, saya ingin bertanya tentang sewa alat "${product.name}".`)
    : '';

  if (isRentalChatOnly) {
    return (
      chatHref ? (
        <a
          href={chatHref}
          target="_blank"
          rel="noreferrer"
          className={
            className ||
            'w-full sm:w-auto inline-flex items-center justify-center bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors'
          }
        >
          {children || 'Chat Admin'}
        </a>
      ) : (
        <button
          type="button"
          disabled
          className={
            className ||
            'w-full sm:w-auto bg-slate-200 text-slate-500 px-4 py-2.5 rounded-xl text-sm font-bold cursor-not-allowed'
          }
        >
          {children || 'Chat Admin'}
        </button>
      )
    );
  }

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
