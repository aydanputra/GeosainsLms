import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { HEAD as certificateDownloadHead } from '@/app/api/certificates/[serial]/download/route';
import { prisma } from '@/utils/prisma';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    page: {
      findUnique: vi.fn(),
    },
    certificate: {
      findUnique: vi.fn(),
    },
    courseCoInstructor: {
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

describe('Certificate Download Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should audit unauthorized certificate download attempts', async () => {
    (prisma.certificate.findUnique as any).mockResolvedValue({
      serial: 'CERT-001',
      userId: 'user-1',
      courseId: 'course-1',
      issuedAt: new Date(),
      user: { name: 'Student One' },
      course: { title: 'Course', instructorId: 'mentor-1', totalDuration: 120 },
    });
    (prisma.page.findUnique as any).mockResolvedValue({ content: JSON.stringify({ certificateDownloadPolicy: 'OWNER_ONLY' }) });

    const req = new NextRequest('http://localhost/api/certificates/CERT-001/download', { method: 'HEAD' });
    const res = await certificateDownloadHead(req, { params: Promise.resolve({ serial: 'CERT-001' }) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CERTIFICATE_DOWNLOAD_DENIED',
        entityId: 'CERT-001',
        status: 401,
      })
    );
  });
});
