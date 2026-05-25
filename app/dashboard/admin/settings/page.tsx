import AdminSettings from '@/modules/dashboard/pages/admin/AdminSettings';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;
  const payload = await verifyToken(token);
  if (!payload?.id || payload.role !== 'ADMIN') return <div>Access Denied</div>;

  const actorId = String(payload.id);
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
  return <AdminSettings isSuperAdmin={Boolean(actor?.isSuperAdmin)} />;
}
