import { cookies } from 'next/headers';
import Link from 'next/link';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import AdminShop from '@/modules/dashboard/pages/admin/AdminShop';

export const dynamic = 'force-dynamic';

const vendorShopSelect = {
  id: true,
  name: true,
  status: true,
  description: true,
  contactEmail: true,
  contactPhone: true,
  addressLine1: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
} as const;

function getStoreDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
  return store;
}

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || !role) return <div>Access Denied</div>;

  const [vendors, categories] = await Promise.all([
    prisma.shopVendor.findMany({
      where: role === 'ADMIN' ? undefined : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: vendorShopSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.productCategoryModel.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const approvedVendors = vendors.filter((v) => v.status === 'APPROVED');
  const approvedVendorIds = approvedVendors.map((v) => v.id);
  const initialVendors = (role === 'ADMIN' ? vendors : approvedVendors).map((vendor) => ({
    id: String(vendor.id),
    name: String(vendor.name || ''),
  }));
  if (role !== 'ADMIN' && approvedVendorIds.length === 0) {
    return (
      <div className="space-y-6 pb-12 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kelola Produk</h1>
          <p className="text-slate-500 text-sm mt-1">Fitur ini aktif setelah vendor disetujui admin.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="text-sm font-extrabold text-slate-900">Vendor belum aktif</div>
          <div className="text-sm text-slate-600 mt-1">Silakan cek status vendor dan lengkapi profil vendor terlebih dahulu.</div>
        </div>
      </div>
    );
  }

  if (role !== 'ADMIN') {
    const v = approvedVendors[0] || null;
    if (v) {
      const missing: string[] = [];
      if (!v.description) missing.push('Deskripsi');
      if (!v.contactEmail) missing.push('Email');
      if (!v.contactPhone) missing.push('Telepon');
      if (!v.addressLine1) missing.push('Alamat');
      if (!v.city) missing.push('Kota');
      if (!v.province) missing.push('Provinsi');
      if (!v.postalCode) missing.push('Kode Pos');
      if (!v.country) missing.push('Negara');
      if (missing.length > 0) {
        return (
          <div className="space-y-6 pb-12 max-w-2xl">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kelola Produk</h1>
              <p className="text-slate-500 text-sm mt-1">Lengkapi profil vendor sebelum membuat atau menjual produk.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="text-sm font-extrabold text-slate-900">Profil vendor belum lengkap</div>
              <div className="text-sm text-slate-600">Lengkapi terlebih dahulu: {missing.join(', ')}.</div>
              <Link
                href="/dashboard/vendor/profile"
                className="inline-flex px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
              >
                Lengkapi Profil Vendor
              </Link>
            </div>
          </div>
        );
      }
    }
  }

  const products =
    approvedVendorIds.length > 0 || role === 'ADMIN'
      ? await prisma.product.findMany({
          where: role === 'ADMIN' ? undefined : { vendorId: { in: approvedVendorIds } },
          orderBy: { createdAt: 'desc' },
          include: {
            categoryRef: { select: { id: true, name: true } },
            vendor: { select: { id: true, name: true, slug: true } },
          },
        })
      : [];

  const productIds = products.map((p) => p.id);
  const soldAgg =
    productIds.length > 0
      ? await prisma.orderItem.findMany({
          where: {
            productId: { in: productIds },
            order: { status: 'PAID' },
          },
          select: {
            productId: true,
            quantity: true,
            price: true,
            discountAmount: true,
            discountStoreAmount: true,
            discountMarketplaceAmount: true,
            refundAmount: true,
          },
        })
      : [];

  const soldMap = new Map<string, { sold: number; revenue: number }>();
  for (const row of soldAgg) {
    if (!row.productId) continue;
    const prev = soldMap.get(row.productId) || { sold: 0, revenue: 0 };
    const qty = Number(row.quantity || 0);
    const price = Number(row.price || 0);
    const gross = Math.max(0, qty * price);
    const refund = Number(row.refundAmount || 0);
    const storeDiscount = getStoreDiscountAmount(row);
    const sellerBase = Math.max(0, gross - storeDiscount - refund);
    soldMap.set(row.productId, {
      sold: prev.sold + qty,
      revenue: prev.revenue + sellerBase,
    });
  }

  return (
    <AdminShop
      products={products.map((p) => ({
        ...p,
        sold: soldMap.get(p.id)?.sold ?? 0,
        revenue: soldMap.get(p.id)?.revenue ?? 0,
        stock: p.stock ?? 0,
        imageUrl: typeof p.imageUrl === 'string' && p.imageUrl.startsWith('blob:') ? null : p.imageUrl,
      }))}
      initialCategories={categories.map((category) => ({ id: String(category.id), name: String(category.name || '') }))}
      initialVendors={initialVendors}
    />
  );
}
