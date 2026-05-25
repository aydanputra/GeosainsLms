import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ instructorId: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { instructorId } = await params;

    const instructor = await prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, createdAt: true },
    });

    if (!instructor || instructor.role !== 'MENTOR') return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });

    const courses = await prisma.course.findMany({
      where: { instructorId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, slug: true, status: true, createdAt: true },
    });

    return NextResponse.json(
      {
        instructor: {
          id: instructor.id,
          name: instructor.name || instructor.email,
          email: instructor.email,
          avatarUrl: instructor.avatarUrl,
          createdAt: instructor.createdAt,
        },
        courses: courses.map((c) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          status: c.status,
          createdAt: c.createdAt,
        })),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load instructor' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ instructorId: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { instructorId } = await params;

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : null;
    const avatarUrl = typeof body?.avatarUrl === 'string' ? body.avatarUrl.trim() : null;

    const instructor = await prisma.user.findUnique({ where: { id: instructorId }, select: { id: true, role: true } });
    if (!instructor || instructor.role !== 'MENTOR') return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id: instructorId },
      data: {
        ...(name !== null ? { name: name || null } : {}),
        ...(avatarUrl !== null ? { avatarUrl: avatarUrl || null } : {}),
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    return NextResponse.json(
      {
        instructor: {
          id: updated.id,
          name: updated.name || updated.email,
          email: updated.email,
          avatarUrl: updated.avatarUrl,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update instructor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ instructorId: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { instructorId } = await params;

    const instructor = await prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, role: true, _count: { select: { coursesTaught: true } } },
    });
    if (!instructor || instructor.role !== 'MENTOR') return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    if (instructor._count.coursesTaught > 0) return NextResponse.json({ error: 'Instructor masih memiliki kursus' }, { status: 400 });

    await prisma.user.update({ where: { id: instructorId }, data: { role: 'STUDENT' } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete instructor' }, { status: 500 });
  }
}

