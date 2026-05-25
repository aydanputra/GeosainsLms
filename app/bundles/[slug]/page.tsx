import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';
import BundleCTA from './components/BundleCTA';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  if (n <= 0) return 'Gratis';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default async function BundleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = await prisma.courseBundle.findUnique({ where: { slug } });

  if (!bundle || !bundle.published) return notFound();

  const rawCourseIds = Array.from(new Set((bundle.courseIds || []).map((c) => c.trim()).filter(Boolean)));
  const courses =
    rawCourseIds.length > 0
      ? await prisma.course.findMany({
          where: { id: { in: rawCourseIds }, deletedAt: null, status: CourseStatus.PUBLISHED },
          select: { id: true, slug: true, title: true, price: true, thumbnailUrl: true, subtitle: true },
        })
      : [];

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const orderedCourses = rawCourseIds.map((id) => courseMap.get(id)).filter(Boolean) as typeof courses;
  const missingCount = rawCourseIds.filter((id) => !courseMap.has(id)).length;

  const subtotal = orderedCourses.reduce((sum, c) => sum + Number(c.price || 0), 0);
  const price = Math.max(0, Number(bundle.price || 0));
  const discount = Math.max(0, Math.round((subtotal - price) * 100) / 100);

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const user = token ? await verifyToken(token) : null;
  const isLoggedIn = !!user;

  const enrolledCount =
    user && orderedCourses.length > 0
      ? await prisma.enrollment.count({
          where: { userId: user.id, courseId: { in: orderedCourses.map((c) => c.id) } },
        })
      : 0;

  const thumbnailUrl =
    typeof bundle.thumbnailUrl === 'string' && bundle.thumbnailUrl.trim() && !bundle.thumbnailUrl.startsWith('blob:')
      ? bundle.thumbnailUrl
      : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[520px] h-[520px] bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[320px] h-[320px] bg-emerald-600/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/bundles" className="hover:text-white transition-colors">
              Bundel
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-4">
              <div className="text-sm font-semibold text-indigo-300">Bundel Kursus</div>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight">{bundle.name}</h1>
              {bundle.description ? <p className="text-slate-300 leading-relaxed max-w-2xl">{bundle.description}</p> : null}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="text-[11px] font-extrabold text-slate-200 bg-white/10 border border-white/15 px-2 py-1 rounded-full">
                  {orderedCourses.length} Kursus
                </span>
                <span className="text-[11px] font-extrabold text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                  Akses seumur hidup
                </span>
                {discount > 0 ? (
                  <span className="text-[11px] font-extrabold text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-full">
                    Hemat {formatCurrency(discount)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-slate-800">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={bundle.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-700 to-indigo-800" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-10">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-extrabold text-slate-900">Kursus di dalam Bundel</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Total harga kursus: {formatCurrency(subtotal)} • Harga bundel: {formatCurrency(price)}
                  </div>
                </div>
                <Link
                  href="/bundles"
                  className="text-sm font-extrabold text-indigo-700 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl"
                >
                  Lihat Bundel Lain
                </Link>
              </div>

              {missingCount > 0 ? (
                <div className="mt-4 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                  Ada {missingCount} kursus yang tidak tersedia untuk publik dan tidak ditampilkan.
                </div>
              ) : null}

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {orderedCourses.length === 0 ? (
                  <div className="text-sm text-slate-600">Bundel ini belum memiliki kursus.</div>
                ) : (
                  orderedCourses.map((c) => {
                    const img =
                      typeof c.thumbnailUrl === 'string' && c.thumbnailUrl.trim() && !c.thumbnailUrl.startsWith('blob:')
                        ? c.thumbnailUrl
                        : null;
                    const courseHref = c.slug ? `/courses/${encodeURIComponent(c.slug)}` : '/courses';
                    return (
                      <Link
                        key={c.id}
                        href={courseHref}
                        className="group border border-slate-200 rounded-2xl overflow-hidden bg-white hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-[16/9] bg-slate-900">
                          {img ? (
                            <img src={img} alt={c.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900" />
                          )}
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-2">
                            {c.title}
                          </div>
                          {c.subtitle ? <div className="text-xs text-slate-600 line-clamp-2">{c.subtitle}</div> : null}
                          <div className="text-xs font-extrabold text-slate-900">{formatCurrency(Number(c.price || 0))}</div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <BundleCTA
              bundleId={bundle.id}
              bundleSlug={bundle.slug}
              courseCount={orderedCourses.length}
              subtotal={subtotal}
              price={price}
              isLoggedIn={isLoggedIn}
              enrolledCount={enrolledCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
