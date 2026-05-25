import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    
    // Phase 5: Authorization Layer - Ownership Check
    if (user.role !== 'ADMIN') {
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course || course.instructorId !== user.id) {
            return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
        }
    }

    const body = await req.json();
    const { type, items } = body;

    if (!type || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Phase 4: Transaction Safety
    if (type === 'module') {
      await prisma.$transaction(
        items.map((item: { id: string; order: number }) => 
          prisma.module.update({
            where: { id: item.id },
            data: { order: item.order },
          })
        )
      );
    } else if (type === 'lesson') {
      await prisma.$transaction(
        items.map((item: { id: string; order: number; moduleId?: string }) => 
          prisma.lesson.update({
            where: { id: item.id },
            data: { 
              order: item.order,
              ...(item.moduleId && { moduleId: item.moduleId }) 
            },
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reorder Error:", error);
    return NextResponse.json({ error: error.message || 'Gagal menyusun ulang' }, { status: 500 });
  }
}
