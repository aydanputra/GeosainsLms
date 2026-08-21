"use client";

import { useCallback, useMemo, useState } from 'react';
import Table from '../../components/Tables';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface AdminCategoriesProps {
  categories: Category[];
}

export default function AdminCategories({ categories: initialCategories }: AdminCategoriesProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleIds = useMemo(() => filteredCategories.map((c) => c.id), [filteredCategories]);
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
              aria-label="Pilih semua kategori"
            />
          </div>
        ),
        accessorKey: 'selected',
        className: 'w-14',
        cell: (_val: unknown, row: Category) => (
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
      },
      {
        header: 'Nama Kategori',
        accessorKey: 'name',
        cell: (val: string) => <div className="font-medium text-slate-900">{val}</div>,
      },
      { header: 'Slug', accessorKey: 'slug', cell: (val: string) => <span className="text-slate-500 font-mono text-xs">/{val}</span> },
      {
        header: 'Jumlah Kursus',
        accessorKey: 'count',
        cell: (val: number) => (
          <div className="text-center w-16 bg-slate-100 rounded-full py-0.5 text-xs font-medium text-slate-600">{val}</div>
        ),
      },
    ];
  }, [isAllVisibleSelected, isBulkDeleting, selectedIds, toggleAllVisible, visibleIds.length]);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    try {
      const slug = newCategory.toLowerCase().replace(/\s+/g, '-');
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory, slug }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menambahkan kategori');
      }

      const newCat = await res.json();
      setCategories([...categories, { ...newCat, count: 0 }]);
      setNewCategory('');
      setIsAdding(false);
      toast.success('Kategori berhasil ditambahkan');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Gagal menambahkan kategori');
    }
  };

  const openEdit = (cat: Category) => {
    setIsAdding(false);
    setNewCategory('');
    setIsEditing(true);
    setEditCategoryId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
  };

  const closeEdit = () => {
    setIsEditing(false);
    setEditCategoryId(null);
    setEditName('');
    setEditSlug('');
  };

  const handleSaveEdit = async () => {
    if (!editCategoryId) return;
    const name = editName.trim();
    const slug = editSlug.trim();
    if (!name) {
      toast.error('Nama kategori wajib diisi');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/categories/${editCategoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mengubah kategori');
      }

      setCategories((prev) =>
        prev.map((c) => (c.id === editCategoryId ? { ...c, name: data.name, slug: data.slug } : c))
      );
      toast.success('Kategori berhasil diperbarui');
      closeEdit();
    } catch (error: any) {
      toast.error(error?.message || 'Gagal mengubah kategori');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ isOpen: false, id: null });
    if (!id) return;

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menghapus kategori');
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      toast.success('Kategori berhasil dihapus');
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menghapus kategori');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 kategori');
      return;
    }
    if (!confirm(`Hapus ${selectedIds.length} kategori terpilih?`)) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/categories/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menghapus kategori terpilih');
      }

      const deletedIds: string[] = Array.isArray(data?.deletedIds) ? data.deletedIds : [];
      const blocked: Array<{ id: string; usageCount: number }> = Array.isArray(data?.blocked) ? data.blocked : [];

      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setCategories((prev) => prev.filter((c) => !deletedSet.has(c.id)));
        setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
        toast.success(`Kategori berhasil dihapus: ${deletedIds.length}`);
      } else {
        toast.info('Tidak ada kategori yang bisa dihapus');
      }

      if (blocked.length > 0) {
        toast.error(`Tidak bisa menghapus ${blocked.length} kategori karena masih dipakai oleh kursus`);
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kategori Kursus</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola kategori untuk mengelompokkan kursus.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-top-2 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Kategori</label>
            <input 
              type="text" 
              placeholder="Contoh: Geologi Dasar" 
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleAddCategory}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm"
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!isSavingEdit) closeEdit();
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-900">Edit Kategori</div>
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={isSavingEdit}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-60"
                >
                  Tutup
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1.5">Nama Kategori</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-slate-900 placeholder:text-slate-500"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1.5">Slug (opsional)</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono font-medium text-slate-900 placeholder:text-slate-500"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-slate-50 px-5 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-extrabold disabled:opacity-60"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Search Bar */}
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
          <div className="text-xs text-slate-500 font-medium">{selectedIds.length ? `${selectedIds.length} dipilih` : `${filteredCategories.length} item`}</div>
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
        {filteredCategories.length > 0 ? (
          <Table 
            columns={columns} 
            data={filteredCategories} 
            isLoading={false}
            actions={(row) => (
              <div className="flex items-center justify-end gap-2">
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  onClick={() => openEdit(row)}
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
            icon={Tag} 
            title="Tidak ada kategori ditemukan" 
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : "Belum ada kategori yang ditambahkan."}
          />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredCategories.length === 0 ? (
          <EmptyState 
            icon={Tag} 
            title="Tidak ada kategori" 
            description="Belum ada data kategori untuk ditampilkan."
          />
        ) : (
          filteredCategories.map((cat) => (
            <div key={cat.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 mt-1"
                  checked={selectedIds.includes(cat.id)}
                  onChange={() => toggleOne(cat.id)}
                  disabled={isBulkDeleting}
                  aria-label={`Pilih kategori ${cat.name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{cat.name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">/{cat.slug}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                      {cat.count} Kursus
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                <button
                  onClick={() => openEdit(cat)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(cat.id)}
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
        title="Hapus Kategori?"
        description="Apakah Anda yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
