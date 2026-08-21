import { prisma } from '@/utils/prisma';
import { CourseStatus } from '@prisma/client';
import PageRenderer from '@/modules/pages/components/PageRenderer';
import { unstable_cache } from 'next/cache';
import { sanitizePageBlocks } from '@/modules/core/utils/sanitizeHtml';

export const revalidate = 300;

function safeParse(content: string | null | undefined) {
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toBlockLimit(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(24, Math.trunc(value))) : fallback;
}

function getHomepageDataLimits(blocks: Array<{ type: string; content: unknown }>) {
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

    const columns = Array.isArray((content as { columns?: unknown }).columns) ? (content as { columns: Array<{ widgets?: unknown }> }).columns : [];
    for (const column of columns) {
      const widgets = Array.isArray(column?.widgets) ? column.widgets : [];
      for (const widget of widgets) {
        if (!widget || typeof widget !== 'object') continue;
        const widgetType = typeof (widget as { type?: unknown }).type === 'string' ? (widget as { type: string }).type : '';
        const widgetContentRaw = (widget as { content?: unknown }).content;
        const widgetContent =
          typeof widgetContentRaw === 'string' ? safeParse(widgetContentRaw) : widgetContentRaw && typeof widgetContentRaw === 'object' ? widgetContentRaw : null;
        inspectBlock(widgetType, widgetContent);
      }
    }
  };

  for (const block of blocks) {
    const content = typeof block.content === 'string' ? safeParse(block.content) : block.content;
    inspectBlock(block.type, content);
  }

  return {
    courseLimit,
    vendorLimit,
  };
}

const getHomepageCourses = unstable_cache(async (limit: number) => {
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
    thumbnailUrl:
      typeof course.thumbnailUrl === 'string' && course.thumbnailUrl.startsWith('blob:') ? null : course.thumbnailUrl,
    price: course.price,
    normalPrice: course.normalPrice,
    instructor: course.instructor,
    level: course.level,
    ratingAvg: ratingMap.get(course.id)?.ratingAvg ?? 0,
    ratingCount: ratingMap.get(course.id)?.ratingCount ?? 0,
    isPublic: course.isPublic,
  }));
}, ['homepage-courses'], { revalidate: 300 });

const getHomepageVendors = unstable_cache(async (limit: number) => {
  if (limit <= 0) return [];

  const prismaAny = prisma as any;
  const vendors = await prismaAny.shopVendor.findMany({
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

  return Array.isArray(vendors)
    ? vendors.map((vendor: any) => ({
        ...vendor,
        logoUrl: typeof vendor.logoUrl === 'string' && vendor.logoUrl.startsWith('blob:') ? null : vendor.logoUrl,
        coverUrl: typeof vendor.coverUrl === 'string' && vendor.coverUrl.startsWith('blob:') ? null : vendor.coverUrl,
        productCount: vendor?._count?.products ?? 0,
      }))
    : [];
}, ['homepage-vendors'], { revalidate: 300 });

function getDefaultHomeBlocks() {
  return [
    {
      id: 'home-hero-default',
      type: 'HERO',
      content: JSON.stringify({
        layout: { widthMode: 'FULL' },
        slider: { enabled: false },
        heading: 'Belajar Geosains Lebih Terarah',
        subheading: 'Platform pembelajaran geosains dengan materi terstruktur, kuis, tugas, dan sertifikat.',
        primaryCta: { text: 'Jelajahi Kursus', href: '/courses' },
        secondaryCta: { text: 'Masuk', href: '/login' },
      }),
    },
    {
      id: 'home-courses-default',
      type: 'COURSES',
      content: JSON.stringify({
        heading: 'Kursus Populer',
        subheading: 'Temukan kursus terbaru dan paling diminati.',
        limit: 6,
        variant: 'grid',
        cta: { text: 'Lihat Semua Kursus', href: '/courses' },
      }),
    },
    {
      id: 'home-cta-default',
      type: 'CTA',
      content: JSON.stringify({
        heading: 'Siap Mulai Belajar?',
        subheading: 'Daftar sekarang dan mulai progres belajarmu hari ini.',
        buttonText: 'Daftar',
        buttonHref: '/register',
      }),
    },
  ];
}

export default async function Home() {
  const page = await prisma.page.findUnique({
    where: { slug: 'home' },
    include: { blocks: { orderBy: { order: 'asc' } } },
  });

  const defaultBlocks = getDefaultHomeBlocks();
  const publishedHomeBlocks =
    page?.published && page.blocks && page.blocks.length > 0 ? sanitizePageBlocks(page.blocks as any[]) : null;
  const blocks = publishedHomeBlocks && publishedHomeBlocks.length > 0 ? publishedHomeBlocks : defaultBlocks;
  const { courseLimit, vendorLimit } = getHomepageDataLimits(blocks);
  const [initialCourses, initialVendors] = await Promise.all([
    getHomepageCourses(courseLimit),
    getHomepageVendors(vendorLimit),
  ]);

  return (
    <main className="min-h-screen bg-white">
      <PageRenderer
        blocks={blocks}
        initialCourses={initialCourses}
        coursesHydratedFromServer
        initialVendors={initialVendors}
        vendorsHydratedFromServer
      />
    </main>
  );
}
