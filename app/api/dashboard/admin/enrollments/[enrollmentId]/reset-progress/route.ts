import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

const COURSE_SETTINGS_SLUG = '__course_settings__';

function safeParseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function getPermissionSettings() {
  const page = await prisma.page.findUnique({ where: { slug: COURSE_SETTINGS_SLUG }, select: { content: true } });
  const raw = safeParseJsonObject(page?.content);
  return {
    allowInstructorsToResetStudentProgress: raw['allowInstructorsToResetStudentProgress'] === true,
  };
}

async function isCourseCoInstructor(courseId: string, userId: string) {
  const row = await prisma.courseCoInstructor.findUnique({
    where: { courseId_userId: { courseId, userId } } as any,
    select: { id: true },
  });
  return Boolean(row);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { enrollmentId } = await params;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, userId: true, courseId: true, course: { select: { deletedAt: true, instructorId: true } } },
    });
    if (!enrollment || enrollment.course.deletedAt) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

    if (user.role !== 'ADMIN') {
      const { allowInstructorsToResetStudentProgress } = await getPermissionSettings();
      if (!allowInstructorsToResetStudentProgress) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const userId = String(user.id);
      const isInstructor = enrollment.course.instructorId === userId;
      const isCoInstructor = !isInstructor ? await isCourseCoInstructor(enrollment.courseId, userId) : false;
      if (!isInstructor && !isCoInstructor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset progress' }, { status: 500 });
  }
}
