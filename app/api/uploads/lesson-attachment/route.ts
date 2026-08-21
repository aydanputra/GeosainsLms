import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { assertLessonAttachmentStorageConfigured, saveLessonAttachmentFile } from '@/utils/lessonAttachmentStorage';
import { writeAuditLog, writeRateLimitAuditLog } from '@/utils/audit';

export const runtime = 'nodejs';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(['pdf', 'docx', 'pptx', 'xlsx']);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const ip = getClientIp(req);
    const ipRl = enforceRateLimit({ key: `lesson-attachment:upload:ip:${ip}`, limit: 30, windowMs: 15 * 60 * 1000 });
    if (!ipRl.ok) {
      await writeRateLimitAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'LESSON_ATTACHMENT_UPLOAD_RATE_LIMITED',
        key: `lesson-attachment:upload:ip:${ip}`,
        retryAfterSeconds: ipRl.retryAfterSeconds,
        entityType: 'LessonAttachment',
        metadata: { scope: 'ip' },
      });
      return NextResponse.json(
        { error: 'Terlalu banyak upload dokumen. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(ipRl.retryAfterSeconds) } }
      );
    }
    const userRl = enforceRateLimit({
      key: `lesson-attachment:upload:user:${String(user.id)}`,
      limit: 50,
      windowMs: 15 * 60 * 1000,
    });
    if (!userRl.ok) {
      await writeRateLimitAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'LESSON_ATTACHMENT_UPLOAD_RATE_LIMITED',
        key: `lesson-attachment:upload:user:${String(user.id)}`,
        retryAfterSeconds: userRl.retryAfterSeconds,
        entityType: 'LessonAttachment',
        metadata: { scope: 'user' },
      });
      return NextResponse.json(
        { error: 'Terlalu banyak upload dokumen untuk akun ini. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(userRl.retryAfterSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const lessonIdValue = formData.get('lessonId');
    const lessonId = typeof lessonIdValue === 'string' ? lessonIdValue.trim() : '';

    if (!(file instanceof File) || !lessonId) {
      return NextResponse.json({ error: 'Missing file or lessonId' }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const isOwner = String(lesson.module.course.instructorId) === String(user.id);
    const isAdmin = user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file melebihi batas 10MB' }, { status: 400 });
    }

    const originalName = String(file.name || '').trim();
    const lowerName = originalName.toLowerCase();
    const ext = lowerName.includes('.') ? lowerName.split('.').pop() || '' : '';
    if (!ext || !ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: 'Tipe file tidak didukung. Gunakan PDF/DOCX/PPTX/XLSX' }, { status: 400 });
    }

    const effectiveMime = file.type && ALLOWED_MIME.has(file.type) ? file.type : MIME_BY_EXT[ext];
    const buffer = Buffer.from(await file.arrayBuffer());

    const hasPdfSignature = buffer.length >= 4 && buffer.toString('utf8', 0, 4) === '%PDF';
    const hasZipSignature = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;

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

    const attachment = await prisma.lessonAttachment.create({
      data: {
        name: originalName,
        url: '',
        type: effectiveMime || 'application/octet-stream',
        size: file.size,
        lessonId,
        userId: String(user.id),
        storagePath: savedFile.storagePath,
      },
    });

    const downloadUrl = `/api/lessons/${lessonId}/attachments/${attachment.id}/download`;
    const updatedAttachment = await prisma.lessonAttachment.update({
      where: { id: attachment.id },
      data: { url: downloadUrl },
    });

    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'LESSON_ATTACHMENT_UPLOAD',
      entityType: 'LessonAttachment',
      entityId: attachment.id,
      metadata: {
        lessonId,
        mimeType: effectiveMime || 'application/octet-stream',
        size: file.size,
      },
    });

    return NextResponse.json(updatedAttachment);
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (
      message.includes('Penyimpanan lampiran belum dikonfigurasi') ||
      message.includes('token Blob di Vercel') ||
      message.includes('BLOB_READ_WRITE_TOKEN') ||
      message.includes('CLOUDINARY_')
    ) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
