import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentDashboard from '@/modules/dashboard/pages/student/StudentDashboard';
import { getEnrolledCourses } from '@/modules/course/api/service';
import { getCourseRuntimeSettings } from '@/modules/course/api/performance';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const [enrolledCourses, quizAgg, affiliateStats, courseSettings] = await Promise.all([
    getEnrolledCourses(userId),
    prisma.quizAttempt.aggregate({
      where: { userId, completedAt: { not: null } },
      _avg: { score: true },
    }),
    prisma.affiliateProfile.findUnique({
      where: { userId },
      include: {
        withdrawals: true,
        commissions: true,
      },
    }),
    getCourseRuntimeSettings(),
  ]);

  const totalScore = Math.round(quizAgg._avg.score ?? 0);

  const coursesWithProgress = enrolledCourses.map((course: any) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    thumbnailUrl: course.thumbnailUrl,
    instructorName: course.instructorName,
    enrolledAt: course.enrolledAt,
    progress: Number(course.progress) || 0,
    totalLessons: Number(course.totalLessons) || 0,
    completedLessons: Number(course.completedLessons) || 0,
    status: Number(course.progress) >= 100 ? 'Selesai' : 'Sedang Berjalan',
  }));

  const completedCourses = coursesWithProgress.filter(c => c.progress === 100).length;
  const inProgressCourses = coursesWithProgress.filter(c => c.progress < 100).length;

  return (
    <StudentDashboard
      stats={{ completedCourses, inProgressCourses, totalScore }}
      courses={coursesWithProgress}
      affiliateStats={affiliateStats}
      becomeInstructorEnabled={courseSettings.becomeInstructorButtonEnabled === true}
    />
  );
}
