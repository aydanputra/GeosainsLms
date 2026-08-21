import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';
import { getCourseAccessContext } from '@/modules/course/api/performance';

async function enforceStudentCourseAccess(args: { userId: string; courseId: string }) {
  const { userId, courseId } = args;
  const course = await getCourseAccessContext(courseId);
  if (!course || course.deletedAt) return { status: 404 as const, error: 'Course not found' };
  if (course.status !== CourseStatus.PUBLISHED) return { status: 403 as const, error: 'Forbidden' };
  if (!course.enableQA) return { status: 403 as const, error: 'Q&A is disabled for this course' };

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { createdAt: true },
  });
  if (!enrollment) {
    if (course.subscriptionEligible) {
      const now = new Date();
      const activeSubscription = await prisma.subscription.findFirst({
        where: { userId: String(userId), startDate: { lte: now }, endDate: { gte: now }, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!activeSubscription) return { status: 403 as const, error: 'Enrollment required' };
    } else {
      return { status: 403 as const, error: 'Enrollment required' };
    }
  }

  const validityDays = course.validityDays;
  if (enrollment && validityDays && validityDays > 0) {
    const expiresAt = new Date(enrollment.createdAt);
    expiresAt.setDate(expiresAt.getDate() + validityDays);
    if (new Date() > expiresAt) return { status: 403 as const, error: 'Enrollment expired' };
  }

  return { status: 200 as const, course };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const course = await getCourseAccessContext(courseId);
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === course.instructorId);
    if (!course.enableQA && !isOwner) return NextResponse.json({ error: 'Q&A is disabled for this course' }, { status: 403 });

    const lessonId = req.nextUrl.searchParams.get('lessonId');

    if (!isOwner) {
      const access = await enforceStudentCourseAccess({ userId: String(user.id), courseId });
      if (access.status !== 200) return NextResponse.json({ error: access.error }, { status: access.status });
    } else {
      if (course.status !== CourseStatus.PUBLISHED && user.role !== 'ADMIN' && user.id !== course.instructorId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const threads = await prisma.qAThread.findMany({
      where: { courseId, ...(lessonId ? { lessonId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
        lesson: { select: { id: true, title: true } },
        _count: { select: { replies: true } },
        replies: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    });

    return NextResponse.json(
      {
        threads: threads.map((t) => ({
          id: t.id,
          courseId: t.courseId,
          lessonId: t.lessonId,
          lessonTitle: t.lesson?.title || null,
          title: t.title,
          question: t.question,
          status: t.status,
          createdAt: t.createdAt,
          author: {
            id: t.author.id,
            name: t.author.name || t.author.email,
            role: t.author.role,
          },
          replyCount: t._count.replies,
          lastReplyAt: t.replies[0]?.createdAt || null,
        })),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load Q&A' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const course = await getCourseAccessContext(courseId);
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === course.instructorId);
    if (!course.enableQA && !isOwner) return NextResponse.json({ error: 'Q&A is disabled for this course' }, { status: 403 });

    if (!isOwner) {
      const access = await enforceStudentCourseAccess({ userId: String(user.id), courseId });
      if (access.status !== 200) return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      question?: unknown;
      lessonId?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const lessonId = typeof body.lessonId === 'string' ? body.lessonId : null;

    if (title.length < 3) return NextResponse.json({ error: 'Judul minimal 3 karakter' }, { status: 400 });
    if (question.length < 10) return NextResponse.json({ error: 'Pertanyaan minimal 10 karakter' }, { status: 400 });

    let lessonTitle: string | null = null;
    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, title: true, module: { select: { courseId: true } } },
      });
      if (!lesson || lesson.module.courseId !== courseId) {
        return NextResponse.json({ error: 'Invalid lesson context' }, { status: 400 });
      }
      lessonTitle = lesson.title;
    }

    const created = await prisma.qAThread.create({
      data: {
        courseId,
        lessonId,
        authorId: String(user.id),
        title,
        question,
        status: 'OPEN',
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
        lesson: { select: { id: true, title: true } },
      },
    });

    if (user.role === 'STUDENT') {
      const instructorId = course.instructorId;
      if (instructorId) {
        const context = `${course.title}${lessonTitle ? ` • ${lessonTitle}` : ''}`.trim();
        const qs = new URLSearchParams();
        qs.set('threadId', created.id);
        if (lessonId) qs.set('lessonId', lessonId);
        const href = `/courses/${encodeURIComponent(course.slug)}/learn?${qs.toString()}#qa`;
        await prisma.notification.create({
          data: {
            userId: instructorId,
            title: 'Q&A Baru',
            message: `${context}\n${title}\nLINK:${href}`,
          },
        });
      }
    }

    return NextResponse.json(
      {
        thread: {
          id: created.id,
          courseId: created.courseId,
          lessonId: created.lessonId,
          lessonTitle: created.lesson?.title || null,
          title: created.title,
          question: created.question,
          status: created.status,
          createdAt: created.createdAt,
          author: {
            id: created.author.id,
            name: created.author.name || created.author.email,
            role: created.author.role,
          },
          replyCount: 0,
          lastReplyAt: null,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create Q&A thread' }, { status: 500 });
  }
}
