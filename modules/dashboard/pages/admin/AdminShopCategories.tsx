"use client";

import { useMemo, useState } from 'react';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Plus, Search, Edit2, Trash2, Tags } from 'lucide-react';
import { toast } from 'sonner';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CategoryForm = {
  id?: string;
  name: string;
  slug: string;
  description: string;
};

type CategoryPermissions = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

function normalizeForm(value: Partial<CategoryRow>): CategoryForm {
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    name: typeof value.name === 'string' ? value.name : '',
    slug: typeof value.slug === 'string' ? value.slug : '',
    description: typeof value.description === 'string' ? value.description : '',
  };
}

export default function AdminShopCategories({
  categories: initialCategories,
  permissions,
}: {
  categories: CategoryRow[];
  permissions?: Partial<CategoryPermissions>;
}) {
  const canCreate = permissions?.canCreate !== false;
  const canEdit = permissions?.canEdit !== false;
  const canDelete = permissions?.canDelete !== false;

  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editorValue, setEditorValue] = useState<CategoryForm>({ name: '', slug: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const isAllVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    const set = new Set(selectedIds);
    return visibleIds.every((id) => set.has(id));
  }, [selectedIds, visibleIds]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) prevSet.add(id);
      return Array.from(prevSet);
    });
  };

  const metrics = [
    { label: 'Total Kategori', value: categories.length, color: 'bg-blue-500' },
    { label: 'Digunakan Produk', value: '-', color: 'bg-indigo-500' },
  ];

  const openCreate = () => {
    if (!canCreate) {
      toast.error('Anda tidak memiliki izin untuk menambahkan kategori');
      return;
    }
    setEditorMode('CREATE');
    setEditorValue({ name: '', slug: '', description: '' });
    setEditorOpen(true);
  };

  const openEdit = (row: CategoryRow) => {
    if (!canEdit) {
      toast.error('Anda tidak memiliki izin untuk mengubah kategori');
      return;
    }
    setEditorMode('EDIT');
    setEditorValue(normalizeForm(row));
    setEditorOpen(true);
  };

  const save = async () => {
    if (!editorValue.name.trim()) {
      toast.error('Nama kategori wajib diisi');
      return;
    }

    const isEdit = editorMode === 'EDIT' && !!editorValue.id;
    if (isEdit && !canEdit) {
      toast.error('Anda tidak memiliki izin untuk mengubah kategori');
      return;
    }
    if (!isEdit && !canCreate) {
      toast.error('Anda tidak memiliki izin untuk menambahkan kategori');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: editorValue.name.trim(),
        slug: editorValue.slug.trim(),
        description: editorValue.description.trim(),
      };

      const url = isEdit ? `/api/shop/categories/${editorValue.id}` : '/api/shop/categories';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan kategori');

      if (isEdit) {
        setCategories((prev) => prev.map((c) => (c.id === data.id ? data : c)));
        toast.success('Kategori berhasil diperbarui');
      } else {
        setCategories((prev) => [data, ...prev]);
        toast.success('Kategori berhasil ditambahkan');
      }

      setEditorOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan kategori');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!canDelete) {
      toast.error('Anda tidak memiliki izin untuk menghapus kategori');
      setDeleteConfirm({ isOpen: false, id: null });
      return;
    }
    if (!deleteConfirm.id) {
      setDeleteConfirm({ isOpen: false, id: null });
      return;
    }

    try {
      const res = await fetch(`/api/shop/categories/${deleteConfirm.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus kategori');
      setCategories((prev) => prev.filter((c) => c.id !== deleteConfirm.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirm.id));
      toast.success(data.message || 'Kategori berhasil dihapus');
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus kategori');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const columns = useMemo(() => {
    const cols: any[] = [];

    if (canDelete) {
      cols.push({
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/40"
              checked={isAllVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visibleIds.length === 0 || isBulkDeleting}
              aria-label="Pilih semua kategori"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-14',
        cell: (_val: unknown, row: CategoryRow) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={selectedIds.includes(row.id)}
              onChange={() => toggleOne(row.id)}
              disabled={isBulkDeleting}
              aria-label={`Pilih kategori ${row.name}`}
            />
          </div>
        ),
      });
    }

    cols.push(
      {
        header: 'Nama',
        accessorKey: 'name',
        cell: (val: string) => <div className="font-bold text-slate-900">{val}</div>,
      },
      { header: 'Slug', accessorKey: 'slug', cell: (val: string) => <span className="font-mono text-xs text-slate-600">{val}</span> },
      {
        header: 'Deskripsi',
        accessorKey: 'description',
        cell: (val: string | null) => <div className="text-sm text-slate-600 line-clamp-1">{val || '-'}</div>,
      }
    );

    if (canEdit || canDelete) {
      cols.push({
        header: 'Aksi',
        accessorKey: 'id',
        cell: (_id: string, row: CategoryRow) => (
          <div className="flex items-center justify-end gap-2">
            {canEdit ? (
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: true, id: row.id })}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Hapus"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        ),
      });
    }

    return cols;
  }, [canDelete, canEdit, isAllVisibleSelected, isBulkDeleting, selectedIds, toggleAllVisible, visibleIds.length]);

  const handleBulkDelete = async () => {
    if (!canDelete) return;
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 kategori');
      return;
    }
    if (!confirm(`Hapus ${selectedIds.length} kategori terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;

    setIsBulkDeleting(true);
    const ids = [...selectedIds];
    const deletedIds = new Set<string>();
    let failed = 0;

    try {
      for (const id of ids) {
        const res = await fetch(`/api/shop/categories/${id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed += 1;
          continue;
        }
        deletedIds.add(id);
        if (data?.message) toast.success(data.message);
      }

      if (deletedIds.size > 0) setCategories((prev) => prev.filter((c) => !deletedIds.has(c.id)));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.has(id)));

      if (failed === 0) toast.success(`Berhasil menghapus ${ids.length} kategori`);
      else toast.error(`${failed} kategori gagal dihapus`);
    } catch {
      toast.error('Gagal menghapus kategori terpilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kategori Produk</h1>
          <p className="text-slate-500 text-sm mt-1">Tambah dan kelola kategori untuk produk toko.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!canCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari kategori..."
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between">
          {canDelete ? (
            <>
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
                {selectedIds.length ? `${selectedIds.length} dipilih` : `${filtered.length} item`}
              </div>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0 || isBulkDeleting}
                className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
              >
                Hapus Terpilih
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-500 font-medium">{filtered.length} item</div>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        {filtered.length > 0 ? (
          <Table columns={columns} data={filtered} isLoading={false} />
        ) : (
          <EmptyState
            icon={Tags}
            title="Tidak ada kategori"
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : 'Belum ada kategori yang ditambahkan.'}
            action={
              !searchQuery
                ? {
                    label: 'Tambah Kategori Baru',
                    onClick: openCreate,
                  }
                : undefined
            }
          />
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filtered.length === 0 ? (
          <EmptyState icon={Tags} title="Tidak ada kategori" description="Belum ada data kategori untuk ditampilkan." />
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                {canDelete ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 mt-1"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleOne(c.id)}
                    disabled={isBulkDeleting}
                    aria-label={`Pilih kategori ${c.name}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 line-clamp-1">{c.name}</div>
                  <div className="font-mono text-xs text-slate-500">{c.slug}</div>
                </div>
              </div>
              <div className="text-sm text-slate-600 line-clamp-2">{c.description || '-'}</div>
              {canEdit || canDelete ? (
                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Edit
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ isOpen: true, id: c.id })}
                      className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Hapus
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">
                {editorMode === 'CREATE' ? 'Tambah Kategori' : 'Edit Kategori'}
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Nama</label>
                <input
                  value={editorValue.name}
                  onChange={(e) => setEditorValue((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Contoh: Tools Geologi"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                <input
                  value={editorValue.slug}
                  onChange={(e) => setEditorValue((prev) => ({ ...prev, slug: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="tools-geologi"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Deskripsi (opsional)</label>
                <textarea
                  rows={4}
                  value={editorValue.description}
                  onChange={(e) => setEditorValue((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Kategori?"
        description="Kategori yang dipakai oleh produk tidak bisa dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
