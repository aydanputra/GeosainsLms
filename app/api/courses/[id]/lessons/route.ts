import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { extractYoutubeId } from '@/modules/course/api/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    
    if (!body.title || !body.moduleId) {
      return NextResponse.json({ error: 'Judul pelajaran dan Modul ID wajib diisi' }, { status: 400 });
    }

    const { id: courseId } = await params;

    // Phase 5: Authorization Layer - Check module ownership
    const courseModule = await prisma.module.findUnique({
      where: { id: body.moduleId },
      include: { course: true },
    });

    if (!courseModule) {
      return NextResponse.json({ error: 'Modul tidak ditemukan' }, { status: 404 });
    }

    if (courseModule.courseId !== courseId) {
      return NextResponse.json({ error: 'Invalid course context' }, { status: 400 });
    }

    if (user.role !== 'ADMIN') {
      if (courseModule.course.instructorId !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
      }
    }

    let content = body.content;
    if (content === undefined) content = {};

    // Extract Video ID
    let videoId = null;
    if (body.type === 'VIDEO' && body.videoUrl) {
      videoId = extractYoutubeId(body.videoUrl);
      if (!videoId) {
        return NextResponse.json({ error: 'URL YouTube tidak valid' }, { status: 400 });
      }
    }

    const rawType = typeof body.type === 'string' ? body.type : undefined;
    const normalizedType = rawType === 'ASSIGNMENT' ? 'TEXT' : rawType;

    const lesson = await prisma.$transaction(async (tx: any) => {
      const createdLesson = await tx.lesson.create({
        data: {
          title: body.title,
          content: content || {},
          videoId: videoId,
          type: normalizedType || 'VIDEO',
          moduleId: body.moduleId,
          order: body.order || 0,
          duration: body.duration || 0,
          isPreview: body.isPreview || false,
        },
      } as any);

      if (rawType === 'ASSIGNMENT' && body.assignment) {
        const assignment = await tx.assignment.create({
          data: {
            lessonId: createdLesson.id,
            title: String(body.title || 'Tugas'),
            description: typeof body.assignment.description === 'string' ? body.assignment.description : null,
            timeLimit: typeof body.assignment.timeLimit === 'number' ? body.assignment.timeLimit : null,
            passingGrade: typeof body.assignment.passingGrade === 'number' ? body.assignment.passingGrade : 0,
            maxFileSize: typeof body.assignment.maxFileSize === 'number' ? body.assignment.maxFileSize : 5,
          },
        });
        return { ...createdLesson, assignment };
      }

      return createdLesson;
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error: any) {
    console.error("Create Lesson Error:", error);
    return NextResponse.json({ error: error.message || 'Gagal membuat pelajaran' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // PATCH is not supported here. Use PUT or POST.
  // Actually, we should probably support PATCH for bulk reordering if needed.
  // But for now, let's just return 405.
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
