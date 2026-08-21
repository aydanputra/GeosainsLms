"use client";

import Table from '../../components/Tables';
import { Award, CheckCircle, Clock } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface StudentProgress {
  id: string;
  studentName: string;
  email: string;
  progress: number;
  completed: boolean;
}

interface CourseProgressProps {
  progressData: StudentProgress[];
}

export default function CourseProgress({ progressData }: CourseProgressProps) {
  const columns = [
    { header: 'Nama Siswa', accessorKey: 'studentName',
      cell: (val: string) => <div className="font-medium text-slate-900">{val}</div>
    },
    { header: 'Email', accessorKey: 'email',
      cell: (val: string) => <div className="text-slate-500 text-sm">{val}</div>
    },
    { header: 'Progress', accessorKey: 'progress', 
      cell: (val: number) => (
        <div className="w-full max-w-[140px] flex items-center gap-2">
          <div className="flex-1 bg-slate-100 rounded-full h-2">
            <div 
              className={twMerge("h-2 rounded-full", val === 100 ? "bg-green-500" : "bg-indigo-500")} 
              style={{ width: `${val}%` }}
            ></div>
          </div>
          <span className="text-xs font-medium text-slate-600 w-8">{val}%</span>
        </div>
      )
    },
    { header: 'Status', accessorKey: 'completed',
      cell: (val: boolean) => (
        <span className={twMerge(
          "px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 w-fit",
          val 
            ? "bg-green-50 text-green-700 border-green-200" 
            : "bg-yellow-50 text-yellow-700 border-yellow-200"
        )}>
          {val ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {val ? 'Selesai' : 'Berjalan'}
        </span>
      )
    }
  ];

  const handleGenerateCertificate = async (studentId: string) => {
    void studentId;
    // Mock API call
    alert('Sertifikat berhasil dibuat (simulasi)');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Progress Siswa</h1>
          <p className="text-slate-500 text-sm mt-1">Pantau kemajuan belajar siswa di kursus ini.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="hidden md:block">
          <Table 
            columns={columns} 
            data={progressData} 
            isLoading={false}
            actions={(row: StudentProgress) => (
              row.completed ? (
                <button 
                  onClick={() => handleGenerateCertificate(row.id)}
                  className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <Award className="w-4 h-4" /> Lihat Sertifikat
                </button>
              ) : (
                <span className="text-slate-400 text-sm italic px-3 py-1.5">Belum Selesai</span>
              )
            )}
          />
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-200">
          {progressData.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Tidak ada data progress.</div>
          ) : (
            progressData.map((student) => (
              <div key={student.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-slate-900">{student.studentName}</h3>
                    <p className="text-xs text-slate-500">{student.email}</p>
                  </div>
                  <span className={twMerge(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1",
                    student.completed 
                      ? "bg-green-50 text-green-700 border-green-200" 
                      : "bg-yellow-50 text-yellow-700 border-yellow-200"
                  )}>
                    {student.completed ? 'Selesai' : 'Berjalan'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div 
                      className={twMerge("h-2 rounded-full", student.progress === 100 ? "bg-green-500" : "bg-indigo-500")} 
                      style={{ width: `${student.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-slate-600">{student.progress}%</span>
                </div>

                {student.completed && (
                  <div className="pt-2 flex justify-end border-t border-slate-100 mt-2">
                    <button 
                      onClick={() => handleGenerateCertificate(student.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Award className="w-3 h-3" /> Lihat Sertifikat
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
