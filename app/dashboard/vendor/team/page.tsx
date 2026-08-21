import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import VendorTeam from '@/modules/dashboard/pages/vendor/VendorTeam';

export const dynamic = 'force-dynamic';

type MemberRow = {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId || !role) return <div>Access Denied</div>;

  const vendors = await prisma.shopVendor.findMany({
    where: role === 'ADMIN' ? undefined : { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (role !== 'ADMIN' && vendors.length === 0) return <div>Access Denied</div>;

  const firstVendorId = vendors[0]?.id ? String(vendors[0].id) : '';
  const initialMembers = firstVendorId
    ? await prisma.shopVendorMember.findMany({
        where: { vendorId: firstVendorId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      })
    : [];

  const serializedMembers: MemberRow[] = initialMembers.map((member) => ({
    id: String(member.id),
    role: String(member.role),
    createdAt: member.createdAt instanceof Date ? member.createdAt.toISOString() : String(member.createdAt),
    user: {
      id: String(member.user.id),
      name: member.user.name ?? null,
      email: String(member.user.email),
    },
  }));

  return (
    <VendorTeam
      vendors={vendors.map((v) => ({ id: v.id, name: v.name, slug: v.slug, status: v.status }))}
      initialMembers={serializedMembers}
      initialVendorId={firstVendorId}
    />
  );
}
