import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPost, updatePost, getPosts } from '../api/service';
import { prisma } from '@/utils/prisma';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    post: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('Blog Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.post.findFirst as any).mockResolvedValue(null);
  });

  describe('createPost', () => {
    it('should create a post with generated slug', async () => {
      const mockPost = { title: 'Test Post', content: '<p>Content here</p><script>alert(1)</script>' };
      (prisma.post.create as any).mockResolvedValue({ id: '1', slug: 'test-post-123', ...mockPost });

      const result = await createPost('user-1', { ...mockPost, published: false });

      expect(prisma.post.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Test Post',
          slug: expect.stringContaining('test-post'),
          author: { connect: { id: 'user-1' } },
          content: '<p>Content here</p>',
        }),
      }));
      expect(result).toHaveProperty('slug');
    });
  });

  describe('updatePost', () => {
    it('should update post and regenerate slug if title changes', async () => {
      const updateData = { title: 'New Title' };
      (prisma.post.update as any).mockResolvedValue({ id: '1', slug: 'new-title-123', ...updateData });

      await updatePost('1', updateData);

      expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: '1' },
        data: expect.objectContaining({
          title: 'New Title',
          slug: expect.stringContaining('new-title'),
        }),
      }));
    });

    it('should reject content that becomes empty after sanitization', async () => {
      await expect(updatePost('1', { content: '<script>alert(1)</script>' })).rejects.toThrow('Konten artikel tidak valid');
      expect(prisma.post.update).not.toHaveBeenCalled();
    });
  });

  describe('getPosts', () => {
    it('should filter published posts', async () => {
      (prisma.post.findMany as any).mockResolvedValue([{ id: '1', published: true }]);

      await getPosts({ publishedOnly: true });

      expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ published: true }),
      }));
    });
  });
});
