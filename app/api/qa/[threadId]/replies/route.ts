import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';

async function enforceStudentThreadAccess(args: { userId: string; threadId: string }) {
  const { userId, threadId } = args;
  const thread = await prisma.qAThread.findUnique({
    where: { id: threadId },
    include: {
      course: {
        select: {
          id: true,
          instructorId: true,
          status: true,
          deletedAt: true,
          validityDays: true,
          enableQA: true,
        },
      },
    },
  });
  if (!thread || thread.course.deletedAt) return { status: 404 as const, error: 'Thread not found' };
  if (thread.course.status !== CourseStatus.PUBLISHED) return { status: 403 as const, error: 'Forbidden' };
  if (!thread.course.enableQA) return { status: 403 as const, error: 'Q&A is disabled for this course' };

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: thread.course.id } },
    select: { createdAt: true },
  });
  if (!enrollment) return { status: 403 as const, error: 'Enrollment required' };

  const validityDays = thread.course.validityDays;
  if (validityDays && validityDays > 0) {
    const expiresAt = new Date(enrollment.createdAt);
    expiresAt.setDate(expiresAt.getDate() + validityDays);
    if (new Date() > expiresAt) return { status: 403 as const, error: 'Enrollment expired' };
  }

  return { status: 200 as const, thread };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const thread = await prisma.qAThread.findUnique({
      where: { id: threadId },
      include: {
        course: { select: { id: true, title: true, slug: true, instructorId: true, status: true, deletedAt: true, enableQA: true, validityDays: true } },
        lesson: { select: { id: true, title: true } },
        author: { select: { id: true } },
      },
    });
    if (!thread || thread.course.deletedAt) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === thread.course.instructorId);
    if (!thread.course.enableQA && !isOwner) return NextResponse.json({ error: 'Q&A is disabled for this course' }, { status: 403 });

    if (!isOwner) {
      const access = await enforceStudentThreadAccess({ userId: String(user.id), threadId });
      if (access.status !== 200) return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await req.json().catch(() => ({}))) as { message?: unknown };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 2) return NextResponse.json({ error: 'Pesan minimal 2 karakter' }, { status: 400 });

    const created = await prisma.qAReply.create({
      data: { threadId, authorId: String(user.id), message },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });

    const notifyTargets = new Set<string>();
    if (user.role === 'STUDENT') {
      if (thread.course.instructorId) notifyTargets.add(thread.course.instructorId);
    } else {
      if (thread.authorId) notifyTargets.add(thread.authorId);
    }
    notifyTargets.delete(String(user.id));

    if (notifyTargets.size) {
      const context = `${thread.course.title}${thread.lesson?.title ? ` • ${thread.lesson.title}` : ''}`.trim();
      const notificationTitle = user.role === 'STUDENT' ? 'Balasan dari Siswa' : 'Balasan dari Mentor';
      const qs = new URLSearchParams();
      qs.set('threadId', threadId);
      if (thread.lessonId) qs.set('lessonId', thread.lessonId);
      const href = `/courses/${encodeURIComponent(thread.course.slug)}/learn?${qs.toString()}#qa`;
      const notificationMessage = `${context}\n${thread.title}\n${message.slice(0, 120)}\nLINK:${href}`;
      await prisma.notification.createMany({
        data: Array.from(notifyTargets).map((userId) => ({
          userId,
          title: notificationTitle,
          message: notificationMessage,
        })),
      });
    }

    return NextResponse.json(
      {
        reply: {
          id: created.id,
          message: created.message,
          createdAt: created.createdAt,
          author: {
            id: created.author.id,
            name: created.author.name || created.author.email,
            role: created.author.role,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reply' }, { status: 500 });
  }
}
