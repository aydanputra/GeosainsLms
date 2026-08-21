import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import PostDetail from '@/modules/blog/components/PostDetail';
import { prisma } from '@/utils/prisma';
import { getAppUrl } from '@/modules/core/utils/appUrl';
import { sanitizeRichHtml } from '@/modules/core/utils/sanitizeHtml';
import { getPublishedBlogSlugs } from '@/modules/public/api/performance';

export const revalidate = 300;

export async function generateStaticParams() {
  return getPublishedBlogSlugs();
}

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizePublicUrl(appUrl: string, value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim();
  if (!v || v.startsWith('blob:')) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('/')) return `${appUrl}${v}`;
  return null;
}

const getSiteSettingsPage = unstable_cache(
  async () => {
    return prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
  },
  ['blog-post-site-settings'],
  { revalidate: 300 }
);

const getPublishedPost = unstable_cache(
  async (slug: string) => {
    return prisma.post.findFirst({
      where: { slug, published: true },
      include: {
        author: { select: { name: true, email: true } },
        category: true,
        tags: { include: { tag: true } },
      },
    });
  },
  ['blog-post-public-detail'],
  { revalidate: 300 }
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const appUrl = getAppUrl();
  const [post, siteSettingsPage] = await Promise.all([getPublishedPost(slug), getSiteSettingsPage()]);
  const parsed = safeParse(siteSettingsPage?.content);
  const siteName = typeof parsed.siteName === 'string' && parsed.siteName.trim() ? parsed.siteName.trim() : 'GeoSains LMS';
  const fallbackDescription =
    typeof parsed.siteDescription === 'string' && parsed.siteDescription.trim() ? parsed.siteDescription.trim() : 'Artikel terbaru dari GeoSains LMS.';
  const canonical = `${appUrl}/blog/${encodeURIComponent(slug)}`;

  if (!post) {
    return { alternates: { canonical } };
  }

  const description =
    (typeof post.excerpt === 'string' && post.excerpt.trim()) ||
    (typeof post.content === 'string' && post.content.replace(/<[^>]+>/g, ' ').trim()) ||
    fallbackDescription;
  const image =
    normalizePublicUrl(appUrl, typeof post.featuredImageUrl === 'string' ? post.featuredImageUrl : null) ||
    normalizePublicUrl(appUrl, typeof parsed.logoUrl === 'string' ? parsed.logoUrl : null);
  const images = image ? [{ url: image }] : [];
  const title = `${post.title} | ${siteName}`;

  return {
    title,
    description: String(description).slice(0, 180),
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title,
      description: String(description).slice(0, 180),
      siteName,
      images,
    },
    twitter: {
      card: images.length > 0 ? 'summary_large_image' : 'summary',
      title,
      description: String(description).slice(0, 180),
      images: images.length > 0 ? images.map((item) => item.url) : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) return notFound();

  return (
    <PostDetail
      post={{
        id: String(post.id),
        title: String(post.title),
        content: sanitizeRichHtml(post.content),
        excerpt: typeof post.excerpt === 'string' ? post.excerpt : null,
        publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
        featuredImageUrl: typeof post.featuredImageUrl === 'string' ? post.featuredImageUrl : null,
        category: post.category ? { name: String(post.category.name), slug: String(post.category.slug) } : null,
        tags: Array.isArray(post.tags)
          ? post.tags.map((tagLink) => ({
              tag: tagLink.tag ? { name: String(tagLink.tag.name), slug: String(tagLink.tag.slug) } : undefined,
            }))
          : [],
        author: {
          name: String(post.author?.name || post.author?.email || 'GeoSains'),
          email: typeof post.author?.email === 'string' ? post.author.email : undefined,
        },
      }}
    />
  );
}
