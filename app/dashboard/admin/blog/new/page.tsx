import { prisma } from '@/utils/prisma';
import ArticleEditor from '@/modules/dashboard/pages/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let categories: any[] = [];
  let tags: any[] = [];
  try {
    categories = await prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });
    tags = await prisma.blogTag.findMany({ orderBy: { name: 'asc' } });
  } catch {
    categories = [];
    tags = [];
  }

  return (
    <ArticleEditor
      mode="CREATE"
      basePath="/dashboard/admin/blog"
      categories={categories}
      tags={tags}
      canManageTaxonomy={true}
    />
  );
}

