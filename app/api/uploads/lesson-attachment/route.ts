
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { readFileSync } from 'fs';
import {
  assertLessonAttachmentStorageConfigured,
  isBlobStorageEnabled,
  saveLessonAttachmentFile,
} from '@/utils/lessonAttachmentStorage';
import path from 'path';

export const runtime = 'nodejs'; // Required for file system access

export async function POST(req: NextRequest) {
  try {
    // #region debug-point A:entry
    const debugReport = (hypothesisId: string, msg: string, data?: Record<string, unknown>) => { let debugServerUrl = 'http://127.0.0.1:7779/event'; let debugSessionId = 'document-upload-500'; try { const debugEnv = readFileSync(path.join(process.cwd(), '.dbg', 'document-upload-500.env'), 'utf8'); debugServerUrl = debugEnv.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl; debugSessionId = debugEnv.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId; } catch {} return fetch(debugServerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: debugSessionId, runId: 'pre-fix', hypothesisId, location: 'app/api/uploads/lesson-attachment/route.ts', msg: `[DEBUG] ${msg}`, data: data || {}, ts: Date.now() }) }).catch(() => {}); };
    await debugReport('A', 'upload request started', { contentType: req.headers.get('content-type') || null });
    // #endregion

    // 1. Auth Check
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const lessonId = formData.get('lessonId') as string;
    // #region debug-point B:formdata
    await debugReport('B', 'form data parsed', {
      lessonId: typeof lessonId === 'string' ? lessonId : null,
      hasFile: !!file,
      fileName: file?.name || null,
      fileType: file?.type || null,
      fileSize: typeof file?.size === 'number' ? file.size : null,
    });
    // #endregion

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

    // #region debug-point B:lesson
    await debugReport('B', 'lesson lookup completed', {
      lessonId,
      foundLesson: !!lesson,
      courseInstructorId: lesson.module.course.instructorId,
      requesterId: String(user.id),
      requesterRole: user.role,
    });
    // #endregion

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
    // #region debug-point A:validation
    await debugReport('A', 'file validation passed', { originalName, ext, detectedMime: file.type || null, effectiveMime });
    // #endregion

    // 5. Save File
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
    
    assertLessonAttachmentStorageConfigured();
    const savedFile = await saveLessonAttachmentFile({
      lessonId,
      originalName,
      buffer,
      mimeType: effectiveMime || 'application/octet-stream',
    });
    // #region debug-point C:path
    await debugReport('C', 'writing file to storage', {
      storageMode: isBlobStorageEnabled() ? 'blob' : 'local',
      safeLessonId: savedFile.safeLessonId,
      filename: savedFile.filename,
      storagePath: savedFile.storagePath,
      target: savedFile.debugTarget,
      bufferSize: buffer.length,
    });
    // #endregion

    // 6. Save to Database
    // We create the record first to get the ID, then update the URL

    const attachment = await prisma.lessonAttachment.create({
      data: {
        name: originalName, // Display name
        url: '', // Placeholder, will update below
        type: effectiveMime || 'application/octet-stream',
        size: file.size,
        lessonId: lessonId,
        userId: String(user.id),
        storagePath: savedFile.storagePath,
      },
    });
    // #region debug-point E:db
    await debugReport('E', 'attachment row created', { attachmentId: attachment.id, lessonId, storagePath: savedFile.storagePath, url: attachment.url });
    // #endregion

    // Update URL to point to the protected download API
    const downloadUrl = `/api/lessons/${lessonId}/attachments/${attachment.id}/download`;
    
    const updatedAttachment = await prisma.lessonAttachment.update({
      where: { id: attachment.id },
      data: { url: downloadUrl }
    });

    return NextResponse.json(updatedAttachment);

  } catch (error) {
    // #region debug-point D:catch
    let debugServerUrl = 'http://127.0.0.1:7779/event'; let debugSessionId = 'document-upload-500'; try { const debugEnv = readFileSync(path.join(process.cwd(), '.dbg', 'document-upload-500.env'), 'utf8'); debugServerUrl = debugEnv.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl; debugSessionId = debugEnv.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId; } catch {} await fetch(debugServerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: debugSessionId, runId: 'pre-fix', hypothesisId: 'D', location: 'app/api/uploads/lesson-attachment/route.ts', msg: '[DEBUG] upload route threw error', data: { name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null }, ts: Date.now() }) }).catch(() => {});
    // #endregion
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (message.includes('token Blob di Vercel') || message.includes('BLOB_READ_WRITE_TOKEN')) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
