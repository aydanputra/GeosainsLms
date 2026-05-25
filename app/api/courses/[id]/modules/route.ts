import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: courseId } = await params;
    const body = await req.json();

    // Phase 5: Authorization Layer - Ownership Check
    if (user.role !== 'ADMIN') {
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.instructorId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
        }
    }

    if (!body.title) {
      return NextResponse.json({ error: 'Judul modul wajib diisi' }, { status: 400 });
    }

    const createdModule = await prisma.module.create({
      data: {
        title: body.title,
        order: body.order || 0,
        courseId: courseId,
      },
    });

    const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
    if (description) {
      await prisma.$executeRaw`
        UPDATE "Module"
        SET "description" = ${description}, "updatedAt" = NOW()
        WHERE "id" = ${createdModule.id}
      `;
    }

    return NextResponse.json({ ...createdModule, description }, { status: 201 });
  } catch (error: any) {
    console.error("Create Module Error:", error);
    return NextResponse.json({ error: error.message || 'Gagal membuat modul' }, { status: 500 });
  }
}
