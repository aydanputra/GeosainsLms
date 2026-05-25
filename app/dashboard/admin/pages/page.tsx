import { prisma } from '@/utils/prisma';
import AdminPages from '@/modules/dashboard/pages/admin/AdminPages';

export default async function Page() {
  const pages = await prisma.page.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return <AdminPages pages={pages} />;
}
