import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentCertificates from '@/modules/dashboard/pages/student/StudentCertificates';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const certificates = await prisma.certificate.findMany({
    where: { userId },
    include: {
      course: {
        select: { title: true }
      }
    },
    orderBy: { issuedAt: 'desc' }
  });

  const formattedCertificates = certificates.map(c => ({
    id: c.id,
    courseTitle: c.course.title,
    serial: c.serial,
    issuedAt: c.issuedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }));

  return <StudentCertificates certificates={formattedCertificates} />;
}
