import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import AdminArticleTaxonomy from '@/modules/dashboard/pages/admin/AdminArticleTaxonomy';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/dashboard/mentor/blog/categories');

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'MENTOR') redirect('/dashboard');

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
      canManage={false}
    />
  );
}

