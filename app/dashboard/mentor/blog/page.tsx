import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import ArticleList from '@/modules/dashboard/pages/admin/ArticleList';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/dashboard/mentor/blog');

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || role !== 'MENTOR') redirect('/dashboard');

  let posts: any[] = [];
  try {
    posts = await prisma.post.findMany({
      where: { authorId: userId },
      include: { author: { select: { name: true, email: true } }, category: true, tags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    posts = await prisma.post.findMany({
      where: { authorId: userId },
      include: { author: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  const formattedPosts = posts.map((p: any) => ({
    ...p,
    authorName: p.author?.name || p.author?.email || 'Unknown',
    categoryName: p.category?.name || '',
    tagNames: Array.isArray(p.tags) ? p.tags.map((t: any) => t.tag?.name).filter(Boolean) : [],
  }));

  return <ArticleList posts={formattedPosts} basePath="/dashboard/mentor/blog" canManage={false} />;
}
