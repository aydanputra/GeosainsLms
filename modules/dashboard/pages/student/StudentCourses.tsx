"use client";

import { Play, Award, Clock, BookOpen, User, Star, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

interface StudentCoursesProps {
  courses: any[];
}

export default function StudentCourses({ courses }: StudentCoursesProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didAutoOpenReviewRef = useRef(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewCourse, setReviewCourse] = useState<any | null>(null);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [myComment, setMyComment] = useState('');
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);

  const openReview = async (course: any) => {
    setReviewCourse(course);
    setReviewOpen(true);
    setIsLoadingReview(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(String(course.id))}/rating`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal memuat ulasan');
      setRatingAvg(typeof (data as any)?.ratingAvg === 'number' ? (data as any).ratingAvg : 0);
      setRatingCount(typeof (data as any)?.ratingCount === 'number' ? (data as any).ratingCount : 0);
      setMyRating(typeof (data as any)?.myRating === 'number' ? (data as any).myRating : null);
      setMyComment(typeof (data as any)?.myComment === 'string' ? (data as any).myComment : '');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat ulasan');
      setRatingAvg(0);
      setRatingCount(0);
      setMyRating(null);
      setMyComment('');
    } finally {
      setIsLoadingReview(false);
    }
  };

  const closeReview = () => {
    setReviewOpen(false);
    setReviewCourse(null);
    setRatingAvg(0);
    setRatingCount(0);
    setMyRating(null);
    setMyComment('');
    setIsLoadingReview(false);
    setIsSavingReview(false);

    const reviewCourseId = searchParams?.get('reviewCourseId');
    if (typeof reviewCourseId === 'string' && reviewCourseId.trim()) {
      router.replace('/dashboard/student/courses');
    }
  };

  const canSaveReview = useMemo(() => {
    return Boolean(reviewCourse?.id) && typeof myRating === 'number' && myRating >= 1 && myRating <= 5;
  }, [myRating, reviewCourse?.id]);

  const saveReview = async () => {
    if (!reviewCourse?.id) return;
    if (!canSaveReview) {
      toast.error('Pilih rating 1–5 terlebih dahulu');
      return;
    }
    setIsSavingReview(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(String(reviewCourse.id))}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: myRating, comment: myComment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal menyimpan ulasan');
      setRatingAvg(typeof (data as any)?.ratingAvg === 'number' ? (data as any).ratingAvg : ratingAvg);
      setRatingCount(typeof (data as any)?.ratingCount === 'number' ? (data as any).ratingCount : ratingCount);
      toast.success('Ulasan berhasil disimpan');
      const nextRaw = searchParams?.get('next');
      const next = typeof nextRaw === 'string' ? nextRaw.trim() : '';
      closeReview();
      if (next.startsWith('/')) {
        router.push(next);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan ulasan');
    } finally {
      setIsSavingReview(false);
    }
  };

  useEffect(() => {
    if (didAutoOpenReviewRef.current) return;
    const reviewCourseIdRaw = searchParams?.get('reviewCourseId');
    const reviewCourseId = typeof reviewCourseIdRaw === 'string' ? reviewCourseIdRaw.trim() : '';
    if (!reviewCourseId) return;
    const course = Array.isArray(courses) ? courses.find((c) => String(c?.id) === reviewCourseId) : null;
    if (!course) return;
    didAutoOpenReviewRef.current = true;
    openReview(course);
  }, [courses, searchParams]);

  useEffect(() => {
    if (!reviewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeReview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reviewOpen]);

  if (!courses || courses.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6 text-slate-900">Kursus Saya</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Belum ada kursus yang diikuti</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">Mulai perjalanan belajar Anda dengan mendaftar di salah satu kursus kami.</p>
          <Link href="/courses" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-200">
            Jelajahi Kursus
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Kursus Saya</h1>
        <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200">
          {courses.length} Kursus Terdaftar
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col">
            {/* Thumbnail */}
            <div className="aspect-video bg-slate-100 relative overflow-hidden">
              <img 
                src={course.thumbnailUrl || '/placeholder-course.jpg'} 
                alt={course.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <Link 
                  href={`/courses/${course.slug}/learn`}
                  className="w-full bg-white/90 hover:bg-white text-slate-900 font-medium py-2 rounded-lg text-center text-sm backdrop-blur-sm transition-colors"
                >
                  Lanjut Belajar
                </Link>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <User className="w-3.5 h-3.5" />
                <span>{course.instructorName}</span>
              </div>
              
              <h3 className="font-bold text-slate-900 line-clamp-2 mb-4 group-hover:text-indigo-600 transition-colors">
                <Link href={`/courses/${course.slug}/learn`}>
                  {course.title}
                </Link>
              </h3>

              <div className="mt-auto space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">{course.progress}% Selesai</span>
                    <span className="text-slate-400">{course.completedLessons}/{course.totalLessons} Materi</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  {course.progress === 100 ? (
                    <Link 
                      href="/dashboard/student/certificates"
                      className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Award className="w-4 h-4" /> Lihat Sertifikat
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Terdaftar {course.enrolledAt}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openReview(course)}
                      className="p-2 bg-slate-50 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                      title="Beri Ulasan"
                    >
                      <Star className="w-4 h-4" fill="currentColor" />
                    </button>
                    <Link 
                      href={`/courses/${course.slug}/learn`}
                      className="p-2 bg-slate-50 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                      title="Lanjut Belajar"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {reviewOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeReview} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900">Beri Ulasan Kursus</div>
                  <div className="text-xs text-slate-500 mt-1 truncate">{String(reviewCourse?.title || '')}</div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    Rating peserta: <span className="font-bold text-slate-700">{ratingAvg ? ratingAvg.toFixed(1) : '0.0'}</span> ({ratingCount})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeReview}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {isLoadingReview ? (
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    Memuat...
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-bold text-slate-700">Rating Anda</div>
                      <div className="mt-2 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const value = i + 1;
                          const active = (myRating || 0) >= value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setMyRating(value)}
                              className="p-1 rounded-lg hover:bg-amber-50"
                              title={`${value} bintang`}
                            >
                              <Star className={`w-6 h-6 ${active ? 'text-amber-500' : 'text-slate-300'}`} fill={active ? 'currentColor' : 'none'} />
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Klik bintang untuk memilih 1–5.</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-700">Komentar (opsional)</div>
                      <textarea
                        value={myComment}
                        onChange={(e) => setMyComment(e.target.value)}
                        rows={4}
                        placeholder="Tulis ulasan singkat tentang kursus ini..."
                        className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReview}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!canSaveReview || isSavingReview || isLoadingReview}
                  onClick={saveReview}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {isSavingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Simpan Ulasan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
