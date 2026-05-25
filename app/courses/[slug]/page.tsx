import { prisma } from '@/utils/prisma';
import { notFound, redirect } from 'next/navigation';
import { CheckCircle, Play, FileText, HelpCircle, Lock, Globe, Calendar, Clock, User as UserIcon, BarChart, Star, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import CourseCTA from './components/CourseCTA';
import CourseInfoTabs from './components/CourseInfoTabs';
import CourseHeroMedia from './components/CourseHeroMedia';
import type { Metadata } from 'next';
import { getAppUrl } from '@/modules/core/utils/appUrl';

// Force dynamic rendering if needed, or use revalidate
export const dynamic = 'force-dynamic';

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

function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const hdrs = await headers();
  const appUrl = getAppUrl(hdrs);

  try {
    const [course, siteSettingsPage] = await Promise.all([
      prisma.course.findUnique({
        where: { slug },
        select: { title: true, description: true, thumbnailUrl: true, updatedAt: true },
      }),
      prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true, updatedAt: true } }),
    ]);

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
        images: images.length > 0 ? images.map((i) => i.url) : undefined,
      },
    };
  } catch {
    return {
      alternates: { canonical: `${appUrl}/courses/${encodeURIComponent(slug)}` },
    };
  }
}

async function getCourse(slug: string) {
  const course = await prisma.course.findUnique({
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
        }
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
                // Exclude content, videoId, attachments
            },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!course) return null;
  return course;
}

export default async function CourseDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>, searchParams: Promise<{ preview?: string }> }) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const course = await getCourse(slug);

  if (!course) {
    notFound();
  }

  const courseSettingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const courseSettings = safeParse(courseSettingsPage?.content);
  const mustLogin = courseSettings['studentsMustBeLoggedInToViewCourse'] === true;

  // Handle Draft Status
  // Only allow viewing draft if preview=student (from Admin) OR user is Admin/Instructor
  // But wait, if preview=student, we still need to verify the user has permission to see the draft in the first place?
  // Currently getCourse returns draft courses too.
  // We should restrict public access to drafts unless authorized.
  
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  let user = null;
  if (token) {
      user = await verifyToken(token);
  }
  if (mustLogin && !user) {
    redirect(`/login?redirect=/courses/${slug}`);
  }

  const isCreator = user && (user.id === course.instructorId || user.role === 'ADMIN');
  const isPublished = course.status === 'PUBLISHED';

  if (!isPublished && !isCreator) {
      // If not published and not creator, 404
      notFound();
  }

  let enrollment = null;
  let isInstructor = isCreator;
  let isAdmin = user?.role === 'ADMIN';

  // Preview Mode: Override roles to simulate student view
  if (preview === 'student' && isCreator) {
      isAdmin = false;
      isInstructor = false;
      // enrollment remains null to simulate non-enrolled student
  } else if (user) {
      enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: course.id
          }
        }
      });
  }

  let enrollmentExpired = false;
  if (enrollment && course.validityDays && course.validityDays > 0) {
    const expiresAt = new Date(enrollment.createdAt);
    expiresAt.setDate(expiresAt.getDate() + course.validityDays);
    if (new Date() > expiresAt) {
      enrollment = null;
      enrollmentExpired = true;
    }
  }

  // Fetch Course Outline from API (SSOT)
  const fetchHeaders = new Headers();
  if (token) fetchHeaders.set('Cookie', `token=${token}`);
  
  // Use absolute URL for SSR
  const headerList = await headers();
  const protocol = headerList.get('x-forwarded-proto') || (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  const host =
    headerList.get('x-forwarded-host') || headerList.get('host') || process.env.HOST || 'localhost:3000';
  const apiUrl = `${protocol}://${host}/api/courses/slug/${slug}/outline`;

  let courseOutline = null;
  try {
      const res = await fetch(apiUrl, { 
          headers: fetchHeaders, 
          cache: 'no-store' // Ensure fresh lock status
      });
      if (res.ok) {
          const data = await res.json();
          courseOutline = data.course;
      }
  } catch (error) {
      console.error("Failed to fetch course outline:", error);
  }

  // Use outline from API if available, otherwise fallback to DB result (without lock info)
  const modules = courseOutline?.modules || course.modules;

  // Date Formatter (id-ID, Asia/Jakarta)
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const lockReasonLabel = (reason: unknown) => {
    if (reason === 'DRIP_LOCKED') return 'Drip';
    if (reason === 'SCHEDULE_LOCKED') return 'Jadwal';
    if (reason === 'SEQUENTIAL_LOCKED') return 'Berurutan';
    if (reason === 'ENROLLMENT_EXPIRED') return 'Akses berakhir';
    if (reason === 'NOT_ENROLLED') return 'Belum terdaftar';
    return 'Terkunci';
  };

  // Calculate stats
  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalDuration = course.modules.reduce((acc, m) => acc + m.lessons.reduce((lAcc, l) => lAcc + l.duration, 0), 0);

  const isPreviewMode = preview === 'student';

  const thumbnailUrl =
    typeof course.thumbnailUrl === 'string' && course.thumbnailUrl.trim() && !course.thumbnailUrl.startsWith('blob:')
      ? course.thumbnailUrl
      : '/placeholder-course.jpg';
  const introVideoUrl = typeof course.introVideoUrl === 'string' ? course.introVideoUrl.trim() : '';
  const embedUrl = introVideoUrl ? getVideoEmbedUrl(introVideoUrl) : null;

  const reviewSummary = course.reviewsEnabled
    ? await prisma.courseReview.aggregate({ where: { courseId: course.id }, _avg: { rating: true }, _count: { rating: true } })
    : null;
  const ratingAvg = reviewSummary?._avg?.rating ?? 0;
  const ratingCount = reviewSummary?._count?.rating ?? 0;
  const recentReviews = course.reviewsEnabled
    ? await prisma.courseReview.findMany({
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
    : [];

  const canViewQa = Boolean(course.enableQA) && Boolean(user) && (Boolean(isCreator) || Boolean(enrollment));
  const qaThreads = canViewQa
    ? await prisma.qAThread.findMany({
        where: { courseId: course.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 6,
        include: {
          author: { select: { id: true, name: true, email: true, role: true } },
          lesson: { select: { id: true, title: true } },
          _count: { select: { replies: true } },
          replies: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      })
    : [];

  const curriculumModules = (Array.isArray(modules) ? modules : []).map((m: any) => ({
    id: String(m?.id || ''),
    title: String(m?.title || ''),
    order: Number(m?.order || 0),
    lessons: (Array.isArray(m?.lessons) ? m.lessons : []).map((l: any) => ({
      id: String(l?.id || ''),
      title: String(l?.title || ''),
      type: String(l?.type || ''),
      duration: Number(l?.duration || 0) || 0,
      isPreview: Boolean(l?.isPreview),
      isLocked: Boolean(l?.isLocked),
      lockLabel: lockReasonLabel(l?.lockReason),
      unlockDateLabel: typeof l?.unlockDate === 'string' && l.unlockDate ? formatDate(String(l.unlockDate)) : null,
    })),
  }));

  const reviewList = Array.isArray(recentReviews)
    ? recentReviews.map((r) => ({
        id: String(r.id),
        rating: Number(r.rating) || 0,
        comment: r.comment === null || typeof r.comment === 'string' ? r.comment : null,
        createdAtLabel: new Date(r.createdAt).toLocaleDateString('id-ID'),
        studentName: String(r.user?.name || r.user?.email || 'Siswa'),
        studentAvatarUrl:
          typeof (r.user as any)?.avatarUrl === 'string' && String((r.user as any).avatarUrl).trim() ? String((r.user as any).avatarUrl).trim() : null,
      }))
    : [];

  const qaList = Array.isArray(qaThreads)
    ? qaThreads.map((t: any) => ({
        id: String(t.id),
        lessonId: t.lessonId ? String(t.lessonId) : null,
        lessonTitle: t.lesson?.title ? String(t.lesson.title) : null,
        title: String(t.title || ''),
        question: String(t.question || ''),
        createdAtLabel: new Date(t.createdAt).toLocaleDateString('id-ID'),
        authorName: String(t.author?.name || t.author?.email || 'User'),
        replyCount: Number(t._count?.replies || 0) || 0,
        lastReplyAtLabel: t.replies?.[0]?.createdAt ? new Date(t.replies[0].createdAt).toLocaleDateString('id-ID') : null,
      }))
    : [];

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {isPreviewMode && (
        <div className="bg-indigo-600 text-white text-center py-2 text-sm font-medium sticky top-0 z-50 shadow-md">
          Anda sedang melihat tampilan sebagai Siswa (Preview Mode)
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-16 relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[300px] h-[300px] bg-emerald-600/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Link href="/" className="hover:text-white transition-colors">Home</Link>
                <span>/</span>
                <Link href="/courses" className="hover:text-white transition-colors">Kursus</Link>
                <span>/</span>
                <span className="text-white font-medium truncate max-w-[200px]">{course.category?.name}</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight">{course.title}</h1>
              {course.subtitle && <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">{course.subtitle}</p>}

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
                {course.level && (
                  <div className="flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-slate-400" />
                    <span className="capitalize">{course.level.toLowerCase()}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Desktop CTA Card Placeholder (Handled by component below) */}
            <div className="hidden lg:block relative">
               {/* This space is reserved for the sticky CTA card */}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <CourseHeroMedia title={course.title} embedUrl={embedUrl} thumbnailUrl={thumbnailUrl} />

            <CourseInfoTabs
              slug={slug}
              courseId={course.id}
              price={Number(course.price || 0)}
              isEnrolled={!!enrollment}
              isLoggedIn={!!user}
              subtitle={course.subtitle || null}
              descriptionHtml={course.description || ''}
              learningOutcomes={Array.isArray(course.learningOutcomes) ? course.learningOutcomes : []}
              totalLessons={totalLessons}
              totalDurationMinutes={Math.round(totalDuration)}
              modules={curriculumModules as any}
              reviewsEnabled={course.reviewsEnabled !== false}
              ratingAvg={ratingAvg}
              ratingCount={ratingCount}
              recentReviews={reviewList as any}
              canRate={Boolean(user && enrollment)}
              canViewQa={canViewQa}
              qaEnabled={Boolean(course.enableQA)}
              qaThreads={qaList as any}
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
                socialLinks: safeJson((course.instructor as any)?.socialLinks ?? null),
                mentorJobTitle: typeof (course.instructor as any)?.mentorJobTitle === 'string' ? String((course.instructor as any).mentorJobTitle) : null,
                mentorBio: typeof (course.instructor as any)?.mentorBio === 'string' ? String((course.instructor as any).mentorBio) : null,
                mentorSkills: Array.isArray((course.instructor as any)?.mentorSkills)
                  ? (course.instructor as any).mentorSkills.filter((v: any) => typeof v === 'string')
                  : [],
                mentorEducations: safeJson((course.instructor as any)?.mentorEducations ?? null),
                mentorExperiences: safeJson((course.instructor as any)?.mentorExperiences ?? null),
                mentorAttachments: safeJson((course.instructor as any)?.mentorAttachments ?? null),
              }}
              viewer={{
                id: user?.id ? String(user.id) : null,
                role: user?.role ? String(user.role) : null,
              }}
              enrollmentExpired={enrollmentExpired}
            />
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <CourseCTA
                course={course}
                isEnrolled={!!enrollment}
                isLoggedIn={!!user}
                totalLessons={totalLessons}
                totalDuration={totalDuration}
              />
              {enrollmentExpired ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Akses kursus Anda sudah berakhir.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
