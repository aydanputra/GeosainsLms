import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const page = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
    const settings = safeParse(page?.content);
    const enabled = settings['courseRetakeEnabled'] === true;
    if (!enabled) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, deletedAt: true, validityDays: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: String(user.id), courseId } },
      select: { createdAt: true },
    });
    if (!enrollment) return NextResponse.json({ error: 'User not enrolled in this course' }, { status: 403 });

    const validityDays = course.validityDays;
    if (validityDays && validityDays > 0) {
      const expiresAt = new Date(enrollment.createdAt);
      expiresAt.setDate(expiresAt.getDate() + validityDays);
      if (new Date() > expiresAt) {
        return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.assignmentSubmission.deleteMany({
        where: { userId: String(user.id), assignment: { lesson: { module: { courseId } } } },
      });
      await tx.quizAttempt.deleteMany({
        where: { userId: String(user.id), quiz: { lesson: { module: { courseId } } } },
      });
      await tx.userProgress.deleteMany({
        where: { userId: String(user.id), lesson: { module: { courseId } } },
      });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to retake course' }, { status: 500 });
  }
}
