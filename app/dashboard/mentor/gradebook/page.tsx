import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import MentorStudents from '@/modules/dashboard/pages/mentor/MentorStudents';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const role = payload?.role ? String(payload.role) : null;
  if (role !== 'MENTOR' && role !== 'ADMIN') return <div>Access Denied</div>;

  return (
    <MentorStudents
      students={[]}
      defaultTab="gradebook"
      hideTabSwitcher
      pageTitle="Gradebook"
      pageDescription="Rekap quiz & tugas dari siswa di kursus Anda."
    />
  );
}

