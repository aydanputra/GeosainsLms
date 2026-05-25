import { prisma } from '@/utils/prisma';
import AdminArticleTaxonomy from '@/modules/dashboard/pages/admin/AdminArticleTaxonomy';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let tags: any[] = [];
  try {
    tags = await prisma.blogTag.findMany({ orderBy: { name: 'asc' } });
  } catch {
    tags = [];
  }

  return (
    <AdminArticleTaxonomy
      kind="TAG"
      items={tags.map((t) => ({
        ...t,
        createdAt: t.createdAt?.toISOString?.() ?? String(t.createdAt),
        updatedAt: t.updatedAt?.toISOString?.() ?? String(t.updatedAt),
      }))}
      canManage={true}
    />
  );
}

