import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    const user = token ? await verifyToken(token) : null;

    const course = (await prisma.course.findUnique({
      where: { id: courseId },
      select: ({ id: true, deletedAt: true, instructorId: true, reviewsEnabled: true } as any),
    })) as any;

    if (!course || course.deletedAt) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    if (course.reviewsEnabled === false) {
      return NextResponse.json({ error: 'Ulasan dinonaktifkan untuk kursus ini' }, { status: 403 });
    }

    const summary = await prisma.courseReview.aggregate({
      where: { courseId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const myReview =
      user && user.id
        ? await prisma.courseReview.findUnique({
            where: { userId_courseId: { userId: user.id, courseId } },
            select: { rating: true, comment: true },
          })
        : null;

    return NextResponse.json(
      {
        ratingAvg: summary._avg.rating ?? 0,
        ratingCount: summary._count.rating ?? 0,
        myRating: myReview?.rating ?? null,
        myComment: myReview?.comment ?? null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load rating' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { rating?: unknown; comment?: unknown };
    const rating = typeof body.rating === 'number' && Number.isFinite(body.rating) ? Math.round(body.rating) : null;
    const comment = typeof body.comment === 'string' ? body.comment.trim() : undefined;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating harus 1 sampai 5' }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, deletedAt: true, instructorId: true },
    });

    if (!course || course.deletedAt) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const isOwner = user.role === 'ADMIN' || user.id === course.instructorId;

    if (!isOwner) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        select: { id: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: 'Anda harus terdaftar untuk memberi rating' }, { status: 403 });
      }
    }

    await prisma.courseReview.upsert({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      update: { rating, comment: comment || null },
      create: { userId: user.id, courseId: course.id, rating, comment: comment || null },
    });

    const summary = await prisma.courseReview.aggregate({
      where: { courseId: course.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return NextResponse.json(
      {
        message: 'Rating berhasil disimpan',
        ratingAvg: summary._avg.rating ?? 0,
        ratingCount: summary._count.rating ?? 0,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan rating' }, { status: 500 });
  }
}
