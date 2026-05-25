"use client";

import { useMemo, useState } from 'react';
import Table from '../../components/Tables';
import { toast } from 'sonner';
import { ArrowUpRight, CheckCircle2, Loader2, MessageSquare, Trash2, X } from 'lucide-react';

type ThreadRow = {
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  title: string;
  question: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
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

export default function MentorQA({ threads }: { threads: ThreadRow[] }) {
  const [rows, setRows] = useState<ThreadRow[]>(threads);
  const [filter, setFilter] = useState<'ALL' | 'UNANSWERED' | 'OPEN' | 'RESOLVED'>('UNANSWERED');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'DEFAULT' | 'UNANSWERED_FIRST'>('UNANSWERED_FIRST');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const activeRow = useMemo(() => rows.find((r) => r.id === activeId) || null, [rows, activeId]);
  const counts = useMemo(() => {
    const total = rows.length;
    const open = rows.filter((r) => r.status === 'OPEN').length;
    const resolved = rows.filter((r) => r.status === 'RESOLVED').length;
    const unanswered = rows.filter((r) => r.replyCount === 0).length;
    return { total, open, resolved, unanswered };
  }, [rows]);

  const visibleRows = useMemo(() => {
    let list = rows;
    if (filter === 'UNANSWERED') list = list.filter((r) => r.replyCount === 0);
    if (filter === 'OPEN') list = list.filter((r) => r.status === 'OPEN');
    if (filter === 'RESOLVED') list = list.filter((r) => r.status === 'RESOLVED');

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.title,
          r.question,
          r.courseTitle,
          r.lessonTitle || '',
          r.authorName,
          r.authorRole,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const sorted = [...list];
    if (sortMode === 'UNANSWERED_FIRST') {
      sorted.sort((a, b) => {
        const aUnanswered = a.replyCount === 0 ? 1 : 0;
        const bUnanswered = b.replyCount === 0 ? 1 : 0;
        if (aUnanswered !== bUnanswered) return bUnanswered - aUnanswered;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return sorted;
    }

    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [rows, filter, search, sortMode]);

  const openInCourse = (row: ThreadRow) => {
    const params = new URLSearchParams();
    params.set('threadId', row.id);
    if (row.lessonId) params.set('lessonId', row.lessonId);
    const url = `/courses/${encodeURIComponent(row.courseSlug)}/learn?${params.toString()}#qa`;
    window.location.href = url;
  };

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
      if (activeId === row.id) close();
      toast.success('Thread dihapus');
    } catch {
      toast.error('Gagal menghapus thread');
    }
  };

  const columns = [
    { header: 'Judul', accessorKey: 'title' },
    { header: 'Kursus', accessorKey: 'courseTitle' },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Balasan', accessorKey: 'replyCount' },
    { header: 'Terakhir', accessorKey: 'lastReplyAt' },
    { header: 'Tanggal', accessorKey: 'createdAt' },
  ];

  const data = visibleRows.map((r) => ({
    id: r.id,
    title: r.title,
    courseTitle: r.courseTitle,
    status: r.status === 'RESOLVED' ? 'SELESAI' : 'OPEN',
    replyCount: r.replyCount,
    lastReplyAt: r.lastReplyAt ? new Date(r.lastReplyAt).toLocaleString('id-ID') : '-',
    createdAt: new Date(r.createdAt).toLocaleString('id-ID'),
    _raw: r,
  }));

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tanya Jawab</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola pertanyaan siswa dan berikan balasan.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                filter === 'ALL' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Semua ({counts.total})
            </button>
            <button
              onClick={() => setFilter('UNANSWERED')}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                filter === 'UNANSWERED'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Belum Dibalas ({counts.unanswered})
            </button>
            <button
              onClick={() => setFilter('OPEN')}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                filter === 'OPEN' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Open ({counts.open})
            </button>
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                filter === 'RESOLVED'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Selesai ({counts.resolved})
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => setSortMode((prev) => (prev === 'UNANSWERED_FIRST' ? 'DEFAULT' : 'UNANSWERED_FIRST'))}
              className={`px-3 py-2 rounded-xl text-sm font-bold border whitespace-nowrap ${
                sortMode === 'UNANSWERED_FIRST'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Unanswered Dulu
            </button>
          </div>

          <div className="w-full lg:w-96">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, pertanyaan, kursus, lesson, penanya..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                <button
                  onClick={() => openInCourse(r)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Buka di Kursus"
                >
                  <ArrowUpRight className="w-4 h-4" />
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
                      <button
                        onClick={toggleResolved}
                        disabled={isUpdating}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-white disabled:opacity-60 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {detail.status === 'RESOLVED' ? 'Buka Lagi' : 'Tandai Selesai'}
                      </button>
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
