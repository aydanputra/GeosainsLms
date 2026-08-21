"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
}

export default function ProductList({ addToCart }: { addToCart: (id: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/shop/products')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading products...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <div key={product.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-48 object-cover mb-4 rounded"
            />
          )}
          <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
          <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-indigo-600 font-bold">${product.price}</span>
            <button 
              onClick={() => addToCart(product.id)}
              disabled={product.stock === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm disabled:opacity-50"
            >
              {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
