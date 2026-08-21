import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { getCourseAccessContext } from '@/modules/course/api/performance';

const COURSE_CERTIFICATE_PREFIX = '__course_certificate__';

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

async function isCourseCoInstructor(courseId: string, userId: string) {
  const row = await prisma.courseCoInstructor.findUnique({
    where: { courseId_userId: { courseId, userId } } as any,
    select: { id: true },
  });
  return Boolean(row);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const course = await getCourseAccessContext(courseId);
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = String(user.id) === course.instructorId;
    const isCoInstructor = !isAdmin && !isInstructor ? await isCourseCoInstructor(course.id, String(user.id)) : false;
    const isOwner = isAdmin || isInstructor || isCoInstructor;
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const page = await prisma.page.findUnique({
      where: { slug: `${COURSE_CERTIFICATE_PREFIX}${courseId}` },
      select: { content: true, updatedAt: true },
    });

    const design = safeParse(page?.content);
    return NextResponse.json({ design, updatedAt: page?.updatedAt ?? null }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const course = await getCourseAccessContext(courseId);
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = String(user.id) === course.instructorId;
    const isCoInstructor = !isAdmin && !isInstructor ? await isCourseCoInstructor(course.id, String(user.id)) : false;
    const isOwner = isAdmin || isInstructor || isCoInstructor;
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const content = JSON.stringify(body);
    const saved = await prisma.page.upsert({
      where: { slug: `${COURSE_CERTIFICATE_PREFIX}${courseId}` },
      create: {
        title: `Certificate Design - ${course.title || courseId}`,
        slug: `${COURSE_CERTIFICATE_PREFIX}${courseId}`,
        content,
        published: false,
      },
      update: {
        content,
      },
      select: { slug: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, slug: saved.slug, updatedAt: saved.updatedAt }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const course = await getCourseAccessContext(courseId);
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = String(user.id) === course.instructorId;
    const isCoInstructor = !isAdmin && !isInstructor ? await isCourseCoInstructor(course.id, String(user.id)) : false;
    const isOwner = isAdmin || isInstructor || isCoInstructor;
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const slug = `${COURSE_CERTIFICATE_PREFIX}${courseId}`;
    const existing = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return NextResponse.json({ ok: true, deleted: false }, { status: 200 });

    await prisma.page.delete({ where: { slug } });
    return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
