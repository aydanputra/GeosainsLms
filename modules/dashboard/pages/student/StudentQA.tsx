"use client";

import { useMemo, useState } from 'react';
import Table from '../../components/Tables';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, MessageSquare, Plus, Send, Trash2, X } from 'lucide-react';

type CourseOption = { id: string; title: string };

type ThreadRow = {
  id: string;
  courseId: string;
  courseTitle: string;
  lessonTitle: string | null;
  title: string;
  question: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  replyCount: number;
  lastReplyAt: string | null;
};

type ThreadDetail = {
  id: string;
  courseTitle: string;
  lessonTitle: string | null;
  title: string;
  question: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  author: { id: string; name: string; role: string };
  replies: Array<{ id: string; message: string; createdAt: string; author: { id: string; name: string; role: string } }>;
};

export default function StudentQA({ courses, threads }: { courses: CourseOption[]; threads: ThreadRow[] }) {
  const [rows, setRows] = useState<ThreadRow[]>(threads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createCourseId, setCreateCourseId] = useState(courses[0]?.id || '');
  const [createTitle, setCreateTitle] = useState('');
  const [createQuestion, setCreateQuestion] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeRow = useMemo(() => rows.find((r) => r.id === activeId) || null, [rows, activeId]);

  const open = async (row: ThreadRow) => {
    setActiveId(row.id);
    setDetail(null);
    setReply('');
    setIsLoading(true);
    try {
      const res = await fetch(`/api/qa/${row.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal memuat thread');
        setActiveId(null);
        return;
      }
      setDetail(data.thread);
    } catch {
      toast.error('Gagal memuat thread');
      setActiveId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const close = () => {
    setActiveId(null);
    setDetail(null);
    setReply('');
    setIsLoading(false);
  };

  const sendReply = async () => {
    if (!activeId) return;
    const message = reply.trim();
    if (message.length < 2) {
      toast.error('Balasan minimal 2 karakter');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(`/api/qa/${activeId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal mengirim balasan');
        return;
      }
      const created = data?.reply;
      setReply('');
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              replies: [
                ...prev.replies,
                {
                  id: created.id,
                  message: created.message,
                  createdAt: created.createdAt,
                  author: created.author,
                },
              ],
            }
          : prev
      );
      setRows((prev) =>
        prev.map((r) =>
          r.id === activeId
            ? {
                ...r,
                replyCount: r.replyCount + 1,
                lastReplyAt: created.createdAt ? new Date(created.createdAt).toISOString() : new Date().toISOString(),
              }
            : r
        )
      );
      toast.success('Balasan terkirim');
    } catch {
      toast.error('Gagal mengirim balasan');
    } finally {
      setIsSending(false);
    }
  };

  const toggleResolved = async () => {
    if (!detail) return;
    if (!activeRow) return;
    if (activeRow.authorId !== detail.author.id) return;
    setIsUpdating(true);
    try {
      const nextStatus = detail.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED';
      const res = await fetch(`/api/qa/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal mengubah status');
        return;
      }
      setDetail((prev) => (prev ? { ...prev, status: nextStatus as any } : prev));
      setRows((prev) => prev.map((r) => (r.id === detail.id ? { ...r, status: nextStatus as any } : r)));
      toast.success('Status diperbarui');
    } catch {
      toast.error('Gagal mengubah status');
    } finally {
      setIsUpdating(false);
    }
  };

  const selectableIds = useMemo(() => rows.filter((r) => r.authorRole === 'STUDENT').map((r) => r.id), [rows]);
  const isAllSelectableSelected = useMemo(() => {
    if (selectableIds.length === 0) return false;
    const set = new Set(selectedIds);
    return selectableIds.every((id) => set.has(id));
  }, [selectedIds, selectableIds]);

  const toggleOne = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r || r.authorRole !== 'STUDENT') return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllSelectable = () => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = selectableIds.length > 0 && selectableIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !selectableIds.includes(id));
      for (const id of selectableIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  };

  const remove = async (row: ThreadRow) => {
    if (!confirm('Hapus thread ini?')) return;
    try {
      const res = await fetch(`/api/qa/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal menghapus thread');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      if (activeId === row.id) close();
      toast.success('Thread dihapus');
    } catch {
      toast.error('Gagal menghapus thread');
    }
  };

  const bulkDelete = async () => {
    const ids = selectedIds.filter((id) => selectableIds.includes(id));
    if (ids.length === 0) {
      toast.info('Pilih minimal 1 thread');
      return;
    }
    if (!confirm(`Hapus ${ids.length} thread terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;

    setIsBulkDeleting(true);
    let failed = 0;
    try {
      for (const id of ids) {
        const res = await fetch(`/api/qa/${id}`, { method: 'DELETE' });
        if (!res.ok) failed += 1;
      }

      if (failed === 0) toast.success(`Berhasil menghapus ${ids.length} thread`);
      else toast.error(`${failed} thread gagal dihapus`);

      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      if (activeId && ids.includes(activeId)) close();
    } catch {
      toast.error('Gagal menghapus thread terpilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openCreate = () => {
    setCreateCourseId(courses[0]?.id || '');
    setCreateTitle('');
    setCreateQuestion('');
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateTitle('');
    setCreateQuestion('');
  };

  const createThread = async () => {
    if (!createCourseId) {
      toast.error('Pilih kursus');
      return;
    }
    if (createTitle.trim().length < 3) {
      toast.error('Judul minimal 3 karakter');
      return;
    }
    if (createQuestion.trim().length < 10) {
      toast.error('Pertanyaan minimal 10 karakter');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`/api/courses/${createCourseId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: createTitle.trim(), question: createQuestion.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Gagal membuat pertanyaan');
        return;
      }
      const created = data?.thread;
      const courseTitle = courses.find((c) => c.id === createCourseId)?.title || '-';
      setRows((prev) => [
        {
          id: created.id,
          courseId: createCourseId,
          courseTitle,
          lessonTitle: created.lessonTitle || null,
          title: created.title,
          question: created.question,
          status: created.status,
          createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : new Date().toISOString(),
          authorId: created.author.id,
          authorName: created.author.name,
          authorRole: created.author.role,
          replyCount: 0,
          lastReplyAt: null,
        },
        ...prev,
      ]);
      toast.success('Pertanyaan dibuat');
      closeCreate();
    } catch {
      toast.error('Gagal membuat pertanyaan');
    } finally {
      setIsCreating(false);
    }
  };

  const columns = useMemo(() => {
    return [
      {
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/40"
              checked={isAllSelectableSelected}
              onChange={toggleAllSelectable}
              disabled={selectableIds.length === 0 || isBulkDeleting}
              aria-label="Pilih semua thread"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-14',
        cell: (_val: unknown, row: any) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={selectedIds.includes(row.id)}
              onChange={() => toggleOne(row.id)}
              disabled={!row.deletable || isBulkDeleting}
              aria-label={`Pilih thread ${row.title}`}
            />
          </div>
        ),
      },
      { header: 'Judul', accessorKey: 'title' },
      { header: 'Kursus', accessorKey: 'courseTitle' },
      { header: 'Status', accessorKey: 'status' },
      { header: 'Balasan', accessorKey: 'replyCount' },
      { header: 'Terakhir', accessorKey: 'lastReplyAt' },
      { header: 'Tanggal', accessorKey: 'createdAt' },
    ];
  }, [isAllSelectableSelected, isBulkDeleting, selectableIds, selectedIds]);

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    courseTitle: r.courseTitle,
    status: r.status === 'RESOLVED' ? 'SELESAI' : 'OPEN',
    replyCount: r.replyCount,
    lastReplyAt: r.lastReplyAt ? new Date(r.lastReplyAt).toLocaleString('id-ID') : '-',
    createdAt: new Date(r.createdAt).toLocaleString('id-ID'),
    deletable: r.authorRole === 'STUDENT',
    _raw: r,
  }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Q&A</h1>
          <p className="text-slate-500 text-sm mt-1">Tanya jawab dengan mentor untuk kursus yang kamu ikuti.</p>
        </div>
        <button
          onClick={openCreate}
          disabled={courses.length === 0}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          <Plus className="w-4 h-4" /> Tanya
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {selectedIds.length ? `${selectedIds.length} dipilih` : `${rows.length} thread`}
          </div>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={selectedIds.length === 0 || isBulkDeleting}
            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
          >
            Hapus Terpilih
          </button>
        </div>
        <Table
          columns={columns}
          data={data}
          isLoading={false}
          actions={(row: any) => {
            const r: ThreadRow = row._raw;
            return (
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => open(r)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Lihat"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                {r.authorRole === 'STUDENT' ? (
                  <button
                    onClick={() => remove(r)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            );
          }}
        />
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">Buat Pertanyaan</div>
              <button onClick={closeCreate} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kursus</label>
                <select
                  value={createCourseId}
                  onChange={(e) => setCreateCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pertanyaan</label>
                <textarea
                  value={createQuestion}
                  onChange={(e) => setCreateQuestion(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-white">
              <button
                onClick={closeCreate}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm"
              >
                Batal
              </button>
              <button
                onClick={createThread}
                disabled={isCreating}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm disabled:opacity-60 flex items-center gap-2"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Kirim
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">{detail?.title || activeRow?.title || 'Q&A'}</div>
                <div className="text-xs text-slate-500 truncate">
                  {(detail?.courseTitle || activeRow?.courseTitle || '-') +
                    (detail?.lessonTitle || activeRow?.lessonTitle ? ` • ${detail?.lessonTitle || activeRow?.lessonTitle}` : '')}
                </div>
              </div>
              <button onClick={close} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat...
                </div>
              ) : detail ? (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        {detail.author.name} • {new Date(detail.createdAt).toLocaleString('id-ID')}
                      </div>
                      {activeRow?.authorId === detail.author.id ? (
                        <button
                          onClick={toggleResolved}
                          disabled={isUpdating}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-60 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {detail.status === 'RESOLVED' ? 'Buka Lagi' : 'Tandai Selesai'}
                        </button>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{detail.question}</div>
                  </div>

                  <div className="space-y-3">
                    {detail.replies.length === 0 ? (
                      <div className="text-sm text-slate-500">Belum ada balasan.</div>
                    ) : (
                      detail.replies.map((r) => (
                        <div key={r.id} className="border border-slate-200 rounded-xl p-3">
                          <div className="text-xs text-slate-500">
                            {r.author.name} • {new Date(r.createdAt).toLocaleString('id-ID')}
                          </div>
                          <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{r.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">Thread tidak ditemukan.</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Tulis balasan..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  onClick={sendReply}
                  disabled={isSending || !detail || detail.status === 'RESOLVED'}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm disabled:opacity-60"
                >
                  Kirim
                </button>
              </div>
              {detail?.status === 'RESOLVED' ? (
                <div className="text-xs text-slate-500 mt-2">Thread sudah selesai. Buka lagi untuk membalas.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
