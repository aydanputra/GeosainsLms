"use client";

import { useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';

export default function CheckoutPage() {
  const { items, clearCart, updateMeta } = useCartStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [shipping, setShipping] = useState({
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Indonesia',
    note: '',
  });
  const estimateLineTotal = (item: any) => {
    const type = item?.type || 'PHYSICAL';
    if (type === 'RENTAL') {
      const start = typeof item?.meta?.rental?.start === 'string' ? item.meta.rental.start : '';
      const end = typeof item?.meta?.rental?.end === 'string' ? item.meta.rental.end : '';
      const s = start ? new Date(start) : null;
      const e = end ? new Date(end) : null;
      if (s && e && !Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e.getTime() > s.getTime()) {
        const days = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)));
        return Number(item.price || 0) * days * Number(item.quantity || 0);
      }
    }
    return Number(item.price || 0) * Number(item.quantity || 0);
  };
  const total = items.reduce((sum, it) => sum + estimateLineTotal(it), 0);
  const hasPhysical = items.some((i) => (i.type || 'PHYSICAL') === 'PHYSICAL');

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      // 1. Create order
      const orderRes = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, meta: i.meta ?? null })),
          ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
          ...(hasPhysical
            ? {
                shipping: {
                  recipientName: shipping.recipientName,
                  phone: shipping.phone,
                  addressLine1: shipping.addressLine1,
                  addressLine2: shipping.addressLine2 || null,
                  city: shipping.city,
                  province: shipping.province || null,
                  postalCode: shipping.postalCode || null,
                  country: shipping.country || null,
                  note: shipping.note || null,
                },
              }
            : {}),
        }),
      });
      if (!orderRes.ok) throw new Error('Failed to create order');
      const order = await orderRes.json();

      const orderId = typeof order?.id === 'string' ? order.id : '';
      if (!orderId) return { order, payment: null, paymentError: 'Invalid order response' };

      // 2. Create payment (active method from admin settings) and get redirect URL
      try {
        const settingsRes = await fetch('/api/site-settings', { cache: 'no-store' as any });
        const settings = await settingsRes.json().catch(() => ({}));
        const method = settings?.paymentMethod === 'MIDTRANS' || settings?.paymentMethod === 'MANUAL' ? settings.paymentMethod : 'XENDIT';
        if (method === 'MANUAL') {
          return { order, payment: null, paymentError: null, manual: true };
        }
        const payRes = await fetch('/api/payment/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const payment = await payRes.json().catch(() => null);
        if (!payRes.ok) {
          const msg = typeof payment?.error === 'string' ? payment.error : 'Failed to create payment';
          return { order, payment: null, paymentError: msg };
        }
        return { order, payment, paymentError: null };
      } catch (e: any) {
        return { order, payment: null, paymentError: typeof e?.message === 'string' ? e.message : 'Failed to create payment' };
      }
    },
    onSuccess: (data: any) => {
      clearCart();
      const orderId = typeof data?.order?.id === 'string' ? data.order.id : '';
      const paymentUrl = typeof data?.payment?.paymentUrl === 'string' ? data.payment.paymentUrl : '';

      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }

      if (typeof data?.paymentError === 'string' && data.paymentError.trim()) {
        alert(`Pesanan berhasil dibuat, tapi gagal membuat pembayaran otomatis. Silakan coba bayar dari halaman pesanan.\n\n${data.paymentError}`);
      }
      router.push(orderId ? `/dashboard/student/orders?orderId=${encodeURIComponent(orderId)}` : '/dashboard/student/orders');
    },
    onError: (err) => {
      console.error(err);
      alert('Checkout failed. Please try again.');
    },
    onSettled: () => setLoading(false),
  });

  const handleCheckout = () => {
    if (items.length === 0) return;
    for (const item of items) {
      const t = item.type || 'PHYSICAL';
      if (t === 'SERVICE') {
        const svc = item.meta?.service;
        if (!svc?.start || !svc?.end) {
          alert(`Jadwal jasa wajib diisi untuk: ${item.name}`);
          return;
        }
      }
      if (t === 'RENTAL') {
        const r = item.meta?.rental;
        if (!r?.start || !r?.end) {
          alert(`Periode sewa wajib diisi untuk: ${item.name}`);
          return;
        }
        if ((r?.pickupMethod || 'PICKUP') === 'DELIVERY') {
          const da = r?.deliveryAddress;
          if (!da?.addressLine1 || !da?.city) {
            alert(`Alamat delivery wajib diisi untuk: ${item.name}`);
            return;
          }
        }
      }
    }
    if (hasPhysical) {
      const required = [
        shipping.recipientName.trim(),
        shipping.phone.trim(),
        shipping.addressLine1.trim(),
        shipping.city.trim(),
      ];
      if (required.some((v) => !v)) {
        alert('Alamat pengiriman belum lengkap.');
        return;
      }
    }
    setLoading(true);
    checkoutMutation.mutate();
  };

  if (items.length === 0) {
    return <div className="text-center py-20">Your cart is empty</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold mb-4">Order Review</h2>
        <ul className="divide-y divide-gray-200 mb-4">
          {items.map((item) => (
            <li key={item.id} className="py-4">
              <div className="flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {(item.type || 'PHYSICAL') === 'SERVICE' ? 'Jasa' : (item.type || 'PHYSICAL') === 'RENTAL' ? 'Sewa' : 'Produk'} • Qty: {item.quantity}
                  </p>
                </div>
                <p className="font-medium shrink-0">IDR {estimateLineTotal(item).toLocaleString()}</p>
              </div>

              {(item.type || 'PHYSICAL') === 'SERVICE' ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Mulai</label>
                    <input
                      type="datetime-local"
                      value={item.meta?.service?.start || ''}
                      onChange={(e) =>
                        updateMeta(item.id, {
                          ...(item.meta || {}),
                          service: {
                            ...(item.meta?.service || {}),
                            start: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Selesai</label>
                    <input
                      type="datetime-local"
                      value={item.meta?.service?.end || ''}
                      onChange={(e) =>
                        updateMeta(item.id, {
                          ...(item.meta || {}),
                          service: {
                            ...(item.meta?.service || {}),
                            end: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-700">Lokasi (opsional)</label>
                    <input
                      type="text"
                      value={item.meta?.service?.locationAddress || ''}
                      onChange={(e) =>
                        updateMeta(item.id, {
                          ...(item.meta || {}),
                          service: {
                            ...(item.meta?.service || {}),
                            locationAddress: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                      placeholder="Alamat lokasi layanan"
                    />
                  </div>
                </div>
              ) : null}

              {(item.type || 'PHYSICAL') === 'RENTAL' ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Mulai Sewa</label>
                    <input
                      type="date"
                      value={item.meta?.rental?.start || ''}
                      onChange={(e) =>
                        updateMeta(item.id, {
                          ...(item.meta || {}),
                          rental: {
                            ...(item.meta?.rental || {}),
                            start: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Selesai Sewa</label>
                    <input
                      type="date"
                      value={item.meta?.rental?.end || ''}
                      onChange={(e) =>
                        updateMeta(item.id, {
                          ...(item.meta || {}),
                          rental: {
                            ...(item.meta?.rental || {}),
                            end: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-700">Pickup Method</label>
                    <select
                      value={item.meta?.rental?.pickupMethod || 'PICKUP'}
                      onChange={(e) =>
                        updateMeta(item.id, {
                          ...(item.meta || {}),
                          rental: {
                            ...(item.meta?.rental || {}),
                            pickupMethod: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                    >
                      <option value="PICKUP">Ambil sendiri</option>
                      <option value="DELIVERY">Diantar</option>
                    </select>
                  </div>

                  {(item.meta?.rental?.pickupMethod || 'PICKUP') === 'DELIVERY' ? (
                    <>
                      <div className="sm:col-span-2">
                        <label className="text-sm font-semibold text-gray-700">Alamat Pengantaran</label>
                        <input
                          type="text"
                          value={item.meta?.rental?.deliveryAddress?.addressLine1 || ''}
                          onChange={(e) =>
                            updateMeta(item.id, {
                              ...(item.meta || {}),
                              rental: {
                                ...(item.meta?.rental || {}),
                                deliveryAddress: {
                                  ...(item.meta?.rental?.deliveryAddress || {}),
                                  addressLine1: e.target.value,
                                },
                              },
                            })
                          }
                          className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                          placeholder="Alamat lengkap"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Kota</label>
                        <input
                          type="text"
                          value={item.meta?.rental?.deliveryAddress?.city || ''}
                          onChange={(e) =>
                            updateMeta(item.id, {
                              ...(item.meta || {}),
                              rental: {
                                ...(item.meta?.rental || {}),
                                deliveryAddress: {
                                  ...(item.meta?.rental?.deliveryAddress || {}),
                                  city: e.target.value,
                                },
                              },
                            })
                          }
                          className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                          placeholder="Kota"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Provinsi (opsional)</label>
                        <input
                          type="text"
                          value={item.meta?.rental?.deliveryAddress?.province || ''}
                          onChange={(e) =>
                            updateMeta(item.id, {
                              ...(item.meta || {}),
                              rental: {
                                ...(item.meta?.rental || {}),
                                deliveryAddress: {
                                  ...(item.meta?.rental?.deliveryAddress || {}),
                                  province: e.target.value,
                                },
                              },
                            })
                          }
                          className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
                          placeholder="Provinsi"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-4 text-lg font-bold">
          <span>Total</span>
          <span>IDR {total.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold mb-4">Kupon</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Masukkan kode kupon (opsional)"
            className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none uppercase"
          />
          <button
            type="button"
            onClick={() => setCouponCode((v) => v.trim().toUpperCase())}
            className="px-4 py-3 rounded-lg border font-semibold text-gray-700 hover:bg-gray-50"
          >
            Terapkan
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Kupon akan divalidasi saat proses checkout.
        </div>
      </div>

      {hasPhysical ? (
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h2 className="text-xl font-semibold mb-4">Alamat Pengiriman</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Nama Penerima</label>
            <input
              type="text"
              value={shipping.recipientName}
              onChange={(e) => setShipping((p) => ({ ...p, recipientName: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="Nama penerima"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Nomor HP</label>
            <input
              type="text"
              value={shipping.phone}
              onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="08xxxx"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Kota</label>
            <input
              type="text"
              value={shipping.city}
              onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="Kota"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Alamat</label>
            <input
              type="text"
              value={shipping.addressLine1}
              onChange={(e) => setShipping((p) => ({ ...p, addressLine1: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="Nama jalan, nomor rumah, kecamatan..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Detail Alamat (opsional)</label>
            <input
              type="text"
              value={shipping.addressLine2}
              onChange={(e) => setShipping((p) => ({ ...p, addressLine2: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="Patokan, RT/RW, dll"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Provinsi (opsional)</label>
            <input
              type="text"
              value={shipping.province}
              onChange={(e) => setShipping((p) => ({ ...p, province: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="Provinsi"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Kode Pos (opsional)</label>
            <input
              type="text"
              value={shipping.postalCode}
              onChange={(e) => setShipping((p) => ({ ...p, postalCode: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="Kode pos"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Catatan (opsional)</label>
            <textarea
              value={shipping.note}
              onChange={(e) => setShipping((p) => ({ ...p, note: e.target.value }))}
              className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none"
              placeholder="Contoh: kirim siang hari / titip satpam"
              rows={3}
            />
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Alamat pengiriman wajib untuk pembelian produk.
        </div>
      </div>
      ) : null}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Buat Pesanan'}
      </button>
    </div>
  );
}
