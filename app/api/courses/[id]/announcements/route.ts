import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        instructorId: true,
        status: true,
        deletedAt: true,
        validityDays: true,
      },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === course.instructorId);
    if (!isOwner) {
      if (course.status !== CourseStatus.PUBLISHED) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId } },
        select: { createdAt: true },
      });
      if (!enrollment) return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });

      const validityDays = course.validityDays;
      if (validityDays && validityDays > 0) {
        const expiresAt = new Date(enrollment.createdAt);
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        if (new Date() > expiresAt) {
          return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
        }
      }
    }

    const announcements = await prisma.announcement.findMany({
      where: { courseId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: { id: true, name: true, email: true } },
        reads: isOwner ? false : { where: { userId: user.id }, select: { id: true } },
      },
    });

    return NextResponse.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        courseId: a.courseId,
        title: a.title,
        content: a.content,
        pinned: a.pinned,
        createdAt: a.createdAt,
        author: a.author,
        isRead: isOwner ? true : (a as any).reads?.length > 0,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load announcements' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || user.id === course.instructorId;
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      content?: unknown;
      pinned?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const pinned = Boolean(body.pinned);

    if (title.length < 3) return NextResponse.json({ error: 'Judul minimal 3 karakter' }, { status: 400 });

    const created = await prisma.announcement.create({
      data: {
        courseId,
        authorId: String(user.id),
        title,
        content: content ? content : null,
        pinned,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });
    const targets = enrollments.map((e) => e.userId).filter((id) => id !== String(user.id));
    if (targets.length) {
      const href = '/dashboard/student/announcements';
      await prisma.notification.createMany({
        data: targets.map((userId) => ({
          userId,
          title: 'Pengumuman Baru',
          message: `${course.title}\n${title}\nLINK:${href}`,
        })),
      });
    }

    return NextResponse.json(
      {
        announcement: {
          id: created.id,
          courseId: created.courseId,
          title: created.title,
          content: created.content,
          pinned: created.pinned,
          createdAt: created.createdAt,
          author: created.author,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 });
  }
}
