import { prisma } from '@/utils/prisma';
import AdminShopCategories from '@/modules/dashboard/pages/admin/AdminShopCategories';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const payload = token ? await verifyToken(token) : null;
  const role = payload?.role ? String(payload.role) : null;
  const userId = payload?.id ? String(payload.id) : '';

  const isVendorApproved =
    role === 'ADMIN'
      ? true
      : role === 'MENTOR' && userId
        ? !!(await prisma.shopVendor.findFirst({
            where: {
              status: 'APPROVED',
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
            select: { id: true },
          }))
        : false;

  const categories = await prisma.productCategoryModel.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <AdminShopCategories
      permissions={{
        canCreate: isVendorApproved,
        canEdit: role === 'ADMIN',
        canDelete: role === 'ADMIN',
      }}
      categories={categories.map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString?.() ?? String(c.createdAt),
        updatedAt: c.updatedAt?.toISOString?.() ?? String(c.updatedAt),
      }))}
    />
  );
}
