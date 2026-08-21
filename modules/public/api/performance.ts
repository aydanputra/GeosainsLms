import { CourseStatus, ProductCategory } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/utils/prisma';
import { sanitizePageBlocks } from '@/modules/core/utils/sanitizeHtml';

const PUBLIC_REVALIDATE = 300;

type ShopSort = 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME_ASC';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizePublicMediaUrl(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return null;
  return trimmed;
}

function stripHtml(input: string | null | undefined) {
  if (typeof input !== 'string' || !input.trim()) return '';
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateText(input: string, maxLength = 180) {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength).trimEnd()}...`;
}

function normalizeShopSort(input: unknown): ShopSort {
  const raw = typeof input === 'string' ? input.trim().toUpperCase() : '';
  return raw === 'PRICE_ASC' || raw === 'PRICE_DESC' || raw === 'NAME_ASC' ? raw : 'NEWEST';
}

function toBlockLimit(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(24, Math.trunc(value))) : fallback;
}

function safeJsonParse(content: unknown) {
  if (typeof content !== 'string' || !content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getPageDataLimits(blocks: Array<{ type: string; content: unknown }>) {
  let courseLimit = 0;
  let vendorLimit = 0;

  const inspectBlock = (blockType: string, content: unknown) => {
    if (!content || typeof content !== 'object') return;

    if (blockType === 'COURSES') {
      courseLimit = Math.max(courseLimit, toBlockLimit((content as { limit?: unknown }).limit, 6));
    }

    if (blockType === 'VENDORS') {
      vendorLimit = Math.max(vendorLimit, toBlockLimit((content as { limit?: unknown }).limit, 6));
    }

    if (blockType !== 'SECTION') return;

    const columns = Array.isArray((content as { columns?: unknown }).columns)
      ? (content as { columns: Array<{ widgets?: unknown }> }).columns
      : [];

    for (const column of columns) {
      const widgets = Array.isArray(column?.widgets) ? column.widgets : [];
      for (const widget of widgets) {
        if (!widget || typeof widget !== 'object') continue;
        const widgetType = typeof (widget as { type?: unknown }).type === 'string' ? (widget as { type: string }).type : '';
        const widgetContentRaw = (widget as { content?: unknown }).content;
        const widgetContent =
          typeof widgetContentRaw === 'string'
            ? safeJsonParse(widgetContentRaw)
            : widgetContentRaw && typeof widgetContentRaw === 'object'
              ? (widgetContentRaw as Record<string, unknown>)
              : null;
        inspectBlock(widgetType, widgetContent);
      }
    }
  };

  for (const block of blocks) {
    const content = typeof block.content === 'string' ? safeJsonParse(block.content) : block.content;
    inspectBlock(block.type, content);
  }

  return {
    courseLimit,
    vendorLimit,
  };
}

const getCachedPublicCourseCatalogData = unstable_cache(
  async () => {
    const [courses, categories] = await Promise.all([
      prisma.course.findMany({
        where: {
          deletedAt: null,
          status: CourseStatus.PUBLISHED,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          thumbnailUrl: true,
          price: true,
          normalPrice: true,
          level: true,
          categoryId: true,
          tags: true,
          createdAt: true,
          instructor: { select: { name: true, email: true } },
          category: { select: { name: true } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const ratings =
      courses.length > 0
        ? await prisma.courseReview.groupBy({
            by: ['courseId'],
            where: { courseId: { in: courses.map((course) => course.id) } },
            _avg: { rating: true },
            _count: { rating: true },
          })
        : [];

    const ratingMap = new Map(
      ratings.map((rating) => [
        rating.courseId,
        {
          ratingAvg: rating._avg.rating ?? 0,
          ratingCount: rating._count.rating ?? 0,
        },
      ])
    );

    return {
      courses: courses.map((course) => ({
        ...course,
        thumbnailUrl: normalizePublicMediaUrl(course.thumbnailUrl),
        ratingAvg: ratingMap.get(course.id)?.ratingAvg ?? 0,
        ratingCount: ratingMap.get(course.id)?.ratingCount ?? 0,
      })),
      categories: categories.map((category) => ({
        id: String(category.id),
        name: String(category.name),
        slug: String(category.slug),
      })),
    };
  },
  ['public-course-catalog-data-shared'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPageCourses = unstable_cache(
  async (limit: number) => {
    if (limit <= 0) return [];

    const courses = await prisma.course.findMany({
      where: {
        deletedAt: null,
        status: CourseStatus.PUBLISHED,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        thumbnailUrl: true,
        price: true,
        normalPrice: true,
        level: true,
        isPublic: true,
        instructor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const ratings =
      courses.length > 0
        ? await prisma.courseReview.groupBy({
            by: ['courseId'],
            where: { courseId: { in: courses.map((course) => course.id) } },
            _avg: { rating: true },
            _count: { rating: true },
          })
        : [];

    const ratingMap = new Map(
      ratings.map((rating) => [
        rating.courseId,
        {
          ratingAvg: rating._avg.rating ?? 0,
          ratingCount: rating._count.rating ?? 0,
        },
      ])
    );

    return courses.map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      thumbnailUrl: normalizePublicMediaUrl(course.thumbnailUrl),
      price: course.price,
      normalPrice: course.normalPrice,
      instructor: course.instructor,
      level: course.level,
      ratingAvg: ratingMap.get(course.id)?.ratingAvg ?? 0,
      ratingCount: ratingMap.get(course.id)?.ratingCount ?? 0,
      isPublic: course.isPublic,
    }));
  },
  ['public-page-courses'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPageVendors = unstable_cache(
  async (limit: number) => {
    if (limit <= 0) return [];

    const vendors = await prisma.shopVendor.findMany({
      where: { status: 'APPROVED' },
      orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        city: true,
        province: true,
        country: true,
        contactEmail: true,
        contactPhone: true,
        ratingAvg: true,
        ratingCount: true,
        _count: { select: { products: true } },
      },
      take: limit,
    });

    return vendors.map((vendor) => ({
      ...vendor,
      logoUrl: normalizePublicMediaUrl(vendor.logoUrl),
      coverUrl: normalizePublicMediaUrl(vendor.coverUrl),
      productCount: vendor?._count?.products ?? 0,
    }));
  },
  ['public-page-vendors'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicCourseCatalogSettings = unstable_cache(
  async () => {
    const page = await prisma.page.findUnique({
      where: { slug: '__course_settings__' },
      select: { content: true, updatedAt: true },
    });
    const settings = safeParse(page?.content);

    return {
      studentsMustBeLoggedInToViewCourse: settings['studentsMustBeLoggedInToViewCourse'] === true,
    };
  },
  ['public-course-catalog-settings'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicBlogPosts = unstable_cache(
  async (categorySlug: string, tagSlug: string) => {
    const posts = await prisma.post.findMany({
      where: {
        published: true,
        ...(categorySlug ? { category: { is: { slug: categorySlug } } } : {}),
        ...(tagSlug ? { tags: { some: { tag: { is: { slug: tagSlug } } } } } : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        featuredImageUrl: true,
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
        author: { select: { name: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return posts.map((post) => ({
      id: String(post.id),
      title: String(post.title),
      slug: String(post.slug),
      content: null,
      excerpt: truncateText(
        (typeof post.excerpt === 'string' && post.excerpt.trim()) || stripHtml(post.content),
        180
      ),
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      featuredImageUrl: normalizePublicMediaUrl(post.featuredImageUrl),
      category: post.category
        ? {
            name: String(post.category.name),
            slug: String(post.category.slug),
          }
        : null,
      tags: Array.isArray(post.tags)
        ? post.tags.map((item) => ({
            tag: item.tag
              ? {
                  name: String(item.tag.name),
                  slug: String(item.tag.slug),
                }
              : undefined,
          }))
        : [],
      author: { name: String(post.author?.name || 'GeoSains') },
    }));
  },
  ['public-blog-post-previews'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicBlogCategory = unstable_cache(
  async (slug: string) => {
    return prisma.blogCategory.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
  },
  ['public-blog-category'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicBlogTag = unstable_cache(
  async (slug: string) => {
    return prisma.blogTag.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
  },
  ['public-blog-tag'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicShopProductsPage = unstable_cache(
  async (search: string, categoryId: string, sort: ShopSort, onlyInStock: boolean, take: number, skip: number) => {
    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (categoryId) {
      where.OR = [{ categoryId }, { categoryIds: { has: categoryId } }];
    }
    if (onlyInStock) {
      where.stock = { gt: 0 };
    }

    const orderBy =
      sort === 'PRICE_ASC'
        ? { price: 'asc' as const }
        : sort === 'PRICE_DESC'
          ? { price: 'desc' as const }
          : sort === 'NAME_ASC'
            ? { name: 'asc' as const }
            : { createdAt: 'desc' as const };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          categoryRef: true,
          vendor: {
            select: {
              id: true,
              name: true,
              slug: true,
              contactPhone: true,
              status: true,
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    const items = products.map((product) => ({
      ...product,
      createdAt: product.createdAt ? product.createdAt.toISOString() : null,
      imageUrl: normalizePublicMediaUrl(product.imageUrl),
      imageUrls: Array.isArray(product.imageUrls)
        ? product.imageUrls
            .map((value) => normalizePublicMediaUrl(value))
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [],
    }));

    const nextOffset = skip + items.length;

    return {
      items,
      total,
      take,
      skip,
      hasMore: nextOffset < total,
      nextOffset,
    };
  },
  ['public-shop-products-page'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicShopCategories = unstable_cache(
  async () => {
    return prisma.productCategoryModel.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  },
  ['public-shop-categories'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicGeoservicesVendors = unstable_cache(
  async (categorySlug: string) => {
    const vendors = await prisma.shopVendor.findMany({
      where: {
        status: 'APPROVED',
      },
      orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        city: true,
        province: true,
        country: true,
        contactEmail: true,
        contactPhone: true,
        ratingAvg: true,
        ratingCount: true,
        _count: {
          select: {
            products: true,
          },
        },
        products: {
          where: { categoryRef: { slug: categorySlug } },
          select: { id: true },
        },
      },
    });

    return vendors.map((vendor) => ({
      ...vendor,
      logoUrl: normalizePublicMediaUrl(vendor.logoUrl),
      coverUrl: normalizePublicMediaUrl(vendor.coverUrl),
      serviceCount: Array.isArray(vendor.products) ? vendor.products.length : 0,
      productCount: vendor._count?.products ?? 0,
    }));
  },
  ['public-geoservices-vendors'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicBundleDetail = unstable_cache(
  async (slug: string) => {
    const bundle = await prisma.courseBundle.findUnique({ where: { slug } });

    if (!bundle || !bundle.published) return null;

    const rawCourseIds = Array.from(new Set((bundle.courseIds || []).map((courseId) => courseId.trim()).filter(Boolean)));
    const courses =
      rawCourseIds.length > 0
        ? await prisma.course.findMany({
            where: {
              id: { in: rawCourseIds },
              deletedAt: null,
              status: CourseStatus.PUBLISHED,
            },
            select: {
              id: true,
              slug: true,
              title: true,
              price: true,
              thumbnailUrl: true,
              subtitle: true,
            },
          })
        : [];

    const courseMap = new Map(courses.map((course) => [course.id, course]));
    const orderedCourses = rawCourseIds.map((courseId) => courseMap.get(courseId)).filter(Boolean).map((course) => ({
      ...course!,
      thumbnailUrl: normalizePublicMediaUrl(course!.thumbnailUrl),
    }));
    const missingCount = rawCourseIds.filter((courseId) => !courseMap.has(courseId)).length;
    const subtotal = orderedCourses.reduce((sum, course) => sum + Number(course.price || 0), 0);
    const price = Math.max(0, Number(bundle.price || 0));
    const discount = Math.max(0, Math.round((subtotal - price) * 100) / 100);

    return {
      bundle: {
        ...bundle,
        thumbnailUrl: normalizePublicMediaUrl(bundle.thumbnailUrl),
      },
      orderedCourses,
      missingCount,
      subtotal,
      price,
      discount,
      rawCourseIds,
    };
  },
  ['public-course-bundle-detail'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublishedBlogSlugs = unstable_cache(
  async () => {
    const rows = await prisma.post.findMany({
      where: { published: true },
      select: { slug: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => ({ slug: String(row.slug) }));
  },
  ['public-blog-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedBlogCategorySlugs = unstable_cache(
  async () => {
    const rows = await prisma.blogCategory.findMany({
      select: { slug: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({ slug: String(row.slug) }));
  },
  ['public-blog-category-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedBlogTagSlugs = unstable_cache(
  async () => {
    const rows = await prisma.blogTag.findMany({
      select: { slug: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({ slug: String(row.slug) }));
  },
  ['public-blog-tag-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedVendorSlugs = unstable_cache(
  async () => {
    const rows = await prisma.shopVendor.findMany({
      where: { status: 'APPROVED' },
      select: { slug: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({ slug: String(row.slug) }));
  },
  ['public-vendor-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedBundleSlugs = unstable_cache(
  async () => {
    const rows = await prisma.courseBundle.findMany({
      where: { published: true },
      select: { slug: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({ slug: String(row.slug) }));
  },
  ['public-bundle-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedCourseSlugs = unstable_cache(
  async () => {
    const rows = await prisma.course.findMany({
      where: {
        deletedAt: null,
        status: CourseStatus.PUBLISHED,
      },
      select: { slug: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => ({ slug: String(row.slug) }));
  },
  ['public-course-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedProductRouteIds = unstable_cache(
  async () => {
    const rows = await prisma.product.findMany({
      select: { id: true, slug: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: typeof row.slug === 'string' && row.slug.trim() ? row.slug.trim() : String(row.id),
    }));
  },
  ['public-product-route-ids'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicCourseTagSlugs = unstable_cache(
  async () => {
    const rows = await prisma.course.findMany({
      where: {
        deletedAt: null,
        status: CourseStatus.PUBLISHED,
      },
      select: { tags: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const tagSet = new Set<string>();
    for (const row of rows) {
      for (const tag of Array.isArray(row.tags) ? row.tags : []) {
        if (typeof tag === 'string' && tag.trim()) {
          tagSet.add(tag.trim());
        }
      }
    }

    return Array.from(tagSet)
      .sort((a, b) => a.localeCompare(b, 'id'))
      .map((tag) => ({ tag }));
  },
  ['public-course-tag-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const RESERVED_PUBLIC_ROOT_SEGMENTS = new Set([
  '',
  'home',
  'blog',
  'bundles',
  'cart',
  'checkout',
  'course-tag',
  'courses',
  'dashboard',
  'forgot-password',
  'geoservices',
  'login',
  'preview',
  'privacy',
  'profile',
  'register',
  'reset-password',
  'shop',
  'subscribe',
  'terms',
  'vendor',
  'verify-email',
  'api',
  '_next',
]);

const getCachedPublicCmsPageSlugs = unstable_cache(
  async () => {
    const rows = await prisma.page.findMany({
      where: {
        published: true,
        NOT: {
          slug: {
            startsWith: '__',
          },
        },
      },
      select: { slug: true },
      orderBy: { updatedAt: 'desc' },
    });

    return rows
      .map((row) => String(row.slug || '').trim())
      .filter((slug) => slug && !RESERVED_PUBLIC_ROOT_SEGMENTS.has(slug.split('/')[0] || ''))
      .map((slug) => ({ slug, segments: slug.split('/').filter(Boolean) }));
  },
  ['public-cms-page-slugs'],
  { revalidate: PUBLIC_REVALIDATE }
);

const getCachedPublicCmsPageData = unstable_cache(
  async (slug: string) => {
    const page = await prisma.page.findFirst({
      where: {
        slug,
        published: true,
      },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!page) return null;

    const blocks = sanitizePageBlocks(page.blocks as any[]).map((block: any) => ({
      id: String(block.id),
      type: String(block.type),
      content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? {}),
    }));

    const { courseLimit, vendorLimit } = getPageDataLimits(blocks);
    const [initialCourses, initialVendors] = await Promise.all([
      getCachedPageCourses(courseLimit),
      getCachedPageVendors(vendorLimit),
    ]);

    return {
      page: {
        id: String(page.id),
        title: String(page.title),
        slug: String(page.slug),
      },
      blocks,
      initialCourses,
      initialVendors,
    };
  },
  ['public-cms-page-data'],
  { revalidate: PUBLIC_REVALIDATE }
);

export async function getPublicCourseCatalogData() {
  return getCachedPublicCourseCatalogData();
}

export async function getPublicCourseCatalogSettings() {
  return getCachedPublicCourseCatalogSettings();
}

export async function getPublicBlogPosts(options: { categorySlug?: string; tagSlug?: string } = {}) {
  return getCachedPublicBlogPosts(options.categorySlug || '', options.tagSlug || '');
}

export async function getPublicBlogCategory(slug: string) {
  return getCachedPublicBlogCategory(slug);
}

export async function getPublicBlogTag(slug: string) {
  return getCachedPublicBlogTag(slug);
}

export async function getPublicShopProductsPage(options: {
  q?: string;
  categoryId?: string;
  sort?: ShopSort;
  onlyInStock?: boolean;
  take?: number;
  skip?: number;
} = {}) {
  const search = typeof options.q === 'string' ? options.q.trim() : '';
  const categoryId = typeof options.categoryId === 'string' ? options.categoryId.trim() : '';
  const sort = normalizeShopSort(options.sort);
  const onlyInStock = options.onlyInStock === true;
  const take = typeof options.take === 'number' && Number.isFinite(options.take) ? Math.max(1, Math.min(100, Math.trunc(options.take))) : 12;
  const skip = typeof options.skip === 'number' && Number.isFinite(options.skip) ? Math.max(0, Math.trunc(options.skip)) : 0;

  return getCachedPublicShopProductsPage(search, categoryId, sort, onlyInStock, take, skip);
}

export async function getPublicShopCategories() {
  return getCachedPublicShopCategories();
}

export async function getPublicGeoservicesVendors(categorySlug = 'geo-services') {
  return getCachedPublicGeoservicesVendors(categorySlug);
}

export async function getPublicBundleDetail(slug: string) {
  return getCachedPublicBundleDetail(slug);
}

export async function getPublishedBlogSlugs() {
  return getCachedPublishedBlogSlugs();
}

export async function getPublicBlogCategorySlugs() {
  return getCachedBlogCategorySlugs();
}

export async function getPublicBlogTagSlugs() {
  return getCachedBlogTagSlugs();
}

export async function getPublicVendorSlugs() {
  return getCachedVendorSlugs();
}

export async function getPublicBundleSlugs() {
  return getCachedBundleSlugs();
}

export async function getPublicCourseSlugs() {
  return getCachedCourseSlugs();
}

export async function getPublicProductRouteIds() {
  return getCachedProductRouteIds();
}

export async function getPublicCourseTagSlugs() {
  return getCachedPublicCourseTagSlugs();
}

export async function getPublicCmsPageSlugs() {
  return getCachedPublicCmsPageSlugs();
}

export async function getPublicCmsPageData(slug: string) {
  return getCachedPublicCmsPageData(slug);
}

export function getProductCategoryLabel(category: ProductCategory) {
  if (category === 'BOOKS') return 'Buku';
  if (category === 'MERCH') return 'Merchandise';
  return 'Lainnya';
}
