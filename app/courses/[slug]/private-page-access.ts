import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function resolveCoursePageAccess(args: {
  slug: string;
  preview?: string;
  mustLogin: boolean;
  redirectPath?: string;
  course: {
    instructorId: string;
    status: string;
  };
}) {
  const { slug, preview, mustLogin, redirectPath, course } = args;
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const user = token ? await verifyToken(token) : null;

  if (mustLogin && !user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath || `/courses/${slug}`)}`);
  }

  const isCreator = Boolean(user && (user.id === course.instructorId || user.role === 'ADMIN'));
  if (course.status !== 'PUBLISHED' && !isCreator) {
    notFound();
  }

  return {
    isPreviewMode: preview === 'student' && isCreator,
  };
}
