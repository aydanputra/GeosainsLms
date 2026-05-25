import { prisma } from '@/utils/prisma';
import CourseProgress from '@/modules/dashboard/pages/admin/CourseProgress';

export default async function Page({ params }: { params: { id: string } }) {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  const totalLessons = await prisma.lesson.count({
    where: { module: { courseId: params.id } },
  });

  const byUser = await prisma.userProgress.groupBy({
    by: ['userId'],
    where: {
      completed: true,
      lesson: { module: { courseId: params.id } },
    },
    _count: { _all: true },
  });
  const completedByUser = new Map<string, number>();
  for (const row of byUser) {
    completedByUser.set(row.userId, row._count._all);
  }

  const formattedProgress = enrollments.map((e) => {
    const completedLessons = completedByUser.get(e.user.id) || 0;
    const progress = totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
    return {
      id: e.user.id,
      studentName: e.user.name || 'Unknown',
      email: e.user.email,
      progress,
      completed: totalLessons > 0 && completedLessons >= totalLessons,
    };
  });

  return <CourseProgress progressData={formattedProgress} />;
}
