"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Loader2, Star } from 'lucide-react';

type CourseCategory = { id: string; name: string; slug: string };

type PublicCourse = {
  id: string;
  slug: string | null;
  title: string;
  thumbnailUrl: string | null;
  price: number | null;
  normalPrice?: number | null;
  level?: string | null;
  categoryId?: string | null;
  category?: { name: string } | null;
  instructor?: { name: string | null; email: string | null } | null;
  tags?: string[] | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  _count?: { enrollments?: number } | null;
  createdAt?: string | null;
};

function resolveThumbnail(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('blob:')) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return null;
}

function getLevelLabel(level: string) {
  if (level === 'ADVANCED') return 'Advanced';
  if (level === 'INTERMEDIATE') return 'Intermediate';
  return 'Beginner';
}

function levelBars(level?: string | null) {
  if (level === 'ADVANCED') return 3;
  if (level === 'INTERMEDIATE') return 2;
  return 1;
}

export default function PublicCoursesCatalogPage({ initialTagSlug }: { initialTagSlug?: string } = {}) {
  const searchParams = useSearchParams();
  const initialCategorySlug = searchParams.get('category') || '';
  const queryTagSlug = searchParams.get('tag') || '';
  const effectiveTagSlug = initialTagSlug || queryTagSlug;

  const [isLoading, setIsLoading] = useState(true);
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);

  const [q, setQ] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedLevels, setSelectedLevels] = useState<Record<string, boolean>>({
    BEGINNER: false,
    INTERMEDIATE: false,
    ADVANCED: false,
  });
  const [priceType, setPriceType] = useState<'ALL' | 'FREE' | 'PAID'>('ALL');
  const [sort, setSort] = useState<'NEWEST' | 'POPULAR' | 'RATING' | 'PRICE_ASC' | 'PRICE_DESC'>('POPULAR');
  const [selectedYears, setSelectedYears] = useState<Record<string, boolean>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const slugifyTag = (raw: string) =>
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const [coursesRes, categoriesRes] = await Promise.all([fetch('/api/courses?published=true'), fetch('/api/categories')]);
        const coursesJson = await coursesRes.json().catch(() => []);
        const categoriesJson = await categoriesRes.json().catch(() => []);
        if (!active) return;
        setCourses(Array.isArray(coursesJson) ? (coursesJson as PublicCourse[]) : []);
        setCategories(Array.isArray(categoriesJson) ? (categoriesJson as CourseCategory[]) : []);
      } catch {
        if (!active) return;
        setCourses([]);
        setCategories([]);
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initialCategorySlug) return;
    const match = categories.find((c) => c.slug === initialCategorySlug);
    if (!match) return;
    setSelectedCategoryId(match.id);
  }, [initialCategorySlug, categories]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    for (const c of courses) {
      if (!c.createdAt) continue;
      const t = new Date(c.createdAt).getTime();
      if (!Number.isFinite(t)) continue;
      set.add(new Date(t).getFullYear());
    }
    return Array.from(set.values()).sort((a, b) => b - a);
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const query = q.trim().toLowerCase();
    const anyLevelSelected = Object.values(selectedLevels).some(Boolean);
    const anyYearSelected = Object.values(selectedYears).some(Boolean);
    let list = courses.slice();

    if (query) list = list.filter((c) => (c.title || '').toLowerCase().includes(query));
    if (effectiveTagSlug) {
      const target = slugifyTag(effectiveTagSlug);
      list = list.filter((c) => {
        const tags = Array.isArray(c.tags) ? c.tags : [];
        return tags.some((t) => slugifyTag(String(t || '')) === target);
      });
    }
    if (selectedCategoryId !== 'ALL') list = list.filter((c) => String(c.categoryId || '') === selectedCategoryId);
    if (anyLevelSelected) {
      list = list.filter((c) => {
        const lv = String(c.level || 'BEGINNER');
        return Boolean(selectedLevels[lv]);
      });
    }
    if (priceType !== 'ALL') {
      list = list.filter((c) => {
        const p = typeof c.price === 'number' && Number.isFinite(c.price) ? c.price : 0;
        return priceType === 'FREE' ? p <= 0 : p > 0;
      });
    }
    if (anyYearSelected) {
      list = list.filter((c) => {
        if (!c.createdAt) return false;
        const t = new Date(c.createdAt).getTime();
        if (!Number.isFinite(t)) return false;
        const y = String(new Date(t).getFullYear());
        return Boolean(selectedYears[y]);
      });
    }

    list.sort((a, b) => {
      const aPrice = typeof a.price === 'number' && Number.isFinite(a.price) ? a.price : 0;
      const bPrice = typeof b.price === 'number' && Number.isFinite(b.price) ? b.price : 0;
      const aPop = typeof a._count?.enrollments === 'number' ? a._count.enrollments : 0;
      const bPop = typeof b._count?.enrollments === 'number' ? b._count.enrollments : 0;
      const aRating = typeof a.ratingAvg === 'number' && Number.isFinite(a.ratingAvg) ? a.ratingAvg : 0;
      const bRating = typeof b.ratingAvg === 'number' && Number.isFinite(b.ratingAvg) ? b.ratingAvg : 0;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (sort === 'PRICE_ASC') return aPrice - bPrice;
      if (sort === 'PRICE_DESC') return bPrice - aPrice;
      if (sort === 'RATING') return bRating - aRating || bPop - aPop;
      if (sort === 'NEWEST') return bTime - aTime;
      return bPop - aPop || bRating - aRating || bTime - aTime;
    });

    return list;
  }, [courses, q, selectedCategoryId, selectedLevels, priceType, sort, selectedYears, effectiveTagSlug]);

  const resetFilters = () => {
    setQ('');
    setSelectedCategoryId('ALL');
    setSelectedLevels({ BEGINNER: false, INTERMEDIATE: false, ADVANCED: false });
    setPriceType('ALL');
    setSort('POPULAR');
    setSelectedYears({});
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
          <aside className="w-full lg:w-[280px] shrink-0 lg:sticky lg:top-24 lg:self-start">
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((v) => !v)}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between text-slate-900 font-extrabold"
              >
                <span>Filter</span>
                <span className="text-slate-500 font-bold text-sm">{mobileFiltersOpen ? 'Tutup' : 'Buka'}</span>
              </button>
            </div>

            <div
              className={[
                'mt-4 lg:mt-0 bg-slate-100/80 border border-slate-200/60 rounded-2xl p-4',
                mobileFiltersOpen ? 'block' : 'hidden lg:block',
              ].join(' ')}
            >
              <div className="space-y-8 lg:max-h-[calc(100vh-8rem)] overflow-auto pr-1">
              <div className="space-y-3">
                <div className="text-sm font-extrabold text-slate-900">Category</div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="course-category"
                      checked={selectedCategoryId === 'ALL'}
                      onChange={() => setSelectedCategoryId('ALL')}
                      className="w-4 h-4 accent-blue-700"
                    />
                    All
                  </label>
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="course-category"
                        checked={selectedCategoryId === c.id}
                        onChange={() => setSelectedCategoryId(c.id)}
                        className="w-4 h-4 accent-blue-700"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-extrabold text-slate-900">Sort</div>
                <div className="space-y-2">
                  {(
                    [
                      { id: 'NEWEST', label: 'Baru Rilis' },
                      { id: 'POPULAR', label: 'Terpopuler' },
                      { id: 'RATING', label: 'Rating Tertinggi' },
                      { id: 'PRICE_ASC', label: 'Harga Terendah' },
                      { id: 'PRICE_DESC', label: 'Harga Tertinggi' },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="course-sort"
                        checked={sort === opt.id}
                        onChange={() => setSort(opt.id)}
                        className="w-4 h-4 accent-blue-700"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-extrabold text-slate-900">Level</div>
                <div className="space-y-2">
                  {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((lv) => (
                    <label key={lv} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedLevels[lv])}
                        onChange={(e) => setSelectedLevels((prev) => ({ ...prev, [lv]: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                      {getLevelLabel(lv)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-extrabold text-slate-900">Type</div>
                <div className="space-y-2">
                  {(
                    [
                      { id: 'ALL', label: 'Semua' },
                      { id: 'FREE', label: 'Gratis' },
                      { id: 'PAID', label: 'Berbayar' },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="course-price"
                        checked={priceType === opt.id}
                        onChange={() => setPriceType(opt.id)}
                        className="w-4 h-4 accent-blue-700"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {yearOptions.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm font-extrabold text-slate-900">Tahun</div>
                  <div className="space-y-2">
                    {yearOptions.map((y) => (
                      <label key={y} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedYears[String(y)])}
                          onChange={(e) => setSelectedYears((prev) => ({ ...prev, [String(y)]: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                        {y}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold text-sm hover:opacity-90 transition-opacity"
                >
                  Reset Filter
                </button>
              </div>
            </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm font-bold text-slate-700">
                Menampilkan <span className="font-extrabold text-slate-900">{filteredCourses.length}</span> kursus
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                placeholder="Cari kursus..."
              />
            </div>

            <div className="mt-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Memuat kursus...</span>
                </div>
              ) : filteredCourses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredCourses.map((course) => {
                    const thumb = resolveThumbnail(course.thumbnailUrl);
                    const href = course.slug ? `/courses/${course.slug}` : '/courses';
                    const ratingAvg = typeof course.ratingAvg === 'number' && Number.isFinite(course.ratingAvg) ? course.ratingAvg : 0;
                    const ratingCount =
                      typeof course.ratingCount === 'number' && Number.isFinite(course.ratingCount) ? course.ratingCount : 0;
                    const filled = Math.max(0, Math.min(5, Math.round(ratingAvg)));

                    return (
                      <Link
                        key={course.id}
                        href={href}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col"
                      >
                        <div className="aspect-video bg-slate-100 relative overflow-hidden">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt={course.title || 'Kursus'}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              unoptimized
                              className="object-cover group-hover:scale-[1.02] transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <BookOpen className="w-10 h-10" />
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col gap-2">
                          <h3 className="font-[700] text-slate-900 line-clamp-2 text-base leading-[27px] transition-colors group-hover:text-blue-800">
                            {course.title}
                          </h3>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-right">
                              {(() => {
                                const price =
                                  typeof course.price === 'number' && Number.isFinite(course.price) ? course.price : Number(course.price || 0) || 0;
                                const normalPrice =
                                  typeof course.normalPrice === 'number' && Number.isFinite(course.normalPrice)
                                    ? course.normalPrice
                                    : course.normalPrice
                                      ? Number(course.normalPrice)
                                      : 0;
                                const showDiscountPrice = price > 0;
                                const showNormalPrice = normalPrice > 0 && (!showDiscountPrice || normalPrice > price);

                                return (
                                  <>
                                    <div className="flex items-baseline justify-end gap-2">
                                      {showNormalPrice ? (
                                        <span className="text-sm font-semibold text-rose-500 line-through price-blink">
                                          Rp {Math.round(normalPrice).toLocaleString('id-ID')}
                                        </span>
                                      ) : null}
                                      <span className={showDiscountPrice ? 'text-sm font-extrabold text-slate-600' : 'text-sm font-extrabold text-emerald-600'}>
                                        {showDiscountPrice ? `Rp ${Math.round(price).toLocaleString('id-ID')}` : 'Gratis'}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const active = i < filled;
                                  return (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${active ? 'text-amber-500' : 'text-slate-300'}`}
                                      fill={active ? 'currentColor' : 'none'}
                                    />
                                  );
                                })}
                              </div>
                              <div className="text-xs text-slate-500">({ratingCount})</div>
                            </div>

                            <div className="flex items-end gap-1 shrink-0">
                              {Array.from({ length: 3 }).map((_, idx) => {
                                const active = idx < levelBars(course.level);
                                const heightClass = idx === 0 ? 'h-2.5' : idx === 1 ? 'h-4' : 'h-6';
                                return (
                                  <div key={idx} className={`w-2 rounded-full ${heightClass} ${active ? 'bg-blue-700' : 'bg-blue-200'}`} />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="font-extrabold text-slate-900">Tidak ada kursus ditemukan</h3>
                  <p className="text-sm text-slate-500 mt-1">Coba ubah filter atau kata kunci pencarian.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
