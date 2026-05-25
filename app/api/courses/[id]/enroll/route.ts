import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';
import { isSameOrigin } from '@/modules/auth/utils/security';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        status: true,
        deletedAt: true,
        instructorId: true,
        enrollmentEndDate: true,
        maxStudents: true,
        validityDays: true,
        subscriptionEligible: true,
        requirements: true,
      },
    });

    if (!course || course.deletedAt) {
      return NextResponse.json({ error: 'Kursus tidak ditemukan' }, { status: 404 });
    }

    const isOwner = user.role === 'ADMIN' || user.id === course.instructorId;
    if (course.status !== CourseStatus.PUBLISHED && !isOwner) {
      return NextResponse.json({ error: 'Kursus belum tersedia untuk didaftarkan' }, { status: 403 });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json({
        message: 'Anda sudah terdaftar di kursus ini',
        redirectUrl: `/courses/${course.slug}/learn`,
        enrolled: true,
      });
    }

    if (!isOwner) {
      if (course.enrollmentEndDate && new Date() > course.enrollmentEndDate) {
        return NextResponse.json({ error: 'Pendaftaran kursus sudah ditutup' }, { status: 403 });
      }

      if (course.maxStudents && course.maxStudents > 0) {
        const totalEnrollments = await prisma.enrollment.count({ where: { courseId: course.id } });
        if (totalEnrollments >= course.maxStudents) {
          return NextResponse.json({ error: 'Kuota kursus sudah penuh' }, { status: 403 });
        }
      }

      if (course.subscriptionEligible) {
        const now = new Date();
        const activeSubscription = await prisma.subscription.findFirst({
          where: {
            userId: user.id,
            startDate: { lte: now },
            endDate: { gte: now },
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (!activeSubscription) {
          return NextResponse.json({ error: 'Kursus ini membutuhkan langganan aktif' }, { status: 403 });
        }
      }

      const raw = Array.isArray(course.requirements) ? course.requirements : [];
      const requiredCourseIds = Array.from(
        new Set(
          raw
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean)
        )
      );

      if (requiredCourseIds.length) {
        const prerequisiteCourses = await prisma.course.findMany({
          where: { id: { in: requiredCourseIds }, deletedAt: null },
          select: { id: true, title: true, slug: true },
        });
        const prerequisiteIds = prerequisiteCourses.map((c) => c.id);
        if (prerequisiteIds.length) {
          const certificates = await prisma.certificate.findMany({
            where: { userId: user.id, courseId: { in: prerequisiteIds } },
            select: { courseId: true },
          });
          const completed = new Set(certificates.map((c) => c.courseId));
          const missing = prerequisiteCourses.filter((c) => !completed.has(c.id));
          if (missing.length) {
            return NextResponse.json(
              {
                error: `Selesaikan kursus prasyarat terlebih dahulu: ${missing
                  .map((c) => c.title || c.slug || c.id)
                  .join(', ')}`,
              },
              { status: 403 }
            );
          }
        }
      }
    }

    if (course.price <= 0) {
      await prisma.enrollment.create({
        data: {
          userId: user.id,
          courseId: course.id,
        },
      });

      const student = await prisma.user.findUnique({
        where: { id: String(user.id) },
        select: { id: true, name: true, email: true },
      });
      const studentName = student?.name || student?.email || 'Siswa';
      const studentEmail = student?.email || '';

      const mentorRecipients = new Set<string>();
      if (course.instructorId) mentorRecipients.add(String(course.instructorId));
      const co = await prisma.courseCoInstructor.findMany({
        where: { courseId: course.id },
        select: { userId: true },
      });
      for (const rel of co) mentorRecipients.add(String(rel.userId));

      if (mentorRecipients.size > 0) {
        const lines = [
          `Siswa: ${studentName}${studentEmail ? ` (${studentEmail})` : ''}`,
          `Kursus: ${course.title}`,
          'Jenis: Gratis',
          'LINK:/dashboard/mentor/students',
        ];
        await prisma.notification.createMany({
          data: Array.from(mentorRecipients.values()).map((userId) => ({
            userId,
            title: 'Pendaftaran Kursus Baru',
            message: lines.join('\n'),
            read: false,
          })),
        });
      }

      await prisma.notification.create({
        data: {
          userId: String(user.id),
          title: 'Pendaftaran Berhasil',
          message: [`Kursus: ${course.title}`, 'LINK:/dashboard/student/courses'].join('\n'),
          read: false,
        },
      });

      return NextResponse.json({
        message: 'Berhasil mendaftar kursus gratis',
        redirectUrl: `/courses/${course.slug}/learn`,
        enrolled: true,
      });
    }

    return NextResponse.json({
      message: 'Lanjutkan ke checkout untuk menyelesaikan pembayaran.',
      enrolled: false,
      redirectUrl: `/checkout?courseId=${encodeURIComponent(course.id)}`,
    });
  } catch (error: any) {
    console.error('Enroll Course Error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mendaftarkan kursus' }, { status: 500 });
  }
}
