import PublicCoursesCatalogPage from '@/modules/course/pages/PublicCoursesCatalogPage';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';
import { getPublicCourseCatalogData, getPublicCourseCatalogSettings } from '@/modules/public/api/performance';

export const revalidate = 300;

export default async function CoursesPage() {
  const settings = await getPublicCourseCatalogSettings();
  const mustLogin = settings.studentsMustBeLoggedInToViewCourse === true;

  if (mustLogin) {
    const token = (await cookies()).get('token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user) redirect('/login?redirect=/courses');
  }

  const { courses, categories } = await getPublicCourseCatalogData();

  return <PublicCoursesCatalogPage initialCourses={courses as any} initialCategories={categories} hydratedFromServer />;
}
