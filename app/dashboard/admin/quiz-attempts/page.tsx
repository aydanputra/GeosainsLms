import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import AdminQuizAttempts from '@/modules/dashboard/pages/admin/AdminQuizAttempts';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  const courses = await prisma.course.findMany({
    where: { deletedAt: null },
    orderBy: { title: 'asc' },
    select: { id: true, title: true },
  });

  return <AdminQuizAttempts courses={courses} />;
}

