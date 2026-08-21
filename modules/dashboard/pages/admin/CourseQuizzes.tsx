"use client";

import Table from '../../components/Tables';

interface Quiz {
  id: string;
  title: string; // From lesson title usually
  questionCount: number;
}

interface CourseQuizzesProps {
  courseId: string;
  quizzes: Quiz[];
}

export default function CourseQuizzes({ courseId, quizzes }: CourseQuizzesProps) {
  void courseId;
  
  const columns = [
    { header: 'Judul Quiz', accessorKey: 'title' },
    { header: 'Jumlah Soal', accessorKey: 'questionCount' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Daftar Quiz Kursus</h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm font-medium">
          + Tambah Quiz Baru
        </button>
      </div>

      <Table 
        columns={columns} 
        data={quizzes} 
        isLoading={false}
        actions={() => (
          <div className="flex space-x-2">
            <button className="text-blue-600 hover:text-blue-800 text-sm">Lihat Soal</button>
            <button className="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button className="text-red-600 hover:text-red-800 text-sm">Hapus</button>
          </div>
        )}
      />
    </div>
  );
}
