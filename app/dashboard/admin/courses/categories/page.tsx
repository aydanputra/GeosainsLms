import AdminCategories from '@/modules/dashboard/pages/admin/AdminCategories';
import { prisma } from '@/utils/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [categories, courses] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.course.findMany({
      where: { deletedAt: null },
      select: { categoryId: true, categoryIds: true },
    }),
  ]);

  const courseCountByCategoryId = new Map<string, number>();
  for (const c of courses) {
    const ids = new Set<string>();
    if (typeof c.categoryId === 'string' && c.categoryId.trim()) ids.add(c.categoryId);
    if (Array.isArray(c.categoryIds)) {
      for (const id of c.categoryIds) {
        const s = String(id || '').trim();
        if (s) ids.add(s);
      }
    }
    for (const id of ids) {
      courseCountByCategoryId.set(id, (courseCountByCategoryId.get(id) || 0) + 1);
    }
  }

  const formattedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    count: courseCountByCategoryId.get(cat.id) || 0,
  }));

  return <AdminCategories categories={formattedCategories} />;
}
