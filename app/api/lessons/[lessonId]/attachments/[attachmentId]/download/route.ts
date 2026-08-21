import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { readLessonAttachmentFile } from '@/utils/lessonAttachmentStorage';
import path from 'path';
import { DripType } from '@prisma/client';
import { writeAccessDeniedAuditLog } from '@/utils/audit';
import { getCourseLessonSequence, getLessonAttachmentAccessContext } from '@/modules/course/api/performance';

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
      await writeAccessDeniedAuditLog({
        req,
        action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
        status: 401,
        entityType: 'LessonAttachment',
        entityId: attachmentId,
        reason: 'missing_token',
        metadata: { lessonId },
      });
      return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
        status: 401,
        entityType: 'LessonAttachment',
        entityId: attachmentId,
        reason: 'invalid_token',
        metadata: { lessonId },
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Fetch Attachment & Lesson Context
    const attachment = await getLessonAttachmentAccessContext(attachmentId);

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
          await writeAccessDeniedAuditLog({
            req,
            actor: { id: String(user.id), role: user.role },
            action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
            status: 403,
            entityType: 'LessonAttachment',
            entityId: attachmentId,
            reason: 'enrollment_required',
            metadata: { lessonId, courseId: course.id },
          });
          return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
        }
      }

      if (enrollment) {
        const validityDays = course.validityDays;
        if (validityDays && validityDays > 0) {
          const expiresAt = new Date(enrollment.createdAt);
          expiresAt.setDate(expiresAt.getDate() + validityDays);
          if (new Date() > expiresAt) {
            await writeAccessDeniedAuditLog({
              req,
              actor: { id: String(user.id), role: user.role },
              action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
              status: 403,
              entityType: 'LessonAttachment',
              entityId: attachmentId,
              reason: 'enrollment_expired',
              metadata: { lessonId, courseId: course.id },
            });
            return NextResponse.json({ error: 'Enrollment expired' }, { status: 403 });
          }
        }
      }

      const accessStartDate = enrollment?.createdAt || activeSubscription?.startDate || null;

      if (accessStartDate && course.dripEnabled) {
        const sequence = await getCourseLessonSequence(course.id);
        const globalLessons = sequence.globalLessons;
        const lessonIndexById = new Map(globalLessons.map((l, idx) => [l.id, idx]));
        const idx = lessonIndexById.get(lesson.id) ?? 0;

        if (course.dripType === DripType.AFTER_ENROLLMENT && course.dripDays) {
          const unlockDate = new Date(accessStartDate);
          unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
          if (now < unlockDate) {
            await writeAccessDeniedAuditLog({
              req,
              actor: { id: String(user.id), role: user.role },
              action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
              status: 403,
              entityType: 'LessonAttachment',
              entityId: attachmentId,
              reason: 'drip_locked_after_enrollment',
              metadata: { lessonId, courseId: course.id },
            });
            return NextResponse.json({ error: 'Lesson content is locked' }, { status: 403 });
          }
        }

        if (course.dripType === DripType.SCHEDULE && course.dripDays) {
          const base = course.publishedAt || course.createdAt;
          const unlockDate = new Date(base);
          unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
          if (now < unlockDate) {
            await writeAccessDeniedAuditLog({
              req,
              actor: { id: String(user.id), role: user.role },
              action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
              status: 403,
              entityType: 'LessonAttachment',
              entityId: attachmentId,
              reason: 'drip_locked_schedule',
              metadata: { lessonId, courseId: course.id },
            });
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
              await writeAccessDeniedAuditLog({
                req,
                actor: { id: String(user.id), role: user.role },
                action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
                status: 403,
                entityType: 'LessonAttachment',
                entityId: attachmentId,
                reason: 'drip_locked_sequential',
                metadata: { lessonId, courseId: course.id },
              });
              return NextResponse.json({ error: 'Lesson content is locked' }, { status: 403 });
            }
          }
        }
      }
    }

    // 4. Serve File
    let storagePath = attachment.storagePath;

    if (!storagePath) {
      // Fallback for legacy files: if url starts with /uploads/, map to public
      // BUT user wants "no public access". Legacy files might still be in public.
      // We can serve them through this API too to enforce Auth, even if they exist in public.
      if (attachment.url.startsWith('/uploads/')) {
        storagePath = path.join('public', attachment.url);
      } else {
        return NextResponse.json({ error: 'File path not found' }, { status: 404 });
      }
    }

    try {
      const storedFile = await readLessonAttachmentFile(storagePath);
      if (!storedFile) {
        return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
      }

      // Return File Response
      return new NextResponse(storedFile.body, {
        headers: {
          'Content-Type': storedFile.contentType || attachment.type || 'application/octet-stream',
          'Content-Length': storedFile.size.toString(),
          'Content-Disposition': `inline; filename="${attachment.name}"`,
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
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
