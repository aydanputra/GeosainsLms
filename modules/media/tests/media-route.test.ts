import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMediaRoute, POST as postMediaRoute } from '@/app/api/media/route';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    mediaAsset: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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

describe('Media Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
  });

  it('should audit unauthenticated media listing attempts', async () => {
    const req = new NextRequest('http://localhost/api/media');
    const res = await getMediaRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEDIA_LIST_DENIED',
        status: 401,
        reason: 'missing_token',
      })
    );
  });

  it('should audit cross-origin media reindex attempts', async () => {
    (isSameOrigin as any).mockReturnValue(false);
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });

    const req = new NextRequest('http://localhost/api/media', {
      method: 'POST',
      headers: {
        cookie: 'token=abc',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'reindex' }),
    });

    const res = await postMediaRoute(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
    expect(writeAccessDeniedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEDIA_REINDEX_DENIED',
        status: 403,
        reason: 'cross_origin',
      })
    );
  });
});
