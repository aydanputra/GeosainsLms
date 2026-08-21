import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'MENTOR' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scope = (req.nextUrl.searchParams.get('scope') || '').trim().toLowerCase();
    const courses = await prisma.course.findMany({
      where:
        user.role === 'MENTOR' || scope === 'self'
          ? { instructorId: user.id, deletedAt: null }
          : { deletedAt: null },
      include: {
        _count: {
          select: { enrollments: true }
        }
      }
    });

    return NextResponse.json(courses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
