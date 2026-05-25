import { notFound } from 'next/navigation';
import { prisma } from '@/utils/prisma';
import ArticleEditor from '@/modules/dashboard/pages/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let post: any | null = null;
  try {
    post = await prisma.post.findUnique({
      where: { id },
      include: { category: true, tags: { include: { tag: true } } },
    });
  } catch {
    post = await prisma.post.findUnique({ where: { id } });
  }

  if (!post) notFound();

  const formattedPost = {
    ...post,
    tagNames: Array.isArray(post.tags) ? post.tags.map((t: any) => t.tag?.name).filter(Boolean) : [],
  };

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
      mode="EDIT"
      basePath="/dashboard/admin/blog"
      categories={categories}
      tags={tags}
      initialPost={formattedPost}
      canManageTaxonomy={true}
    />
  );
}

