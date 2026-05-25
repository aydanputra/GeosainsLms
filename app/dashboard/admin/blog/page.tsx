import { prisma } from '@/utils/prisma';
import ArticleList from '@/modules/dashboard/pages/admin/ArticleList';

export default async function Page() {
  let posts: any[] = [];
  try {
    posts = await prisma.post.findMany({
      include: {
        author: {
          select: { name: true, email: true },
        },
        category: true,
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    posts = await prisma.post.findMany({
      include: {
        author: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  const formattedPosts = posts.map((p: any) => ({
    ...p,
    authorName: p.author?.name || p.author?.email || 'Unknown',
    categoryName: p.category?.name || '',
    tagNames: Array.isArray(p.tags) ? p.tags.map((t: any) => t.tag?.name).filter(Boolean) : [],
  }));

  return <ArticleList posts={formattedPosts} basePath="/dashboard/admin/blog" canManage={true} />;
}
