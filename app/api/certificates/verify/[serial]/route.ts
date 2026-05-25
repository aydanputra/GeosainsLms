
import { NextRequest, NextResponse } from 'next/server';
import { getCertificateBySerial } from '@/modules/certificates/api/service';

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ serial: string }> }
) {
  try {
    const { serial } = await params;
    const certificate = await getCertificateBySerial(serial);

    if (!certificate) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      serial: certificate.serial,
      studentName: certificate.user.name || 'Student',
      courseTitle: certificate.course.title,
      instructorName: certificate.course.instructor?.name || 'Instructor',
      completedAt: certificate.completedAt,
      issuedAt: certificate.issuedAt,
    });
  } catch (error) {
    console.error('Certificate verify error:', error);
    return NextResponse.json({ valid: false, error: 'Verification failed' }, { status: 500 });
  }
}
