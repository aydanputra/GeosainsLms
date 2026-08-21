import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorCourses from '@/modules/dashboard/pages/mentor/MentorCourses';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const instructorName = user?.name || user?.email || 'Mentor';

  const courses = await prisma.course.findMany({
    where: {
      instructorId: userId,
      deletedAt: null,
    },
    include: {
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formattedCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    price: c.price,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    totalStudents: c._count.enrollments,
    instructorName,
  }));

  return <MentorCourses courses={formattedCourses as any} />;
}
