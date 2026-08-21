import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as downloadSubmissionRoute } from '@/app/api/assignments/submissions/[submissionId]/download/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    assignmentSubmission: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAccessDeniedAuditLog: vi.fn(),
}));

describe('Assignment Submission Download Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject file paths outside assignment storage directory', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'student-1', role: 'STUDENT' });
    (prisma.assignmentSubmission.findUnique as any).mockResolvedValue({
      id: 'submission-1',
      userId: 'student-1',
      fileUrl: '../secrets.txt',
      assignment: {
        lesson: {
          module: {
            course: {
              instructorId: 'mentor-1',
            },
          },
        },
      },
    });

    const req = new NextRequest('http://localhost/api/assignments/submissions/submission-1/download', {
      headers: { cookie: 'token=abc' },
    });
    const res = await downloadSubmissionRoute(req, { params: Promise.resolve({ submissionId: 'submission-1' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid file path' });
  });

  it('should forbid unrelated users from downloading another submission', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'student-2', role: 'STUDENT' });
    (prisma.assignmentSubmission.findUnique as any).mockResolvedValue({
      id: 'submission-1',
      userId: 'student-1',
      fileUrl: 'storage/assignments/assignment-1/submission-1-proof.pdf',
      assignment: {
        lesson: {
          module: {
            course: {
              instructorId: 'mentor-1',
            },
          },
        },
      },
    });

    const req = new NextRequest('http://localhost/api/assignments/submissions/submission-1/download', {
      headers: { cookie: 'token=abc' },
    });
    const res = await downloadSubmissionRoute(req, { params: Promise.resolve({ submissionId: 'submission-1' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ASSIGNMENT_SUBMISSION_DOWNLOAD_DENIED',
        entityId: 'submission-1',
        status: 403,
      })
    );
  });
});
