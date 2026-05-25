
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;
    
    // 1. Auth Check
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

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
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    } else {
        // Fallback for orphaned attachments (shouldn't happen with Cascade)
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    // 3. Delete File from Storage
    const storagePath = attachment.storagePath;
    
    if (storagePath) {
        // Private storage deletion
        const absolutePath = path.isAbsolute(storagePath) 
            ? storagePath 
            : path.join(process.cwd(), storagePath);
            
        try {
            await unlink(absolutePath);
        } catch (err: any) {
            // Ignore if file not found
            if (err.code !== 'ENOENT') {
                console.error('Failed to delete storage file:', err);
            }
        }
    } else {
        // Legacy public deletion fallback
        const relativePath = attachment.url; // e.g. /uploads/lessons/123/file.pdf
        if (relativePath && relativePath.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), 'public', relativePath.replace(/^\//, ''));
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

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Delete attachment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
