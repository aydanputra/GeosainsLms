import AdminCoupons from '@/modules/dashboard/pages/admin/AdminCoupons';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || role !== 'MENTOR') return <div>Access Denied</div>;

  const coupons = await prisma.coupon.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = coupons.map((c) => ({
    ...c,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return <AdminCoupons variant="MENTOR" coupons={serialized as any} />;
}

