import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Tidak ada kursus yang dipilih' }, { status: 400 });
    }

    const courses = await prisma.course.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: {
        id: true,
        instructorId: true,
      },
    });

    const allowedIds =
      user.role === 'ADMIN' ? courses.map((course) => course.id) : courses.filter((course) => course.instructorId === user.id).map((course) => course.id);

    if (allowedIds.length === 0) {
      return NextResponse.json({ error: 'Tidak ada kursus yang dapat dihapus' }, { status: 403 });
    }

    const result = await prisma.course.updateMany({
      where: {
        id: { in: allowedIds },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `${result.count} kursus berhasil dihapus`,
      deletedIds: allowedIds,
      skippedCount: ids.length - allowedIds.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus kursus secara massal' }, { status: 500 });
  }
}

