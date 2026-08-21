"use client";

import Table from '../../components/Tables';

interface MentorLessonsProps {
  lessons: any[];
}

export default function MentorLessons({ lessons }: MentorLessonsProps) {
  const columns = [
    { header: 'Judul', accessorKey: 'title' },
    { header: 'Modul', accessorKey: 'moduleTitle' },
    { header: 'Kursus', accessorKey: 'courseTitle' },
    { header: 'Tipe', accessorKey: 'type' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pelajaran</h1>
        <p className="text-sm text-slate-600 mt-1">Daftar lesson yang ada di kursus yang kamu ajar.</p>
      </div>
      <Table 
        columns={columns} 
        data={lessons} 
        isLoading={false}
        actions={() => (
          <button className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
        )}
      />
    </div>
  );
}
