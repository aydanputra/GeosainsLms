import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorAnnouncements from '@/modules/dashboard/pages/mentor/MentorAnnouncements';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  const courses = await prisma.course.findMany({
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
  });

  const courseIds = courses.map((c) => c.id);
  const announcements = courseIds.length
    ? await prisma.announcement.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          course: { select: { title: true } },
          author: { select: { id: true, name: true, email: true } },
        },
      })
    : [];

  return (
    <MentorAnnouncements
      courses={courses}
      announcements={announcements.map((a) => ({
        id: a.id,
        courseId: a.courseId,
        courseTitle: a.course.title,
        title: a.title,
        content: a.content,
        pinned: a.pinned,
        createdAt: a.createdAt.toISOString(),
        authorName: a.author.name || a.author.email,
      }))}
    />
  );
}
