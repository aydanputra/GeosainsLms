"use client";

import { useCallback, useMemo, useState } from 'react';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, Trash2, Eye, Globe, Save } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';
import PageEditor from '@/modules/pages/components/PageEditor';

interface AdminPagesProps {
  pages: any[];
}

export default function AdminPages({ pages: initialPages }: AdminPagesProps) {
  const [pages, setPages] = useState(initialPages);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [editorState, setEditorState] = useState<{ isOpen: boolean; page: any | null; isLoading: boolean }>({
    isOpen: false,
    page: null,
    isLoading: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const editorFormId = 'page-editor-form';

  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleIds = useMemo(() => filteredPages.map((p) => p.id as string), [filteredPages]);
  const isAllVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    const set = new Set(selectedIds);
    return visibleIds.every((id) => set.has(id));
  }, [selectedIds, visibleIds]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  }, [visibleIds]);

  const metrics = [
    { label: 'Total Halaman', value: pages.length, color: 'bg-blue-500' },
    { label: 'Terbit', value: pages.filter(p => p.published).length, color: 'bg-green-500' },
    { label: 'Draft', value: pages.filter(p => !p.published).length, color: 'bg-gray-500' },
  ];

  const columns = useMemo(() => {
    return [
      {
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/40"
              checked={isAllVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visibleIds.length === 0 || isBulkDeleting}
              aria-label="Pilih semua halaman"
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
              disabled={isBulkDeleting}
              aria-label={`Pilih halaman ${row.title}`}
            />
          </div>
        ),
      },
      {
        header: 'Judul Halaman',
        accessorKey: 'title',
        cell: (val: string) => <div className="font-medium text-slate-900">{val}</div>,
      },
      {
        header: 'Slug',
        accessorKey: 'slug',
        cell: (val: string) => (
          <span className="text-slate-500 font-mono text-xs bg-slate-50 px-2 py-1 rounded">/{val}</span>
        ),
      },
      {
        header: 'Status',
        accessorKey: 'published',
        cell: (val: boolean) => (
          <span
            className={twMerge(
              "px-2.5 py-0.5 rounded-full text-xs font-medium border",
              val ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"
            )}
          >
            {val ? 'Terbit' : 'Draft'}
          </span>
        ),
      },
    ];
  }, [isAllVisibleSelected, isBulkDeleting, selectedIds, toggleAllVisible, visibleIds.length]);

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const refreshPages = async () => {
    try {
      const res = await fetch('/api/pages');
      if (!res.ok) throw new Error('Gagal memuat halaman');
      const data = await res.json();
      setPages(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat halaman');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) {
      setDeleteConfirm({ isOpen: false, id: null });
      return;
    }

    try {
      const res = await fetch(`/api/pages/${deleteConfirm.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghapus halaman');
      }
      toast.success('Halaman berhasil dihapus');
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirm.id));
      await refreshPages();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus halaman');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const openEditorForCreate = () => {
    setIsSaving(false);
    setEditorState({
      isOpen: true,
      isLoading: false,
      page: { title: '', slug: '', published: false, blocks: [] },
    });
  };

  const openEditorForPage = async (page: any) => {
    setIsSaving(false);
    setEditorState({ isOpen: true, page: null, isLoading: true });
    try {
      const res = await fetch(`/api/pages/${page.slug}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal memuat detail halaman');
      }
      const fullPage = await res.json();
      setEditorState({ isOpen: true, page: fullPage, isLoading: false });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat detail halaman');
      setEditorState({ isOpen: false, page: null, isLoading: false });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 halaman');
      return;
    }
    if (!confirm(`Hapus ${selectedIds.length} halaman terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;

    setIsBulkDeleting(true);
    let failed = 0;
    try {
      for (const id of selectedIds) {
        const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' });
        if (!res.ok) failed += 1;
      }

      if (failed === 0) toast.success(`Berhasil menghapus ${selectedIds.length} halaman`);
      else toast.error(`${failed} halaman gagal dihapus`);

      setSelectedIds([]);
      await refreshPages();
    } catch {
      toast.error('Gagal menghapus halaman terpilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Halaman / Situs</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola halaman statis dan informasi situs.</p>
        </div>
        <button
          onClick={openEditorForCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Tambah Halaman
        </button>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      {/* Floating Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Cari halaman..." 
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
          <div className="text-xs text-slate-500 font-medium">{selectedIds.length ? `${selectedIds.length} dipilih` : `${filteredPages.length} item`}</div>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0 || isBulkDeleting}
            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
          >
            Hapus Terpilih
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        {filteredPages.length > 0 ? (
          <Table 
            columns={columns} 
            data={filteredPages} 
            isLoading={false}
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
                <a
                  href={`/${row.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Lihat"
                >
                  <Eye className="w-4 h-4" />
                </a>
                <button
                  onClick={() => openEditorForPage(row)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => handleDelete(row.id)}
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          />
        ) : (
          <EmptyState 
            icon={Globe} 
            title="Tidak ada halaman ditemukan" 
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : "Belum ada halaman yang dibuat."}
          />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredPages.length === 0 ? (
          <EmptyState 
            icon={Globe} 
            title="Tidak ada halaman" 
            description="Belum ada data halaman untuk ditampilkan."
          />
        ) : (
          filteredPages.map((page) => (
            <div key={page.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 mt-1"
                  checked={selectedIds.includes(page.id)}
                  onChange={() => toggleOne(page.id)}
                  disabled={isBulkDeleting}
                  aria-label={`Pilih halaman ${page.title}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{page.title}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">/{page.slug}</p>
                    </div>
                    <span
                      className={twMerge(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                        page.published ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {page.published ? 'Terbit' : 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <a
                  href={`/${page.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Lihat
                </a>
                <button
                  onClick={() => openEditorForPage(page)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(page.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Halaman?"
        description="Apakah Anda yakin ingin menghapus halaman ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />

      {editorState.isOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-50 w-full h-full overflow-hidden border border-slate-200 shadow-2xl flex flex-col">
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-10">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {editorState.page?.id ? 'Edit Halaman' : 'Tambah Halaman'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Susun layout dengan section, kolom, dan widget.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  form={editorFormId}
                  disabled={editorState.isLoading || !editorState.page || isSaving}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-bold text-sm"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  onClick={() => setEditorState({ isOpen: false, page: null, isLoading: false })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm"
                >
                  Tutup
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {editorState.isLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
                  Memuat editor...
                </div>
              ) : editorState.page ? (
                <PageEditor
                  initialData={editorState.page}
                  formId={editorFormId}
                  hideFooterActions
                  onSavingChange={setIsSaving}
                  closeAfterSave={false}
                  onSaved={async (saved) => {
                    if (saved) setEditorState((prev) => ({ ...prev, page: saved }));
                    await refreshPages();
                  }}
                  onSuccess={async () => {
                    setEditorState({ isOpen: false, page: null, isLoading: false });
                    await refreshPages();
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
