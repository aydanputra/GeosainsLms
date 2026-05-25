"use client";

import Table from '../../components/Tables';
import Link from 'next/link';
import EmptyState from '../../components/EmptyState';
import Cards from '../../components/Cards';
import { Filter, Plus, Search, Edit2, Trash2, Eye, BookOpen, Package, Copy } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface MentorCoursesProps {
  courses: any[];
}

export default function MentorCourses({ courses }: MentorCoursesProps) {
  type ItemTypeFilter = 'ALL' | 'COURSE' | 'BUNDLE';
  type PublishFilter = 'ALL' | 'PUBLISHED' | 'DRAFT';

  type UnifiedRow = {
    id: string;
    itemType: 'COURSE';
    title: string;
    slug: string;
    price: number;
    status: 'PUBLISHED' | 'DRAFT';
    createdAt: string;
    instructorName: string;
    countLabel: string;
    publicUrl: string;
    manageUrl: string;
  };

  const [courseItems, setCourseItems] = useState<any[]>(courses);
  const [filterStatus, setFilterStatus] = useState<PublishFilter>('ALL');
  const [filterType, setFilterType] = useState<ItemTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const router = useRouter();

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const unifiedRows: UnifiedRow[] = useMemo(
    () =>
      (Array.isArray(courseItems) ? courseItems : []).map((c) => ({
        id: String(c.id),
        itemType: 'COURSE' as const,
        title: String(c.title || ''),
        slug: String(c.slug || ''),
        price: Number(c.price || 0) || 0,
        status: c.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        createdAt: String(c.createdAt || ''),
        instructorName: String(c.instructorName || 'Mentor'),
        countLabel: `${Number(c.totalStudents || 0) || 0} siswa`,
        publicUrl: c.slug ? `/courses/${encodeURIComponent(String(c.slug))}` : '/courses',
        manageUrl: `/dashboard/mentor/courses/${encodeURIComponent(String(c.id))}/edit`,
      })),
    [courseItems]
  );

  const filteredRows = unifiedRows
    .filter((row) => {
      if (filterType === 'COURSE') return row.itemType === 'COURSE';
      if (filterType === 'BUNDLE') return false;
      return true;
    })
    .filter((row) => {
      if (filterStatus === 'PUBLISHED') return row.status === 'PUBLISHED';
      if (filterStatus === 'DRAFT') return row.status === 'DRAFT';
      return true;
    })
    .filter((row) => {
      if (!normalizedQuery) return true;
      return row.title.toLowerCase().includes(normalizedQuery) || row.slug.toLowerCase().includes(normalizedQuery);
    });

  const selectableCourseIds = filteredRows.map((r) => r.id);
  const allFilteredSelected = selectableCourseIds.length > 0 && selectableCourseIds.every((id) => selectedCourseIds.includes(id));

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds((prev) => (prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]));
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedCourseIds((prev) => prev.filter((id) => !selectableCourseIds.includes(id)));
      return;
    }
    setSelectedCourseIds((prev) => Array.from(new Set([...prev, ...selectableCourseIds])));
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kursus ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || data?.message || 'Gagal menghapus kursus');
        return;
      }
      setCourseItems((prev) => prev.filter((c) => String(c.id) !== courseId));
      setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
      alert('Kursus berhasil dihapus');
    } catch {
      alert('Terjadi kesalahan saat menghapus kursus');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCourseIds.length === 0) {
      alert('Pilih minimal 1 kursus terlebih dahulu');
      return;
    }

    if (!confirm(`Hapus ${selectedCourseIds.length} kursus terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;

    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/courses/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedCourseIds }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || data.message || 'Gagal menghapus kursus terpilih');
        return;
      }

      const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds : [];
      setCourseItems((prev) => prev.filter((c) => !deletedIds.includes(String(c.id))));
      setSelectedCourseIds([]);
      alert(data.message || 'Kursus terpilih berhasil dihapus');
    } catch {
      alert('Terjadi kesalahan saat menghapus kursus terpilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDuplicate = async (courseId: string) => {
    if (!confirm('Salin kursus ini? Kursus baru akan dibuat sebagai Draft.')) return;
    setDuplicatingId(courseId);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/duplicate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Gagal menyalin kursus');
        return;
      }
      const redirectUrl = typeof data?.redirectUrl === 'string' && data.redirectUrl.trim() ? data.redirectUrl.trim() : '';
      if (redirectUrl) {
        router.push(redirectUrl);
        return;
      }
      router.refresh();
    } catch {
      alert('Terjadi kesalahan saat menyalin kursus');
    } finally {
      setDuplicatingId(null);
    }
  };

  const metrics = [
    { label: 'Total Kursus', value: unifiedRows.length, color: 'bg-blue-500' },
    { label: 'Kursus Terbit', value: unifiedRows.filter((r) => r.status === 'PUBLISHED').length, color: 'bg-emerald-600' },
    { label: 'Bundel Kursus', value: 0, color: 'bg-indigo-600' },
    {
      label: 'Jumlah Siswa',
      value: (Array.isArray(courseItems) ? courseItems : []).reduce((sum, c: any) => sum + Number(c?.totalStudents || 0), 0),
      color: 'bg-indigo-600',
    },
  ];

  const columns = [
    {
      header: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleSelectAllFiltered}
          className="h-4 w-4 rounded border-white/40 bg-white/10"
          aria-label="Pilih semua kursus"
        />
      ),
      accessorKey: 'selected',
      className: 'w-14',
      cell: (_val: unknown, row: UnifiedRow) => (
        <input
          type="checkbox"
          checked={selectedCourseIds.includes(row.id)}
          onChange={() => toggleCourseSelection(row.id)}
          className="h-4 w-4 rounded border-slate-300"
          aria-label={`Pilih kursus ${row.title}`}
        />
      ),
    },
    {
      header: 'Judul',
      accessorKey: 'title',
      cell: (val: string) => (
        <div className="space-y-0.5">
          <div className="font-medium text-slate-900 line-clamp-2">{val}</div>
          <div className="text-xs text-slate-500">Kursus</div>
        </div>
      ),
    },
    {
      header: 'Pengelola',
      accessorKey: 'instructorName',
      cell: (val: string) => <div className="hidden md:block text-slate-600">{val}</div>,
    },
    { header: 'Harga', accessorKey: 'price', cell: (val: number) => `IDR ${val.toLocaleString('id-ID')}` },
    { header: 'Jumlah', accessorKey: 'countLabel', cell: (val: string) => <span className="text-slate-600">{val}</span> },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (val: string) => {
        const isPublished = val === 'PUBLISHED';
        return (
          <span
            className={twMerge(
              'px-3 py-1 rounded-full text-xs font-medium',
              isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            )}
          >
            {isPublished ? 'Aktif' : 'Draft'}
          </span>
        );
      },
    },
    {
      header: 'Tanggal',
      accessorKey: 'createdAt',
      cell: (val: string) => <span className="hidden lg:block text-slate-500 text-xs">{new Date(val).toLocaleDateString('id-ID')}</span>,
    },
    {
      header: 'Aksi',
      accessorKey: 'id',
      cell: (_val: string, row: UnifiedRow) => (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => handleDuplicate(row.id)}
            disabled={duplicatingId === row.id}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-60"
            title="Duplikat"
          >
            {duplicatingId === row.id ? <span className="w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" /> : <Copy className="w-4 h-4" />}
          </button>
          <Link
            href={row.publicUrl}
            target="_blank"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="Lihat Publik"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <Link
            href={row.manageUrl}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Kelola"
          >
            <Edit2 className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(row.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Hapus"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Kursus</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola semua materi pembelajaran dan instruktur.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/mentor/course-bundles?new=1"
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 text-sm font-bold transition-colors"
          >
            <Package className="w-4 h-4" /> Tambah Bundel
          </Link>
          <Link
            href="/dashboard/mentor/courses/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tambah Kursus
          </Link>
        </div>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari kursus / bundel..."
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {selectedCourseIds.length > 0 ? (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-60"
            >
              {isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedCourseIds.length})`}
            </button>
          ) : null}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
            <Package className="w-4 h-4 text-slate-500" />
            <select
              className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ItemTypeFilter)}
            >
              <option value="ALL">Bundel & Kursus</option>
              <option value="COURSE">Kursus</option>
              <option value="BUNDLE">Bundel</option>
            </select>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white transition-colors">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as PublishFilter)}
            >
              <option value="ALL">Semua Status</option>
              <option value="PUBLISHED">Terbit</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        {filteredRows.length > 0 ? (
          <Table columns={columns} data={filteredRows} isLoading={false} />
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Tidak ada data ditemukan"
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : 'Belum ada kursus untuk ditampilkan.'}
          />
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filteredRows.length === 0 ? (
          <EmptyState icon={BookOpen} title="Tidak ada data" description="Belum ada kursus untuk ditampilkan." />
        ) : (
          filteredRows.map((row) => (
            <div key={`${row.itemType}-${row.id}`} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedCourseIds.includes(row.id)}
                    onChange={() => toggleCourseSelection(row.id)}
                    className="h-4 w-4 rounded border-slate-300 mt-1"
                    aria-label={`Pilih kursus ${row.title}`}
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 line-clamp-2">{row.title}</h3>
                    <div className="text-xs text-slate-500 mt-0.5">Kursus</div>
                  </div>
                </div>
                <span
                  className={twMerge(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ml-2',
                    row.status === 'PUBLISHED'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  )}
                >
                  {row.status === 'PUBLISHED' ? 'Aktif' : 'Draft'}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>{row.instructorName}</span>
                <span className="font-medium text-slate-900">IDR {row.price.toLocaleString('id-ID')}</span>
              </div>

              <div className="text-xs text-slate-500">{row.countLabel}</div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <Link
                  href={row.publicUrl}
                  target="_blank"
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  Lihat
                </Link>
                <Link
                  href={row.manageUrl}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Kelola
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
