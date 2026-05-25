import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
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

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const courseId = req.nextUrl.searchParams.get('courseId');
    const studentId = req.nextUrl.searchParams.get('userId');
    const assignmentId = req.nextUrl.searchParams.get('assignmentId');
    const status = req.nextUrl.searchParams.get('status');
    const pendingOnly = req.nextUrl.searchParams.get('pendingOnly') === '1';
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cursor = req.nextUrl.searchParams.get('cursor');
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));

    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (user.role === 'MENTOR' && String(user.id) !== course.instructorId) {
      const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
      const settings = safeParse(settingsPage?.content);
      const allowCoInstructorAccess = settings['gradebookAllowCoInstructorAccess'] === true;
      if (!allowCoInstructorAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const isCoInstructor = Boolean(
        await prisma.courseCoInstructor.findUnique({
          where: { courseId_userId: { courseId, userId: String(user.id) } } as any,
          select: { id: true },
        })
      );
      if (!isCoInstructor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const submittedAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const submissions = await prisma.assignmentSubmission.findMany({
      where: {
        ...(studentId ? { userId: studentId } : {}),
        ...(assignmentId ? { assignmentId } : {}),
        ...(pendingOnly ? { status: 'PENDING' } : status ? { status: status as any } : {}),
        assignment: { lesson: { module: { courseId } } },
        ...(submittedAtFilter ? { submittedAt: submittedAtFilter } : {}),
        ...(q
          ? {
              OR: [
                { user: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { user: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                {
                  assignment: {
                    is: {
                      lesson: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        notes: true,
        grade: true,
        feedback: true,
        status: true,
        submittedAt: true,
        gradedAt: true,
        fileUrl: true,
        user: { select: { id: true, name: true, email: true } },
        assignment: {
          select: {
            id: true,
            passingGrade: true,
            lesson: { select: { id: true, title: true } },
          },
        },
      },
    });

    const hasMore = submissions.length > limit;
    const page = hasMore ? submissions.slice(0, limit) : submissions;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return NextResponse.json(
      {
        submissions: page.map((s) => ({
          id: s.id,
          notes: s.notes,
          grade: s.grade,
          feedback: s.feedback,
          status: s.status,
          submittedAt: s.submittedAt,
          gradedAt: s.gradedAt,
          downloadUrl: `/api/assignments/submissions/${s.id}/download`,
          student: { id: s.user.id, name: s.user.name || s.user.email, email: s.user.email },
          assignment: {
            id: s.assignment.id,
            passingGrade: s.assignment.passingGrade ?? 0,
            lessonId: s.assignment.lesson?.id ?? null,
            lessonTitle: s.assignment.lesson?.title ?? 'Tugas',
          },
        })),
        nextCursor,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load submissions' }, { status: 500 });
  }
}
