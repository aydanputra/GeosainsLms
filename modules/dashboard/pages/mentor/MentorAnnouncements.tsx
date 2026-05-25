"use client";

import { useMemo, useState } from 'react';
import Table from '../../components/Tables';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, X } from 'lucide-react';

type CourseOption = { id: string; title: string };

type AnnouncementRow = {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  content: string | null;
  pinned: boolean;
  createdAt: string;
  authorName: string;
};

export default function MentorAnnouncements({
  courses,
  announcements,
}: {
  courses: CourseOption[];
  announcements: AnnouncementRow[];
}) {
  const [rows, setRows] = useState<AnnouncementRow[]>(announcements);
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const active = useMemo(() => rows.find((r) => r.id === activeId) || null, [rows, activeId]);

  const openCreate = () => {
    setActiveId(null);
    setCourseId(courses[0]?.id || '');
    setTitle('');
    setContent('');
    setPinned(false);
    setIsOpen(true);
  };

  const openEdit = (row: AnnouncementRow) => {
    setActiveId(row.id);
    setCourseId(row.courseId);
    setTitle(row.title);
    setContent(row.content || '');
    setPinned(row.pinned);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setActiveId(null);
    setTitle('');
    setContent('');
    setPinned(false);
  };

  const save = async () => {
    if (!courseId) {
      toast.error('Pilih kursus');
      return;
    }
    if (title.trim().length < 3) {
      toast.error('Judul minimal 3 karakter');
      return;
    }

    setIsSaving(true);
    try {
      if (!activeId) {
        const res = await fetch(`/api/courses/${courseId}/announcements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), content: content.trim(), pinned }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(data?.error || 'Gagal membuat pengumuman');
          return;
        }
        const created = data?.announcement;
        const courseTitle = courses.find((c) => c.id === courseId)?.title || '-';
        setRows((prev) => [
          {
            id: created.id,
            courseId,
            courseTitle,
            title: created.title,
            content: created.content || null,
            pinned: Boolean(created.pinned),
            createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : new Date().toISOString(),
            authorName: created?.author?.name || created?.author?.email || 'Mentor',
          },
          ...prev,
        ]);
        toast.success('Pengumuman dibuat');
        closeModal();
        return;
      }

      const res = await fetch(`/api/announcements/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), pinned }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal memperbarui pengumuman');
        return;
      }
      const updated = data?.announcement;
      setRows((prev) =>
        prev.map((r) =>
          r.id === activeId
            ? {
                ...r,
                title: updated.title,
                content: updated.content || null,
                pinned: Boolean(updated.pinned),
              }
            : r
        )
      );
      toast.success('Pengumuman diperbarui');
      closeModal();
    } catch {
      toast.error('Gagal menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (row: AnnouncementRow) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    try {
      const res = await fetch(`/api/announcements/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal menghapus');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Pengumuman dihapus');
    } catch {
      toast.error('Gagal menghapus');
    }
  };

  const columns = [
    { header: 'Judul', accessorKey: 'title' },
    { header: 'Kursus', accessorKey: 'courseTitle' },
    { header: 'Pin', accessorKey: 'pinned' },
    { header: 'Tanggal', accessorKey: 'createdAt' },
  ];

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    courseTitle: r.courseTitle,
    pinned: r.pinned ? 'YA' : '-',
    createdAt: new Date(r.createdAt).toLocaleString('id-ID'),
    _raw: r,
  }));

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengumuman</h1>
          <p className="text-slate-500 text-sm mt-1">Buat dan kelola pengumuman untuk siswa.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Buat
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table
          columns={columns}
          data={data}
          isLoading={false}
          actions={(row: any) => {
            const r: AnnouncementRow = row._raw;
            return (
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => openEdit(r)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(r)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          }}
        />
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">{active ? 'Edit Pengumuman' : 'Buat Pengumuman'}</div>
                <div className="text-xs text-slate-500 truncate">
                  {active ? active.courseTitle : 'Untuk siswa di kursus terpilih'}
                </div>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kursus</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  disabled={Boolean(activeId)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Judul</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Isi</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                Pin pengumuman
              </label>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-white">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm"
              >
                Batal
              </button>
              <button
                onClick={save}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
