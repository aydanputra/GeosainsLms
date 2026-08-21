
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const certificates = await prisma.certificate.findMany({
      where: { userId: user.id },
      include: {
        course: {
          select: { title: true, slug: true, thumbnailUrl: true }
        }
      },
      orderBy: { issuedAt: 'desc' }
    });

    return NextResponse.json(certificates);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 });
  }
}
