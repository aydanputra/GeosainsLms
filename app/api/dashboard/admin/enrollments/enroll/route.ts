import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : '';
    const userIds = Array.isArray(body?.userIds) ? body.userIds.map(String).map((s: string) => s.trim()).filter(Boolean) : [];
    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    if (userIds.length === 0) return NextResponse.json({ error: 'userIds is required' }, { status: 400 });

    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, deletedAt: true } });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const existingStudents = await prisma.user.findMany({
      where: { id: { in: userIds }, role: 'STUDENT' },
      select: { id: true },
    });
    const validUserIds = existingStudents.map((u) => u.id);
    if (validUserIds.length === 0) return NextResponse.json({ error: 'No valid students' }, { status: 400 });

    const result = await prisma.enrollment.createMany({
      data: validUserIds.map((id) => ({ userId: id, courseId })),
      skipDuplicates: true,
    });

    return NextResponse.json({ createdCount: result.count }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to enroll students' }, { status: 500 });
  }
}

