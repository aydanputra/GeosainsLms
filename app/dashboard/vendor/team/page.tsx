import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import VendorTeam from '@/modules/dashboard/pages/vendor/VendorTeam';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || !role) return <div>Access Denied</div>;

  const vendors = await prisma.shopVendor.findMany({
    where: role === 'ADMIN' ? undefined : { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (role !== 'ADMIN' && vendors.length === 0) return <div>Access Denied</div>;

  return <VendorTeam vendors={vendors.map((v) => ({ id: v.id, name: v.name, slug: v.slug, status: v.status }))} />;
}
