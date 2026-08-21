import { notFound } from 'next/navigation';
import BlogListPage from '@/modules/blog/pages/BlogListPage';
import { getPublicBlogCategory, getPublicBlogCategorySlugs, getPublicBlogPosts } from '@/modules/public/api/performance';

export const revalidate = 300;

export async function generateStaticParams() {
  return getPublicBlogCategorySlugs();
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, posts] = await Promise.all([
    getPublicBlogCategory(slug),
    getPublicBlogPosts({ categorySlug: slug }),
  ]);

  if (!category) notFound();

  return <BlogListPage categorySlug={category.slug} categoryName={category.name} initialPosts={posts} />;
}
