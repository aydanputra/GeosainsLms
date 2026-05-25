import AdminCourseSettings from '@/modules/dashboard/pages/admin/AdminCourseSettings';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;
  const payload = await verifyToken(token);
  if (!payload?.id || payload.role !== 'ADMIN') return <div>Access Denied</div>;

  const actor = await prisma.user.findUnique({ where: { id: String(payload.id) }, select: { isSuperAdmin: true } });
  if (!actor?.isSuperAdmin) return <div>Access Denied</div>;

  return <AdminCourseSettings />;
}
