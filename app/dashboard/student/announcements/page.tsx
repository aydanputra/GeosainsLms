import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentAnnouncements from '@/modules/dashboard/pages/student/StudentAnnouncements';
import { CourseStatus } from '@prisma/client';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true, createdAt: true, course: { select: { title: true, status: true, validityDays: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const activeCourseIds = enrollments
    .filter((e) => {
      if (e.course.status !== CourseStatus.PUBLISHED) return false;
      const validityDays = e.course.validityDays;
      if (validityDays && validityDays > 0) {
        const expiresAt = new Date(e.createdAt);
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        return new Date() <= expiresAt;
      }
      return true;
    })
    .map((e) => e.courseId);

  const announcements = activeCourseIds.length
    ? await prisma.announcement.findMany({
        where: { courseId: { in: activeCourseIds } },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          course: { select: { title: true } },
          author: { select: { name: true, email: true } },
          reads: { where: { userId }, select: { id: true } },
        },
      })
    : [];

  return (
    <StudentAnnouncements
      announcements={announcements.map((a) => ({
        id: a.id,
        courseTitle: a.course.title,
        title: a.title,
        content: a.content,
        pinned: a.pinned,
        createdAt: a.createdAt.toISOString(),
        authorName: a.author.name || a.author.email || 'Mentor',
        isRead: a.reads.length > 0,
      }))}
    />
  );
}
