import { prisma } from '@/utils/prisma';
import { z } from 'zod';
import { sanitizePageBlocks } from '@/modules/core/utils/sanitizeHtml';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start of text
    .replace(/-+$/, '');      // Trim - from end of text
}

// Schemas
export const PageBlockSchema = z.object({
  type: z.enum(['HERO', 'TEXT', 'FEATURES', 'TESTIMONIALS', 'CTA', 'COURSES', 'BLOG', 'SECTION', 'GRID']),
  content: z.string(), // JSON string, validated based on type in UI
  order: z.number().int(),
});

export const PageSchema = z.object({
  title: z.string().min(3),
  slug: z.string().optional(), // Optional on create, auto-generated
  published: z.boolean().default(false),
  blocks: z.array(PageBlockSchema).optional(),
});

// Services
export const createPage = async (data: z.infer<typeof PageSchema>) => {
  const slug = data.slug || slugify(data.title);
  
  // Ensure unique slug
  let uniqueSlug = slug;
  let counter = 1;
  while (await prisma.page.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  // Separate blocks from page data
  const { blocks, ...pageData } = data;
  const sanitizedBlocks = sanitizePageBlocks(blocks);

  return prisma.page.create({
    data: {
      ...pageData,
      slug: uniqueSlug,
      blocks: {
        create: sanitizedBlocks,
      },
    },
    include: { blocks: { orderBy: { order: 'asc' } } },
  });
};

export const updatePage = async (id: string, data: Partial<z.infer<typeof PageSchema>>) => {
  // If blocks are provided, we replace all existing blocks (simple strategy)
  // A better strategy would be to diff and update/create/delete
  
  const sanitizedBlocks = data.blocks ? sanitizePageBlocks(data.blocks) : undefined;

  if (sanitizedBlocks) {
    await prisma.pageBlock.deleteMany({ where: { pageId: id } });
    await prisma.pageBlock.createMany({
      data: sanitizedBlocks.map((b) => ({ ...b, pageId: id })),
    });
  }

  const updateData: { title?: string; published?: boolean; slug?: string } = {};
  if (data.title) updateData.title = data.title;
  if (data.published !== undefined) updateData.published = data.published;
  if (data.slug) updateData.slug = data.slug;

  return prisma.page.update({
    where: { id },
    data: updateData,
    include: { blocks: { orderBy: { order: 'asc' } } },
  });
};

export const getPageBySlug = async (slug: string) => {
  return prisma.page.findUnique({
    where: { slug },
    include: { blocks: { orderBy: { order: 'asc' } } },
  });
};

export const getPublishedPageBySlug = async (slug: string) => {
  return prisma.page.findFirst({
    where: { slug, published: true },
    include: { blocks: { orderBy: { order: 'asc' } } },
  });
};

export const getPages = async (publishedOnly = false) => {
  return prisma.page.findMany({
    where: publishedOnly ? { published: true } : undefined,
    orderBy: { updatedAt: 'desc' },
  });
};

export const deletePage = async (id: string) => {
  return prisma.page.delete({
    where: { id },
  });
};
