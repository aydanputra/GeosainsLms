
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs'; // Required for file system access

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const lessonId = formData.get('lessonId') as string;

    if (!file || !lessonId) {
      return NextResponse.json({ error: 'Missing file or lessonId' }, { status: 400 });
    }

    // 3. Ownership Check
    // Lesson -> Module -> Course
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true
          }
        }
      }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Check if user is Admin or Instructor of the course
    const isOwner = lesson.module.course.instructorId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Validate File
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file melebihi batas 10MB' }, { status: 400 });
    }

    const originalName = file.name || '';
    const lowerName = originalName.toLowerCase();
    const ext = lowerName.includes('.') ? lowerName.split('.').pop() : '';

    const allowedExt = new Set(['pdf', 'docx', 'pptx', 'xlsx']);
    if (!ext || !allowedExt.has(ext)) {
      return NextResponse.json({ error: 'Tipe file tidak didukung. Gunakan PDF/DOCX/PPTX/XLSX' }, { status: 400 });
    }

    const mimeByExt: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const allowedMime = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);

    const effectiveMime = file.type && allowedMime.has(file.type) ? file.type : mimeByExt[ext];

    // 5. Save File Locally (Private Storage)
    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic Bytes Verification
    const hasPdfSignature = buffer.length >= 4 && buffer.toString('utf8', 0, 4) === '%PDF';
    const hasZipSignature = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"

    if (ext === 'pdf' && !hasPdfSignature) {
      return NextResponse.json({ error: 'File PDF tidak valid' }, { status: 400 });
    }
    if (ext !== 'pdf' && !hasZipSignature) {
      return NextResponse.json({ error: 'File dokumen tidak valid' }, { status: 400 });
    }
    
    // Ensure directory exists: storage/lessons/<lessonId>/
    // Sanitize lessonId just in case (alphanumeric only)
    const safeLessonId = lessonId.replace(/[^a-zA-Z0-9-]/g, '');
    const uploadDir = path.join(process.cwd(), 'storage', 'lessons', safeLessonId);
    await mkdir(uploadDir, { recursive: true });

    // Generate safe filename
    // Format: timestamp-uuid-originalName (sanitized)
    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${uuidv4().slice(0, 8)}-${safeName}`;
    const filePath = path.join(uploadDir, filename);

    await writeFile(filePath, buffer);

    // 6. Save to Database
    // We create the record first to get the ID, then update the URL
    // storagePath is relative to project root for portability (or absolute, but relative is better)
    const relativeStoragePath = `storage/lessons/${safeLessonId}/${filename}`;

    const attachment = await prisma.lessonAttachment.create({
      data: {
        name: originalName, // Display name
        url: '', // Placeholder, will update below
        type: effectiveMime || 'application/octet-stream',
        size: file.size,
        lessonId: lessonId,
        userId: String(user.id),
        storagePath: relativeStoragePath,
      },
    });

    // Update URL to point to the protected download API
    const downloadUrl = `/api/lessons/${lessonId}/attachments/${attachment.id}/download`;
    
    const updatedAttachment = await prisma.lessonAttachment.update({
      where: { id: attachment.id },
      data: { url: downloadUrl }
    });

    return NextResponse.json(updatedAttachment);

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
