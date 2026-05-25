import { prisma } from '@/utils/prisma';
import AdminCourseBundles from '@/modules/dashboard/pages/admin/AdminCourseBundles';

export default async function Page() {
  const [bundles, courses] = await Promise.all([
    prisma.courseBundle.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.course.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, slug: true, price: true, status: true },
    }),
  ]);

  return <AdminCourseBundles bundles={bundles as any} courses={courses as any} />;
}

