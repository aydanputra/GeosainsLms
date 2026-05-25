import { notFound } from 'next/navigation';
import { prisma } from '@/utils/prisma';
import BlogListPage from '@/modules/blog/pages/BlogListPage';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const tag = await prisma.blogTag.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!tag) notFound();

  return <BlogListPage tagSlug={tag.slug} tagName={tag.name} />;
}

