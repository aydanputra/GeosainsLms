import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import ProfilePage from '@/modules/profile/pages/ProfilePage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/dashboard/profile');

  const payload = await verifyToken(token);
  if (!payload?.id) redirect('/login?redirect=/dashboard/profile');

  const role = payload?.role === 'ADMIN' || payload?.role === 'MENTOR' || payload?.role === 'STUDENT' ? payload.role : 'STUDENT';

  const user = await prisma.user.findUnique({
    where: { id: String(payload.id) },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      profileCoverUrl: true,
      signatureUrl: true,
      phone: true,
      gender: true,
      birthDate: true,
      country: true,
      province: true,
      city: true,
      address: true,
      socialLinks: true,
      mentorJobTitle: true,
      mentorBio: true,
      mentorSkills: true,
      mentorEducations: true,
      mentorExperiences: true,
      mentorAttachments: true,
      role: true,
        isSuperAdmin: true,
        totpEnabled: true,
        totpVerifiedAt: true,
      createdAt: true,
    } as any,
  });

  if (!user) redirect('/login?redirect=/dashboard/profile');
  if ((user as any).role === 'ADMIN' && Boolean((user as any).isSuperAdmin)) redirect('/dashboard/settings');

  return (
    <ProfilePage
      variant="dashboard"
      initialUser={{
        id: String((user as any).id),
        name: (user as any).name ?? null,
        email: String((user as any).email),
        avatarUrl: (user as any).avatarUrl ?? null,
        profileCoverUrl: (user as any).profileCoverUrl ?? null,
        signatureUrl: (user as any).signatureUrl ?? null,
        phone: (user as any).phone ?? null,
        gender: (user as any).gender ?? null,
        birthDate: (user as any).birthDate ? (user as any).birthDate.toISOString() : null,
        country: (user as any).country ?? null,
        province: (user as any).province ?? null,
        city: (user as any).city ?? null,
        address: (user as any).address ?? null,
        socialLinks: (user as any).socialLinks ?? null,
        mentorJobTitle: (user as any).mentorJobTitle ?? null,
        mentorBio: (user as any).mentorBio ?? null,
        mentorSkills: Array.isArray((user as any).mentorSkills) ? (user as any).mentorSkills : [],
        mentorEducations: (user as any).mentorEducations ?? null,
        mentorExperiences: (user as any).mentorExperiences ?? null,
        mentorAttachments: (user as any).mentorAttachments ?? null,
        role: (user as any).role,
        isSuperAdmin: Boolean((user as any).isSuperAdmin),
        totpEnabled: Boolean((user as any).totpEnabled),
        totpVerifiedAt: (user as any).totpVerifiedAt ? (user as any).totpVerifiedAt.toISOString() : null,
        createdAt: (user as any).createdAt.toISOString(),
      }}
    />
  );
}
