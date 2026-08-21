import type { MetadataRoute } from 'next';
import { prisma } from '@/utils/prisma';
import { getAppUrl } from '@/modules/core/utils/appUrl';

function toUrl(appUrl: string, path: string) {
  return `${appUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getAppUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: toUrl(appUrl, '/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: toUrl(appUrl, '/courses'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: toUrl(appUrl, '/blog'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: toUrl(appUrl, '/shop'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: toUrl(appUrl, '/geoservices'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: toUrl(appUrl, '/bundles'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: toUrl(appUrl, '/privacy'), lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: toUrl(appUrl, '/terms'), lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const [pages, courses, posts, bundles, products, vendors] = await Promise.all([
      prisma.page.findMany({
        where: { published: true, slug: { notIn: ['home', '__site_settings__'] } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.course.findMany({
        where: { status: 'PUBLISHED', deletedAt: null, isPublic: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.post.findMany({
        where: { published: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.courseBundle.findMany({
        where: { published: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.product.findMany({
        where: { slug: { not: null } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.shopVendor.findMany({
        where: { status: 'APPROVED' },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticRoutes,
      ...pages
        .filter((page) => page.slug && !page.slug.startsWith('__'))
        .map((page) => ({
          url: toUrl(appUrl, `/${page.slug}`),
          lastModified: page.updatedAt,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        })),
      ...courses.map((course) => ({
        url: toUrl(appUrl, `/courses/${course.slug}`),
        lastModified: course.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...posts.map((post) => ({
        url: toUrl(appUrl, `/blog/${post.slug}`),
        lastModified: post.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...bundles.map((bundle) => ({
        url: toUrl(appUrl, `/bundles/${bundle.slug}`),
        lastModified: bundle.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...products
        .filter((product): product is { slug: string; updatedAt: Date } => Boolean(product.slug))
        .map((product) => ({
          url: toUrl(appUrl, `/shop/products/${product.slug}`),
          lastModified: product.updatedAt,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        })),
      ...vendors.map((vendor) => ({
        url: toUrl(appUrl, `/vendor/${vendor.slug}`),
        lastModified: vendor.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
