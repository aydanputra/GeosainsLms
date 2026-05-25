import PublicCoursesCatalogPage from '@/modules/course/pages/PublicCoursesCatalogPage';
import { prisma } from '@/utils/prisma';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';

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

export default async function CourseTagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;

  const page = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const settings = safeParse(page?.content);
  const mustLogin = settings['studentsMustBeLoggedInToViewCourse'] === true;

  if (mustLogin) {
    const token = (await cookies()).get('token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user) redirect(`/login?redirect=/course-tag/${encodeURIComponent(tag)}`);
  }

  return <PublicCoursesCatalogPage initialTagSlug={tag} />;
}
