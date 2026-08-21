import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { getAssignmentAccessContext, getCourseLessonSequence } from '@/modules/course/api/performance';

export const runtime = 'nodejs';

const MAX_GLOBAL_MB = 50;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
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

function resolveAssignmentStoragePath(relativePath: string) {
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

async function deleteStoredFiles(fileUrl: string) {
  const manifest = parseStoredFiles(fileUrl);
  if (manifest) {
    await Promise.all(
      manifest.files.map((f) => {
        const absolutePath = resolveAssignmentStoragePath(f.path);
        if (!absolutePath) return Promise.resolve(undefined);
        return unlink(absolutePath).catch(() => undefined);
      })
    );
    return;
  }
  if (fileUrl && fileUrl !== 'PENDING') {
    const absolutePath = resolveAssignmentStoragePath(fileUrl);
    if (!absolutePath) return;
    await unlink(absolutePath).catch(() => undefined);
  }
}

function getAssignmentSettings(lessonContent: any) {
  const content = lessonContent && typeof lessonContent === 'object' && !Array.isArray(lessonContent) ? lessonContent : null;
  const settings = content && typeof (content as any).assignmentSettings === 'object' && (content as any).assignmentSettings ? (content as any).assignmentSettings : {};
  const allowResubmission = settings.allowResubmission !== false;
  const maxResubmissionAttempts =
    typeof settings.maxResubmissionAttempts === 'number' && Number.isFinite(settings.maxResubmissionAttempts)
      ? Math.max(1, Math.floor(Number(settings.maxResubmissionAttempts)))
      : 5;
  const fileUploadLimit =
    typeof settings.fileUploadLimit === 'number' && Number.isFinite(settings.fileUploadLimit)
      ? Math.max(1, Math.floor(Number(settings.fileUploadLimit)))
      : 1;
  return { allowResubmission, maxResubmissionAttempts, fileUploadLimit };
}

async function checkStudentAccess(args: {
  userId: string;
  course: any;
  lessonId: string;
  isPreview: boolean;
  enrollmentCreatedAt: Date;
  ignoreValidityDays?: boolean;
}) {
  const { course, lessonId, isPreview, enrollmentCreatedAt, userId, ignoreValidityDays } = args;

  const validityDays = course.validityDays;
  if (!ignoreValidityDays && validityDays && validityDays > 0) {
    const expiresAt = new Date(enrollmentCreatedAt);
    expiresAt.setDate(expiresAt.getDate() + validityDays);
    if (new Date() > expiresAt) {
      return { status: 403, body: { error: 'Enrollment expired' } };
    }
  }

  if (course.dripEnabled) {
    const sequence = await getCourseLessonSequence(course.id);
    const globalLessons = sequence.globalLessons;
    const idx = globalLessons.findIndex((l: { id: string }) => l.id === lessonId);
    const now = new Date();

    if (idx >= 0 && !isPreview) {
      if (course.dripType === 'AFTER_ENROLLMENT' && course.dripDays) {
        const unlockDate = new Date(enrollmentCreatedAt);
        unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
        if (now < unlockDate) {
          return {
            status: 403,
            body: { error: 'Lesson is locked', lockReason: 'DRIP_LOCKED', unlockDate: unlockDate.toISOString() },
          };
        }
      }

      if (course.dripType === 'SCHEDULE' && course.dripDays) {
        const base = course.publishedAt || course.createdAt;
        const unlockDate = new Date(base);
        unlockDate.setDate(unlockDate.getDate() + idx * course.dripDays);
        if (now < unlockDate) {
          return {
            status: 403,
            body: { error: 'Lesson is locked', lockReason: 'SCHEDULE_LOCKED', unlockDate: unlockDate.toISOString() },
          };
        }
      }

      if (course.dripType === 'SEQUENTIAL') {
        const completed = await prisma.userProgress.findMany({
          where: { userId, lessonId: { in: globalLessons.map((l: { id: string }) => l.id) }, completed: true },
          select: { lessonId: true },
        });
        const completedSet = new Set(completed.map((p: { lessonId: string }) => p.lessonId));

        for (let i = 0; i < idx; i++) {
          const prev = globalLessons[i];
          if (prev.isPreview) continue;
          if (!completedSet.has(prev.id)) {
            return { status: 403, body: { error: 'Lesson is locked', lockReason: 'SEQUENTIAL_LOCKED' } };
          }
        }
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const assignment = await getAssignmentAccessContext(assignmentId);

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = user.id === assignment.lesson.module.course.instructorId;

    if (user.role === 'MENTOR' && !isInstructor && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAdmin && !isInstructor && user.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: assignment.lesson.module.courseId } },
        select: { id: true, createdAt: true },
      });
      const now = new Date();
      const activeSubscription =
        !enrollment && assignment.lesson.module.course.subscriptionEligible
          ? await prisma.subscription.findFirst({
              where: { userId: String(user.id), startDate: { lte: now }, endDate: { gte: now }, status: 'ACTIVE' },
              select: { startDate: true },
            })
          : null;
      if (!enrollment && !activeSubscription) return NextResponse.json({ error: 'User not enrolled in this course' }, { status: 403 });

      const accessError = await checkStudentAccess({
        userId: user.id,
        course: assignment.lesson.module.course,
        lessonId: assignment.lessonId,
        isPreview: Boolean(assignment.lesson.isPreview),
        enrollmentCreatedAt: enrollment ? enrollment.createdAt : (activeSubscription as any).startDate,
        ignoreValidityDays: !enrollment,
      });
      if (accessError) return NextResponse.json(accessError.body, { status: accessError.status });

      const settings = getAssignmentSettings(assignment.lesson?.content as any);
      const [attemptsUsed, submission] = await Promise.all([
        prisma.assignmentSubmission.count({ where: { assignmentId, userId: String(user.id) } }),
        prisma.assignmentSubmission.findFirst({
          where: { assignmentId, userId: user.id },
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            notes: true,
            grade: true,
            feedback: true,
            status: true,
            submittedAt: true,
            gradedAt: true,
            fileUrl: true,
          },
        }),
      ]);
      const attemptsLeft = settings.allowResubmission ? Math.max(0, settings.maxResubmissionAttempts - attemptsUsed) : 0;

      const downloadUrls =
        submission && typeof submission.fileUrl === 'string'
          ? (() => {
              const manifest = parseStoredFiles(submission.fileUrl);
              if (manifest) return manifest.files.map((_, idx) => `/api/assignments/submissions/${submission.id}/download?i=${idx}`);
              return [`/api/assignments/submissions/${submission.id}/download`];
            })()
          : [];

      if (submission && submission.status === 'GRADED' && typeof submission.grade === 'number') {
        const passing = typeof assignment.passingGrade === 'number' ? assignment.passingGrade : 0;
        if (submission.grade >= passing) {
          await prisma.userProgress.upsert({
            where: { userId_lessonId: { userId: String(user.id), lessonId: assignment.lessonId } },
            update: { completed: true },
            create: { userId: String(user.id), lessonId: assignment.lessonId, completed: true },
          });
        }
      }

      return NextResponse.json(
        {
          submission: submission
            ? {
                id: submission.id,
                notes: submission.notes,
                grade: submission.grade,
                feedback: submission.feedback,
                status: submission.status,
                submittedAt: submission.submittedAt,
                gradedAt: submission.gradedAt,
                downloadUrl: downloadUrls[0] || `/api/assignments/submissions/${submission.id}/download`,
                downloadUrls,
              }
            : null,
          meta: {
            allowResubmission: settings.allowResubmission,
            maxResubmissionAttempts: settings.maxResubmissionAttempts,
            fileUploadLimit: settings.fileUploadLimit,
            attemptsUsed,
            attemptsLeft,
          },
        },
        { status: 200 }
      );
    }

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      {
        submissions: submissions.map((s: any) => ({
          id: s.id,
          notes: s.notes,
          grade: s.grade,
          feedback: s.feedback,
          status: s.status,
          submittedAt: s.submittedAt,
          gradedAt: s.gradedAt,
          user: s.user,
          downloadUrl: (() => {
            const manifest = typeof s.fileUrl === 'string' ? parseStoredFiles(s.fileUrl) : null;
            return manifest ? `/api/assignments/submissions/${s.id}/download?i=0` : `/api/assignments/submissions/${s.id}/download`;
          })(),
          downloadUrls: (() => {
            const manifest = typeof s.fileUrl === 'string' ? parseStoredFiles(s.fileUrl) : null;
            return manifest ? manifest.files.map((_, idx) => `/api/assignments/submissions/${s.id}/download?i=${idx}`) : [`/api/assignments/submissions/${s.id}/download`];
          })(),
        })),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch submissions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'STUDENT' && user.role !== 'ADMIN' && user.role !== 'MENTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const assignment = await getAssignmentAccessContext(assignmentId);

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isInstructor = user.id === assignment.lesson.module.course.instructorId;
    const canSubmitAsStudent = user.role === 'STUDENT';

    if (user.role === 'MENTOR' && !isAdmin && !isInstructor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (canSubmitAsStudent) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: assignment.lesson.module.courseId } },
        select: { id: true, createdAt: true },
      });
      const now = new Date();
      const activeSubscription =
        !enrollment && assignment.lesson.module.course.subscriptionEligible
          ? await prisma.subscription.findFirst({
              where: { userId: String(user.id), startDate: { lte: now }, endDate: { gte: now }, status: 'ACTIVE' },
              select: { startDate: true },
            })
          : null;
      if (!enrollment && !activeSubscription) return NextResponse.json({ error: 'User not enrolled in this course' }, { status: 403 });

      const accessError = await checkStudentAccess({
        userId: user.id,
        course: assignment.lesson.module.course,
        lessonId: assignment.lessonId,
        isPreview: Boolean(assignment.lesson.isPreview),
        enrollmentCreatedAt: enrollment ? enrollment.createdAt : (activeSubscription as any).startDate,
        ignoreValidityDays: !enrollment,
      });
      if (accessError) return NextResponse.json(accessError.body, { status: accessError.status });
    }

    const formData = await req.formData();
    const rawFiles = formData.getAll('files');
    const fallbackFile = formData.get('file');
    const notes = formData.get('notes');

    const files = rawFiles.filter((f) => f instanceof File) as File[];
    if (files.length === 0 && fallbackFile instanceof File) files.push(fallbackFile);
    if (files.length === 0) return NextResponse.json({ error: 'File wajib diisi' }, { status: 400 });

    const settings = getAssignmentSettings(assignment.lesson?.content as any);
    if (files.length > settings.fileUploadLimit) {
      return NextResponse.json({ error: `Maksimal ${settings.fileUploadLimit} file per submission` }, { status: 400 });
    }

    const maxMb = Math.min(MAX_GLOBAL_MB, assignment.maxFileSize || 5);
    const maxBytes = maxMb * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxBytes) {
        return NextResponse.json({ error: `Ukuran file maksimal ${maxMb}MB per file` }, { status: 400 });
      }
      if (!ALLOWED_MIME.has(f.type)) {
        return NextResponse.json({ error: 'Tipe file tidak didukung' }, { status: 400 });
      }
    }

    const attemptsUsed = await prisma.assignmentSubmission.count({ where: { assignmentId, userId: String(user.id) } });
    if (settings.allowResubmission) {
      if (attemptsUsed >= settings.maxResubmissionAttempts) {
        return NextResponse.json({ error: 'Batas kirim ulang sudah tercapai' }, { status: 403 });
      }
    }

    const existing = settings.allowResubmission
      ? null
      : await prisma.assignmentSubmission.findFirst({
          where: { assignmentId, userId: user.id },
          orderBy: { submittedAt: 'desc' },
        });

    if (!settings.allowResubmission && existing && existing.status === 'GRADED') {
      return NextResponse.json({ error: 'Submission sudah dinilai dan tidak bisa diubah' }, { status: 403 });
    }

    const submission = settings.allowResubmission
      ? await prisma.assignmentSubmission.create({
          data: {
            assignmentId,
            userId: String(user.id),
            fileUrl: 'PENDING',
            notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
          },
        })
      : existing
        ? await prisma.assignmentSubmission.update({
            where: { id: existing.id },
            data: {
              notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
              grade: null,
              feedback: null,
              status: 'PENDING',
              submittedAt: new Date(),
              gradedAt: null,
            },
          })
        : await prisma.assignmentSubmission.create({
            data: {
              assignmentId,
              userId: String(user.id),
              fileUrl: 'PENDING',
              notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
            },
          });

    const safeAssignmentId = sanitizeSegment(assignmentId);
    const timestamp = Date.now();
    const storageDir = path.join(process.cwd(), 'storage', 'assignments', safeAssignmentId);
    await mkdir(storageDir, { recursive: true });

    if (!settings.allowResubmission && existing && typeof existing.fileUrl === 'string' && existing.fileUrl && existing.fileUrl !== 'PENDING') {
      await deleteStoredFiles(existing.fileUrl);
    }

    const stored: Array<{ path: string; name: string; originalName: string }> = [];
    for (const f of files) {
      const safeFileName = sanitizeFilename(f.name);
      const relativeStoragePath = path.posix.join(
        'storage',
        'assignments',
        safeAssignmentId,
        `${submission.id}-${timestamp}-${safeFileName}`
      );
      const absoluteStoragePath = path.join(process.cwd(), relativeStoragePath);
      const buffer = Buffer.from(await f.arrayBuffer());
      await writeFile(absoluteStoragePath, buffer);
      stored.push({ path: relativeStoragePath, name: safeFileName, originalName: f.name });
    }

    const storedValue = stored.length === 1 ? stored[0].path : JSON.stringify({ files: stored });

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        fileUrl: storedValue,
      },
      select: {
        id: true,
        notes: true,
        grade: true,
        feedback: true,
        status: true,
        submittedAt: true,
        gradedAt: true,
      },
    });

    if (user.role === 'STUDENT') {
      const course = assignment.lesson.module.course;
      const instructorId = course.instructorId;
      if (instructorId) {
        const student = await prisma.user.findUnique({
          where: { id: String(user.id) },
          select: { id: true, name: true, email: true },
        });
        const studentName = student?.name || student?.email || 'Siswa';
        const studentEmail = student?.email || '';
        const isResubmission = settings.allowResubmission ? attemptsUsed > 0 : Boolean(existing);
        const title = isResubmission ? 'Pengumpulan Ulang Tugas' : 'Pengumpulan Tugas Baru';
        const lines = [
          `${course.title} • ${assignment.title}`.trim(),
          `Siswa: ${studentName}${studentEmail ? ` (${studentEmail})` : ''}`,
          typeof updated.notes === 'string' && updated.notes.trim() ? `Catatan: ${updated.notes.trim().slice(0, 140)}` : null,
          `LINK:/dashboard/mentor/assignments`,
        ].filter(Boolean) as string[];
        await prisma.notification.create({
          data: {
            userId: instructorId,
            title,
            message: lines.join('\n'),
            read: false,
          },
        });
      }
    }

    return NextResponse.json(
      {
        submission: {
          ...updated,
          downloadUrl: `/api/assignments/submissions/${updated.id}/download`,
          downloadUrls: stored.length > 1 ? stored.map((_, idx) => `/api/assignments/submissions/${updated.id}/download?i=${idx}`) : [`/api/assignments/submissions/${updated.id}/download`],
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to submit assignment' }, { status: 500 });
  }
}
