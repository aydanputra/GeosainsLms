import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import AdminArticleTaxonomy from '@/modules/dashboard/pages/admin/AdminArticleTaxonomy';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/dashboard/mentor/blog/tags');

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'MENTOR') redirect('/dashboard');

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
      canManage={false}
    />
  );
}

