"use client";

import Table from '../../components/Tables';

interface StudentQuizzesProps {
  quizzes: any[];
}

export default function StudentQuizzes({ quizzes }: StudentQuizzesProps) {
  const columns = [
    { header: 'Kuis', accessorKey: 'quizTitle' },
    { header: 'Kursus', accessorKey: 'courseTitle' },
    { header: 'Skor', accessorKey: 'score', cell: (val: number) => `${val}%` },
    { header: 'Tanggal', accessorKey: 'completedAt' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hasil Kuis</h1>
        <p className="text-sm text-slate-600 mt-1">Riwayat kuis yang sudah Anda selesaikan.</p>
      </div>
      <Table 
        columns={columns} 
        data={quizzes} 
        isLoading={false}
        actions={() => (
          <button type="button" className="text-indigo-700 hover:text-indigo-900 text-sm font-bold">
            Ulangi
          </button>
        )}
      />
    </div>
  );
}
