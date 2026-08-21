"use client";

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

export default function CourseRatingWidget({
  courseId,
  initialRatingAvg = 0,
  initialRatingCount = 0,
}: {
  courseId: string;
  initialRatingAvg?: number;
  initialRatingCount?: number;
}) {
  const [ratingAvg, setRatingAvg] = useState(initialRatingAvg);
  const [ratingCount, setRatingCount] = useState(initialRatingCount);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/rating`);
        const data = await res.json();
        if (!active) return;
        setRatingAvg(typeof data.ratingAvg === 'number' ? data.ratingAvg : 0);
        setRatingCount(typeof data.ratingCount === 'number' ? data.ratingCount : 0);
        setMyRating(typeof data.myRating === 'number' ? data.myRating : null);
      } catch {
        if (!active) return;
        setRatingAvg(initialRatingAvg);
        setRatingCount(initialRatingCount);
        setMyRating(null);
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [courseId, initialRatingAvg, initialRatingCount]);

  const save = async (value: number) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan rating');
      setMyRating(value);
      setRatingAvg(typeof data.ratingAvg === 'number' ? data.ratingAvg : value);
      setRatingCount(typeof data.ratingCount === 'number' ? data.ratingCount : ratingCount);
      toast.success(data.message || 'Rating tersimpan');
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan rating');
    } finally {
      setIsSaving(false);
    }
  };

  const filled = Math.max(0, Math.min(5, Math.round(ratingAvg)));

  return (
    <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
      <div className="text-sm font-extrabold text-slate-900">Rating Peserta</div>
      <div className="mt-2 flex items-center justify-between gap-3">
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
        <div className="text-xs font-bold text-slate-700">{ratingAvg ? ratingAvg.toFixed(1) : '0.0'}</div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-bold text-slate-700">Beri rating Anda</div>
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => {
            const value = i + 1;
            const selected = (myRating || 0) >= value;
            return (
              <button
                key={value}
                type="button"
                disabled={isLoading || isSaving}
                onClick={() => save(value)}
                className="p-1 rounded-lg hover:bg-white disabled:opacity-60"
                aria-label={`Beri rating ${value}`}
              >
                <Star className={`w-5 h-5 ${selected ? 'text-amber-500' : 'text-slate-300'}`} fill={selected ? 'currentColor' : 'none'} />
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          {myRating ? `Rating Anda: ${myRating}/5` : 'Belum ada rating dari Anda.'}
        </div>
      </div>
    </div>
  );
}
