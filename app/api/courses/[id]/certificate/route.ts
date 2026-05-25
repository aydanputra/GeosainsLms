import { NextRequest, NextResponse } from 'next/server';
import { generateCertificate } from '@/modules/course/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const certificate = await generateCertificate(user.id, courseId);
    return NextResponse.json(certificate, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
