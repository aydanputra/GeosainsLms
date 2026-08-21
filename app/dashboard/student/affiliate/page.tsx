import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentAffiliate from '@/modules/dashboard/pages/student/StudentAffiliate';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const stats = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: {
      withdrawals: true,
      commissions: true
    }
  });

  return <StudentAffiliate stats={stats} isMentor={role === 'MENTOR'} />;
}
