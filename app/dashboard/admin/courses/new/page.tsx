import CourseForm from '@/modules/dashboard/pages/admin/CourseForm';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;
  const payload = await verifyToken(token);
  if (!payload?.id || payload.role !== 'ADMIN') return <div>Access Denied</div>;

  return <CourseForm />;
}
