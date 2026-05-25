import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPage, updatePage, getPageBySlug } from '../api/service';
import { prisma } from '@/utils/prisma';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    page: {
      create: vi.fn(),
      update: vi.fn(),
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
    it('should create a page with blocks', async () => {
      const mockPageData = {
        title: 'Home',
        published: true,
        blocks: [{ type: 'HERO', content: '{}', order: 0 }],
      };
      
      (prisma.page.findUnique as any).mockResolvedValue(null); // Slug unique
      (prisma.page.create as any).mockResolvedValue({ id: '1', slug: 'home', ...mockPageData });

      // @ts-ignore
      const result = await createPage(mockPageData);

      expect(prisma.page.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: 'Home',
          blocks: {
            create: mockPageData.blocks,
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
        blocks: [{ type: 'TEXT', content: 'Hello', order: 0 }],
      };
      (prisma.page.update as any).mockResolvedValue({ id: '1', ...updateData });

      // @ts-ignore
      await updatePage('1', updateData);

      expect(prisma.pageBlock.deleteMany).toHaveBeenCalledWith({ where: { pageId: '1' } });
      expect(prisma.pageBlock.createMany).toHaveBeenCalled();
      expect(prisma.page.update).toHaveBeenCalled();
    });
  });
});
