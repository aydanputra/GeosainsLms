import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
// Import client layout component
import DashboardLayoutClient from '../../modules/dashboard/components/DashboardLayoutClient';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = prisma as any;
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  
  let role = 'ADMIN';
  let userId: string | null = null;
  
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.role) {
      const allowed = new Set(['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR']);
      role = allowed.has(String(payload.role)) ? String(payload.role) : 'STUDENT';
    }
    if (payload?.id) userId = String(payload.id);
  }

  const messagePredicate = {
    OR: [
      { title: { startsWith: 'Admin' } },
      { title: { startsWith: 'Kebijakan' } },
      { title: { startsWith: 'Program' } },
      { title: { startsWith: 'Promo' } },
      { title: { startsWith: 'Diskon' } },
      { title: { startsWith: 'Pesan dari' } },
      { title: { startsWith: 'Direct Message' } },
      { title: { startsWith: 'DM' } },
      { title: { startsWith: 'Pesan Kursus' } },
      { title: { startsWith: 'Pesan Produk' } },
      { title: { startsWith: 'Komentar' } },
      { title: { startsWith: 'Q&A' } },
      { title: { startsWith: 'Balasan dari' } },
      { title: { startsWith: 'Tugas' } },
      { title: { startsWith: 'Pelajaran' } },
      { title: { startsWith: 'Materi' } },
    ],
  };

  let qaUnansweredCount = 0;
  let notificationUnreadCount = 0;
  let dmUnreadCount = 0;
  if (userId) {
    try {
      const [qaCount, alertCount, dmA, dmB] = await Promise.all([
        prisma.notification.count({
          where: { userId, read: false, ...(messagePredicate as any) },
        }),
        prisma.notification.count({
          where: { userId, read: false, NOT: messagePredicate as any },
        }),
        db.directThread.aggregate({
          where: { userAId: userId },
          _sum: { unreadCountA: true },
        }),
        db.directThread.aggregate({
          where: { userBId: userId },
          _sum: { unreadCountB: true },
        }),
      ]);

      dmUnreadCount = Number(dmA?._sum?.unreadCountA || 0) + Number(dmB?._sum?.unreadCountB || 0);
      qaUnansweredCount = Number(qaCount || 0) + dmUnreadCount;
      notificationUnreadCount = Number(alertCount || 0);
    } catch {
      qaUnansweredCount = 0;
      notificationUnreadCount = 0;
      dmUnreadCount = 0;
    }
  }

  return (
    <DashboardLayoutClient
      role={role as any}
      qaUnansweredCount={qaUnansweredCount}
      notificationUnreadCount={notificationUnreadCount}
    >
      {children}
    </DashboardLayoutClient>
  );
}
