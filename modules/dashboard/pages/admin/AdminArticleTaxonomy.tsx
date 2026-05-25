"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Plus, Search, Tags, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

type TaxonomyItem = {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default function AdminArticleTaxonomy({
  kind,
  items: initialItems,
  canManage = true,
}: {
  kind: 'CATEGORY' | 'TAG';
  items: TaxonomyItem[];
  canManage?: boolean;
}) {
  const [items, setItems] = useState<TaxonomyItem[]>(Array.isArray(initialItems) ? initialItems : []);
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: '',
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const endpoint = kind === 'CATEGORY' ? '/api/blog/categories' : '/api/blog/tags';
  const title = kind === 'CATEGORY' ? 'Kategori Artikel' : 'Tag Artikel';
  const description = kind === 'CATEGORY' ? 'Kelola kategori untuk artikel.' : 'Kelola tag untuk artikel.';
  const archiveBase = kind === 'CATEGORY' ? '/blog/category' : '/blog/tag';

  const metrics = [
    { label: `Total ${kind === 'CATEGORY' ? 'Kategori' : 'Tag'}`, value: items.length, color: 'bg-blue-500' },
  ];

  const columns = useMemo(() => {
    return [
      {
        header: 'Nama',
        accessorKey: 'name',
        cell: (val: string) => <div className="font-bold text-slate-900">{val}</div>,
      },
      {
        header: 'Slug',
        accessorKey: 'slug',
        cell: (val: string) => <span className="font-mono text-xs text-slate-600">{val}</span>,
      },
      {
        header: 'Arsip',
        accessorKey: 'slugLink',
        cell: (_: unknown, row: TaxonomyItem) => (
          <Link
            href={`${archiveBase}/${row.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 hover:text-slate-900"
          >
            <Eye className="w-4 h-4" />
            Lihat
          </Link>
        ),
      },
    ];
  }, [archiveBase]);

  const create = async () => {
    const name = form.name.trim();
    const slug = slugify(form.slug.trim() || name);
    if (!name) {
      toast.error(`Nama ${kind === 'CATEGORY' ? 'kategori' : 'tag'} wajib diisi`);
      return;
    }
    if (!slug) {
      toast.error(`Slug ${kind === 'CATEGORY' ? 'kategori' : 'tag'} tidak valid`);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');

      setItems((prev) => [data, ...prev].sort((a, b) => String(a.name).localeCompare(String(b.name))));
      setForm({ name: '', slug: '' });
      setEditorOpen(false);
      toast.success(`${kind === 'CATEGORY' ? 'Kategori' : 'Tag'} berhasil ditambahkan`);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteConfirm.id) return;
    setIsSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirm.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');

      setItems((prev) => prev.filter((x) => x.id !== deleteConfirm.id));
      setDeleteConfirm({ isOpen: false, id: null, name: '' });
      toast.success('Berhasil dihapus');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-slate-500 text-sm mt-1">{description}</p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tambah {kind === 'CATEGORY' ? 'Kategori' : 'Tag'}
          </button>
        ) : null}
      </div>

      <Cards metrics={metrics} isLoading={false} />

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={`Cari ${kind === 'CATEGORY' ? 'kategori' : 'tag'}...`}
            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="hidden md:block">
        {filtered.length > 0 ? (
          <Table
            columns={columns as any}
            data={filtered as any}
            isLoading={false}
            actions={
              canManage
                ? (row) => (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ isOpen: true, id: row.id, name: row.name })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                : undefined
            }
          />
        ) : (
          <EmptyState
            icon={Tags}
            title={`Tidak ada ${kind === 'CATEGORY' ? 'kategori' : 'tag'}`}
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : `Belum ada ${kind === 'CATEGORY' ? 'kategori' : 'tag'} yang ditambahkan.`}
          />
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filtered.length === 0 ? (
          <EmptyState icon={Tags} title={`Tidak ada ${kind === 'CATEGORY' ? 'kategori' : 'tag'}`} description="Belum ada data untuk ditampilkan." />
        ) : (
          filtered.map((it) => (
            <div key={it.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2">
              <div className="font-bold text-slate-900">{it.name}</div>
              <div className="text-xs text-slate-500 font-mono">{it.slug}</div>
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                <Link
                  href={`${archiveBase}/${it.slug}`}
                  target="_blank"
                  className="text-xs font-extrabold text-indigo-700 hover:text-indigo-800"
                >
                  Lihat Arsip
                </Link>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isOpen: true, id: it.id, name: it.name })}
                    className="text-xs font-extrabold text-rose-700"
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">
                Tambah {kind === 'CATEGORY' ? 'Kategori' : 'Tag'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Nama</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder={kind === 'CATEGORY' ? 'Tutorial' : 'GIS'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    placeholder={kind === 'CATEGORY' ? 'tutorial' : 'gis'}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={create}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={remove}
        title={`Hapus ${kind === 'CATEGORY' ? 'Kategori' : 'Tag'}?`}
        description={`Apakah Anda yakin ingin menghapus "${deleteConfirm.name}"?`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isSaving}
      />
    </div>
  );
}

