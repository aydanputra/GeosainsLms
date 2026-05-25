import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import AdminCourseReportDetail from '@/modules/dashboard/pages/admin/AdminCourseReportDetail';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  if (!courseId) return <div>Kursus tidak ditemukan</div>;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, slug: true, deletedAt: true },
  });
  if (!course || course.deletedAt) return <div>Kursus tidak ditemukan</div>;

  return <AdminCourseReportDetail courseId={course.id} courseTitle={course.title} courseSlug={course.slug} />;
}
