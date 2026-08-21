import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPage, getPages, getPublishedPageBySlug, updatePage } from '../api/service';
import { prisma } from '@/utils/prisma';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    page: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    pageBlock: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

describe('Pages Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPage', () => {
    it('should create a page with sanitized blocks', async () => {
      const mockPageData = {
        title: 'Home',
        published: true,
        blocks: [{ type: 'TEXT', content: '{"text":"<p>Halo</p><script>alert(1)</script>"}', order: 0 }],
      };
      
      (prisma.page.findUnique as any).mockResolvedValue(null); // Slug unique
      (prisma.page.create as any).mockResolvedValue({ id: '1', slug: 'home', ...mockPageData });

      // @ts-ignore
      const result = await createPage(mockPageData);

      expect(prisma.page.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Home',
          blocks: {
            create: [{ type: 'TEXT', content: '{"text":"<p>Halo</p>"}', order: 0 }],
          },
        }),
      }));
      expect(result).toHaveProperty('slug');
    });
  });

  describe('updatePage', () => {
    it('should replace blocks when updating', async () => {
      const updateData = {
        title: 'Home Updated',
        blocks: [{ type: 'TEXT', content: '{"text":"Hello<script>alert(1)</script>"}', order: 0 }],
      };
      (prisma.page.update as any).mockResolvedValue({ id: '1', ...updateData });

      // @ts-ignore
      await updatePage('1', updateData);

      expect(prisma.pageBlock.deleteMany).toHaveBeenCalledWith({ where: { pageId: '1' } });
      expect(prisma.pageBlock.createMany).toHaveBeenCalledWith({
        data: [{ type: 'TEXT', content: '{"text":"Hello"}', order: 0, pageId: '1' }],
      });
      expect(prisma.page.update).toHaveBeenCalled();
    });
  });

  describe('public page queries', () => {
    it('should fetch published page by slug only', async () => {
      (prisma.page.findFirst as any).mockResolvedValue({ id: '1', slug: 'home', published: true });

      await getPublishedPageBySlug('home');

      expect(prisma.page.findFirst).toHaveBeenCalledWith({
        where: { slug: 'home', published: true },
        include: { blocks: { orderBy: { order: 'asc' } } },
      });
    });

    it('should filter page list to published records when requested', async () => {
      (prisma.page.findMany as any).mockResolvedValue([{ id: '1', published: true }]);

      await getPages(true);

      expect(prisma.page.findMany).toHaveBeenCalledWith({
        where: { published: true },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });
});
