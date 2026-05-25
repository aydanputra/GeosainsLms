import { NextRequest, NextResponse } from 'next/server';
import { getEnrolledCourses } from '@/modules/course/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const courses = await getEnrolledCourses(user.id);
    return NextResponse.json(courses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
