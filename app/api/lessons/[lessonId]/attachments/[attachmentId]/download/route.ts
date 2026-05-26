import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { DripType } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string; attachmentId: string }> }
) {
  try {
    const { lessonId, attachmentId } = await params;

    // 1. Auth Check (Mandatory for all downloads)
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Fetch Attachment & Lesson Context
    const attachment = await prisma.lessonAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true
              }
            }
          }
        }
      }
    });

    if (!attachment || !attachment.lesson) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Verify lessonId matches
    if (attachment.lessonId !== lessonId) {
      return NextResponse.json({ error: 'Invalid lesson context' }, { status: 400 });
    }

    const lesson = attachment.lesson;
    const course = lesson.module.course;

    // 3. Authorization Logic
    const isAdmin = user.role === 'ADMIN';
    const isInstructor = course.instructorId === user.id;

    // Admin & Instructor bypass checks
    if (!isAdmin && !isInstructor) {
      
      // Check Enrollment
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: course.id
          }
        }
      });

      const now = new Date();
      const activeSubscription =
        !enrollment && course.subscriptionEligible
          ? await prisma.subscription.findFirst({
              where: { userId: String(user.id), startDate: { lte: now }, endDate: { gte: now }, status: 'ACTIVE' },
              select: { startDate: true },
            })
          : null;

      if (!enrollment && !activeSubscription) {
        if (!lesson.isPreview) {
          return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
        }
      }

      if (enrollment) {
        const validityDays = course.validityDays;
        if (validityDays && validityDays > 0) {
          const expiresAt = new Date(enrollment.createdAt);
          expiresAt.setDate(expiresAt.getDate() + validityDays);
          if (new Date() > expiresAt) {
            return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
          }
        }
      }

      const accessStartDate = enrollment?.createdAt || activeSubscription?.startDate || null;

      if (accessStartDate && course.dripEnabled) {
        const modules = await prisma.module.findMany({
          where: { courseId: course.id },
          orderBy: { order: 'asc' },
          select: {
            lessons: {
              orderBy: { order: 'asc' },
              select: { id: true, isPreview: true },
            },
          },
        });

        const globalLessons = modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, isPreview: l.isPreview })));
        const lessonIndexById = new Map(globalLessons.map((l, idx) => [l.id, idx]));
        const idx = lessonIndexById.get(lesson.id) ?? 0;

        if (course.dripType === DripType.AFTER_ENROLLMENT && course.dripDays) {
          const unlockDate = new Date(accessStartDate);
          unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
          if (now < unlockDate) {
            return NextResponse.json({ error: 'Lesson content is locked' }, { status: 403 });
          }
        }

        if (course.dripType === DripType.SCHEDULE && course.dripDays) {
          const base = course.publishedAt || course.createdAt;
          const unlockDate = new Date(base);
          unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
          if (now < unlockDate) {
            return NextResponse.json({ error: 'Lesson content is locked' }, { status: 403 });
          }
        }

        if (course.dripType === DripType.SEQUENTIAL) {
          const completed = await prisma.userProgress.findMany({
            where: { userId: user.id, lessonId: { in: globalLessons.map((l) => l.id) }, completed: true },
            select: { lessonId: true },
          });
          const completedSet = new Set(completed.map((p) => p.lessonId));
          for (let i = 0; i < idx; i++) {
            const prev = globalLessons[i];
            if (prev.isPreview) continue;
            if (!completedSet.has(prev.id)) {
              return NextResponse.json({ error: 'Lesson content is locked' }, { status: 403 });
            }
          }
        }
      }
    }

    // 4. Serve File
    // Prefer storagePath, fallback to legacy check if needed (or fail)
    let filePath = attachment.storagePath;

    if (!filePath) {
      // Fallback for legacy files: if url starts with /uploads/, map to public
      // BUT user wants "no public access". Legacy files might still be in public.
      // We can serve them through this API too to enforce Auth, even if they exist in public.
      if (attachment.url.startsWith('/uploads/')) {
        filePath = path.join('public', attachment.url);
      } else {
        return NextResponse.json({ error: 'File path not found' }, { status: 404 });
      }
    }

    // Resolve absolute path
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(process.cwd(), filePath);

    try {
      const stats = await stat(absolutePath);
      const fileBuffer = await readFile(absolutePath);

      // Return File Response
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': attachment.type || 'application/octet-stream',
          'Content-Length': stats.size.toString(),
          'Content-Disposition': `inline; filename="${attachment.name}"`,
          // Cache Control: private, max-age=3600
          'Cache-Control': 'private, max-age=3600' 
        }
      });
    } catch (err) {
      console.error('File read error:', err);
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

  } catch (error) {
    console.error('Download API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
