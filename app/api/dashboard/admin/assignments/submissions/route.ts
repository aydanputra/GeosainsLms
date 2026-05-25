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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const courseId = (req.nextUrl.searchParams.get('courseId') || '').trim();
    const assignmentId = (req.nextUrl.searchParams.get('assignmentId') || '').trim();
    const status = (req.nextUrl.searchParams.get('status') || '').trim();
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cursor = (req.nextUrl.searchParams.get('cursor') || '').trim();
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));
    const from = toDate(req.nextUrl.searchParams.get('from'));
    const to = toDate(req.nextUrl.searchParams.get('to'));

    const submittedAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const submissions = await prisma.assignmentSubmission.findMany({
      where: {
        ...(assignmentId ? { assignmentId } : {}),
        ...(courseId && courseId !== 'ALL' ? { assignment: { lesson: { module: { courseId } } } } : {}),
        ...(status && status !== 'ALL' ? { status: status as any } : {}),
        ...(submittedAtFilter ? { submittedAt: submittedAtFilter } : {}),
        ...(q
          ? {
              OR: [
                { user: { is: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { user: { is: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                { assignment: { is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
                {
                  assignment: {
                    is: {
                      lesson: {
                        is: {
                          title: { contains: q, mode: Prisma.QueryMode.insensitive },
                        },
                      },
                    },
                  },
                },
                {
                  assignment: {
                    is: {
                      lesson: {
                        is: {
                          module: {
                            is: {
                              course: {
                                is: { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                              },
                            },
                          },
                        },
                      },
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
            title: true,
            passingGrade: true,
            timeLimit: true,
            lesson: {
              select: {
                id: true,
                title: true,
                module: {
                  select: {
                    course: { select: { id: true, title: true, slug: true } },
                  },
                },
              },
            },
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
          course: {
            id: s.assignment.lesson.module.course.id,
            title: s.assignment.lesson.module.course.title,
            slug: s.assignment.lesson.module.course.slug,
          },
          assignment: {
            id: s.assignment.id,
            title: s.assignment.title || s.assignment.lesson.title || 'Tugas',
            passingGrade: s.assignment.passingGrade ?? 0,
            timeLimit: s.assignment.timeLimit,
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
