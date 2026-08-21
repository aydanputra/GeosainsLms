import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as downloadLessonAttachmentRoute } from '@/app/api/lessons/[lessonId]/attachments/[attachmentId]/download/route';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {},
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/utils/lessonAttachmentStorage', () => ({
  readLessonAttachmentFile: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAccessDeniedAuditLog: vi.fn(),
}));

describe('Lesson Attachment Download Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should audit unauthorized lesson attachment download attempts', async () => {
    const req = new NextRequest('http://localhost/api/lessons/lesson-1/attachments/attachment-1/download');
    const res = await downloadLessonAttachmentRoute(req, {
      params: Promise.resolve({ lessonId: 'lesson-1', attachmentId: 'attachment-1' }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized: Login required' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LESSON_ATTACHMENT_DOWNLOAD_DENIED',
        entityId: 'attachment-1',
        status: 401,
      })
    );
  });
});
