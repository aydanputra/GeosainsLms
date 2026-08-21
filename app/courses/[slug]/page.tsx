import { prisma } from '@/utils/prisma';
import { notFound } from 'next/navigation';
import { Globe, Calendar, User as UserIcon, BarChart } from 'lucide-react';
import Link from 'next/link';
import CourseCTA from './components/CourseCTA';
import CourseInfoTabs from './components/CourseInfoTabs';
import CourseHeroMedia from './components/CourseHeroMedia';
import { CourseDetailAccessProvider } from './components/CourseDetailAccessProvider';
import type { Metadata } from 'next';
import { getAppUrl } from '@/modules/core/utils/appUrl';
import { sanitizeRichHtml } from '@/modules/core/utils/sanitizeHtml';
import { unstable_cache } from 'next/cache';
import { getPublicCourseSlugs } from '@/modules/public/api/performance';
import { getCourseRuntimeSettings } from '@/modules/course/api/performance';

export const revalidate = 300;

export async function generateStaticParams() {
  return getPublicCourseSlugs();
}

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

const getVideoEmbedUrl = (url: string) => {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]*)/);
  if (ytMatch && ytMatch[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/(?:vimeo\.com\/)([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
};

function normalizePublicUrl(appUrl: string, value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('/')) return `${appUrl}${v}`;
  return null;
}

const getSiteSettingsPage = unstable_cache(
  async () => prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true, updatedAt: true } }),
  ['course-page-site-settings'],
  { revalidate: 300 }
);

const getCourse = unstable_cache(
  async (slug: string) => {
    return prisma.course.findUnique({
      where: { slug },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            profileCoverUrl: true,
            phone: true,
            country: true,
            province: true,
            city: true,
            address: true,
            socialLinks: true,
            mentorJobTitle: true,
            mentorBio: true,
            mentorSkills: true,
            mentorEducations: true,
            mentorExperiences: true,
            mentorAttachments: true,
          },
        },
        category: true,
        modules: {
          include: {
            lessons: {
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                isPreview: true,
                order: true,
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  },
  ['public-course-detail-base'],
  { revalidate: 300 }
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const appUrl = getAppUrl();

  try {
    const [course, siteSettingsPage] = await Promise.all([getCourse(slug), getSiteSettingsPage()]);

    if (!course) {
      return {
        alternates: { canonical: `${appUrl}/courses/${encodeURIComponent(slug)}` },
      };
    }

    const parsed = safeParse(siteSettingsPage?.content);
    const siteName = typeof parsed.siteName === 'string' && parsed.siteName.trim() ? parsed.siteName.trim() : 'GeoSains LMS';
    const fallbackDescription =
      typeof parsed.siteDescription === 'string' && parsed.siteDescription.trim() ? parsed.siteDescription.trim() : 'Platform pembelajaran geosains.';
    const courseDescription = typeof course.description === 'string' && course.description.trim() ? course.description.trim() : fallbackDescription;
    const canonical = `${appUrl}/courses/${encodeURIComponent(slug)}`;

    const image =
      normalizePublicUrl(appUrl, course.thumbnailUrl) ||
      normalizePublicUrl(appUrl, typeof parsed.logoUrl === 'string' ? parsed.logoUrl : null) ||
      null;

    const images = image ? [{ url: image }] : [];

    return {
      title: `${course.title} | ${siteName}`,
      description: courseDescription,
      alternates: { canonical },
      openGraph: {
        type: 'website',
        url: canonical,
        title: `${course.title} | ${siteName}`,
        description: courseDescription,
        siteName,
        images,
      },
      twitter: {
        card: images.length > 0 ? 'summary_large_image' : 'summary',
        title: `${course.title} | ${siteName}`,
        description: courseDescription,
        images: images.length > 0 ? images.map((item) => item.url) : undefined,
      },
    };
  } catch {
    return {
      alternates: { canonical: `${appUrl}/courses/${encodeURIComponent(slug)}` },
    };
  }
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;

  const [course, courseSettings] = await Promise.all([getCourse(slug), getCourseRuntimeSettings()]);

  if (!course) {
    notFound();
  }

  const mustLogin = courseSettings.studentsMustBeLoggedInToViewCourse === true;
  let isPreviewMode = false;
  if (mustLogin || course.status !== 'PUBLISHED' || preview === 'student') {
    const { resolveCoursePageAccess } = await import('./private-page-access');
    const access = await resolveCoursePageAccess({
      slug,
      preview,
      mustLogin,
      redirectPath: `/courses/${slug}`,
      course: {
        instructorId: String(course.instructorId),
        status: String(course.status),
      },
    });
    isPreviewMode = access.isPreviewMode;
  }
  const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0);
  const totalDuration = course.modules.reduce(
    (acc, module) => acc + module.lessons.reduce((lessonAcc, lesson) => lessonAcc + Number(lesson.duration || 0), 0),
    0
  );

  const thumbnailUrl =
    typeof course.thumbnailUrl === 'string' && course.thumbnailUrl.trim() && !course.thumbnailUrl.startsWith('blob:')
      ? course.thumbnailUrl
      : '/placeholder-course.jpg';
  const introVideoUrl = typeof course.introVideoUrl === 'string' ? course.introVideoUrl.trim() : '';
  const embedUrl = introVideoUrl ? getVideoEmbedUrl(introVideoUrl) : null;

  const curriculumModules = course.modules.map((module) => ({
    id: String(module.id || ''),
    title: String(module.title || ''),
    order: Number(module.order || 0),
    lessons: module.lessons.map((lesson) => ({
      id: String(lesson.id || ''),
      title: String(lesson.title || ''),
      type: String(lesson.type || ''),
      duration: Number(lesson.duration || 0) || 0,
      isPreview: Boolean(lesson.isPreview),
      isLocked: !lesson.isPreview,
      lockLabel: lesson.isPreview ? 'Preview' : 'Belum terdaftar',
      unlockDateLabel: null,
    })),
  }));

  const [reviewSummary, recentReviews] = await Promise.all([
    course.reviewsEnabled
      ? prisma.courseReview.aggregate({ where: { courseId: course.id }, _avg: { rating: true }, _count: { rating: true } })
      : Promise.resolve(null),
    course.reviewsEnabled
      ? prisma.courseReview.findMany({
          where: { courseId: course.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 6,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: { select: { name: true, email: true, avatarUrl: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const ratingAvg = reviewSummary?._avg?.rating ?? 0;
  const ratingCount = reviewSummary?._count?.rating ?? 0;
  const reviewList = Array.isArray(recentReviews)
    ? recentReviews.map((review) => ({
        id: String(review.id),
        rating: Number(review.rating) || 0,
        comment: review.comment === null || typeof review.comment === 'string' ? review.comment : null,
        createdAtLabel: new Date(review.createdAt).toLocaleDateString('id-ID'),
        studentName: String(review.user?.name || review.user?.email || 'Siswa'),
        studentAvatarUrl:
          typeof (review.user as any)?.avatarUrl === 'string' && String((review.user as any).avatarUrl).trim()
            ? String((review.user as any).avatarUrl).trim()
            : null,
      }))
    : [];

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {isPreviewMode ? (
        <div className="bg-indigo-600 text-white text-center py-2 text-sm font-medium sticky top-0 z-50 shadow-md">
          Anda sedang melihat tampilan sebagai Siswa (Preview Mode)
        </div>
      ) : null}

      <div className="bg-slate-900 text-white py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[300px] h-[300px] bg-emerald-600/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
                <span>/</span>
                <Link href="/courses" className="hover:text-white transition-colors">
                  Kursus
                </Link>
                <span>/</span>
                <span className="text-white font-medium truncate max-w-[200px]">{course.category?.name}</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight">{course.title}</h1>
              {course.subtitle ? <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">{course.subtitle}</p> : null}

              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300 pt-4">
                <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                  <UserIcon className="w-4 h-4 text-indigo-400" />
                  <span className="font-medium text-slate-200">{course.instructor?.name || 'Instruktur'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Update: {new Date(course.updatedAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span>Bahasa Indonesia</span>
                </div>
                {course.level ? (
                  <div className="flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-slate-400" />
                    <span className="capitalize">{course.level.toLowerCase()}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="hidden lg:block relative" />
          </div>
        </div>
      </div>

      <CourseDetailAccessProvider slug={slug} previewMode={isPreviewMode} initialModules={curriculumModules as any}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              <CourseHeroMedia title={course.title} embedUrl={embedUrl} thumbnailUrl={thumbnailUrl} />

              <CourseInfoTabs
                slug={slug}
                courseId={course.id}
                price={Number(course.price || 0)}
                subtitle={course.subtitle || null}
                descriptionHtml={sanitizeRichHtml(course.description || '')}
                learningOutcomes={Array.isArray(course.learningOutcomes) ? course.learningOutcomes : []}
                totalLessons={totalLessons}
                totalDurationMinutes={Math.round(totalDuration)}
                modules={curriculumModules as any}
                reviewsEnabled={course.reviewsEnabled !== false}
                ratingAvg={ratingAvg}
                ratingCount={ratingCount}
                recentReviews={reviewList as any}
                qaEnabled={Boolean(course.enableQA)}
                mentor={{
                  id: String((course.instructor as any)?.id || ''),
                  name: String(course.instructor?.name || course.instructor?.email || 'Instruktur'),
                  email: String(course.instructor?.email || ''),
                  avatarUrl: typeof course.instructor?.avatarUrl === 'string' && course.instructor.avatarUrl.trim() ? course.instructor.avatarUrl : null,
                  profileCoverUrl:
                    typeof (course.instructor as any)?.profileCoverUrl === 'string' && String((course.instructor as any).profileCoverUrl).trim()
                      ? String((course.instructor as any).profileCoverUrl).trim()
                      : null,
                  phone: typeof (course.instructor as any)?.phone === 'string' ? String((course.instructor as any).phone) : null,
                  country: typeof (course.instructor as any)?.country === 'string' ? String((course.instructor as any).country) : null,
                  province: typeof (course.instructor as any)?.province === 'string' ? String((course.instructor as any).province) : null,
                  city: typeof (course.instructor as any)?.city === 'string' ? String((course.instructor as any).city) : null,
                  address: typeof (course.instructor as any)?.address === 'string' ? String((course.instructor as any).address) : null,
                  socialLinks: (course.instructor as any)?.socialLinks ?? null,
                  mentorJobTitle: typeof (course.instructor as any)?.mentorJobTitle === 'string' ? String((course.instructor as any).mentorJobTitle) : null,
                  mentorBio: typeof (course.instructor as any)?.mentorBio === 'string' ? String((course.instructor as any).mentorBio) : null,
                  mentorSkills: Array.isArray((course.instructor as any)?.mentorSkills)
                    ? (course.instructor as any).mentorSkills.filter((value: any) => typeof value === 'string')
                    : [],
                  mentorEducations: (course.instructor as any)?.mentorEducations ?? null,
                  mentorExperiences: (course.instructor as any)?.mentorExperiences ?? null,
                  mentorAttachments: (course.instructor as any)?.mentorAttachments ?? null,
                }}
              />
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                <CourseCTA course={course} totalLessons={totalLessons} totalDuration={totalDuration} />
              </div>
            </div>
          </div>
        </div>
      </CourseDetailAccessProvider>
    </div>
  );
}
