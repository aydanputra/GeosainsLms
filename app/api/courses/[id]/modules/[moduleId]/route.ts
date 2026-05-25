import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: courseId, moduleId } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'Judul modul wajib diisi' }, { status: 400 });

    const description =
      typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;

    const moduleRow = await prisma.module.findFirst({
      where: { id: moduleId, courseId },
      select: { id: true, courseId: true, order: true, createdAt: true, updatedAt: true, course: { select: { instructorId: true } } },
    });

    if (!moduleRow) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwner = String(user.id) === moduleRow.course.instructorId;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
    }

    await prisma.$executeRaw`
      UPDATE "Module"
      SET "title" = ${title},
          "description" = ${description},
          "updatedAt" = NOW()
      WHERE "id" = ${moduleId} AND "courseId" = ${courseId}
    `;

    return NextResponse.json({
      id: moduleRow.id,
      title,
      description,
      courseId: moduleRow.courseId,
      order: moduleRow.order,
      createdAt: moduleRow.createdAt,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui modul' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: courseId, moduleId } = await params;

    // Phase 5: Authorization Layer - Ownership Check
    if (user.role !== 'ADMIN') {
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.instructorId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
        }
    }

    const { moduleId: verifiedModuleId } = await params;

    // Delete lessons associated with the module first (though cascade delete might handle this if configured)
    await prisma.lesson.deleteMany({
      where: { moduleId: verifiedModuleId },
    });

    await prisma.module.delete({
      where: { id: verifiedModuleId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Module Error:", error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus modul' }, { status: 500 });
  }
}
