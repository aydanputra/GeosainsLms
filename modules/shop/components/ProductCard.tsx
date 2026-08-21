"use client";

import { useCartStore } from '../store/useCartStore';
import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { buildWhatsAppUrl } from '@/modules/core/utils/whatsapp';
import { normalizeImageUrl, pickImageUrl } from '@/modules/core/utils/image';

interface ProductCardProps {
  product: {
    id: string;
    slug?: string | null;
    name: string;
    description?: string | null;
    price: number;
    imageUrl?: string | null;
    imageUrls?: string[] | null;
    type?: 'PHYSICAL' | 'SERVICE' | 'RENTAL';
  };
  addToCartVariant?: 'text' | 'icon';
  adminWhatsAppNumber?: string | null;
}

export default function ProductCard({ product, addToCartVariant = 'icon', adminWhatsAppNumber }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [imageBroken, setImageBroken] = useState(false);
  const href = `/shop/products/${product.slug || product.id}`;
  const isChatOnly = Number(product.price || 0) <= 0;
  const chatHref = isChatOnly
    ? buildWhatsAppUrl(adminWhatsAppNumber, `Halo Admin, saya ingin bertanya tentang produk "${product.name}".`)
    : '';

  const imageUrl = useMemo(() => {
    const gallery = Array.isArray(product.imageUrls) ? product.imageUrls : [];
    return pickImageUrl([product.imageUrl, ...gallery], { fallback: null });
  }, [product.imageUrl, product.imageUrls]);
  const normalizedImageUrl = normalizeImageUrl(imageUrl);

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: normalizedImageUrl,
      type: product.type || 'PHYSICAL',
    });
  };

  const priceLabel = isChatOnly ? 'Hubungi Admin' : `IDR ${product.price.toLocaleString('id-ID')}`;
  const canShowImage = Boolean(normalizedImageUrl && !imageBroken);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col min-w-0">
      <Link href={href} className="block bg-slate-100 w-full">
        <div className="aspect-[4/3] bg-slate-100 w-full relative">
          {canShowImage ? (
            <Image
              src={normalizedImageUrl!}
              alt={product.name}
              fill
              sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) calc(50vw - 2rem), 25vw"
              quality={70}
              className="object-cover"
              onError={() => setImageBroken(true)}
            />
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
          <span className="text-blue-700 font-extrabold">{priceLabel}</span>
          {isChatOnly ? (
            chatHref ? (
              <a
                href={chatHref}
                target="_blank"
                rel="noreferrer"
                className={
                  addToCartVariant === 'icon'
                    ? 'bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700 transition-colors shrink-0'
                    : 'bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors'
                }
                aria-label="Chat Admin"
              >
                {addToCartVariant === 'icon' ? <MessageCircle className="w-5 h-5" /> : 'Chat Admin'}
              </a>
            ) : (
              <button
                type="button"
                disabled
                className={
                  addToCartVariant === 'icon'
                    ? 'bg-slate-200 text-slate-500 p-2.5 rounded-xl shrink-0 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-500 px-4 py-2 rounded-xl text-sm font-bold cursor-not-allowed'
                }
                aria-label="Chat Admin belum tersedia"
              >
                {addToCartVariant === 'icon' ? <MessageCircle className="w-5 h-5" /> : 'Chat Admin'}
              </button>
            )
          ) : addToCartVariant === 'icon' ? (
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
              Tambah ke Keranjang
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
