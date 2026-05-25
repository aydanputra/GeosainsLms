import { NextRequest, NextResponse } from 'next/server';
import { markLessonComplete } from '@/modules/course/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const { id: courseId, lessonId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, module: { select: { courseId: true } } },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (lesson.module.courseId !== courseId) {
      return NextResponse.json({ error: 'Invalid course context' }, { status: 400 });
    }

    const progress = await markLessonComplete(user.id, lessonId);
    return NextResponse.json(progress, { status: 200 });
  } catch (error: any) {
    const message = error?.message || 'Failed to update progress';
    if (message === 'User not enrolled in this course') {
      return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
    }
    if (message === 'ENROLLMENT_EXPIRED') {
      return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
    }
    if (message === 'DRIP_LOCKED' || message === 'SCHEDULE_LOCKED' || message === 'SEQUENTIAL_LOCKED') {
      return NextResponse.json({ error: 'Lesson is locked', lockReason: message }, { status: 403 });
    }
    if (message === 'QUIZ_NOT_PASSED') {
      return NextResponse.json({ error: 'Quiz not passed' }, { status: 403 });
    }
    if (message === 'ASSIGNMENT_NOT_PASSED') {
      return NextResponse.json({ error: 'Assignment not passed' }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
