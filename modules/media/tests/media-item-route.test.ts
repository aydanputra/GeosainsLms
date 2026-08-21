import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE as deleteMediaRoute, PATCH as patchMediaRoute } from '@/app/api/media/[id]/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    mediaAsset: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeAccessDeniedAuditLog: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {},
  unlink: vi.fn(),
}));

describe('Media Item Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
  });

  it('should audit denied patch access for non-owner users', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'user-2', role: 'STUDENT' });
    (prisma.mediaAsset.findUnique as any).mockResolvedValue({ id: 'media-1', userId: 'user-1' });

    const req = new NextRequest('http://localhost/api/media/media-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
      body: JSON.stringify({ alt: 'new alt' }),
    });

    const res = await patchMediaRoute(req, { params: Promise.resolve({ id: 'media-1' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEDIA_MUTATION_DENIED',
        entityId: 'media-1',
        status: 403,
      })
    );
  });

  it('should not unlink unsafe media storage paths on delete', async () => {
    const { unlink } = await import('fs/promises');
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    (prisma.mediaAsset.findUnique as any).mockResolvedValue({
      id: 'media-1',
      userId: 'user-1',
      storagePath: '../unsafe.txt',
      url: '/uploads/media/user-1/file.png',
    });
    (prisma.mediaAsset.delete as any).mockResolvedValue({ id: 'media-1' });

    const req = new NextRequest('http://localhost/api/media/media-1', {
      method: 'DELETE',
      headers: { cookie: 'token=abc' },
    });

    const res = await deleteMediaRoute(req, { params: Promise.resolve({ id: 'media-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(unlink).not.toHaveBeenCalled();
  });
});
