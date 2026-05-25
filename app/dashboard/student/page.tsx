import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentDashboard from '@/modules/dashboard/pages/student/StudentDashboard';

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
    where: { userId, course: { deletedAt: null } },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          modules: {
            select: {
              lessons: {
                select: { id: true }
              }
            }
          }
        }
      }
    }
  });

  const coursesWithProgress = [];
  const quizAgg = await prisma.quizAttempt.aggregate({
    where: { userId, completedAt: { not: null } },
    _avg: { score: true },
  });
  const totalScore = Math.round(quizAgg._avg.score ?? 0);

  for (const enrollment of enrollments) {
    const allLessons = enrollment.course.modules.flatMap(m => m.lessons);
    const totalLessons = allLessons.length;
    
    const progressRecords = await prisma.userProgress.findMany({
      where: {
        userId,
        lessonId: { in: allLessons.map(l => l.id) }
      }
    });

    const completedLessons = progressRecords.filter(p => p.completed).length;
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    
    coursesWithProgress.push({
      title: enrollment.course.title,
      progress,
      status: progress === 100 ? 'Selesai' : 'Sedang Berjalan'
    });
  }

  const completedCourses = coursesWithProgress.filter(c => c.progress === 100).length;
  const inProgressCourses = coursesWithProgress.filter(c => c.progress < 100).length;

  const affiliateStats = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: {
      withdrawals: true,
      commissions: true
    }
  });

  return <StudentDashboard stats={{ completedCourses, inProgressCourses, totalScore }} courses={coursesWithProgress} affiliateStats={affiliateStats} />;
}
