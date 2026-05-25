"use client";

import Table from '../../components/Tables';

interface MentorQuizzesProps {
  quizzes: any[];
}

export default function MentorQuizzes({ quizzes }: MentorQuizzesProps) {
  const columns = [
    { header: 'Pelajaran', accessorKey: 'lessonTitle' },
    { header: 'Jumlah Soal', accessorKey: 'questionCount' },
    { header: 'Kursus', accessorKey: 'courseTitle' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kuis</h1>
        <p className="text-sm text-slate-600 mt-1">Daftar quiz dari kursus yang kamu ajar.</p>
      </div>
      <Table 
        columns={columns} 
        data={quizzes} 
        isLoading={false}
        actions={(row) => (
          <button className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
        )}
      />
    </div>
  );
}
