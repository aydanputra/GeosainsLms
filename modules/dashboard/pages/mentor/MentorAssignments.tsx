"use client";

import { useMemo, useState } from 'react';
import Table from '../../components/Tables';
import { Download, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

type SubmissionRow = {
  id: string;
  status: 'PENDING' | 'GRADED' | 'REJECTED';
  submittedAt: string;
  gradedAt: string | null;
  grade: number | null;
  feedback: string | null;
  notes: string | null;
  downloadUrl: string;
  student: { id: string; name: string; email: string };
  assignment: { id: string; title: string; lessonTitle: string; courseTitle: string };
};

export default function MentorAssignments({ submissions }: { submissions: SubmissionRow[] }) {
  const [rows, setRows] = useState(submissions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [status, setStatus] = useState<'GRADED' | 'REJECTED'>('GRADED');
  const [isSaving, setIsSaving] = useState(false);

  const active = useMemo(() => rows.find((r) => r.id === activeId) || null, [rows, activeId]);

  const openGrade = (row: SubmissionRow) => {
    setActiveId(row.id);
    setStatus(row.status === 'REJECTED' ? 'REJECTED' : 'GRADED');
    setGrade(typeof row.grade === 'number' ? String(row.grade) : '');
    setFeedback(row.feedback || '');
  };

  const closeGrade = () => {
    setActiveId(null);
    setGrade('');
    setFeedback('');
    setStatus('GRADED');
  };

  const saveGrade = async () => {
    if (!active) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/assignments/submissions/${active.id}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          grade: status === 'GRADED' ? grade : null,
          feedback,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal menyimpan penilaian');
        return;
      }

      const updated = data?.submission;
      if (!updated) {
        toast.error('Gagal menyimpan penilaian');
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? {
                ...r,
                status: updated.status,
                grade: updated.grade,
                feedback: updated.feedback,
                gradedAt: updated.gradedAt || new Date().toISOString(),
              }
            : r
        )
      );
      toast.success('Penilaian tersimpan');
      closeGrade();
    } catch {
      toast.error('Gagal menyimpan penilaian');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    { header: 'Siswa', accessorKey: 'studentName' },
    { header: 'Kursus', accessorKey: 'courseTitle' },
    { header: 'Materi', accessorKey: 'lessonTitle' },
    { header: 'Tugas', accessorKey: 'assignmentTitle' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Nilai', accessorKey: 'grade' },
    { header: 'Submit', accessorKey: 'submittedAt' },
  ];

  const data = rows.map((r) => ({
    id: r.id,
    studentName: r.student.name,
    courseTitle: r.assignment.courseTitle,
    lessonTitle: r.assignment.lessonTitle,
    assignmentTitle: r.assignment.title,
    status: r.status,
    grade: typeof r.grade === 'number' ? r.grade : '-',
    submittedAt: new Date(r.submittedAt).toLocaleString('id-ID'),
    _raw: r,
  }));

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tugas</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola submission tugas siswa.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table
          columns={columns}
          data={data}
          isLoading={false}
          actions={(row: any) => {
            const r: SubmissionRow = row._raw;
            return (
              <div className="flex items-center gap-2">
                <a
                  href={r.downloadUrl}
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <Download className="w-4 h-4" /> Unduh
                </a>
                <button
                  onClick={() => openGrade(r)}
                  className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-4 h-4" /> Nilai
                </button>
              </div>
            );
          }}
        />
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">{active.student.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {active.assignment.courseTitle} • {active.assignment.lessonTitle} • {active.assignment.title}
                </div>
              </div>
              <button onClick={closeGrade} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {active.notes ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Catatan Siswa</div>
                  <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{active.notes}</div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value === 'REJECTED' ? 'REJECTED' : 'GRADED')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="GRADED">GRADED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nilai (0-100)</label>
                  <input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    type="number"
                    min={0}
                    max={100}
                    disabled={status !== 'GRADED'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-white">
              <button
                onClick={closeGrade}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm"
              >
                Batal
              </button>
              <button
                onClick={saveGrade}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm disabled:opacity-70"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
