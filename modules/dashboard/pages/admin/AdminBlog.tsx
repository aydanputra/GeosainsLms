"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from '../../components/Tables';
import Cards from '../../components/Cards';
import EmptyState from '../../components/EmptyState';
import { Plus, Search, Edit2, Trash2, Eye, FileText } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import ConfirmDialog from '../../components/ConfirmDialog';
import Link from 'next/link';
import Image from 'next/image';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import { useSearchParams } from 'next/navigation';
import RichTextEditor from '@/modules/course/components/RichTextEditor';

interface AdminBlogProps {
  posts: any[];
  categories: any[];
  tags: any[];
  canManageTaxonomy?: boolean;
}

function normalizeTagInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

function dedupeTags(tags: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const n = normalizeTagInput(t);
    if (!n) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out.slice(0, 30);
}

function plainTextFromHtml(html: string) {
  const raw = typeof html === 'string' ? html : '';
  const withoutNbsp = raw.replace(/&nbsp;/gi, ' ');
  const stripped = withoutNbsp.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  return stripped;
}

export default function AdminBlog({ posts: initialPosts, categories, tags, canManageTaxonomy = false }: AdminBlogProps) {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState(initialPosts);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editorValue, setEditorValue] = useState<{
    id?: string;
    title: string;
    slug: string;
    excerpt: string;
    featuredImageUrl: string;
    content: string;
    published: boolean;
    categoryId: string;
    categoryName: string;
    tags: string[];
  }>({
    title: '',
    slug: '',
    excerpt: '',
    featuredImageUrl: '',
    content: '',
    published: false,
    categoryId: '',
    categoryName: '',
    tags: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [categoriesState, setCategoriesState] = useState<any[]>(Array.isArray(categories) ? categories : []);
  const [tagsState, setTagsState] = useState<any[]>(Array.isArray(tags) ? tags : []);
  const [manageCategoryOpen, setManageCategoryOpen] = useState(false);
  const [manageTagOpen, setManageTagOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '' });
  const [tagForm, setTagForm] = useState({ name: '', slug: '' });
  const [isSavingTaxonomy, setIsSavingTaxonomy] = useState(false);
  const [deleteTaxonomy, setDeleteTaxonomy] = useState<{ kind: 'CATEGORY' | 'TAG'; id: string | null; name: string }>({
    kind: 'CATEGORY',
    id: null,
    name: '',
  });

  useEffect(() => {
    const create = searchParams.get('create');

    if (create === '1') {
      openCreate();
      return;
    }
  }, [searchParams]);

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleIds = useMemo(() => filteredPosts.map((p) => p.id as string), [filteredPosts]);
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
    { label: 'Total Artikel', value: posts.length, color: 'bg-blue-500' },
    { label: 'Terbit', value: posts.filter(p => p.published).length, color: 'bg-green-500' },
    { label: 'Draft', value: posts.filter(p => !p.published).length, color: 'bg-gray-500' },
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
              checked={selectedIds.includes(row.id)}
              onChange={() => toggleOne(row.id)}
              disabled={isBulkDeleting}
              aria-label={`Pilih artikel ${row.title}`}
            />
          </div>
        ),
      },
      {
        header: 'Judul',
        accessorKey: 'title',
        cell: (val: string) => <div className="font-medium text-slate-900 line-clamp-1">{val}</div>,
      },
      {
        header: 'Kategori',
        accessorKey: 'categoryName',
        cell: (val: string) => <div className="text-slate-600 line-clamp-1">{val || '-'}</div>,
      },
      {
        header: 'Tag',
        accessorKey: 'tagNames',
        cell: (val: string[]) => (
          <div className="text-slate-600 line-clamp-1">{Array.isArray(val) && val.length ? val.join(', ') : '-'}</div>
        ),
      },
      { header: 'Penulis', accessorKey: 'authorName', cell: (val: string) => <div className="text-slate-600">{val}</div> },
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

  const refreshTaxonomy = async () => {
    try {
      const [cRes, tRes] = await Promise.all([fetch('/api/blog/categories'), fetch('/api/blog/tags')]);
      if (cRes.ok) {
        const items = await cRes.json().catch(() => []);
        setCategoriesState(Array.isArray(items) ? items : []);
      }
      if (tRes.ok) {
        const items = await tRes.json().catch(() => []);
        setTagsState(Array.isArray(items) ? items : []);
      }
    } catch {}
  };

  const slugifyLocal = (input: string) =>
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const createCategory = async () => {
    const name = categoryForm.name.trim();
    const slug = slugifyLocal(categoryForm.slug.trim() || name);
    if (!name) {
      toast.error('Nama kategori wajib diisi');
      return;
    }
    if (!slug) {
      toast.error('Slug kategori tidak valid');
      return;
    }
    setIsSavingTaxonomy(true);
    try {
      const res = await fetch('/api/blog/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menambah kategori');
      setCategoriesState((prev) => [data, ...prev].sort((a, b) => String(a.name).localeCompare(String(b.name))));
      toast.success('Kategori berhasil ditambahkan');
      setCategoryForm({ name: '', slug: '' });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambah kategori');
    } finally {
      setIsSavingTaxonomy(false);
    }
  };

  const createTag = async () => {
    const name = tagForm.name.trim();
    const slug = slugifyLocal(tagForm.slug.trim() || name);
    if (!name) {
      toast.error('Nama tag wajib diisi');
      return;
    }
    if (!slug) {
      toast.error('Slug tag tidak valid');
      return;
    }
    setIsSavingTaxonomy(true);
    try {
      const res = await fetch('/api/blog/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menambah tag');
      setTagsState((prev) => [data, ...prev].sort((a, b) => String(a.name).localeCompare(String(b.name))));
      toast.success('Tag berhasil ditambahkan');
      setTagForm({ name: '', slug: '' });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambah tag');
    } finally {
      setIsSavingTaxonomy(false);
    }
  };

  const removeTaxonomy = async () => {
    if (!deleteTaxonomy.id) return;
    setIsSavingTaxonomy(true);
    try {
      const url = deleteTaxonomy.kind === 'CATEGORY' ? '/api/blog/categories' : '/api/blog/tags';
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTaxonomy.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      if (deleteTaxonomy.kind === 'CATEGORY') setCategoriesState((prev) => prev.filter((x) => x.id !== deleteTaxonomy.id));
      if (deleteTaxonomy.kind === 'TAG') setTagsState((prev) => prev.filter((x) => x.id !== deleteTaxonomy.id));
      toast.success('Berhasil dihapus');
      setDeleteTaxonomy({ kind: 'CATEGORY', id: null, name: '' });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus');
    } finally {
      setIsSavingTaxonomy(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

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
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirm.id));
      toast.success('Artikel berhasil dihapus');
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus artikel');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 artikel');
      return;
    }
    if (!confirm(`Hapus ${selectedIds.length} artikel terpilih?`)) return;
    setIsBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      const results = await Promise.allSettled(ids.map((id) => fetch(`/api/blog/posts/${id}`, { method: 'DELETE' })));
      const deleted = results.filter((r) => r.status === 'fulfilled' && (r.value as Response).ok).length;
      const failed = ids.length - deleted;

      if (deleted > 0) {
        const deletedSet = new Set(ids.filter((_id, idx) => results[idx].status === 'fulfilled' && (results[idx] as any).value.ok));
        setPosts((prev) => prev.filter((p) => !deletedSet.has(p.id)));
        setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      }

      if (deleted > 0) toast.success(`Artikel dihapus: ${deleted}`);
      if (failed > 0) toast.error(`Gagal menghapus: ${failed}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openCreate = () => {
    setEditorMode('CREATE');
    setEditorValue({
      title: '',
      slug: '',
      excerpt: '',
      featuredImageUrl: '',
      content: '',
      published: false,
      categoryId: '',
      categoryName: '',
      tags: [],
    });
    setTagInput('');
    setNewCategoryName('');
    setEditorOpen(true);
  };

  const openEdit = (row: any) => {
    setEditorMode('EDIT');
    setEditorValue({
      id: String(row?.id || ''),
      title: typeof row?.title === 'string' ? row.title : '',
      slug: typeof row?.slug === 'string' ? row.slug : '',
      excerpt: typeof row?.excerpt === 'string' ? row.excerpt : '',
      featuredImageUrl: typeof row?.featuredImageUrl === 'string' ? row.featuredImageUrl : '',
      content: typeof row?.content === 'string' ? row.content : '',
      published: Boolean(row?.published),
      categoryId: typeof row?.categoryId === 'string' ? row.categoryId : '',
      categoryName: typeof row?.category?.name === 'string' ? row.category.name : '',
      tags: Array.isArray(row?.tagNames) ? dedupeTags(row.tagNames) : [],
    });
    setTagInput('');
    setNewCategoryName('');
    setEditorOpen(true);
  };

  const save = async (nextPublished?: boolean) => {
    const title = editorValue.title.trim();
    const content = typeof editorValue.content === 'string' ? editorValue.content : '';
    const contentText = plainTextFromHtml(content);
    if (!title) {
      toast.error('Judul wajib diisi');
      return;
    }
    if (!contentText) {
      toast.error('Konten wajib diisi');
      return;
    }
    setIsSaving(true);
    try {
      const isEdit = editorMode === 'EDIT' && Boolean(editorValue.id);
      const url = isEdit ? `/api/blog/posts/${editorValue.id}` : '/api/blog/posts';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: editorValue.slug.trim(),
          excerpt: editorValue.excerpt.trim(),
          featuredImageUrl: editorValue.featuredImageUrl.trim(),
          content,
          published: typeof nextPublished === 'boolean' ? nextPublished : editorValue.published,
          categoryId: editorValue.categoryId.trim(),
          categoryName: editorValue.categoryName.trim(),
          tags: editorValue.tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan artikel');

      const authorName = data?.author?.name || data?.author?.email || data?.authorName;
      const normalized = {
        ...data,
        authorName: authorName || 'Unknown',
        categoryName: data?.category?.name || '',
        tagNames: Array.isArray(data?.tags) ? data.tags.map((t: any) => t?.tag?.name).filter(Boolean) : [],
      };

      if (isEdit) {
        setPosts((prev) => prev.map((p) => (p.id === normalized.id ? { ...p, ...normalized } : p)));
        toast.success('Artikel berhasil diperbarui');
      } else {
        setPosts((prev) => [normalized, ...prev]);
        toast.success('Artikel berhasil dibuat');
      }
      setEditorOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan artikel');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Blog / Konten</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola artikel dan konten edukasi.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageTaxonomy ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setManageCategoryOpen(true);
                  void refreshTaxonomy();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
              >
                Kelola Kategori
              </button>
              <button
                type="button"
                onClick={() => {
                  setManageTagOpen(true);
                  void refreshTaxonomy();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
              >
                Kelola Tag
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tambah Artikel Baru
          </button>
        </div>
      </div>

      <Cards metrics={metrics} isLoading={false} />

      {/* Floating Search Bar */}
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
          <div className="text-xs text-slate-500 font-medium">{selectedIds.length ? `${selectedIds.length} dipilih` : `${filteredPosts.length} item`}</div>
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
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  type="button"
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
            icon={FileText} 
            title="Tidak ada artikel ditemukan" 
            description={searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : "Belum ada artikel yang dipublikasikan."}
          />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredPosts.length === 0 ? (
          <EmptyState 
            icon={FileText} 
            title="Tidak ada artikel" 
            description="Belum ada data artikel untuk ditampilkan."
          />
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 mt-1"
                  checked={selectedIds.includes(post.id)}
                  onChange={() => toggleOne(post.id)}
                  disabled={isBulkDeleting}
                  aria-label={`Pilih artikel ${post.title}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-slate-900 line-clamp-2">{post.title}</h3>
                    <span
                      className={twMerge(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ml-2",
                        post.published ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {post.published ? 'Terbit' : 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-slate-500">
                Penulis: {post.authorName}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
                {post?.slug ? (
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Lihat
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors opacity-60"
                    disabled
                  >
                    Lihat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(post)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <button 
                  type="button"
                  onClick={() => handleDelete(post.id)}
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
        title="Hapus Artikel?"
        description="Apakah Anda yakin ingin menghapus artikel ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />

      {editorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">
                {editorMode === 'CREATE' ? 'Tambah Artikel' : 'Edit Artikel'}
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Judul</label>
                    <input
                      value={editorValue.title}
                      onChange={(e) => setEditorValue((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Judul artikel"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                    <input
                      value={editorValue.slug}
                      onChange={(e) => setEditorValue((prev) => ({ ...prev, slug: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                      placeholder="contoh: tips-qgis"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Ringkasan (opsional)</label>
                    <textarea
                      value={editorValue.excerpt}
                      onChange={(e) => setEditorValue((prev) => ({ ...prev, excerpt: e.target.value }))}
                      className="w-full min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Ringkasan singkat artikel (seperti excerpt WordPress)"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Konten</label>
                    <RichTextEditor
                      value={editorValue.content}
                      onChange={(value) => setEditorValue((prev) => ({ ...prev, content: value }))}
                      placeholder="Tulis konten artikel..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Penerbitan</div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-slate-700">Status</div>
                      <span
                        className={twMerge(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                          editorValue.published ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-200"
                        )}
                      >
                        {editorValue.published ? 'Terbit' : 'Draft'}
                      </span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 w-fit">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={editorValue.published}
                        onChange={(e) => setEditorValue((prev) => ({ ...prev, published: e.target.checked }))}
                      />
                      Terbitkan
                    </label>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Featured Image</div>
                    <div className="aspect-video bg-slate-50 border border-slate-200 rounded-xl overflow-hidden relative">
                      {editorValue.featuredImageUrl ? (
                        <Image src={editorValue.featuredImageUrl} alt="Featured image" fill unoptimized className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                          Belum ada gambar
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsMediaOpen(true)}
                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700"
                      >
                        Pilih / Upload
                      </button>
                      {editorValue.featuredImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditorValue((p) => ({ ...p, featuredImageUrl: '' }))}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-xs hover:bg-slate-50"
                        >
                          Hapus
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Kategori</div>
                    <select
                      value={editorValue.categoryId}
                      onChange={(e) =>
                        setEditorValue((p) => ({
                          ...p,
                          categoryId: e.target.value,
                          categoryName: '',
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="">Tanpa kategori</option>
                      {(Array.isArray(categoriesState) ? categoriesState : []).map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Tambah kategori baru"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = newCategoryName.trim();
                          if (!name) return;
                          setEditorValue((p) => ({ ...p, categoryId: '', categoryName: name }));
                          setNewCategoryName('');
                        }}
                        className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs hover:bg-slate-800"
                      >
                        Pakai
                      </button>
                    </div>
                    {editorValue.categoryName ? (
                      <div className="text-xs text-slate-600">Kategori baru: {editorValue.categoryName}</div>
                    ) : null}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Tag</div>
                    <div className="flex flex-wrap gap-2">
                      {editorValue.tags.map((t) => (
                        <button
                          key={t.toLowerCase()}
                          type="button"
                          onClick={() => setEditorValue((p) => ({ ...p, tags: p.tags.filter((x) => x.toLowerCase() !== t.toLowerCase()) }))}
                          className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                          title="Hapus tag"
                        >
                          {t} ×
                        </button>
                      ))}
                      {editorValue.tags.length === 0 ? <div className="text-xs text-slate-500">Belum ada tag.</div> : null}
                    </div>
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ',') return;
                        e.preventDefault();
                        const next = normalizeTagInput(tagInput);
                        if (!next) return;
                        setEditorValue((p) => ({ ...p, tags: dedupeTags([...p.tags, next]) }));
                        setTagInput('');
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Ketik tag lalu Enter / koma"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(tagsState) ? tagsState : [])
                        .map((t: any) => (typeof t?.name === 'string' ? t.name : ''))
                        .filter(Boolean)
                        .slice(0, 10)
                        .map((name: string) => (
                          <button
                            key={name.toLowerCase()}
                            type="button"
                            onClick={() => setEditorValue((p) => ({ ...p, tags: dedupeTags([...p.tags, name]) }))}
                            className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-extrabold border border-indigo-100 hover:bg-indigo-100"
                          >
                            {name}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
              >
                Batal
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSaving ? 'Menyimpan...' : editorValue.published ? 'Update' : 'Terbitkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <MediaPickerModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        initialTab="UPLOAD"
        onSelect={(item) => {
          setEditorValue((p) => ({ ...p, featuredImageUrl: item.url }));
        }}
      />

      {manageCategoryOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">Kelola Kategori</div>
              <button
                type="button"
                onClick={() => setManageCategoryOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-4">
              {canManageTaxonomy ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Nama</label>
                      <input
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Contoh: Tutorial"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                      <input
                        value={categoryForm.slug}
                        onChange={(e) => setCategoryForm((p) => ({ ...p, slug: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                        placeholder="tutorial"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={createCategory}
                    disabled={isSavingTaxonomy}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSavingTaxonomy ? 'Menyimpan...' : 'Tambah Kategori'}
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Anda dapat melihat daftar kategori. Untuk menambah/menghapus kategori, gunakan akun Admin.
                </div>
              )}

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-700">Daftar Kategori</div>
                <div className="divide-y divide-slate-200">
                  {categoriesState.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-500">Belum ada kategori.</div>
                  ) : (
                    categoriesState.map((c) => (
                      <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{c.name}</div>
                          <div className="text-xs text-slate-500 font-mono truncate">{c.slug}</div>
                        </div>
                        {canManageTaxonomy ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTaxonomy({ kind: 'CATEGORY', id: c.id, name: c.name })}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100"
                          >
                            Hapus
                          </button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {manageTagOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">Kelola Tag</div>
              <button
                type="button"
                onClick={() => setManageTagOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-4">
              {canManageTaxonomy ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Nama</label>
                      <input
                        value={tagForm.name}
                        onChange={(e) => setTagForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Contoh: GIS"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
                      <input
                        value={tagForm.slug}
                        onChange={(e) => setTagForm((p) => ({ ...p, slug: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                        placeholder="gis"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={createTag}
                    disabled={isSavingTaxonomy}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSavingTaxonomy ? 'Menyimpan...' : 'Tambah Tag'}
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Anda dapat melihat daftar tag. Untuk menambah/menghapus tag, gunakan akun Admin.
                </div>
              )}

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-700">Daftar Tag</div>
                <div className="divide-y divide-slate-200">
                  {tagsState.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-500">Belum ada tag.</div>
                  ) : (
                    tagsState.map((t) => (
                      <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{t.name}</div>
                          <div className="text-xs text-slate-500 font-mono truncate">{t.slug}</div>
                        </div>
                        {canManageTaxonomy ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTaxonomy({ kind: 'TAG', id: t.id, name: t.name })}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100"
                          >
                            Hapus
                          </button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {canManageTaxonomy ? (
        <ConfirmDialog
          isOpen={Boolean(deleteTaxonomy.id)}
          onClose={() => setDeleteTaxonomy({ kind: 'CATEGORY', id: null, name: '' })}
          onConfirm={removeTaxonomy}
          title={deleteTaxonomy.kind === 'CATEGORY' ? 'Hapus Kategori?' : 'Hapus Tag?'}
          description={`Apakah Anda yakin ingin menghapus "${deleteTaxonomy.name}"?`}
          confirmText="Hapus"
          cancelText="Batal"
          variant="danger"
          isLoading={isSavingTaxonomy}
        />
      ) : null}
    </div>
  );
}
