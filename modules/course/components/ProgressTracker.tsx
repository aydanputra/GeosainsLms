"use client";

interface ProgressTrackerProps {
  completedLessons: number;
  totalLessons: number;
  currentLessonTitle: string;
}

export default function ProgressTracker({ completedLessons, totalLessons, currentLessonTitle }: ProgressTrackerProps) {
  const percentage = Math.round((completedLessons / totalLessons) * 100) || 0;

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-extrabold text-slate-900">Progress Kursus</h3>
        <span className="text-sm font-extrabold text-indigo-700">{percentage}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4">
        <div 
          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="text-sm text-slate-700">
        <span className="font-extrabold text-slate-900">{completedLessons}/{totalLessons}</span> materi selesai
      </div>
      <div className="mt-2 text-xs text-slate-600">
        Sedang dipelajari: <span className="text-slate-800 font-bold">{currentLessonTitle}</span>
      </div>
    </div>
  );
}
