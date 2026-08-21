import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPostsRoute } from '@/app/api/blog/posts/route';
import { GET as getPostDetailRoute } from '@/app/api/blog/posts/[id]/route';
import { getPostBySlug, getPosts } from '../api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { sanitizeRichHtml } from '@/modules/core/utils/sanitizeHtml';

vi.mock('../api/service', () => ({
  getPosts: vi.fn(),
  getPostBySlug: vi.fn(),
  createPost: vi.fn(),
  PostSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/core/utils/sanitizeHtml', () => ({
  sanitizeRichHtml: vi.fn((value: string) => `sanitized:${value}`),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
}));

describe('Blog Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should keep public list on publishedOnly=true even when publishedOnly=false is requested without auth', async () => {
    (getPosts as any).mockResolvedValue([{ id: 'post-1', content: '<p>draft</p>' }]);

    const req = new NextRequest('http://localhost/api/blog/posts?publishedOnly=false');
    const res = await getPostsRoute(req);
    const data = await res.json();

    expect(getPosts).toHaveBeenCalledWith({
      publishedOnly: true,
      search: undefined,
      authorId: undefined,
      categorySlug: undefined,
      tagSlug: undefined,
    });
    expect(data).toEqual([{ id: 'post-1', content: 'sanitized:<p>draft</p>' }]);
  });

  it('should allow mentor to request own drafts from list route', async () => {
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });
    (getPosts as any).mockResolvedValue([{ id: 'post-1', content: '<p>draft</p>' }]);

    const req = new NextRequest('http://localhost/api/blog/posts?publishedOnly=false&authorId=mentor-1', {
      headers: { cookie: 'token=abc' },
    });
    const res = await getPostsRoute(req);

    expect(res.status).toBe(200);
    expect(verifyToken).toHaveBeenCalledWith('abc');
    expect(getPosts).toHaveBeenCalledWith({
      publishedOnly: false,
      search: undefined,
      authorId: 'mentor-1',
      categorySlug: undefined,
      tagSlug: undefined,
    });
  });

  it('should hide draft detail from public users', async () => {
    (getPostBySlug as any).mockResolvedValue({
      id: 'post-1',
      slug: 'draft-post',
      authorId: 'mentor-1',
      published: false,
      content: '<p>draft</p>',
    });

    const req = new NextRequest('http://localhost/api/blog/posts/draft-post');
    const res = await getPostDetailRoute(req, { params: Promise.resolve({ id: 'draft-post' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: 'Post not found' });
  });

  it('should allow mentor owner to access draft detail and sanitize content', async () => {
    (getPostBySlug as any).mockResolvedValue({
      id: 'post-1',
      slug: 'draft-post',
      authorId: 'mentor-1',
      published: false,
      content: '<p>draft</p>',
    });
    (verifyToken as any).mockResolvedValue({ id: 'mentor-1', role: 'MENTOR' });

    const req = new NextRequest('http://localhost/api/blog/posts/draft-post', {
      headers: { cookie: 'token=abc' },
    });
    const res = await getPostDetailRoute(req, { params: Promise.resolve({ id: 'draft-post' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      id: 'post-1',
      slug: 'draft-post',
      authorId: 'mentor-1',
      published: false,
      content: 'sanitized:<p>draft</p>',
    });
    expect(sanitizeRichHtml).toHaveBeenCalledWith('<p>draft</p>');
  });
});
