import { prisma } from '@/utils/prisma';
import AdminVendors from '@/modules/dashboard/pages/admin/AdminVendors';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;
  const payload = await verifyToken(token);
  if (!payload?.id || payload.role !== 'ADMIN') return <div>Access Denied</div>;

  const vendors = await prisma.shopVendor.findMany({
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { id: true, email: true, name: true } } },
  });

  return (
    <AdminVendors
      permissions={{
        canCreate: true,
        canEdit: true,
        canChangeStatus: true,
        canDelete: true,
      }}
      vendors={vendors.map((v) => ({
        ...v,
        ownerId: v.ownerId ?? null,
        ownerEmail: v.owner?.email ?? null,
        ownerName: v.owner?.name ?? null,
        createdAt: v.createdAt?.toISOString?.() ?? String(v.createdAt),
        updatedAt: v.updatedAt?.toISOString?.() ?? String(v.updatedAt),
      }))}
    />
  );
}
