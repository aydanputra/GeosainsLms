import { notFound } from 'next/navigation';
import PageRenderer from '@/modules/pages/components/PageRenderer';
import { getPublicCmsPageData, getPublicCmsPageSlugs } from '@/modules/public/api/performance';

export const revalidate = 300;

export async function generateStaticParams() {
  const pages = await getPublicCmsPageSlugs();
  return pages.map((page) => ({
    slug: page.segments,
  }));
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const slugString = Array.isArray(slug) ? slug.join('/') : '';

  if (!slugString) {
    notFound();
  }

  const page = await getPublicCmsPageData(slugString);

  if (!page) {
    notFound();
  }

  return (
    <PageRenderer
      blocks={page.blocks}
      initialCourses={page.initialCourses}
      coursesHydratedFromServer
      initialVendors={page.initialVendors}
      vendorsHydratedFromServer
    />
  );
}
