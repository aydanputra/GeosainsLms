import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/modules/auth/utils/auth';
 
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
 
export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
 
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 
    const cursor = req.nextUrl.searchParams.get('cursor');
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const status = (req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));
 
    const normalizedStatus = status === 'PENDING' || status === 'GRADED' || status === 'REJECTED' || status === 'ALL' ? status : 'ALL';
 
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: studentId, course: { deletedAt: null } },
      select: { courseId: true },
    });
    const courseIds = Array.from(new Set(enrollments.map((e) => e.courseId)));
 
    const submittedAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;
 
    const where: Prisma.AssignmentSubmissionWhereInput = {
      userId: studentId,
      assignment: { is: { lesson: { is: { module: { is: { courseId: { in: courseIds } } } } } } },
      ...(normalizedStatus !== 'ALL' ? { status: normalizedStatus as any } : {}),
      ...(submittedAtFilter ? { submittedAt: submittedAtFilter } : {}),
      ...(q
        ? {
            OR: [
              { assignment: { is: { lesson: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } },
              { assignment: { is: { lesson: { is: { module: { is: { course: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } } } } } } } },
            ],
          }
        : {}),
    };
 
    const subs = await prisma.assignmentSubmission.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        grade: true,
        feedback: true,
        notes: true,
        submittedAt: true,
        gradedAt: true,
        assignment: {
          select: {
            id: true,
            passingGrade: true,
            lesson: { select: { id: true, title: true, module: { select: { course: { select: { id: true, title: true, slug: true } } } } } },
          },
        },
      },
    });
 
    const mapped = subs.map((s) => ({
      id: s.id,
      status: s.status,
      grade: s.grade,
      feedback: s.feedback,
      notes: s.notes,
      submittedAt: s.submittedAt,
      gradedAt: s.gradedAt,
      assignment: {
        id: s.assignment.id,
        lessonId: s.assignment.lesson?.id ?? null,
        lessonTitle: s.assignment.lesson?.title ?? 'Tugas',
        passingGrade: s.assignment.passingGrade ?? 0,
      },
      course: {
        id: s.assignment.lesson?.module.course.id ?? '',
        title: s.assignment.lesson?.module.course.title ?? '',
        slug: s.assignment.lesson?.module.course.slug ?? '',
      },
      downloadUrl: `/api/assignments/submissions/${s.id}/download`,
    }));
 
    const page = mapped.slice(0, limit);
    const nextCursor = mapped.length > limit ? page[page.length - 1]?.id ?? null : null;
 
    return NextResponse.json({ submissions: page, nextCursor }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load submissions' }, { status: 500 });
  }
}
