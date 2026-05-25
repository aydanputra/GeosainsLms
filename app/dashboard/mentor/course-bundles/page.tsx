import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import AdminCourseBundles from '@/modules/dashboard/pages/admin/AdminCourseBundles';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const courses = await prisma.course.findMany({
    where: role === 'ADMIN' ? { deletedAt: null } : { instructorId: userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, slug: true, price: true, status: true },
  });

  const courseIds = courses.map((c) => c.id);
  const courseIdSet = new Set(courseIds);

  const bundles =
    role === 'ADMIN'
      ? await prisma.courseBundle.findMany({ orderBy: { updatedAt: 'desc' } })
      : courseIds.length === 0
        ? []
        : (
            await prisma.courseBundle.findMany({
              where: { courseIds: { hasSome: courseIds } },
              orderBy: { updatedAt: 'desc' },
            })
          ).filter((b) => Array.isArray(b.courseIds) && b.courseIds.every((cid) => courseIdSet.has(String(cid))));

  return <AdminCourseBundles bundles={bundles as any} courses={courses as any} />;
}
