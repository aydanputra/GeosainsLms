import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bundle = await prisma.courseBundle.findUnique({
      where: { id },
      select: {
        id: true,
        published: true,
        courseIds: true,
      },
    });

    if (!bundle || !bundle.published) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const token = req.cookies.get('token')?.value;
    const user = token ? await verifyToken(token) : null;

    if (!user) {
      return NextResponse.json(
        {
          isLoggedIn: false,
          enrolledCount: 0,
        },
        { status: 200 }
      );
    }

    const courseIds = Array.from(new Set((bundle.courseIds || []).map((courseId) => courseId.trim()).filter(Boolean)));
    const enrolledCount =
      courseIds.length > 0
        ? await prisma.enrollment.count({
            where: {
              userId: String(user.id),
              courseId: { in: courseIds },
            },
          })
        : 0;

    return NextResponse.json(
      {
        isLoggedIn: true,
        enrolledCount,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
