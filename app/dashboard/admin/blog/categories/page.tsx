import { prisma } from '@/utils/prisma';
import AdminArticleTaxonomy from '@/modules/dashboard/pages/admin/AdminArticleTaxonomy';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let categories: any[] = [];
  try {
    categories = await prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });
  } catch {
    categories = [];
  }

  return (
    <AdminArticleTaxonomy
      kind="CATEGORY"
      items={categories.map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString?.() ?? String(c.createdAt),
        updatedAt: c.updatedAt?.toISOString?.() ?? String(c.updatedAt),
      }))}
      canManage={true}
    />
  );
}

