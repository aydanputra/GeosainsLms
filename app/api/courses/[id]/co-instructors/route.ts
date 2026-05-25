import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

const SETTINGS_SLUG = '__course_settings__';

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

async function getPermissionSettings() {
  const page = await prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } });
  const raw = safeParse(page?.content);
  return {
    allowInstructorsToManageCoInstructors: raw['allowInstructorsToManageCoInstructors'] === true,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    if (user.role !== 'ADMIN' && String(user.id) !== course.instructorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.courseCoInstructor.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.user.id,
        name: r.user.name || r.user.email,
        email: r.user.email,
        role: r.user.role,
      })),
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load co-instructors' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { allowInstructorsToManageCoInstructors } = await getPermissionSettings();
    if (user.role === 'MENTOR' && !allowInstructorsToManageCoInstructors) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    if (user.role !== 'ADMIN' && String(user.id) !== course.instructorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
    const coId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!coId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (coId === course.instructorId) return NextResponse.json({ error: 'Sudah menjadi author' }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id: coId }, select: { id: true, role: true, email: true, name: true } });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (target.role !== 'MENTOR' && target.role !== 'ADMIN') return NextResponse.json({ error: 'User bukan instruktur' }, { status: 400 });

    await prisma.courseCoInstructor.upsert({
      where: { courseId_userId: { courseId, userId: coId } } as any,
      update: {},
      create: { courseId, userId: coId },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add co-instructor' }, { status: 500 });
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

    const { allowInstructorsToManageCoInstructors } = await getPermissionSettings();
    if (user.role === 'MENTOR' && !allowInstructorsToManageCoInstructors) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
    const coId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!coId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, deletedAt: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    if (user.role !== 'ADMIN' && String(user.id) !== course.instructorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.courseCoInstructor.deleteMany({
      where: { courseId, userId: coId },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove co-instructor' }, { status: 500 });
  }
}
