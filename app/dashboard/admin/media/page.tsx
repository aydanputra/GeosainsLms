import { prisma } from '@/utils/prisma';
import AdminMedia from '@/modules/dashboard/pages/admin/AdminMedia';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  const items = await prisma.mediaAsset.findMany({
    take: 60,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const total = await prisma.mediaAsset.count();

  return <AdminMedia initialItems={items} initialTotal={total} />;
}

