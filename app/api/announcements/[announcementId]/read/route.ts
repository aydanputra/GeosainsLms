import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ announcementId: string }> }) {
  try {
    const { announcementId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        course: {
          select: {
            id: true,
            instructorId: true,
            status: true,
            deletedAt: true,
            validityDays: true,
          },
        },
      },
    });
    if (!announcement || announcement.course.deletedAt) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    const courseId = announcement.course.id;
    const isOwner = user.role === 'ADMIN' || (user.role === 'MENTOR' && user.id === announcement.course.instructorId);
    if (!isOwner) {
      if (announcement.course.status !== CourseStatus.PUBLISHED) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId } },
        select: { createdAt: true },
      });
      if (!enrollment) return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });

      const validityDays = announcement.course.validityDays;
      if (validityDays && validityDays > 0) {
        const expiresAt = new Date(enrollment.createdAt);
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        if (new Date() > expiresAt) {
          return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
        }
      }
    }

    await prisma.announcementRead.upsert({
      where: { userId_announcementId: { userId: String(user.id), announcementId } },
      update: { readAt: new Date() },
      create: { userId: String(user.id), announcementId },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to mark as read' }, { status: 500 });
  }
}
