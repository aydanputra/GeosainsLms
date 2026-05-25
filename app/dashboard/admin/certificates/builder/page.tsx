import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import CertificateBuilder from '@/modules/certificates/components/CertificateBuilder';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

const SETTINGS_SLUG = '__course_settings__';
const COURSE_CERTIFICATE_PREFIX = '__course_certificate__';

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

async function isCourseCoInstructor(courseId: string, userId: string) {
  const row = await prisma.courseCoInstructor.findUnique({
    where: { courseId_userId: { courseId, userId } } as any,
    select: { id: true },
  });
  return Boolean(row);
}

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; templateId?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) redirect('/login');

  const user = await verifyToken(token);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) redirect('/dashboard');

  const { courseId } = await searchParams;
  if (user.role === 'MENTOR' && !courseId) redirect('/dashboard/mentor');

  const page = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG } });
  const globalSettings = safeParse(page?.content);

  let mergedSettings = globalSettings;
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) redirect('/dashboard');

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = String(user.id) === course.instructorId;
    const isCoInstructor = !isAdmin && !isInstructor ? await isCourseCoInstructor(course.id, String(user.id)) : false;
    const isOwner = isAdmin || isInstructor || isCoInstructor;
    if (user.role === 'MENTOR' && !isOwner) redirect('/dashboard/mentor');

    const courseCertPage = await prisma.page.findUnique({
      where: { slug: `${COURSE_CERTIFICATE_PREFIX}${courseId}` },
      select: { content: true },
    });
    const courseSettings = safeParse(courseCertPage?.content);
    mergedSettings = { ...globalSettings, ...courseSettings };
  }

  return (
    <Suspense fallback={<div>Loading Builder...</div>}>
      <CertificateBuilder initialSettings={mergedSettings} />
    </Suspense>
  );
}
