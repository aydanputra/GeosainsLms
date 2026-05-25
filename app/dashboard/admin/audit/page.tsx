import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import AdminAudit from '@/modules/dashboard/pages/admin/AdminAudit';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  if (!payload?.id || payload.role !== 'ADMIN') return <div>Access Denied</div>;

  return <AdminAudit />;
}
