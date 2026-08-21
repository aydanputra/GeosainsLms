import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import ProfilePage from '@/modules/profile/pages/ProfilePage';
import { getProfilePageInitialData } from '@/modules/profile/api/performance';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login?redirect=/dashboard/settings');

  const payload = await verifyToken(token);
  if (!payload?.id) redirect('/login?redirect=/dashboard/settings');

  const profileData = await getProfilePageInitialData(String(payload.id));

  if (!profileData) redirect('/login?redirect=/dashboard/settings');

  return (
    <ProfilePage
      variant="dashboard"
      mode="settings"
      initialUser={profileData.initialUser as any}
      initialMeData={profileData.initialMeData as any}
      initialStudentStats={profileData.initialStudentStats as any}
      initialEnrolledCoursesData={profileData.initialEnrolledCoursesData as any}
      initialCertificatesData={profileData.initialCertificatesData as any}
      initialMentorStats={profileData.initialMentorStats as any}
      initialMentorCoursesData={profileData.initialMentorCoursesData as any}
      initialMentorPostsData={profileData.initialMentorPostsData as any}
    />
  );
}
