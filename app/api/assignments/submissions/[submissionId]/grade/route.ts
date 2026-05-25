import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { issueCertificateIfEligible } from '@/modules/certificates/api/service';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as any;
  } catch {
    return null;
  }
}

function parseStoredFiles(fileUrl: string): { files: Array<{ path: string }> } | null {
  if (!fileUrl) return null;
  const trimmed = String(fileUrl).trim();
  if (!trimmed.startsWith('{')) return null;
  const parsed = safeParseJson(trimmed);
  if (!parsed || typeof parsed !== 'object') return null;
  const files = Array.isArray((parsed as any).files) ? (parsed as any).files : null;
  if (!files) return null;
  const normalized = files.map((f: any) => ({ path: typeof f?.path === 'string' ? f.path : '' })).filter((f: any) => f.path);
  if (normalized.length === 0) return null;
  return { files: normalized };
}

type GradePayload = {
  grade?: unknown;
  feedback?: unknown;
  status?: unknown;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { submissionId } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN' && user.role !== 'MENTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            lesson: {
              include: { module: { include: { course: true } } },
            },
          },
        },
      },
    });

    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const course = submission.assignment.lesson.module.course;
    const isAdmin = user.role === 'ADMIN';
    const isInstructor = user.id === course.instructorId;
    if (!isAdmin && !isInstructor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as GradePayload;
    const status = body.status === 'GRADED' || body.status === 'REJECTED' ? body.status : 'GRADED';
    const feedback = typeof body.feedback === 'string' && body.feedback.trim() ? body.feedback.trim() : null;

    let grade: number | null = null;
    if (status === 'GRADED') {
      const raw = body.grade;
      const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        return NextResponse.json({ error: 'Nilai harus 0-100' }, { status: 400 });
      }
      grade = Math.round(parsed);
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        grade,
        feedback,
        gradedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (status === 'GRADED' && typeof grade === 'number') {
      const passingGrade = submission.assignment.passingGrade ?? 0;
      if (grade >= passingGrade) {
        await prisma.userProgress.upsert({
          where: { userId_lessonId: { userId: submission.userId, lessonId: submission.assignment.lessonId } },
          update: { completed: true },
          create: { userId: submission.userId, lessonId: submission.assignment.lessonId, completed: true },
        });

        const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
        const settings = safeParse(settingsPage?.content);
        const certificatesEnabled = settings['certificatesEnabled'] !== false;
        const autoIssue = settings['autoIssueCertificateOnCompletion'] !== false;
        if (certificatesEnabled && autoIssue) {
          await issueCertificateIfEligible(submission.userId, course.id).catch(() => undefined);
        }
      }
    }

    const notifyTitle = status === 'REJECTED' ? 'Tugas Perlu Revisi' : 'Tugas Dinilai';
    const href = `/courses/${encodeURIComponent(course.slug)}/learn?lessonId=${encodeURIComponent(submission.assignment.lessonId)}`;
    const lines = [
      `${course.title} • ${submission.assignment.title}`.trim(),
      status === 'GRADED' && typeof grade === 'number' ? `Nilai: ${grade}` : null,
      status === 'REJECTED' ? 'Status: Perlu revisi' : null,
      feedback ? `Catatan Mentor: ${feedback.slice(0, 180)}` : null,
      `LINK:${href}`,
    ].filter(Boolean) as string[];
    await prisma.notification.create({
      data: {
        userId: submission.userId,
        title: notifyTitle,
        message: lines.join('\n'),
        read: false,
      },
    });

    return NextResponse.json(
      {
        submission: {
          id: updated.id,
          notes: updated.notes,
          grade: updated.grade,
          feedback: updated.feedback,
          status: updated.status,
          submittedAt: updated.submittedAt,
          gradedAt: updated.gradedAt,
          user: updated.user,
          downloadUrl: (() => {
            const manifest = typeof (updated as any).fileUrl === 'string' ? parseStoredFiles(String((updated as any).fileUrl)) : null;
            return manifest ? `/api/assignments/submissions/${updated.id}/download?i=0` : `/api/assignments/submissions/${updated.id}/download`;
          })(),
          downloadUrls: (() => {
            const manifest = typeof (updated as any).fileUrl === 'string' ? parseStoredFiles(String((updated as any).fileUrl)) : null;
            return manifest ? manifest.files.map((_, idx) => `/api/assignments/submissions/${updated.id}/download?i=${idx}`) : [`/api/assignments/submissions/${updated.id}/download`];
          })(),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to grade submission' }, { status: 500 });
  }
}
