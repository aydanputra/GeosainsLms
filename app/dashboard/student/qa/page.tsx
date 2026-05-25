import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentQA from '@/modules/dashboard/pages/student/StudentQA';
import { CourseStatus } from '@prisma/client';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: {
      courseId: true,
      createdAt: true,
      course: { select: { id: true, title: true, status: true, validityDays: true, enableQA: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeCourses = enrollments
    .filter((e) => {
      if (e.course.status !== CourseStatus.PUBLISHED) return false;
      if (!e.course.enableQA) return false;
      const validityDays = e.course.validityDays;
      if (validityDays && validityDays > 0) {
        const expiresAt = new Date(e.createdAt);
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        return new Date() <= expiresAt;
      }
      return true;
    })
    .map((e) => ({ id: e.course.id, title: e.course.title }));

  const activeCourseIds = activeCourses.map((c) => c.id);

  const threads = activeCourseIds.length
    ? await prisma.qAThread.findMany({
        where: { courseId: { in: activeCourseIds } },
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { title: true } },
          lesson: { select: { title: true } },
          author: { select: { id: true, name: true, email: true, role: true } },
          _count: { select: { replies: true } },
          replies: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      })
    : [];

  return (
    <StudentQA
      courses={activeCourses}
      threads={threads.map((t) => ({
        id: t.id,
        courseId: t.courseId,
        courseTitle: t.course.title,
        lessonTitle: t.lesson?.title || null,
        title: t.title,
        question: t.question,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        authorId: t.author.id,
        authorName: t.author.name || t.author.email || 'User',
        authorRole: t.author.role,
        replyCount: t._count.replies,
        lastReplyAt: t.replies[0]?.createdAt ? t.replies[0].createdAt.toISOString() : null,
      }))}
    />
  );
}
