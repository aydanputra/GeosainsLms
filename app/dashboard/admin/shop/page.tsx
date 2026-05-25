import { prisma } from '@/utils/prisma';
import AdminShop from '@/modules/dashboard/pages/admin/AdminShop';

function getStoreDiscountAmount(it: any) {
  const store = Number(it?.discountStoreAmount || 0);
  const marketplace = Number(it?.discountMarketplaceAmount || 0);
  if (store === 0 && marketplace === 0) return Number(it?.discountAmount || 0);
  return store;
}

export default async function Page() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      categoryRef: true,
      vendor: true,
    },
  });

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
    />
  );
}
