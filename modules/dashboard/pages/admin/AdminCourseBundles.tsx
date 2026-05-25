"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import { Check, Edit2, Image as ImageIcon, Loader2, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

type CourseOption = { id: string; title: string; slug: string; price: number; status: string };
type BundleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  courseIds: string[];
  price: number;
  published: boolean;
  updatedAt: string;
};

type BundleForm = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  thumbnailUrl: string;
  courseIds: string[];
  price: number;
  published: boolean;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export default function AdminCourseBundles({
  bundles: initialBundles,
  courses,
}: {
  bundles: BundleRow[];
  courses: CourseOption[];
}) {
  const searchParams = useSearchParams();
  const openFromQueryOnceRef = useRef(false);
  const [bundles, setBundles] = useState<BundleRow[]>(initialBundles);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const [form, setForm] = useState<BundleForm>({
    name: '',
    slug: '',
    description: '',
    thumbnailUrl: '',
    courseIds: [],
    price: 0,
    published: false,
  });

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const filteredBundles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bundles;
    return bundles.filter((b) => (b.name || '').toLowerCase().includes(q) || (b.slug || '').toLowerCase().includes(q));
  }, [bundles, search]);

  const subtotalSelected = useMemo(() => {
    const ids = Array.isArray(form.courseIds) ? form.courseIds : [];
    return ids.reduce((sum, id) => sum + (Number(courseMap.get(id)?.price || 0) || 0), 0);
  }, [form.courseIds, courseMap]);

  const openCreate = () => {
    setForm({
      name: '',
      slug: '',
      description: '',
      thumbnailUrl: '',
      courseIds: [],
      price: 0,
      published: false,
    });
    setEditorOpen(true);
  };

  const openEdit = (row: BundleRow) => {
    setForm({
      id: row.id,
      name: row.name || '',
      slug: row.slug || '',
      description: row.description || '',
      thumbnailUrl: row.thumbnailUrl || '',
      courseIds: Array.isArray(row.courseIds) ? row.courseIds : [],
      price: Number(row.price || 0) || 0,
      published: !!row.published,
    });
    setEditorOpen(true);
  };

  useEffect(() => {
    if (openFromQueryOnceRef.current) return;
    const newFlag = searchParams.get('new') === '1';
    const editId = searchParams.get('edit');
    if (newFlag) {
      openFromQueryOnceRef.current = true;
      openCreate();
      return;
    }
    if (typeof editId === 'string' && editId.trim()) {
      const row = bundles.find((b) => b.id === editId.trim());
      if (row) {
        openFromQueryOnceRef.current = true;
        openEdit(row);
      }
    }
  }, [bundles, searchParams]);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nama bundle wajib diisi');
      return;
    }
    if (form.courseIds.length === 0) {
      toast.error('Pilih minimal 1 kursus');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || null,
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        courseIds: Array.from(new Set(form.courseIds.map((c) => c.trim()).filter(Boolean))),
        price: Number.isFinite(form.price) ? Number(form.price) : 0,
        published: !!form.published,
      };

      const res = await fetch(form.id ? `/api/course-bundles/${form.id}` : '/api/course-bundles', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan bundle');

      if (form.id) {
        setBundles((prev) => prev.map((b) => (b.id === form.id ? data : b)));
      } else {
        setBundles((prev) => [data, ...prev]);
      }
      setEditorOpen(false);
      toast.success('Bundle berhasil disimpan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan bundle');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (row: BundleRow) => {
    try {
      const res = await fetch(`/api/course-bundles/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !row.published }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal update status');
      setBundles((prev) => prev.map((b) => (b.id === row.id ? data : b)));
    } catch (e: any) {
      toast.error(e?.message || 'Gagal update status');
    }
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ open: false, id: null });
    if (!id) return;
    try {
      const res = await fetch(`/api/course-bundles/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus bundle');
      setBundles((prev) => prev.filter((b) => b.id !== id));
      toast.success('Bundle berhasil dihapus');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus bundle');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bundel Kursus</h1>
          <p className="text-slate-500 text-sm mt-1">Buat paket kursus dan atur harga bundel.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Buat Bundel
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari bundel..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-500 font-medium"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filteredBundles.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-slate-400" />
            </div>
            Belum ada bundel.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredBundles.map((b) => (
              <div key={b.id} className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                  {b.thumbnailUrl ? (
                    <Image src={b.thumbnailUrl} alt={b.name} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="font-extrabold text-slate-900 truncate">{b.name}</div>
                    <span
                      className={twMerge(
                        "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                        b.published ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-600 border-slate-200"
                      )}
                    >
                      {b.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {Array.isArray(b.courseIds) ? b.courseIds.length : 0} kursus • IDR {Number(b.price || 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePublish(b)}
                    className={twMerge(
                      "px-3 py-2 rounded-xl text-xs font-extrabold border transition-colors",
                      b.published
                        ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                    )}
                    title={b.published ? 'Jadikan Draft' : 'Publish'}
                  >
                    {b.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ open: true, id: b.id })}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-extrabold text-slate-900">{form.id ? 'Edit Bundel' : 'Buat Bundel'}</div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-extrabold text-slate-500 mb-1">Nama Bundel</div>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => ({ ...p, name: v, slug: p.slug ? p.slug : slugify(v) }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    placeholder="Contoh: Paket GIS Advanced"
                  />
                </div>

                <div>
                  <div className="text-xs font-extrabold text-slate-500 mb-1">Slug</div>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    placeholder="paket-gis-advanced"
                  />
                </div>

                <div>
                  <div className="text-xs font-extrabold text-slate-500 mb-1">Deskripsi (Opsional)</div>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 min-h-24"
                    placeholder="Ringkasan bundel..."
                  />
                </div>

                <div>
                  <div className="text-xs font-extrabold text-slate-500 mb-1">Kursus di Dalam Bundel</div>
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-3 border-b border-slate-200 bg-slate-50">
                      <div className="text-xs font-bold text-slate-500">
                        Pilih kursus ({form.courseIds.length}/{courses.length})
                      </div>
                    </div>
                    <div className="max-h-72 overflow-auto divide-y divide-slate-100">
                      {courses.map((c) => {
                        const checked = form.courseIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setForm((p) => {
                                const next = checked ? p.courseIds.filter((id) => id !== c.id) : [...p.courseIds, c.id];
                                return { ...p, courseIds: Array.from(new Set(next)) };
                              });
                            }}
                            className={twMerge(
                              "w-full px-4 py-3 flex items-center justify-between text-left hover:bg-indigo-50 transition-colors",
                              checked ? "bg-indigo-50" : "bg-white"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">{c.title}</div>
                              <div className="text-xs text-slate-500">IDR {Number(c.price || 0).toLocaleString('id-ID')}</div>
                            </div>
                            {checked ? <Check className="w-4 h-4 text-indigo-600" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="p-4 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">Thumbnail</div>
                    <div className="text-xs text-slate-500 mt-0.5">Tampil di list bundel.</div>
                  </div>
                  <div className="p-4">
                    <div className="w-full aspect-[16/9] rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden relative">
                      {form.thumbnailUrl ? (
                        <Image src={form.thumbnailUrl} alt="Thumbnail" fill unoptimized className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ImageIcon className="w-7 h-7" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsMediaOpen(true)}
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-50"
                      >
                        Pilih Media
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, thumbnailUrl: '' }))}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="p-4 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">Harga Bundel</div>
                    <div className="text-xs text-slate-500 mt-0.5">Total kursus: IDR {subtotalSelected.toLocaleString('id-ID')}</div>
                  </div>
                  <div className="p-4 space-y-3">
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                      placeholder="0"
                      min={0}
                    />
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.published}
                        onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      Publish setelah disimpan
                    </label>
                    <div className="text-xs text-slate-500">
                      Diskon otomatis dihitung saat pembelian: subtotal kursus - harga bundel.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
                disabled={isSaving}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Bundel?"
        description="Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />

      <MediaPickerModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        onSelect={(asset) => {
          setForm((p) => ({ ...p, thumbnailUrl: String(asset?.url || '') }));
          setIsMediaOpen(false);
        }}
      />
    </div>
  );
}
