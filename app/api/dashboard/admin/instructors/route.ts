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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cursor = (req.nextUrl.searchParams.get('cursor') || '').trim();
    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(100, rawLimit ?? 20));

    const instructors = await prisma.user.findMany({
      where: {
        role: 'MENTOR',
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { coursesTaught: true } },
      },
    });

    const hasMore = instructors.length > limit;
    const page = hasMore ? instructors.slice(0, limit) : instructors;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const instructorIds = page.map((i) => i.id);
    const courses = instructorIds.length
      ? await prisma.course.findMany({
          where: { instructorId: { in: instructorIds }, deletedAt: null },
          select: { id: true, instructorId: true, _count: { select: { enrollments: true } } },
        })
      : [];

    const studentsByInstructor = new Map<string, number>();
    for (const c of courses) {
      const prev = studentsByInstructor.get(c.instructorId) || 0;
      studentsByInstructor.set(c.instructorId, prev + (c._count.enrollments || 0));
    }

    return NextResponse.json(
      {
        instructors: page.map((i) => ({
          id: i.id,
          name: i.name || i.email,
          email: i.email,
          avatarUrl: i.avatarUrl,
          createdAt: i.createdAt,
          totalCourses: i._count.coursesTaught,
          totalStudents: studentsByInstructor.get(i.id) || 0,
          status: 'APPROVED',
        })),
        nextCursor,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load instructors' }, { status: 500 });
  }
}
