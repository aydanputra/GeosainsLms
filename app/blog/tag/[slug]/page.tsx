import { notFound } from 'next/navigation';
import BlogListPage from '@/modules/blog/pages/BlogListPage';
import { getPublicBlogPosts, getPublicBlogTag, getPublicBlogTagSlugs } from '@/modules/public/api/performance';

export const revalidate = 300;

export async function generateStaticParams() {
  return getPublicBlogTagSlugs();
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [tag, posts] = await Promise.all([
    getPublicBlogTag(slug),
    getPublicBlogPosts({ tagSlug: slug }),
  ]);

  if (!tag) notFound();

  return <BlogListPage tagSlug={tag.slug} tagName={tag.name} initialPosts={posts} />;
}
