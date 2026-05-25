import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ announcementId: string }> }) {
  try {
    const { announcementId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await prisma.announcement.findUnique({
      where: { id: announcementId },
      include: { course: { select: { instructorId: true, deletedAt: true } } },
    });
    if (!existing || existing.course.deletedAt) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || user.id === existing.course.instructorId;
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      content?: unknown;
      pinned?: unknown;
    };

    const data: any = {};
    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (title.length < 3) return NextResponse.json({ error: 'Judul minimal 3 karakter' }, { status: 400 });
      data.title = title;
    }
    if (typeof body.content === 'string') {
      const content = body.content.trim();
      data.content = content ? content : null;
    }
    if (typeof body.pinned === 'boolean') {
      data.pinned = body.pinned;
    }

    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data,
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(
      {
        announcement: {
          id: updated.id,
          courseId: updated.courseId,
          title: updated.title,
          content: updated.content,
          pinned: updated.pinned,
          createdAt: updated.createdAt,
          author: updated.author,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ announcementId: string }> }) {
  try {
    const { announcementId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await prisma.announcement.findUnique({
      where: { id: announcementId },
      include: { course: { select: { instructorId: true, deletedAt: true } } },
    });
    if (!existing || existing.course.deletedAt) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });

    const isOwner = user.role === 'ADMIN' || user.id === existing.course.instructorId;
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.announcement.delete({ where: { id: announcementId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 });
  }
}
