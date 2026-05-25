import { cookies } from 'next/headers';
import Link from 'next/link';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import Cards from '@/modules/dashboard/components/Cards';
import VendorApplyModal from '@/modules/dashboard/components/VendorApplyModal';

export const dynamic = 'force-dynamic';

function formatIdr(value: number) {
  return `IDR ${Number(value || 0).toLocaleString('id-ID')}`;
}

function getTotalDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  const fallbackTotal = Number(it?.discountAmount || 0);
  if (store === 0 && marketplace === 0) return fallbackTotal;
  return store + marketplace;
}

function getStoreDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
  return store;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ submitted?: string; resubmit?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || !role) return <div>Access Denied</div>;

  const vendors = await prisma.shopVendor.findMany({
    where: role === 'ADMIN' ? undefined : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      ownerId: true,
      commissionType: true,
      commissionRate: true,
      verificationNote: true,
      description: true,
      logoUrl: true,
      coverUrl: true,
      contactEmail: true,
      contactPhone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,
      idNumber: true,
      idDocumentUrl: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const canApply = role !== 'ADMIN';
  const hasVendor = vendors.length > 0;
  const hasApprovedVendor = role === 'ADMIN' ? true : vendors.some((v) => v.status === 'APPROVED');

  if (!hasVendor && canApply) {
    return (
      <div className="space-y-6 pb-12 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vendor</h1>
          <p className="text-slate-500 text-sm mt-1">
            Daftarkan toko Anda untuk mulai menjual produk. Setelah mendaftar, admin akan melakukan persetujuan.
          </p>
        </div>

        {role !== 'MENTOR' ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="text-sm font-extrabold text-slate-900">Akses tidak tersedia</div>
            <div className="text-sm text-slate-600 mt-1">Fitur Vendor saat ini hanya tersedia untuk akun Mentor.</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-extrabold text-slate-900">Pengajuan Vendor</div>
                <div className="text-sm text-slate-600 mt-1">Klik tombol di bawah untuk mengajukan vendor.</div>
              </div>
              <VendorApplyModal triggerLabel="Ajukan Vendor" />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (role !== 'ADMIN' && hasVendor && !hasApprovedVendor) {
    const v = vendors[0];
    const statusLabel = v.status === 'PENDING' ? 'Menunggu Persetujuan' : v.status === 'REJECTED' ? 'Ditolak' : 'Suspended';
    const note = typeof v.verificationNote === 'string' ? v.verificationNote.trim() : '';
    return (
      <div className="space-y-6 pb-12 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vendor</h1>
          <p className="text-slate-500 text-sm mt-1">Status pendaftaran vendor Anda saat ini.</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          {sp.submitted === '1' ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              Permintaan vendor berhasil dikirim. Admin akan memeriksa dan memberikan persetujuan. Anda akan menerima notifikasi setelah ada keputusan.
            </div>
          ) : null}
          <div className="text-sm font-extrabold text-slate-900">{v.name}</div>
          <div className="text-sm text-slate-700">
            Status:{' '}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
              {statusLabel}
            </span>
          </div>
          {note ? <div className="text-sm text-slate-600 whitespace-pre-line">Catatan admin: {note}</div> : null}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Link
              href="/dashboard/vendor/profile"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
            >
              Lihat Profil Vendor
            </Link>
            {v.status === 'REJECTED' ? (
              <VendorApplyModal
                triggerLabel="Ajukan Ulang"
                initialValue={{
                  name: v.name,
                  slug: v.slug,
                  description: v.description ?? undefined,
                  logoUrl: v.logoUrl ?? undefined,
                  coverUrl: v.coverUrl ?? undefined,
                  contactEmail: v.contactEmail ?? undefined,
                  contactPhone: v.contactPhone ?? undefined,
                  addressLine1: v.addressLine1 ?? undefined,
                  addressLine2: v.addressLine2 ?? undefined,
                  city: v.city ?? undefined,
                  province: v.province ?? undefined,
                  postalCode: v.postalCode ?? undefined,
                  country: v.country ?? undefined,
                  idNumber: v.idNumber ?? undefined,
                  idDocumentUrl: v.idDocumentUrl ?? undefined,
                }}
                defaultOpen={sp.resubmit === '1'}
              />
            ) : null}
            <Link
              href={`/vendor/${v.slug}`}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
            >
              Lihat Halaman Toko
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const vendorIds = vendors.map((v) => v.id);
  const hasScope = role === 'ADMIN' || vendorIds.length > 0;
  const vendorById = new Map(vendors.map((v: any) => [String(v.id), v] as const));

  const products = hasScope
    ? await prisma.product.findMany({
        where: role === 'ADMIN' ? undefined : { vendorId: { in: vendorIds } },
        select: { id: true, vendorId: true },
      })
    : [];

  const productIds = products.map((p) => p.id);

  const paidItems = productIds.length
    ? await prisma.orderItem.findMany({
        where: { productId: { in: productIds }, order: { is: { status: 'PAID' } } },
        select: {
          productId: true,
          quantity: true,
          price: true,
          discountAmount: true,
          discountStoreAmount: true,
          discountMarketplaceAmount: true,
          refundAmount: true,
          product: { select: { vendorId: true } },
        },
      })
    : [];

  const grossByProduct = new Map<string, { sold: number; gross: number; vendorId: string }>();
  for (const it of paidItems) {
    const pid = it.productId ? String(it.productId) : '';
    const vendorId = it.product?.vendorId ? String(it.product.vendorId) : '';
    if (!pid || !vendorId) continue;
    const prev = grossByProduct.get(pid) || { sold: 0, gross: 0, vendorId };
    const qty = Number(it.quantity || 0);
    const lineSubtotal = Number(it.price || 0) * qty;
    const storeDiscount = Math.max(0, getStoreDiscountAmount(it));
    const refund = Math.max(0, Number(it.refundAmount || 0));
    const sellerBase = Math.max(0, lineSubtotal - storeDiscount - refund);
    grossByProduct.set(pid, { sold: prev.sold + qty, gross: prev.gross + sellerBase, vendorId });
  }

  const commissionOrders = productIds.length
    ? await prisma.order.findMany({
        where: {
          status: 'PAID',
          commission: { isNot: null },
          items: { some: { productId: { in: productIds } } },
        },
        select: {
          total: true,
          commission: { select: { amount: true, status: true } },
          items: {
            where: { productId: { in: productIds } },
            select: {
              productId: true,
              quantity: true,
              price: true,
              discountAmount: true,
              discountStoreAmount: true,
              discountMarketplaceAmount: true,
              refundAmount: true,
            },
          },
        },
      })
    : [];

  const affiliateFeeByProductId = new Map<string, number>();
  for (const o of commissionOrders) {
    const orderTotal = Math.max(0, Number(o.total || 0));
    const commissionAmount = Math.max(0, Number((o as any)?.commission?.amount || 0));
    const commissionStatus = String((o as any)?.commission?.status || '').toUpperCase();
    if (!orderTotal || !commissionAmount || commissionStatus.includes('REVERSED')) continue;

    const items = Array.isArray((o as any)?.items) ? (o as any).items : [];
    const vendorBuyerPaid = items.reduce((sum: number, it: any) => {
      const qty = Number(it?.quantity || 0);
      const price = Number(it?.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Math.max(0, Number(it?.refundAmount || 0));
      const discountTotal = Math.max(0, getTotalDiscountAmount(it));
      const buyerPaid = Math.max(0, gross - discountTotal - refund);
      return sum + buyerPaid;
    }, 0);
    if (!vendorBuyerPaid) continue;

    const orderShare = Math.max(0, Math.min(1, vendorBuyerPaid / orderTotal));
    const feeForVendor = Math.max(0, commissionAmount * orderShare);
    if (!feeForVendor) continue;

    for (const it of items) {
      const pid = it?.productId ? String(it.productId) : '';
      if (!pid) continue;
      const qty = Number(it?.quantity || 0);
      const price = Number(it?.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Math.max(0, Number(it?.refundAmount || 0));
      const discountTotal = Math.max(0, getTotalDiscountAmount(it));
      const buyerPaid = Math.max(0, gross - discountTotal - refund);
      if (!buyerPaid) continue;
      const share = Math.max(0, Math.min(1, buyerPaid / vendorBuyerPaid));
      const itemFee = Math.max(0, feeForVendor * share);
      affiliateFeeByProductId.set(pid, (affiliateFeeByProductId.get(pid) || 0) + itemFee);
    }
  }

  let totalNet = 0;
  let totalPlatformFee = 0;
  let totalAffiliateFee = 0;
  let totalSoldPaid = 0;
  for (const [pid, agg] of grossByProduct.entries()) {
    const vendor = vendorById.get(agg.vendorId);
    const commissionType = String((vendor as any)?.commissionType || 'PERCENT').toUpperCase();
    const commissionRate = Number((vendor as any)?.commissionRate || 0);
    const platformFee =
      commissionType === 'FLAT' ? Math.max(0, commissionRate * agg.sold) : Math.max(0, (agg.gross * commissionRate) / 100);
    const affiliateFee = Math.max(0, Number(affiliateFeeByProductId.get(pid) || 0));
    const net = Math.max(0, agg.gross - platformFee - affiliateFee);
    totalNet += net;
    totalPlatformFee += platformFee;
    totalAffiliateFee += affiliateFee;
    totalSoldPaid += agg.sold;
  }

  const orders = productIds.length
    ? await prisma.order.findMany({
        where: {
          items: { some: { productId: { in: productIds } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
          items: {
            where: { productId: { in: productIds } },
            select: {
              quantity: true,
              price: true,
              productId: true,
              discountAmount: true,
              discountStoreAmount: true,
              discountMarketplaceAmount: true,
              refundAmount: true,
            },
          },
        },
      })
    : [];

  const paidOrdersCount = productIds.length
    ? await prisma.order.count({ where: { status: 'PAID', items: { some: { productId: { in: productIds } } } } })
    : 0;
  const pendingOrdersCount = productIds.length
    ? await prisma.order.count({ where: { status: 'PENDING', items: { some: { productId: { in: productIds } } } } })
    : 0;

  const metrics = [
    { label: 'Total Produk', value: products.length, color: 'bg-blue-500' },
    { label: 'Pesanan (Paid)', value: paidOrdersCount, color: 'bg-green-500' },
    { label: 'Fee Platform', value: formatIdr(totalPlatformFee), color: 'bg-rose-500' },
    { label: 'Fee Affiliate', value: formatIdr(totalAffiliateFee), color: 'bg-rose-600' },
    { label: 'Pendapatan Bersih', value: formatIdr(totalNet), color: 'bg-purple-500' },
    { label: 'Pesanan (Pending)', value: pendingOrdersCount, color: 'bg-amber-500' },
    { label: 'Terjual', value: totalSoldPaid, color: 'bg-emerald-500' },
  ];

  const rows = orders.map((o) => {
    const subtotal = o.items.reduce((acc, it: any) => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.price || 0);
      const gross = Math.max(0, qty * price);
      const refund = Math.max(0, Number(it.refundAmount || 0));
      const discountTotal = Math.max(0, getTotalDiscountAmount(it));
      const paid = Math.max(0, gross - discountTotal - refund);
      return acc + paid;
    }, 0);
    return {
      id: o.id,
      buyerName: o.user?.name || o.user?.email || 'Unknown',
      buyerEmail: o.user?.email || '-',
      subtotal,
      status: o.status,
    };
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Vendor</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ringkasan toko dan aktivitas penjualan terbaru.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/vendor/shop"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
          >
            Kelola Produk
          </Link>
          {role === 'VENDOR' || role === 'ADMIN' ? (
            <Link
              href="/dashboard/vendor/team"
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
            >
              Tim Vendor
            </Link>
          ) : null}
        </div>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Pesanan Terbaru</div>
            <div className="text-xs text-slate-500 mt-1">Menampilkan 10 pesanan terakhir yang berisi produk vendor.</div>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 text-slate-300">…</div>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Tidak ada data</h3>
            <p className="text-slate-500 mt-1 text-sm">Belum ada pesanan yang bisa ditampilkan.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto pb-4">
            <table className="w-full border-separate border-spacing-y-3 px-1">
              <thead>
                <tr className="bg-gradient-to-r from-blue-900 to-blue-600 rounded-2xl shadow-sm">
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider first:rounded-l-2xl">
                    Order
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Pembeli</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Dibayar</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider last:rounded-r-2xl">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="space-y-4">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group bg-white hover:bg-indigo-50/30 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 rounded-2xl"
                  >
                    <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 first:border-l first:rounded-l-2xl group-hover:border-indigo-100/50 transition-colors">
                      <span className="font-mono text-xs text-slate-600">{String(row.id).slice(0, 8)}...</span>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 group-hover:border-indigo-100/50 transition-colors">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{row.buyerName}</div>
                        <div className="text-xs text-slate-500 truncate">{row.buyerEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 group-hover:border-indigo-100/50 transition-colors">
                      <span className="font-semibold text-slate-900">{formatIdr(row.subtotal)}</span>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700 border-t border-b border-slate-100 last:border-r last:rounded-r-2xl group-hover:border-indigo-100/50 transition-colors">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                        {row.status === 'PAID' ? 'LUNAS' : row.status === 'PENDING' ? 'MENUNGGU' : row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
