import Link from 'next/link';
import { prisma } from '@/utils/prisma';
import { CourseStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  if (n <= 0) return 'Gratis';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default async function BundlesPage() {
  const bundles = await prisma.courseBundle.findMany({
    where: { published: true },
    orderBy: { updatedAt: 'desc' },
  });

  const allCourseIds = Array.from(
    new Set(
      bundles
        .flatMap((b) => b.courseIds || [])
        .map((c) => c.trim())
        .filter(Boolean)
    )
  );

  const publishedCourses =
    allCourseIds.length > 0
      ? await prisma.course.findMany({
          where: { id: { in: allCourseIds }, deletedAt: null, status: CourseStatus.PUBLISHED },
          select: { id: true },
        })
      : [];

  const publishedCourseIdSet = new Set(publishedCourses.map((c) => c.id));

  const bundleCards = bundles.map((b) => {
    const ids = Array.from(new Set((b.courseIds || []).map((c) => c.trim()).filter(Boolean)));
    const publishedCount = ids.filter((id) => publishedCourseIdSet.has(id)).length;
    const imageUrl =
      typeof b.thumbnailUrl === 'string' && b.thumbnailUrl.trim() && !b.thumbnailUrl.startsWith('blob:') ? b.thumbnailUrl : null;

    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      price: Number(b.price || 0),
      publishedCount,
      imageUrl,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[520px] h-[520px] bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[320px] h-[320px] bg-emerald-600/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl space-y-4">
            <div className="text-sm font-semibold text-indigo-300">Katalog</div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight">Bundel Kursus</h1>
            <p className="text-slate-300 leading-relaxed">
              Beli beberapa kursus sekaligus dengan harga bundel yang lebih hemat.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {bundleCards.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-lg font-extrabold text-slate-900">Belum ada bundel</div>
            <div className="text-sm text-slate-500 mt-2">Silakan cek kembali nanti.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundleCards.map((b) => (
              <Link
                key={b.id}
                href={`/bundles/${encodeURIComponent(b.slug)}`}
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="aspect-[16/9] bg-slate-900">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900" />
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-extrabold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                        {b.name}
                      </div>
                      {b.description ? (
                        <div className="text-sm text-slate-600 line-clamp-2 mt-1">{b.description}</div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-sm font-extrabold text-slate-900">{formatCurrency(b.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
                      {b.publishedCount} Kursus
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                      Akses seumur hidup
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
