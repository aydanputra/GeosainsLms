import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentCourses from '@/modules/dashboard/pages/student/StudentCourses';

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
    include: {
      course: {
        include: {
          instructor: {
            select: { name: true, email: true }
          },
          modules: {
            include: { lessons: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch progress separately if not on Enrollment
  const progressRecords = await prisma.userProgress.findMany({
      where: { userId },
      select: { lessonId: true, completed: true }
  });
  
  const completedLessonIds = new Set(progressRecords.filter(p => p.completed).map(p => p.lessonId));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedCourses = enrollments.map((e: any) => {
    // Calculate progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLessons = e.course.modules.flatMap((m: any) => m.lessons);
    const totalLessons = allLessons.length;
    
    // Count completed lessons for this course
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedLessons = allLessons.filter((l: any) => completedLessonIds.has(l.id)).length;
    
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      id: e.course.id,
      slug: e.course.slug,
      title: e.course.title,
      thumbnailUrl: e.course.thumbnailUrl,
      instructorName: e.course.instructor?.name || e.course.instructor?.email || 'Unknown',
      enrolledAt: e.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      progress: progressPercent,
      totalLessons,
      completedLessons,
      status: progressPercent === 100 ? 'COMPLETED' : 'IN_PROGRESS'
    };
  });

  return <StudentCourses courses={formattedCourses} />;
}
