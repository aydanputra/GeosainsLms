import AdminCoupons from '@/modules/dashboard/pages/admin/AdminCoupons';
import { prisma } from '@/utils/prisma';

export default async function Page() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  const serialized = coupons.map((c) => ({
    ...c,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
  return <AdminCoupons coupons={serialized as any} />;
}
