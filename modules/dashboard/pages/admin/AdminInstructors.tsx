"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Plus, Save, Search, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

type InstructorRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  totalCourses: number;
  totalStudents: number;
  status: 'APPROVED';
};

type StudentOption = { id: string; name: string | null; email: string };

type InstructorDetail = {
  instructor: { id: string; name: string; email: string; avatarUrl: string | null; createdAt: string };
  courses: Array<{ id: string; title: string; slug: string; status: string; createdAt: string }>;
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(nameOrEmail: string) {
  const cleaned = String(nameOrEmail || '').trim();
  if (!cleaned) return 'I';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || cleaned[0];
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return (first + last).toUpperCase();
}

export default function AdminInstructors() {
  const [rows, setRows] = useState<InstructorRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'NONAKTIFKAN'>('NONAKTIFKAN');
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InstructorDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredStudents = useMemo(() => {
    const q = studentsSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.name || s.email).toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [students, studentsSearch]);

  const fetchInstructors = async (args: { reset: boolean }) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL('/api/dashboard/admin/instructors', window.location.origin);
      url.searchParams.set('limit', '20');
      if (search.trim()) url.searchParams.set('q', search.trim());
      const cursor = args.reset ? null : nextCursor;
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat instruktur');
      const list = Array.isArray(data?.instructors) ? data.instructors : [];
      const mapped: InstructorRow[] = list.map((i: any) => ({
        id: String(i.id),
        name: String(i.name || i.email || ''),
        email: String(i.email || ''),
        avatarUrl: typeof i.avatarUrl === 'string' ? i.avatarUrl : null,
        createdAt: typeof i.createdAt === 'string' ? i.createdAt : new Date(i.createdAt).toISOString(),
        totalCourses: Number(i.totalCourses) || 0,
        totalStudents: Number(i.totalStudents) || 0,
        status: 'APPROVED',
      }));
      setRows((prev) => (args.reset ? mapped : [...prev, ...mapped]));
      setNextCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat instruktur');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchInstructors({ reset: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAllOnPage = () => {
    const allIds = rows.map((r) => r.id);
    const next = new Set(selectedIds);
    const allSelected = allIds.length > 0 && allIds.every((id) => next.has(id));
    if (allSelected) {
      for (const id of allIds) next.delete(id);
    } else {
      for (const id of allIds) next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const openAddModal = () => {
    setAddModalOpen(true);
    setStudentsSearch('');
    setSelectedStudentIds(new Set());
  };

  useEffect(() => {
    if (!addModalOpen) return;
    if (students.length > 0 || isLoadingStudents) return;
    setIsLoadingStudents(true);
    setStudentsError(null);
    (async () => {
      try {
        const res = await fetch('/api/users?role=STUDENT', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat pengguna');
        const list = Array.isArray(data) ? data : [];
        setStudents(
          list.map((u: any) => ({ id: String(u.id), name: typeof u.name === 'string' ? u.name : null, email: String(u.email || '') }))
        );
      } catch (e: any) {
        setStudentsError(e?.message || 'Gagal memuat pengguna');
      } finally {
        setIsLoadingStudents(false);
      }
    })();
  }, [addModalOpen, isLoadingStudents, students.length]);

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const promoteStudents = async () => {
    const ids = Array.from(selectedStudentIds);
    if (ids.length === 0) {
      toast.error('Pilih minimal 1 pengguna');
      return;
    }
    if (isPromoting) return;
    setIsPromoting(true);
    try {
      const res = await fetch('/api/dashboard/admin/instructors/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menambahkan instruktur');
      toast.success('Instruktur ditambahkan');
      setAddModalOpen(false);
      setSelectedStudentIds(new Set());
      setRows([]);
      setNextCursor(null);
      setSelectedIds(new Set());
      fetchInstructors({ reset: true });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambahkan instruktur');
    } finally {
      setIsPromoting(false);
    }
  };

  const openEdit = async (id: string) => {
    setEditModalOpen(true);
    setEditId(id);
    setDetail(null);
    setDetailError(null);
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/dashboard/admin/instructors/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat instruktur');
      const instructor = data?.instructor;
      setDetail({
        instructor: {
          id: String(instructor.id),
          name: String(instructor.name || instructor.email || ''),
          email: String(instructor.email || ''),
          avatarUrl: typeof instructor.avatarUrl === 'string' ? instructor.avatarUrl : null,
          createdAt: typeof instructor.createdAt === 'string' ? instructor.createdAt : new Date(instructor.createdAt).toISOString(),
        },
        courses: Array.isArray(data?.courses)
          ? data.courses.map((c: any) => ({
              id: String(c.id),
              title: String(c.title || ''),
              slug: String(c.slug || ''),
              status: String(c.status || ''),
              createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date(c.createdAt).toISOString(),
            }))
          : [],
      });
      setEditName(String(instructor.name || '').trim());
      setEditAvatarUrl(String(instructor.avatarUrl || '').trim());
    } catch (e: any) {
      setDetailError(e?.message || 'Gagal memuat instruktur');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeEdit = () => {
    setEditModalOpen(false);
    setEditId(null);
    setDetail(null);
    setDetailError(null);
    setIsLoadingDetail(false);
    setEditName('');
    setEditAvatarUrl('');
    setIsSaving(false);
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/dashboard/admin/instructors/${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, avatarUrl: editAvatarUrl }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan');
      const updated = data?.instructor;
      toast.success('Tersimpan');
      setRows((prev) =>
        prev.map((r) =>
          r.id === editId
            ? {
                ...r,
                name: String(updated?.name || r.name),
                avatarUrl: typeof updated?.avatarUrl === 'string' ? updated.avatarUrl : null,
              }
            : r
        )
      );
      if (detail) {
        setDetail({
          ...detail,
          instructor: {
            ...detail.instructor,
            name: String(updated?.name || detail.instructor.name),
            avatarUrl: typeof updated?.avatarUrl === 'string' ? updated.avatarUrl : null,
          },
        });
      }
      closeEdit();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const demoteInstructor = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/admin/instructors/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Gagal menonaktifkan instruktur');
      toast.success('Instruktur dinonaktifkan');
      setRows((prev) => prev.filter((x) => x.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menonaktifkan instruktur');
    }
  };

  const applyBulk = async () => {
    if (isBulkWorking) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Pilih minimal 1 instruktur');
      return;
    }
    const removable = ids.filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row ? row.totalCourses === 0 : false;
    });
    if (removable.length === 0) {
      toast.error('Tidak ada instruktur yang bisa dinonaktifkan (semua masih memiliki kursus)');
      return;
    }
    const ok = window.confirm(`Nonaktifkan ${removable.length} instruktur terpilih? (hanya yang tidak memiliki kursus)`);
    if (!ok) return;
    setIsBulkWorking(true);
    try {
      const results = await Promise.allSettled(
        removable.map((id) =>
          fetch(`/api/dashboard/admin/instructors/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(async (res) => {
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Gagal menonaktifkan instruktur');
            return true;
          })
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) toast.success(`Berhasil menonaktifkan ${succeeded} instruktur`);
      if (failed > 0) toast.error(`${failed} instruktur gagal dinonaktifkan`);
      setSelectedIds(new Set());
      setRows([]);
      setNextCursor(null);
      await fetchInstructors({ reset: true });
    } finally {
      setIsBulkWorking(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Instruktur</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola instruktur (mentor) dan kursus yang diajarkan.</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Tambah Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari instruktur / email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
            />
          </div>
          <button
            onClick={() => {
              setSelectedIds(new Set());
              setRows([]);
              setNextCursor(null);
              fetchInstructors({ reset: true });
            }}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Terapkan
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as any)}
              className="w-full sm:w-56 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium"
            >
              <option value="NONAKTIFKAN">Nonaktifkan</option>
            </select>
            <button
              onClick={applyBulk}
              disabled={isBulkWorking}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center"
            >
              {isBulkWorking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Apply
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Status instruktur: <span className="font-extrabold text-slate-700">Disetujui</span>
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-rose-700">{error}</div> : null}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-extrabold w-10">
                  <input type="checkbox" checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))} onChange={toggleAllOnPage} />
                </th>
                <th className="px-4 py-3 font-extrabold">Nama</th>
                <th className="px-4 py-3 font-extrabold">Email</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Total Kursus</th>
                <th className="px-4 py-3 font-extrabold whitespace-nowrap">Total Siswa</th>
                <th className="px-4 py-3 font-extrabold">Status</th>
                <th className="px-4 py-3 font-extrabold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-600">
                    Tidak ada data instruktur.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="text-slate-700">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} />
                    </td>
                    <td className="px-4 py-3 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        {r.avatarUrl ? (
                          <Image
                            src={r.avatarUrl}
                            alt={r.name}
                            width={36}
                            height={36}
                            unoptimized
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-extrabold text-indigo-700">
                            {initials(r.name || r.email)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">{r.name}</div>
                          <div className="text-xs text-slate-500">Bergabung: {formatDateTime(r.createdAt)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.totalCourses}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.totalStudents}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Disetujui
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(r.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/dashboard/admin/users?q=${encodeURIComponent(r.email)}`}
                          className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          aria-label="Buka di Pengguna"
                          title="Buka di Pengguna"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => {
                            if (r.totalCourses > 0) {
                              toast.error('Tidak bisa menonaktifkan: instruktur masih memiliki kursus');
                              return;
                            }
                            const ok = window.confirm('Nonaktifkan instruktur ini?');
                            if (!ok) return;
                            demoteInstructor(r.id);
                          }}
                          aria-label="Nonaktifkan"
                          title={r.totalCourses > 0 ? 'Tidak bisa: masih memiliki kursus' : 'Nonaktifkan'}
                          className={twMerge(
                            'inline-flex items-center justify-center p-2 rounded-xl border',
                            r.totalCourses > 0
                              ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                              : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          )}
                          disabled={r.totalCourses > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={() => fetchInstructors({ reset: false })}
            disabled={!nextCursor || isLoading}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-50 disabled:opacity-60 inline-flex items-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Muat lebih banyak
          </button>
        </div>
      </div>

      {addModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAddModalOpen(false);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Tambah Instruktur</div>
                <div className="text-lg font-extrabold text-slate-900">Pilih Pengguna</div>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    value={studentsSearch}
                    onChange={(e) => setStudentsSearch(e.target.value)}
                    placeholder="Cari pengguna / email..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                  />
                </div>
                <div className="text-xs font-extrabold text-slate-600 text-right">Dipilih: {selectedStudentIds.size}</div>
              </div>

              {studentsError ? <div className="text-sm text-rose-700">{studentsError}</div> : null}
              {isLoadingStudents ? (
                <div className="p-8 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat pengguna...
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[45vh] overflow-auto divide-y divide-slate-200">
                    {filteredStudents.length === 0 ? (
                      <div className="p-6 text-sm text-slate-600">Tidak ada pengguna.</div>
                    ) : (
                      filteredStudents.map((s) => (
                        <label key={s.id} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={selectedStudentIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
                              <UserRound className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-900 truncate">{s.name || s.email}</div>
                              <div className="text-xs text-slate-500 truncate">{s.email}</div>
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-white">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-extrabold text-sm hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={promoteStudents}
                disabled={isPromoting}
                className={twMerge(
                  'px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 inline-flex items-center',
                  isPromoting ? 'opacity-60' : ''
                )}
              >
                {isPromoting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeEdit();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Edit Instruktur</div>
                <div className="text-lg font-extrabold text-slate-900">{detail?.instructor.name || 'Instruktur'}</div>
                {detail ? <div className="text-xs text-slate-500 mt-1">{detail.instructor.email}</div> : null}
              </div>
              <button onClick={closeEdit} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
              {detailError ? <div className="text-sm text-rose-700">{detailError}</div> : null}
              {isLoadingDetail ? (
                <div className="p-8 flex items-center justify-center text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat...
                </div>
              ) : detail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-extrabold text-slate-700 mb-1">Nama</div>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nama instruktur"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-slate-700 mb-1">Avatar URL</div>
                        <input
                          value={editAvatarUrl}
                          onChange={(e) => setEditAvatarUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs font-extrabold text-slate-500">Ringkasan</div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="text-slate-600">Total Kursus</div>
                          <div className="font-extrabold text-slate-900">{detail.courses.length}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-slate-600">Bergabung</div>
                          <div className="font-extrabold text-slate-900">{formatDateTime(detail.instructor.createdAt)}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-slate-600">Status</div>
                          <div className="font-extrabold text-emerald-700">Disetujui</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700">Kursus yang Diajar</div>
                    <div className="divide-y divide-slate-200">
                      {detail.courses.length === 0 ? (
                        <div className="p-4 text-sm text-slate-600">Belum ada kursus.</div>
                      ) : (
                        detail.courses.map((c) => (
                          <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/dashboard/admin/courses/${encodeURIComponent(c.id)}`}
                                className="font-extrabold text-slate-900 hover:text-indigo-700 hover:underline truncate"
                              >
                                {c.title}
                              </Link>
                              <div className="text-xs text-slate-500">
                                {c.slug} • {c.status} • {formatDateTime(c.createdAt)}
                              </div>
                            </div>
                            <Link
                              href={`/dashboard/admin/courses/${encodeURIComponent(c.id)}`}
                              className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              aria-label="Buka kursus"
                              title="Buka kursus"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-white">
              <button
                onClick={closeEdit}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-extrabold text-sm hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving || !editId}
                className={twMerge(
                  'px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm hover:bg-indigo-700 inline-flex items-center',
                  isSaving ? 'opacity-60' : ''
                )}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
