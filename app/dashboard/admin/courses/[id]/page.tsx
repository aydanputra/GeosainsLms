import { prisma } from '@/utils/prisma';
import CourseDetail from '@/modules/dashboard/pages/admin/CourseDetail';

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  const [course, mentors] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            lessons: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    }),
    prisma.user.findMany({
      where: { role: 'MENTOR' },
      select: { id: true, name: true, email: true }
    })
  ]);

  if (!course) return <div>Kursus tidak ditemukan</div>;

  const formattedMentors = mentors.map(m => ({
    id: m.id,
    name: m.name || m.email
  }));

  return <CourseDetail course={course} mentors={formattedMentors} />;
}
