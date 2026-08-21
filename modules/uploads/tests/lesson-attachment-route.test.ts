import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as uploadLessonAttachmentRoute } from '@/app/api/uploads/lesson-attachment/route';
import { verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeRateLimitAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    lesson: {
      findUnique: vi.fn(),
    },
    lessonAttachment: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  enforceRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  isSameOrigin: vi.fn(),
}));

vi.mock('@/utils/lessonAttachmentStorage', () => ({
  assertLessonAttachmentStorageConfigured: vi.fn(),
  saveLessonAttachmentFile: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeRateLimitAuditLog: vi.fn(),
}));

describe('Lesson Attachment Upload Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (getClientIp as any).mockReturnValue('127.0.0.1');
    (enforceRateLimit as any).mockReturnValue({ ok: true });
  });

  it('should reject cross-origin uploads', async () => {
    (isSameOrigin as any).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/uploads/lesson-attachment', { method: 'POST' });
    const res = await uploadLessonAttachmentRoute(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('should return 429 when attachment upload rate limit is exceeded', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });
    (enforceRateLimit as any).mockReturnValueOnce({ ok: false, retryAfterSeconds: 180 });

    const form = new FormData();
    form.set('lessonId', 'lesson-1');
    form.set('file', new File(['dummy'], 'test.pdf', { type: 'application/pdf' }));

    const req = new NextRequest('http://localhost/api/uploads/lesson-attachment', {
      method: 'POST',
      headers: { cookie: 'token=abc' },
      body: form,
    });

    const res = await uploadLessonAttachmentRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('180');
    expect(data).toEqual({ error: 'Terlalu banyak upload dokumen. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LESSON_ATTACHMENT_UPLOAD_RATE_LIMITED',
        key: 'lesson-attachment:upload:ip:127.0.0.1',
      })
    );
  });
});
