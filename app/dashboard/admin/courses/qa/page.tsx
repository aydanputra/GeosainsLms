import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import MentorQA from '@/modules/dashboard/pages/mentor/MentorQA';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'ADMIN') return <div>Access Denied</div>;

  const threads = await prisma.qAThread.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { id: true, title: true, slug: true } },
      lesson: { select: { id: true, title: true } },
      author: { select: { name: true, email: true, role: true } },
      _count: { select: { replies: true } },
      replies: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  });

  return (
    <MentorQA
      threads={threads.map((t) => ({
        id: t.id,
        courseId: t.course.id,
        courseSlug: t.course.slug,
        courseTitle: t.course.title,
        lessonId: t.lessonId,
        lessonTitle: t.lesson?.title || null,
        title: t.title,
        question: t.question,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        authorName: t.author.name || t.author.email || 'User',
        authorRole: t.author.role,
        replyCount: t._count.replies,
        lastReplyAt: t.replies[0]?.createdAt ? t.replies[0].createdAt.toISOString() : null,
      }))}
    />
  );
}
