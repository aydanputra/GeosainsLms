import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import ArticleEditor from '@/modules/dashboard/pages/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect(`/login?redirect=/dashboard/mentor/blog/${id}`);

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || role !== 'MENTOR') redirect('/dashboard');

  let post: any | null = null;
  try {
    post = await prisma.post.findFirst({
      where: { id, authorId: userId },
      include: { category: true, tags: { include: { tag: true } } },
    });
  } catch {
    post = await prisma.post.findFirst({ where: { id, authorId: userId } });
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
      basePath="/dashboard/mentor/blog"
      categories={categories}
      tags={tags}
      initialPost={formattedPost}
      canManageTaxonomy={false}
    />
  );
}

