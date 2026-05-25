import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardIndexPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    redirect('/login?redirect=/dashboard');
  }

  const user = await verifyToken(token);
  const role = user?.role ? String(user.role) : null;
  if (!role) {
    redirect('/login?redirect=/dashboard');
  }

  if (role === 'ADMIN') redirect('/dashboard/admin');
  if (role === 'MENTOR') redirect('/dashboard/mentor');
  if (role === 'VENDOR' || role === 'VENDOR_STAFF') redirect('/dashboard/vendor');
  redirect('/dashboard/student');
}

