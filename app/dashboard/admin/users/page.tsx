import { prisma } from '@/utils/prisma';
import AdminUsers from '@/modules/dashboard/pages/admin/AdminUsers';

export default async function Page() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const formattedUsers = users.map(u => ({
    id: u.id,
    name: u.name || 'Unknown',
    email: u.email,
    role: u.role,
    isSuperAdmin: Boolean((u as any).isSuperAdmin),
    status: 'ACTIVE' // Mock status as Prisma schema doesn't have status field for User yet
  }));

  return <AdminUsers users={formattedUsers} />;
}
