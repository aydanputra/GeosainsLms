import { prisma } from '@/utils/prisma';
import CourseQuizzes from '@/modules/dashboard/pages/admin/CourseQuizzes';

export default async function Page({ params }: { params: { id: string } }) {
  const quizzes = await prisma.quiz.findMany({
    where: {
      lesson: {
        module: {
          courseId: params.id
        }
      }
    },
    include: {
      lesson: { select: { title: true } },
      _count: { select: { questions: true } }
    }
  });

  const formattedQuizzes = quizzes.map(q => ({
    id: q.id,
    title: q.lesson.title,
    questionCount: q._count.questions
  }));

  return <CourseQuizzes courseId={params.id} quizzes={formattedQuizzes} />;
}
