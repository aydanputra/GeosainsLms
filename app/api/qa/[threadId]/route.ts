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
          status: true,
          deletedAt: true,
          validityDays: true,
          enableQA: true,
        },
      },
      lesson: { select: { id: true, title: true } },
      author: { select: { id: true, name: true, email: true, role: true } },
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const thread = await prisma.qAThread.findUnique({
      where: { id: threadId },
      include: {
        course: { select: { id: true, title: true, instructorId: true, status: true, deletedAt: true, enableQA: true, validityDays: true } },
        lesson: { select: { id: true, title: true } },
        author: { select: { id: true, name: true, email: true, role: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });
    if (!thread || thread.course.deletedAt) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === thread.course.instructorId);
    if (!thread.course.enableQA && !isOwner) return NextResponse.json({ error: 'Q&A is disabled for this course' }, { status: 403 });

    if (!isOwner) {
      const access = await enforceStudentThreadAccess({ userId: String(user.id), threadId });
      if (access.status !== 200) return NextResponse.json({ error: access.error }, { status: access.status });
    }

    return NextResponse.json(
      {
        thread: {
          id: thread.id,
          courseId: thread.course.id,
          courseTitle: thread.course.title,
          lessonId: thread.lessonId,
          lessonTitle: thread.lesson?.title || null,
          title: thread.title,
          question: thread.question,
          status: thread.status,
          createdAt: thread.createdAt,
          author: {
            id: thread.author.id,
            name: thread.author.name || thread.author.email,
            role: thread.author.role,
          },
          replies: thread.replies.map((r) => ({
            id: r.id,
            message: r.message,
            createdAt: r.createdAt,
            author: {
              id: r.author.id,
              name: r.author.name || r.author.email,
              role: r.author.role,
            },
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load thread' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const thread = await prisma.qAThread.findUnique({
      where: { id: threadId },
      include: { course: { select: { instructorId: true, deletedAt: true } } },
    });
    if (!thread || thread.course.deletedAt) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === thread.course.instructorId);
    const isAuthor = String(user.id) === thread.authorId;
    if (!isOwner && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { status?: unknown };
    const statusValue = typeof body.status === 'string' ? body.status : null;
    if (statusValue !== 'OPEN' && statusValue !== 'RESOLVED') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await prisma.qAThread.update({
      where: { id: threadId },
      data: { status: statusValue },
    });

    return NextResponse.json({ thread: { id: updated.id, status: updated.status } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update thread' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const thread = await prisma.qAThread.findUnique({
      where: { id: threadId },
      include: { course: { select: { instructorId: true, deletedAt: true } } },
    });
    if (!thread || thread.course.deletedAt) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === thread.course.instructorId);
    const isAuthor = String(user.id) === thread.authorId;
    if (!isOwner && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.qAThread.delete({ where: { id: threadId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete thread' }, { status: 500 });
  }
}
