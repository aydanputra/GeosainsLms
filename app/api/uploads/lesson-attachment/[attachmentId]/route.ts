
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { BlobNotFoundError } from '@vercel/blob';
import { deleteLessonAttachmentFile } from '@/utils/lessonAttachmentStorage';
import { unlink } from 'fs/promises';
import path from 'path';
import { writeAccessDeniedAuditLog, writeAuditLog } from '@/utils/audit';

function resolveLegacyPublicAttachmentPath(relativeUrl?: string | null) {
  const raw = typeof relativeUrl === 'string' ? relativeUrl.trim() : '';
  if (!raw.startsWith('/uploads/')) return null;

  const baseDir = path.resolve(process.cwd(), 'public', 'uploads');
  const absolutePath = path.resolve(process.cwd(), 'public', raw.replace(/^\//, ''));
  const relativeFromBase = path.relative(baseDir, absolutePath);
  if (
    relativeFromBase.startsWith('..') ||
    path.isAbsolute(relativeFromBase) ||
    !absolutePath.startsWith(baseDir)
  ) {
    return null;
  }

  return absolutePath;
}

export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;

    if (!isSameOrigin(req)) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'LESSON_ATTACHMENT_DELETE_DENIED',
        status: 403,
        entityType: 'LessonAttachment',
        entityId: attachmentId,
        reason: 'cross_origin',
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // 1. Auth Check
    const token = req.cookies.get('token')?.value;
    if (!token) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'LESSON_ATTACHMENT_DELETE_DENIED',
        status: 401,
        entityType: 'LessonAttachment',
        entityId: attachmentId,
        reason: 'missing_token',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await verifyToken(token);
    if (!user) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'LESSON_ATTACHMENT_DELETE_DENIED',
        status: 401,
        entityType: 'LessonAttachment',
        entityId: attachmentId,
        reason: 'invalid_token',
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Fetch Attachment & Check Ownership
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

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Since attachment is linked to a lesson, we check lesson ownership.
    // If orphaned (lesson deleted), maybe only ADMIN can delete? 
    // But schema has Cascade delete, so attachments should be gone if lesson is gone.
    // Assuming attachment always has a lesson here due to relation.
    
    if (attachment.lesson) {
        const isOwner = attachment.lesson.module.course.instructorId === user.id;
        const isAdmin = user.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            await writeAccessDeniedAuditLog({
                req,
                actor: { id: String(user.id), role: user.role },
                action: 'LESSON_ATTACHMENT_DELETE_DENIED',
                status: 403,
                entityType: 'LessonAttachment',
                entityId: attachmentId,
                reason: 'forbidden',
            });
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    } else {
        // Fallback for orphaned attachments (shouldn't happen with Cascade)
        if (user.role !== 'ADMIN') {
            await writeAccessDeniedAuditLog({
                req,
                actor: { id: String(user.id), role: user.role },
                action: 'LESSON_ATTACHMENT_DELETE_DENIED',
                status: 403,
                entityType: 'LessonAttachment',
                entityId: attachmentId,
                reason: 'forbidden_orphan',
            });
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    // 3. Delete File from Storage
    const storagePath = attachment.storagePath;
    
    if (storagePath) {
        try {
            await deleteLessonAttachmentFile(storagePath);
        } catch (err: any) {
            // Ignore if file not found
            if (err?.code !== 'ENOENT' && !(err instanceof BlobNotFoundError)) {
                console.error('Failed to delete storage file:', err);
            }
        }
    } else {
        // Legacy public deletion fallback
        const relativePath = attachment.url; // e.g. /uploads/lessons/123/file.pdf
        const filePath = resolveLegacyPublicAttachmentPath(relativePath);
        if (filePath) {
            try {
                await unlink(filePath);
            } catch (err: any) {
                // Ignore if file not found
                if (err.code !== 'ENOENT') {
                    console.error('Failed to delete public file:', err);
                }
            }
        }
    }

    // 4. Delete DB Record
    await prisma.lessonAttachment.delete({
      where: { id: attachmentId }
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'LESSON_ATTACHMENT_DELETE',
      entityType: 'LessonAttachment',
      entityId: attachmentId,
      metadata: { lessonId: attachment.lessonId },
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Delete attachment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
