import { prisma } from '@/utils/prisma';
import AdminCourses from '@/modules/dashboard/pages/admin/AdminCourses';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [courses, bundles] = await Promise.all([
    prisma.course.findMany({
      where: {
        deletedAt: null
      },
      include: {
        instructor: {
          select: { name: true, email: true }
        },
        _count: {
          select: { enrollments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.courseBundle.findMany({
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const formattedCourses = courses.map(c => ({
    ...c,
    instructorName: c.instructor?.name || c.instructor?.email || 'Unknown',
    totalStudents: c._count.enrollments,
    createdAt: c.createdAt.toISOString()
  }));

  const formattedBundles = bundles.map((b) => ({
    ...b,
    updatedAt: b.updatedAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }));

  return <AdminCourses courses={formattedCourses} bundles={formattedBundles as any} />;
}
