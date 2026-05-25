import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import CourseForm from '@/modules/dashboard/pages/admin/CourseForm';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  return <CourseForm courseId={id} />;
}

