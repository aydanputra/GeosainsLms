import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE as deleteLessonAttachmentRoute } from '@/app/api/uploads/lesson-attachment/[attachmentId]/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    lessonAttachment: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  isSameOrigin: vi.fn(),
}));

vi.mock('@/utils/lessonAttachmentStorage', () => ({
  deleteLessonAttachmentFile: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeAccessDeniedAuditLog: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {},
  unlink: vi.fn(),
}));

describe('Lesson Attachment Delete Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
  });

  it('should audit denied delete access for non-owner users', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'student-1', role: 'STUDENT' });
    (prisma.lessonAttachment.findUnique as any).mockResolvedValue({
      id: 'attachment-1',
      lessonId: 'lesson-1',
      lesson: {
        module: {
          course: {
            instructorId: 'mentor-1',
          },
        },
      },
    });

    const req = new NextRequest('http://localhost/api/uploads/lesson-attachment/attachment-1', {
      method: 'DELETE',
      headers: { cookie: 'token=abc' },
    });

    const res = await deleteLessonAttachmentRoute(req, { params: Promise.resolve({ attachmentId: 'attachment-1' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LESSON_ATTACHMENT_DELETE_DENIED',
        entityId: 'attachment-1',
        status: 403,
      })
    );
  });

  it('should ignore unsafe legacy public attachment paths on delete', async () => {
    const { unlink } = await import('fs/promises');
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    (prisma.lessonAttachment.findUnique as any).mockResolvedValue({
      id: 'attachment-1',
      lessonId: 'lesson-1',
      storagePath: null,
      url: '/uploads/../../unsafe.txt',
      lesson: {
        module: {
          course: {
            instructorId: 'mentor-1',
          },
        },
      },
    });
    (prisma.lessonAttachment.delete as any).mockResolvedValue({ id: 'attachment-1' });

    const req = new NextRequest('http://localhost/api/uploads/lesson-attachment/attachment-1', {
      method: 'DELETE',
      headers: { cookie: 'token=abc' },
    });

    const res = await deleteLessonAttachmentRoute(req, { params: Promise.resolve({ attachmentId: 'attachment-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(unlink).not.toHaveBeenCalled();
  });
});
