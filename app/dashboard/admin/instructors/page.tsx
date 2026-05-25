import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import AdminInstructors from '@/modules/dashboard/pages/admin/AdminInstructors';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  return <AdminInstructors />;
}

