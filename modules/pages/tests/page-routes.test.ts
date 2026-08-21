import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPagesRoute } from '@/app/api/pages/route';
import { GET as getPublicPageRoute } from '@/app/api/pages/public/[...slug]/route';
import { getPages, getPublishedPageBySlug } from '../api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { sanitizePageBlocks } from '@/modules/core/utils/sanitizeHtml';

vi.mock('../api/service', () => ({
  getPages: vi.fn(),
  getPublishedPageBySlug: vi.fn(),
  createPage: vi.fn(),
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/core/utils/sanitizeHtml', () => ({
  sanitizePageBlocks: vi.fn((blocks: any[]) =>
    blocks.map((block) => ({
      ...block,
      content: 'sanitized-content',
    }))
  ),
}));

describe('Page Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject internal page list when no auth token is present', async () => {
    const req = new NextRequest('http://localhost/api/pages');
    const res = await getPagesRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('should reject internal page list for non-admin users', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });

    const req = new NextRequest('http://localhost/api/pages', {
      headers: { cookie: 'token=abc' },
    });
    const res = await getPagesRoute(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Forbidden' });
  });

  it('should allow admin to fetch internal page list', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    (getPages as any).mockResolvedValue([{ id: 'page-1', slug: 'home' }]);

    const req = new NextRequest('http://localhost/api/pages', {
      headers: { cookie: 'token=abc' },
    });
    const res = await getPagesRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(getPages).toHaveBeenCalledWith();
    expect(data).toEqual([{ id: 'page-1', slug: 'home' }]);
  });

  it('should only fetch published page in public route and sanitize blocks', async () => {
    (getPublishedPageBySlug as any).mockResolvedValue({
      id: 'page-1',
      slug: 'home',
      published: true,
      blocks: [{ id: 'block-1', type: 'TEXT', content: '{"text":"unsafe"}' }],
    });

    const req = new NextRequest('http://localhost/api/pages/public/home');
    const res = await getPublicPageRoute(req, { params: Promise.resolve({ slug: ['home'] }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(getPublishedPageBySlug).toHaveBeenCalledWith('home');
    expect(sanitizePageBlocks).toHaveBeenCalledWith([{ id: 'block-1', type: 'TEXT', content: '{"text":"unsafe"}' }]);
    expect(data).toEqual({
      id: 'page-1',
      slug: 'home',
      published: true,
      blocks: [{ id: 'block-1', type: 'TEXT', content: 'sanitized-content' }],
    });
  });
});
