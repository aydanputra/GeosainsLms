import { notFound } from 'next/navigation';
import { prisma } from '@/utils/prisma';
import BlogListPage from '@/modules/blog/pages/BlogListPage';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const category = await prisma.blogCategory.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!category) notFound();

  return <BlogListPage categorySlug={category.slug} categoryName={category.name} />;
}

