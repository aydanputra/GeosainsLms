"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Star } from 'lucide-react';
import { normalizeImageUrl, toOptimizedImageUrl } from '@/modules/core/utils/image';

type CoursesContent = {
  heading?: string;
  subheading?: string;
  limit?: number;
  variant?: string;
  publicOnly?: boolean;
  cta?: { text?: string; href?: string };
};

type PublicCourse = {
  id: string;
  slug: string | null;
  title: string;
  thumbnailUrl: string | null;
  price: number | null;
  normalPrice?: number | null;
  instructor?: { name: string | null; email: string | null } | null;
  level?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  isPublic?: boolean | null;
};

function CourseBlockCard({
  course,
  index,
}: {
  course: PublicCourse;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);

  const getLevelBars = (level?: string | null) => {
    if (level === 'ADVANCED') return 3;
    if (level === 'INTERMEDIATE') return 2;
    return 1;
  };

  const thumb = normalizeImageUrl(course.thumbnailUrl);
  const optimizedThumb = toOptimizedImageUrl(thumb, { width: 720, height: 405, fit: 'fill' });
  const canShowImage = Boolean(optimizedThumb && !imgError);
  const shouldPrioritize = index < 3;

  return (
    <Link
      href={course.slug ? `/courses/${course.slug}` : '/courses'}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '320px' }}
    >
      <div className="aspect-video bg-slate-100 relative overflow-hidden">
        {canShowImage ? (
          <Image
            src={optimizedThumb!}
            alt={course.title || 'Kursus'}
            fill
            sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) calc(50vw - 2rem), 360px"
            priority={shouldPrioritize}
            className="object-cover group-hover:scale-[1.02] transition-transform"
            onError={() => setImgError(true)}
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
          <div className="text-xs text-slate-500 truncate">{course.instructor?.name || course.instructor?.email || ''}</div>
          {(() => {
            const price = typeof course.price === 'number' && Number.isFinite(course.price) ? course.price : Number(course.price || 0) || 0;
            const normalPrice =
              typeof course.normalPrice === 'number' && Number.isFinite(course.normalPrice)
                ? course.normalPrice
                : course.normalPrice
                  ? Number(course.normalPrice)
                  : 0;
            const showDiscountPrice = price > 0;
            const showNormalPrice = normalPrice > 0 && (!showDiscountPrice || normalPrice > price);

            if (!showDiscountPrice && !showNormalPrice) return null;

            return (
              <div className="flex items-baseline justify-end gap-2 shrink-0">
                {showNormalPrice ? (
                  <span className="text-sm font-semibold text-rose-500 line-through price-blink">
                    Rp {Math.round(normalPrice).toLocaleString('id-ID')}
                  </span>
                ) : null}
                <span className={showDiscountPrice ? 'text-sm font-extrabold text-slate-600' : 'text-sm font-extrabold text-emerald-600'}>
                  {showDiscountPrice ? `Rp ${Math.round(price).toLocaleString('id-ID')}` : 'Gratis'}
                </span>
              </div>
            );
          })()}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {(() => {
              const ratingAvg =
                typeof course.ratingAvg === 'number' && Number.isFinite(course.ratingAvg) ? course.ratingAvg : 0;
              const ratingCount =
                typeof course.ratingCount === 'number' && Number.isFinite(course.ratingCount) ? course.ratingCount : 0;
              const filled = Math.max(0, Math.min(5, Math.round(ratingAvg)));
              return (
                <>
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
                </>
              );
            })()}
          </div>

          <div className="flex items-end gap-1">
            {Array.from({ length: 3 }).map((_, idx) => {
              const active = idx < getLevelBars(course.level);
              const heightClass = idx === 0 ? 'h-2.5' : idx === 1 ? 'h-4' : 'h-6';
              return (
                <div
                  key={idx}
                  className={`w-2 rounded-full ${heightClass} ${active ? 'bg-indigo-600' : 'bg-indigo-200'}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CoursesBlock({
  content,
  initialCourses = [],
}: {
  content: CoursesContent;
  initialCourses?: PublicCourse[];
  hydratedFromServer?: boolean;
}) {
  const heading = typeof content?.heading === 'string' ? content.heading : 'Kursus';
  const subheading = typeof content?.subheading === 'string' ? content.subheading : '';
  const limit = typeof content?.limit === 'number' ? content.limit : 6;
  const publicOnly = typeof content?.publicOnly === 'boolean' ? content.publicOnly : false;
  const ctaText = typeof content?.cta?.text === 'string' ? content.cta.text : '';
  const ctaHref = typeof content?.cta?.href === 'string' ? content.cta.href : '/courses';
  const [courses] = useState<PublicCourse[] | null>(Array.isArray(initialCourses) ? initialCourses : []);

  const visibleCourses = useMemo(() => {
    const list = Array.isArray(courses) ? courses : [];
    return publicOnly ? list.filter((course) => course.isPublic === true) : list;
  }, [courses, publicOnly]);

  return (
    <section className="w-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{heading}</h2>
            {subheading ? <p className="text-sm sm:text-base text-slate-600 max-w-2xl">{subheading}</p> : null}
          </div>
          {ctaText ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gradient text-white font-extrabold text-sm hover:opacity-90 transition-opacity w-full sm:w-auto"
            >
              {ctaText} <ArrowRight className="w-4 h-4" />
            </Link>
          ) : null}
        </div>

        <div className="mt-6 sm:mt-8">
          {visibleCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {visibleCourses.slice(0, limit).map((course, index) => (
                <CourseBlockCard key={course.id} course={course} index={index} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="font-bold text-slate-900">Belum ada kursus</h3>
              <p className="text-sm text-slate-500 mt-1">Kursus yang dipublikasikan akan muncul di sini.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
