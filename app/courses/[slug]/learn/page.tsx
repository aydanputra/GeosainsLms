import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import CoursePlayerPage from '@/modules/course/pages/CoursePlayerPage';

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

function buildRedirectUrl(pathname: string, current: Record<string, string | string[] | undefined>, next: Record<string, string | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, item);
      continue;
    }
    qs.set(k, v);
  }
  for (const [k, v] of Object.entries(next)) {
    if (v === null) qs.delete(k);
    else qs.set(k, v);
  }
  const query = qs.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default async function LearnCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      status: true,
      instructorId: true,
      validityDays: true,
      deletedAt: true,
    },
  });

  if (!course || course.deletedAt) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect(`/login?redirect=/courses/${slug}/learn`);
  }

  const user = await verifyToken(token);
  if (!user) {
    redirect(`/login?redirect=/courses/${slug}/learn`);
  }

  const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const settings = safeParse(settingsPage?.content);
  const allowStaffView = settings['allowStaffViewCourseContentWithoutEnrolling'] !== false;
  const spotlightEnabled = settings['spotlightModeEnabled'] === true;
  const autoLoadNextCourseContent = settings['autoLoadNextCourseContent'] !== false;
  const courseRetakeEnabled = settings['courseRetakeEnabled'] === true;

  const spotlightParam = typeof sp.spotlight === 'string' ? sp.spotlight : null;
  const learnPath = `/courses/${slug}/learn`;
  if (spotlightEnabled && spotlightParam !== '1') {
    redirect(buildRedirectUrl(learnPath, sp, { spotlight: '1' }));
  }
  if (!spotlightEnabled && spotlightParam === '1') {
    redirect(buildRedirectUrl(learnPath, sp, { spotlight: null }));
  }

  const isAdmin = user.role === 'ADMIN';
  const isInstructor = user.id === course.instructorId;
  const isCoInstructor =
    !isAdmin && !isInstructor
      ? Boolean(
          await prisma.courseCoInstructor.findUnique({
            where: { courseId_userId: { courseId: course.id, userId: String(user.id) } } as any,
            select: { id: true },
          })
        )
      : false;
  const canBypassEnrollment = (isAdmin || isInstructor || isCoInstructor) && allowStaffView;

  if (!canBypassEnrollment) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
      select: { createdAt: true },
    });

    if (!enrollment) {
      redirect(`/courses/${slug}`);
    }

    const validityDays = course.validityDays;
    if (validityDays && validityDays > 0) {
      const expiresAt = new Date(enrollment.createdAt);
      expiresAt.setDate(expiresAt.getDate() + validityDays);
      if (new Date() > expiresAt) {
        redirect(`/courses/${slug}`);
      }
    }
  }

  return (
    <CoursePlayerPage
      courseId={course.id}
      autoLoadNextCourseContent={autoLoadNextCourseContent}
      courseRetakeEnabled={courseRetakeEnabled}
    />
  );
}
