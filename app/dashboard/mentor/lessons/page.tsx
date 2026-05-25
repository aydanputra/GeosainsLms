import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorLessons from '@/modules/dashboard/pages/mentor/MentorLessons';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const lessons = await prisma.lesson.findMany({
    where: {
      module: {
        course: {
          instructorId: userId
        }
      }
    },
    include: {
      module: {
        include: {
          course: {
            select: { title: true }
          }
        }
      }
    },
    orderBy: { order: 'asc' }
  });

  const formattedLessons = lessons.map(l => ({
    ...l,
    moduleTitle: l.module.title,
    courseTitle: l.module.course.title
  }));

  return <MentorLessons lessons={formattedLessons} />;
}
