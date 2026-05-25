"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Plus, Search, Edit2, Trash2, Eye, FileText } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

export default function ArticleList({
  posts: initialPosts,
  basePath,
  canManage,
}: {
  posts: any[];
  basePath: string;
  canManage: boolean;
}) {
  const [posts, setPosts] = useState<any[]>(Array.isArray(initialPosts) ? initialPosts : []);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{ isOpen: boolean; ids: string[] }>({ isOpen: false, ids: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => String(post.title || '').toLowerCase().includes(q));
  }, [posts, searchQuery]);

  const visibleIds = useMemo(() => filteredPosts.map((p) => String(p.id)), [filteredPosts]);
  const isAllVisibleSelected = useMemo(() => {
    if (!canManage) return false;
    if (visibleIds.length === 0) return false;
    const set = new Set(selectedIds);
    return visibleIds.every((id) => set.has(id));
  }, [canManage, selectedIds, visibleIds]);

  const toggleOne = (id: string) => {
    if (!canManage) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    if (!canManage) return;
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  };

  const metrics = [
    { label: 'Total Artikel', value: posts.length, color: 'bg-blue-500' },
    { label: 'Terbit', value: posts.filter((p) => p.published).length, color: 'bg-green-500' },
    { label: 'Draft', value: posts.filter((p) => !p.published).length, color: 'bg-gray-500' },
  ];

  const columns = useMemo(() => {
    const base = [
      { header: 'Judul', accessorKey: 'title', cell: (val: string) => <div className="font-bold text-slate-900 line-clamp-1">{val}</div> },
      { header: 'Kategori', accessorKey: 'categoryName', cell: (val: string) => <div className="text-slate-600 line-clamp-1">{val || '-'}</div> },
      {
        header: 'Tag',
        accessorKey: 'tagNames',
        cell: (val: string[]) => (
          <div className="text-slate-600 line-clamp-1">{Array.isArray(val) && val.length ? val.join(', ') : '-'}</div>
        ),
      },
      { header: 'Penulis', accessorKey: 'authorName', cell: (val: string) => <div className="text-slate-600 line-clamp-1">{val}</div> },
      {
        header: 'Status',
        accessorKey: 'published',
        cell: (val: boolean) => (
          <span
            className={twMerge(
              'px-2.5 py-0.5 rounded-full text-xs font-bold border',
              val ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-700 border-slate-200'
            )}
          >
            {val ? 'Terbit' : 'Draft'}
          </span>
        ),
      },
    ];

    if (!canManage) return base;

    return [
      {
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={isAllVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visibleIds.length === 0 || isBulkDeleting}
              aria-label="Pilih semua artikel"
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
              checked={selectedIds.includes(String(row.id))}
              onChange={() => toggleOne(String(row.id))}
              disabled={isBulkDeleting}
              aria-label={`Pilih artikel ${row.title || ''}`}
            />
          </div>
        ),
      },
      ...base,
    ];
  }, [canManage, isAllVisibleSelected, isBulkDeleting, selectedIds, toggleAllVisible, toggleOne, visibleIds]);

  const confirmDelete = async () => {
    if (!deleteConfirm.id) {
      setDeleteConfirm({ isOpen: false, id: null });
      return;
    }
    try {
      const res = await fetch(`/api/blog/posts/${deleteConfirm.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus artikel');
      setPosts((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
      toast.success('Artikel berhasil dihapus');
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus artikel');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const confirmBulkDelete = async () => {
    const ids = Array.isArray(bulkDeleteConfirm.ids) ? bulkDeleteConfirm.ids : [];
    setBulkDeleteConfirm({ isOpen: false, ids: [] });
    if (!canManage) return;
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const successIds: string[] = [];
      const failed: Array<{ id: string; error: string }> = [];
      for (const id of ids) {
        try {
          const res = await fetch(`/api/blog/posts/${id}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Gagal menghapus artikel');
          successIds.push(id);
        } catch (e: any) {
          failed.push({ id, error: e?.message || 'Gagal menghapus artikel' });
        }
      }

      if (successIds.length > 0) {
        const successSet = new Set(successIds);
        setPosts((prev) => prev.filter((p) => !successSet.has(String(p.id))));
        setSelectedIds((prev) => prev.filter((id) => !successSet.has(id)));
      }

      if (failed.length === 0) {
        toast.success(`Berhasil menghapus ${successIds.length} artikel`);
      } else if (successIds.length === 0) {
        toast.error('Gagal menghapus artikel terpilih');
      } else {
        toast.success(`Berhasil menghapus ${successIds.length} artikel, ${failed.length} gagal`);
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Artikel</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola artikel dan konten edukasi.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${basePath}/categories`}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
          >
            Kategori
          </Link>
          <Link
            href={`${basePath}/tags`}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
          >
            Tag
          </Link>
          <Link
            href={`${basePath}/new`}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tambah Artikel
          </Link>
        </div>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari artikel..."
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between">
            <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={isAllVisibleSelected}
                onChange={toggleAllVisible}
                disabled={visibleIds.length === 0 || isBulkDeleting}
              />
              Pilih semua
            </label>
            <div className="text-xs text-slate-500 font-medium">
              {selectedIds.length ? `${selectedIds.length} dipilih` : `${filteredPosts.length} item`}
            </div>
            <button
              type="button"
              onClick={() => setBulkDeleteConfirm({ isOpen: true, ids: selectedIds })}
              disabled={selectedIds.length === 0 || isBulkDeleting}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
            >
              Hapus Terpilih
            </button>
          </div>
        ) : null}
      </div>

      <div className="hidden md:block">
        {filteredPosts.length > 0 ? (
          <Table
            columns={columns}
            data={filteredPosts}
            isLoading={false}
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
                {row?.slug ? (
                  <Link
                    href={`/blog/${row.slug}`}
                    target="_blank"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Lihat"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Lihat"
                    disabled
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <Link
                  href={`${basePath}/${row.id}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </Link>
                {canManage ? (
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    onClick={() => setDeleteConfirm({ isOpen: true, id: row.id })}
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            )}
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Tidak ada artikel ditemukan"
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : 'Belum ada artikel yang ditambahkan.'}
          />
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filteredPosts.length === 0 ? (
          <EmptyState icon={FileText} title="Tidak ada artikel" description="Belum ada data artikel untuk ditampilkan." />
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 line-clamp-2">{post.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {post.categoryName ? `Kategori: ${post.categoryName}` : 'Tanpa kategori'}
                  </div>
                </div>
                {canManage ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 mt-1"
                    checked={selectedIds.includes(String(post.id))}
                    onChange={() => toggleOne(String(post.id))}
                    disabled={isBulkDeleting}
                    aria-label={`Pilih artikel ${post.title || ''}`}
                  />
                ) : null}
                <span
                  className={twMerge(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap',
                    post.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                  )}
                >
                  {post.published ? 'Terbit' : 'Draft'}
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                {post?.slug ? (
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Lihat
                  </Link>
                ) : null}
                <Link
                  href={`${basePath}/${post.id}`}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </Link>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isOpen: true, id: post.id })}
                    className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {canManage ? (
        <>
          <ConfirmDialog
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
            onConfirm={confirmDelete}
            title="Hapus Artikel?"
            description="Apakah Anda yakin ingin menghapus artikel ini? Tindakan ini tidak dapat dibatalkan."
            confirmText="Hapus"
            cancelText="Batal"
            variant="danger"
          />
          <ConfirmDialog
            isOpen={bulkDeleteConfirm.isOpen}
            onClose={() => setBulkDeleteConfirm({ isOpen: false, ids: [] })}
            onConfirm={confirmBulkDelete}
            title={`Hapus ${bulkDeleteConfirm.ids.length} Artikel?`}
            description="Apakah Anda yakin ingin menghapus semua artikel yang dipilih? Tindakan ini tidak dapat dibatalkan."
            confirmText={isBulkDeleting ? 'Menghapus...' : 'Hapus'}
            cancelText="Batal"
            variant="danger"
          />
        </>
      ) : null}
    </div>
  );
}
