import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import ArticleEditor from '@/modules/dashboard/pages/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/dashboard/mentor/blog/new');

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'MENTOR') redirect('/dashboard');

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
      basePath="/dashboard/mentor/blog"
      categories={categories}
      tags={tags}
      canManageTaxonomy={false}
    />
  );
}

