import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorStudents from '@/modules/dashboard/pages/mentor/MentorStudents';

export default async function Page({ searchParams }: { searchParams?: { tab?: string } }) {
  if (searchParams?.tab === 'gradebook') redirect('/dashboard/mentor/gradebook');

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      course: {
        instructorId: userId
      }
    },
    include: {
      user: {
        select: { name: true, email: true }
      },
      course: {
        select: { title: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const formattedStudents = enrollments.map(e => ({
    id: e.id,
    studentName: e.user.name || 'Tidak diketahui',
    studentEmail: e.user.email,
    courseTitle: e.course.title,
    enrolledAt: e.createdAt.toLocaleDateString()
  }));

  return (
    <MentorStudents
      students={formattedStudents}
      defaultTab="students"
      hideTabSwitcher
      pageTitle="Siswa"
      pageDescription="Daftar siswa yang terdaftar di kursus Anda."
    />
  );
}
