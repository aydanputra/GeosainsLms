import BlogListPage from '@/modules/blog/pages/BlogListPage';
import { getPublicBlogPosts } from '@/modules/public/api/performance';

export const revalidate = 300;

export default async function Page() {
  const posts = await getPublicBlogPosts();

  return <BlogListPage initialPosts={posts} />;
}
