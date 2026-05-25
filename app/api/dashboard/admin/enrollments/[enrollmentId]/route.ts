import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { enrollmentId } = await params;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, userId: true, courseId: true, course: { select: { deletedAt: true } } },
    });
    if (!enrollment || enrollment.course.deletedAt) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

    await prisma.$transaction(async (tx: any) => {
      await tx.assignmentSubmission.deleteMany({
        where: { userId: enrollment.userId, assignment: { lesson: { module: { courseId: enrollment.courseId } } } },
      });
      await tx.quizAttempt.deleteMany({
        where: { userId: enrollment.userId, quiz: { lesson: { module: { courseId: enrollment.courseId } } } },
      });
      await tx.userProgress.deleteMany({
        where: { userId: enrollment.userId, lesson: { module: { courseId: enrollment.courseId } } },
      });
      await tx.enrollment.delete({ where: { id: enrollment.id } });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete enrollment' }, { status: 500 });
  }
}
