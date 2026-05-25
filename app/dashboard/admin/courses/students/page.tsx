import { prisma } from '@/utils/prisma';
import AdminCourseStudents from '@/modules/dashboard/pages/admin/AdminCourseStudents';
 
export const dynamic = 'force-dynamic';
 
export default async function Page() {
  const users = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      enrollments: {
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          course: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } },
        },
      },
    },
  });
 
  const students = users.map((u) => {
    const validEnrollments = u.enrollments.filter((e) => e.course && !e.course.deletedAt);
    const courseMap = new Map<
      string,
      {
        id: string;
        title: string;
        slug: string;
        status: string;
        enrolledAt: string;
      }
    >();
 
    for (const e of validEnrollments) {
      const c = e.course!;
      if (!courseMap.has(c.id)) {
        courseMap.set(c.id, {
          id: c.id,
          title: c.title,
          slug: c.slug,
          status: c.status,
          enrolledAt: e.createdAt.toISOString(),
        });
      }
    }
 
    const courses = Array.from(courseMap.values()).sort((a, b) => (a.enrolledAt < b.enrolledAt ? 1 : -1));
    const lastEnrolledAt = validEnrollments[0]?.createdAt ? validEnrollments[0].createdAt.toISOString() : null;
 
    return {
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      registeredAt: u.createdAt.toISOString(),
      totalCourses: courses.length,
      lastEnrolledAt,
      courses,
    };
  });
 
  return <AdminCourseStudents students={students} />;
}
