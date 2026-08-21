import { prisma } from '@/utils/prisma';
import { z } from 'zod';
import { sanitizeRichHtml } from '@/modules/core/utils/sanitizeHtml';

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

async function generateUniquePostSlug(base: string, excludeId?: string | null) {
  const normalizedBase = slugify(base);
  if (!normalizedBase) return null;

  const existing = await prisma.post.findFirst({
    where: { slug: normalizedBase, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (!existing) return normalizedBase;

  for (let i = 2; i <= 50; i++) {
    const candidate = `${normalizedBase}-${i}`;
    const used = await prisma.post.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!used) return candidate;
  }

  return `${normalizedBase}-${Date.now().toString(36)}`;
}

// Schemas
export const PostSchema = z.object({
  title: z.string().min(5),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  featuredImageUrl: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().min(10),
  published: z.boolean().default(false),
});

// Services
export const createPost = async (authorId: string, data: z.infer<typeof PostSchema>) => {
  const requestedSlugBase = typeof data.slug === 'string' && data.slug.trim() ? data.slug : data.title;
  const slug = await generateUniquePostSlug(requestedSlugBase);
  if (!slug) throw new Error('Slug tidak valid');

  const excerpt = typeof data.excerpt === 'string' && data.excerpt.trim() ? data.excerpt.trim() : null;
  const featuredImageUrl =
    typeof data.featuredImageUrl === 'string' && data.featuredImageUrl.trim() ? data.featuredImageUrl.trim() : null;

  const categoryId = typeof data.categoryId === 'string' && data.categoryId.trim() ? data.categoryId.trim() : null;
  const categoryName = typeof data.categoryName === 'string' && data.categoryName.trim() ? data.categoryName.trim() : null;
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const normalizedTags = Array.from(
    new Set(
      tags
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter(Boolean)
        .slice(0, 30)
    )
  );

  const sanitizedContent = sanitizeRichHtml(data.content);
  if (!sanitizedContent) {
    throw new Error('Konten artikel tidak valid');
  }

  return prisma.post.create({
    data: {
      title: data.title,
      slug,
      author: { connect: { id: authorId } },
      publishedAt: data.published ? new Date() : null,
      published: data.published,
      content: sanitizedContent,
      excerpt,
      featuredImageUrl,
      ...(categoryId
        ? { category: { connect: { id: categoryId } } }
        : categoryName
          ? {
              category: {
                connectOrCreate: {
                  where: { slug: slugify(categoryName) },
                  create: { name: categoryName, slug: slugify(categoryName) },
                },
              },
            }
          : {}),
      ...(normalizedTags.length
        ? {
            tags: {
              create: normalizedTags.map((name) => ({
                tag: {
                  connectOrCreate: {
                    where: { slug: slugify(name) },
                    create: { name, slug: slugify(name) },
                  },
                },
              })),
            },
          }
        : {}),
    },
    include: {
      author: { select: { name: true, email: true } },
      category: true,
      tags: { include: { tag: true } },
    },
  });
};

export const updatePost = async (id: string, data: Partial<z.infer<typeof PostSchema>>) => {
  const title = typeof data.title === 'string' ? data.title.trim() : undefined;
  const content = typeof data.content === 'string' ? sanitizeRichHtml(data.content) : undefined;
  if (typeof data.content === 'string' && !content) {
    throw new Error('Konten artikel tidak valid');
  }
  const excerpt = typeof data.excerpt === 'string' ? (data.excerpt.trim() ? data.excerpt.trim() : null) : undefined;
  const featuredImageUrl =
    typeof data.featuredImageUrl === 'string' ? (data.featuredImageUrl.trim() ? data.featuredImageUrl.trim() : null) : undefined;
  const published = typeof data.published === 'boolean' ? data.published : undefined;

  const requestedSlugBase = typeof data.slug === 'string' && data.slug.trim() ? data.slug : title;
  const shouldUpdateSlug = typeof requestedSlugBase === 'string' && requestedSlugBase.trim().length > 0;
  const nextSlug = shouldUpdateSlug ? await generateUniquePostSlug(requestedSlugBase, id) : undefined;

  const hasCategoryIdKey = Object.prototype.hasOwnProperty.call(data, 'categoryId');
  const hasCategoryNameKey = Object.prototype.hasOwnProperty.call(data, 'categoryName');
  const shouldHandleCategory = hasCategoryIdKey || hasCategoryNameKey;
  const categoryId = typeof data.categoryId === 'string' && data.categoryId.trim() ? data.categoryId.trim() : null;
  const categoryName = typeof data.categoryName === 'string' && data.categoryName.trim() ? data.categoryName.trim() : null;
  const tags = Array.isArray(data.tags) ? data.tags : undefined;
  const normalizedTags =
    tags === undefined
      ? undefined
      : Array.from(
          new Set(
            tags
              .map((t) => (typeof t === 'string' ? t.trim() : ''))
              .filter(Boolean)
              .slice(0, 30)
          )
        );

  return prisma.post.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(excerpt !== undefined ? { excerpt } : {}),
      ...(featuredImageUrl !== undefined ? { featuredImageUrl } : {}),
      ...(published !== undefined
        ? {
            published,
            publishedAt: published ? new Date() : null,
          }
        : {}),
      ...(nextSlug ? { slug: nextSlug } : {}),
      ...(shouldHandleCategory
        ? categoryId
          ? { category: { connect: { id: categoryId } } }
          : categoryName
            ? {
                category: {
                  connectOrCreate: {
                    where: { slug: slugify(categoryName) },
                    create: { name: categoryName, slug: slugify(categoryName) },
                  },
                },
              }
            : { category: { disconnect: true } }
        : {}),
      ...(normalizedTags !== undefined
        ? {
            tags: {
              deleteMany: {},
              ...(normalizedTags.length
                ? {
                    create: normalizedTags.map((name) => ({
                      tag: {
                        connectOrCreate: {
                          where: { slug: slugify(name) },
                          create: { name, slug: slugify(name) },
                        },
                      },
                    })),
                  }
                : {}),
            },
          }
        : {}),
    },
    include: {
      author: { select: { name: true, email: true } },
      category: true,
      tags: { include: { tag: true } },
    },
  });
};

export const getPosts = async (params?: {
  publishedOnly?: boolean;
  search?: string;
  authorId?: string;
  categorySlug?: string;
  tagSlug?: string;
}) => {
  const where: any = {};

  if (params?.publishedOnly) {
    where.published = true;
  }

  if (params?.search) {
    where.title = { contains: params.search, mode: 'insensitive' };
  }

  if (params?.authorId) {
    where.authorId = params.authorId;
  }

  if (params?.categorySlug) {
    where.category = { is: { slug: params.categorySlug } };
  }

  if (params?.tagSlug) {
    where.tags = { some: { tag: { is: { slug: params.tagSlug } } } };
  }

  return prisma.post.findMany({
    where,
    include: {
      author: {
        select: { name: true, email: true },
      },
      category: true,
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getPostBySlug = async (slug: string) => {
  return prisma.post.findUnique({
    where: { slug },
    include: {
      author: {
        select: { name: true, email: true },
      },
      category: true,
      tags: { include: { tag: true } },
    },
  });
};

export const deletePost = async (id: string) => {
  return prisma.post.delete({
    where: { id },
  });
};
