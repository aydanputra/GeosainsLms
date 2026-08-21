import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

export const runtime = 'nodejs';

function guessContentType(filename: string) {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'zip') return 'application/zip';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as any;
  } catch {
    return null;
  }
}

function parseStoredFiles(fileUrl: string): { files: Array<{ path: string; name?: string; originalName?: string }> } | null {
  if (!fileUrl) return null;
  const trimmed = String(fileUrl).trim();
  if (!trimmed.startsWith('{')) return null;
  const parsed = safeParseJson(trimmed);
  if (!parsed || typeof parsed !== 'object') return null;
  const files = Array.isArray((parsed as any).files) ? (parsed as any).files : null;
  if (!files) return null;
  const normalized = files
    .map((f: any) => ({
      path: typeof f?.path === 'string' ? f.path : '',
      name: typeof f?.name === 'string' ? f.name : undefined,
      originalName: typeof f?.originalName === 'string' ? f.originalName : undefined,
    }))
    .filter((f: any) => typeof f.path === 'string' && f.path.length > 0);
  if (normalized.length === 0) return null;
  return { files: normalized };
}

function resolveSubmissionStoragePath(relativePath: string) {
  const normalizedRelative = path.normalize(String(relativePath || '').trim());
  if (!normalizedRelative) return null;

  const baseDir = path.resolve(process.cwd(), 'storage', 'assignments');
  const absolutePath = path.resolve(process.cwd(), normalizedRelative);
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { submissionId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'ASSIGNMENT_SUBMISSION_DOWNLOAD_DENIED',
        status: 401,
        entityType: 'AssignmentSubmission',
        entityId: submissionId,
        reason: 'missing_token',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      await writeAccessDeniedAuditLog({
        req,
        action: 'ASSIGNMENT_SUBMISSION_DOWNLOAD_DENIED',
        status: 401,
        entityType: 'AssignmentSubmission',
        entityId: submissionId,
        reason: 'invalid_token',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            lesson: {
              include: {
                module: {
                  include: { course: true },
                },
              },
            },
          },
        },
      },
    });

    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const course = submission.assignment.lesson.module.course;
    const isAdmin = user.role === 'ADMIN';
    const isInstructor = user.id === course.instructorId;
    const isOwner = submission.userId === user.id;

    if (!isAdmin && !isInstructor && !isOwner) {
      await writeAccessDeniedAuditLog({
        req,
        actor: { id: String(user.id), role: user.role },
        action: 'ASSIGNMENT_SUBMISSION_DOWNLOAD_DENIED',
        status: 403,
        entityType: 'AssignmentSubmission',
        entityId: submissionId,
        reason: 'forbidden',
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!submission.fileUrl || submission.fileUrl === 'PENDING') {
      return NextResponse.json({ error: 'File not ready' }, { status: 400 });
    }

    const manifest = typeof submission.fileUrl === 'string' ? parseStoredFiles(submission.fileUrl) : null;
    const rawIndex = req.nextUrl.searchParams.get('i');
    const parsedIndex = rawIndex ? Number(rawIndex) : 0;
    const index = Number.isFinite(parsedIndex) ? Math.max(0, Math.floor(parsedIndex)) : 0;
    const relativePath = manifest ? manifest.files[index]?.path : submission.fileUrl;
    if (!relativePath) return NextResponse.json({ error: 'Invalid file index' }, { status: 400 });

    const absolutePath = resolveSubmissionStoragePath(relativePath);
    if (!absolutePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const filename = manifest ? manifest.files[index]?.originalName || manifest.files[index]?.name || path.basename(absolutePath) : path.basename(absolutePath);
    const [fileStats, buffer] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': guessContentType(filename),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileStats.size),
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to download' }, { status: 500 });
  }
}
