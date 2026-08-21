"use client";

import Cards from '../../components/Cards';
import Table from '../../components/Tables';
import ReferralDashboard from '../../../affiliate/components/ReferralDashboard';
import { useStudentStats, useStudentCourses } from '../../api/service';
import { useState } from 'react';
import { toast } from 'sonner';

interface StudentDashboardProps {
  stats: {
    completedCourses: number;
    inProgressCourses: number;
    totalScore: number;
  };
  courses: any[];
  affiliateStats?: any;
  becomeInstructorEnabled?: boolean;
}

export default function StudentDashboard({
  stats: initialStats,
  courses: initialCourses,
  affiliateStats,
  becomeInstructorEnabled = false,
}: StudentDashboardProps) {
  const { data: stats, isLoading: statsLoading } = useStudentStats(initialStats);
  const { data: courses, isLoading: coursesLoading } = useStudentCourses(initialCourses);
  const [isRequesting, setIsRequesting] = useState(false);

  const displayedStats = stats || initialStats;
  const displayedCourses = courses || initialCourses;

  const metrics = [
    { label: 'Kursus Selesai', value: displayedStats?.completedCourses || 0, color: 'bg-green-500' },
    { label: 'Sedang Berjalan', value: displayedStats?.inProgressCourses || 0, color: 'bg-blue-500' },
    { label: 'Rata-rata Skor Quiz', value: displayedStats?.totalScore || 0, color: 'bg-yellow-500' },
  ];

  const courseColumns = [
    { header: 'Kursus', accessorKey: 'title' },
    { header: 'Progres', accessorKey: 'progress', 
      cell: (val: number) => (
        <div className="w-full bg-slate-200 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${val}%` }}></div>
        </div>
      ) 
    },
    { header: 'Status', accessorKey: 'status',
      cell: (val: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${val === 'Selesai' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
          {val}
        </span>
      )
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Siswa</h1>
        <p className="text-sm text-slate-600 mt-1">Ringkasan progres belajar dan aktivitas Anda.</p>
      </div>

      <Cards metrics={metrics} isLoading={statsLoading} />

      {becomeInstructorEnabled ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold text-slate-900">Jadi Instruktur</div>
              <div className="text-sm text-slate-600 mt-1">Kirim permintaan menjadi instruktur. Admin akan meninjau permintaan Anda.</div>
            </div>
            <button
              type="button"
              disabled={isRequesting}
              onClick={async () => {
                if (isRequesting) return;
                setIsRequesting(true);
                try {
                  const res = await fetch('/api/instructor-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data?.error || 'Gagal mengirim permintaan');
                  toast.success('Permintaan terkirim');
                } catch (e: any) {
                  toast.error(e?.message || 'Gagal mengirim permintaan');
                } finally {
                  setIsRequesting(false);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              Ajukan Permintaan
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Pembelajaran Saya</h2>
        <Table 
          columns={courseColumns} 
          data={displayedCourses || []} 
          isLoading={coursesLoading}
          actions={() => (
            <button className="text-indigo-700 hover:text-indigo-900 text-sm font-bold">Lanjutkan</button>
          )}
        />
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Program Afiliasi</h2>
        <ReferralDashboard initialStats={affiliateStats} />
      </div>
    </div>
  );
}
