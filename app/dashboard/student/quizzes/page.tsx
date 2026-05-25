import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentQuizzes from '@/modules/dashboard/pages/student/StudentQuizzes';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const attempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    include: {
      quiz: {
        include: {
          lesson: {
            include: {
              module: {
                include: {
                  course: {
                    select: { title: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  const formattedQuizzes = attempts.map((a) => ({
    id: a.id,
    quizTitle: a.quiz.lesson?.title || a.quiz.title || 'Quiz',
    courseTitle: a.quiz.lesson?.module?.course?.title || '-',
    score: a.score,
    completedAt: (a.completedAt || a.startedAt).toLocaleDateString('id-ID'),
  }));

  return <StudentQuizzes quizzes={formattedQuizzes} />;
}
