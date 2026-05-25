import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorQuizzes from '@/modules/dashboard/pages/mentor/MentorQuizzes';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const quizzes = await prisma.quiz.findMany({
    where: {
      lesson: {
        module: {
          course: {
            instructorId: userId
          }
        }
      }
    },
    include: {
      lesson: {
        include: {
          module: {
            include: {
              course: {
                select: { title: true }
              }
            }
          }
        }
      },
      _count: {
        select: { questions: true }
      }
    }
  });

  const formattedQuizzes = quizzes.map(q => ({
    id: q.id,
    lessonTitle: q.lesson.title,
    questionCount: q._count.questions,
    courseTitle: q.lesson.module.course.title
  }));

  return <MentorQuizzes quizzes={formattedQuizzes} />;
}
