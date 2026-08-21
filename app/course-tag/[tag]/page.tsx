import PublicCoursesCatalogPage from '@/modules/course/pages/PublicCoursesCatalogPage';
import { getPublicCourseCatalogData, getPublicCourseCatalogSettings, getPublicCourseTagSlugs } from '@/modules/public/api/performance';

export const revalidate = 300;

export async function generateStaticParams() {
  return getPublicCourseTagSlugs();
}

export default async function CourseTagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;

  const settings = await getPublicCourseCatalogSettings();
  const mustLogin = settings.studentsMustBeLoggedInToViewCourse === true;

  if (mustLogin) {
    const { resolveCoursePageAccess } = await import('../../courses/[slug]/private-page-access');
    await resolveCoursePageAccess({
      slug: `course-tag/${tag}`,
      mustLogin: true,
      preview: undefined,
      redirectPath: `/course-tag/${encodeURIComponent(tag)}`,
      course: {
        instructorId: '',
        status: 'PUBLISHED',
      },
    });
  }

  const { courses, categories } = await getPublicCourseCatalogData();

  return (
    <PublicCoursesCatalogPage
      initialTagSlug={tag}
      initialCourses={courses as any}
      initialCategories={categories}
      hydratedFromServer
    />
  );
}
