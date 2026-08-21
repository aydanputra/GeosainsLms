"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import RichTextEditor from '@/modules/course/components/RichTextEditor';
import { twMerge } from 'tailwind-merge';
import { ChevronDown } from 'lucide-react';

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

export default function ArticleEditor({
  mode,
  basePath,
  categories,
  tags,
  initialPost,
  canManageTaxonomy,
}: {
  mode: 'CREATE' | 'EDIT';
  basePath: string;
  categories: any[];
  tags: any[];
  initialPost?: any | null;
  canManageTaxonomy: boolean;
}) {
  const [value, setValue] = useState<{
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
  }>(() => {
    const p = initialPost || {};
    return {
      id: typeof p.id === 'string' ? p.id : undefined,
      title: typeof p.title === 'string' ? p.title : '',
      slug: typeof p.slug === 'string' ? p.slug : '',
      excerpt: typeof p.excerpt === 'string' ? p.excerpt : '',
      featuredImageUrl: typeof p.featuredImageUrl === 'string' ? p.featuredImageUrl : '',
      content: typeof p.content === 'string' ? p.content : '',
      published: Boolean(p.published),
      categoryId: typeof p.categoryId === 'string' ? p.categoryId : '',
      categoryName: typeof p.category?.name === 'string' ? p.category.name : '',
      tags: Array.isArray(p.tagNames) ? dedupeTags(p.tagNames) : [],
    };
  });

  const [tagInput, setTagInput] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryPickerQuery, setCategoryPickerQuery] = useState('');
  const categoryPickerRef = useRef<HTMLDivElement | null>(null);

  const categoriesState = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const tagsState = useMemo(() => (Array.isArray(tags) ? tags : []), [tags]);

  const filteredCategories = useMemo(() => {
    const q = categoryPickerQuery.trim().toLowerCase();
    if (!q) return categoriesState;
    return categoriesState.filter((c: any) => String(c?.name || '').toLowerCase().includes(q));
  }, [categoriesState, categoryPickerQuery]);

  const selectedCategoryLabel = useMemo(() => {
    const id = String(value.categoryId || '').trim();
    if (!id) return 'Tanpa kategori';
    const found = categoriesState.find((c: any) => String(c?.id || '') === id);
    const name = found && typeof (found as any).name === 'string' ? (found as any).name : '';
    return name || 'Kategori dipilih';
  }, [value.categoryId, categoriesState]);

  useEffect(() => {
    if (!categoryPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!categoryPickerRef.current) return;
      if (!categoryPickerRef.current.contains(e.target as Node)) setCategoryPickerOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [categoryPickerOpen]);

  const isEdit = mode === 'EDIT' && Boolean(value.id);

  const canSubmit = useMemo(() => {
    const title = value.title.trim();
    const contentText = plainTextFromHtml(value.content || '');
    return Boolean(title && contentText);
  }, [value.title, value.content]);

  const save = async (nextPublished: boolean) => {
    const title = value.title.trim();
    const content = typeof value.content === 'string' ? value.content : '';
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
      const url = isEdit ? `/api/blog/posts/${value.id}` : '/api/blog/posts';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: value.slug.trim(),
          excerpt: value.excerpt.trim(),
          featuredImageUrl: value.featuredImageUrl.trim(),
          content,
          published: nextPublished,
          categoryId: value.categoryId.trim(),
          categoryName: value.categoryName.trim(),
          tags: value.tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan artikel');

      toast.success(isEdit ? 'Artikel berhasil diperbarui' : 'Artikel berhasil dibuat');
      window.location.href = basePath;
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan artikel');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{isEdit ? 'Edit Artikel' : 'Tambah Artikel'}</h1>
          <p className="text-slate-500 text-sm mt-1">Tulis artikel dengan kategori, tag, dan featured image.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={basePath}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50"
          >
            Kembali
          </Link>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={isSaving || !canSubmit}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Draft'}
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={isSaving || !canSubmit}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSaving ? 'Menyimpan...' : value.published ? 'Update' : 'Terbitkan'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Judul</label>
              <input
                value={value.title}
                onChange={(e) => setValue((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="Judul artikel"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Slug (opsional)</label>
              <input
                value={value.slug}
                onChange={(e) => setValue((p) => ({ ...p, slug: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                placeholder="contoh: tips-qgis"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Ringkasan (opsional)</label>
              <textarea
                value={value.excerpt}
                onChange={(e) => setValue((p) => ({ ...p, excerpt: e.target.value }))}
                className="w-full min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="Ringkasan singkat artikel (excerpt)"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Konten</div>
            <RichTextEditor value={value.content} onChange={(content) => setValue((p) => ({ ...p, content }))} placeholder="Tulis konten artikel..." />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Penerbitan</div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-700">Status</div>
              <span
                className={twMerge(
                  'px-2.5 py-0.5 rounded-full text-xs font-bold border',
                  value.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                )}
              >
                {value.published ? 'Terbit' : 'Draft'}
              </span>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 w-fit">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={value.published}
                onChange={(e) => setValue((p) => ({ ...p, published: e.target.checked }))}
              />
              Terbitkan
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Featured Image</div>
            <div className="aspect-video bg-slate-50 border border-slate-200 rounded-xl overflow-hidden relative">
              {value.featuredImageUrl ? (
                <Image src={value.featuredImageUrl} alt="Featured image" fill unoptimized className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">Belum ada gambar</div>
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
              {value.featuredImageUrl ? (
                <button
                  type="button"
                  onClick={() => setValue((p) => ({ ...p, featuredImageUrl: '' }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-extrabold text-xs hover:bg-slate-50"
                >
                  Hapus
                </button>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Kategori</div>
              <Link
                href={`${basePath}/categories`}
                className={twMerge(
                  'text-xs font-extrabold',
                  canManageTaxonomy ? 'text-indigo-700 hover:text-indigo-800' : 'text-slate-400 pointer-events-none'
                )}
              >
                Kelola
              </Link>
            </div>
            <div className="relative" ref={categoryPickerRef}>
              <button
                type="button"
                onClick={() => setCategoryPickerOpen((v) => !v)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-left">{selectedCategoryLabel}</span>
                  <ChevronDown
                    className={twMerge('w-4 h-4 text-slate-500 shrink-0 transition-transform', categoryPickerOpen ? 'rotate-180' : '')}
                  />
                </span>
              </button>

              {categoryPickerOpen ? (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      value={categoryPickerQuery}
                      onChange={(e) => setCategoryPickerQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Cari kategori..."
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setValue((p) => ({ ...p, categoryId: '', categoryName: '' }));
                        setCategoryPickerOpen(false);
                      }}
                      className={twMerge(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-sm font-bold border',
                        !value.categoryId ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-white text-slate-800 border-transparent hover:bg-slate-50'
                      )}
                    >
                      <span className="truncate">Tanpa kategori</span>
                      <span
                        className={twMerge(
                          'h-5 w-5 rounded-md border flex items-center justify-center text-[10px] font-extrabold',
                          !value.categoryId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-transparent border-slate-300'
                        )}
                      >
                        ✓
                      </span>
                    </button>

                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((c: any) => {
                        const selected = String(value.categoryId || '') === String(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setValue((p) => ({ ...p, categoryId: String(c.id), categoryName: '' }));
                              setCategoryPickerOpen(false);
                            }}
                            className={twMerge(
                              'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-sm font-bold border',
                              selected ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-white text-slate-800 border-transparent hover:bg-slate-50'
                            )}
                          >
                            <span className="truncate">{c.name}</span>
                            <span
                              className={twMerge(
                                'h-5 w-5 rounded-md border flex items-center justify-center text-[10px] font-extrabold',
                                selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-transparent border-slate-300'
                              )}
                            >
                              ✓
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-500">Kategori tidak ditemukan.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
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
                  setValue((p) => ({ ...p, categoryId: '', categoryName: name }));
                  setNewCategoryName('');
                }}
                className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs hover:bg-slate-800"
              >
                Pakai
              </button>
            </div>
            {value.categoryName ? <div className="text-xs text-slate-600">Kategori baru: {value.categoryName}</div> : null}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-slate-900 uppercase tracking-widest">Tag</div>
              <Link
                href={`${basePath}/tags`}
                className={twMerge(
                  'text-xs font-extrabold',
                  canManageTaxonomy ? 'text-indigo-700 hover:text-indigo-800' : 'text-slate-400 pointer-events-none'
                )}
              >
                Kelola
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {value.tags.map((t) => (
                <button
                  key={t.toLowerCase()}
                  type="button"
                  onClick={() => setValue((p) => ({ ...p, tags: p.tags.filter((x) => x.toLowerCase() !== t.toLowerCase()) }))}
                  className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                  title="Hapus tag"
                >
                  {t} ×
                </button>
              ))}
              {value.tags.length === 0 ? <div className="text-xs text-slate-500">Belum ada tag.</div> : null}
            </div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ',') return;
                e.preventDefault();
                const next = normalizeTagInput(tagInput);
                if (!next) return;
                setValue((p) => ({ ...p, tags: dedupeTags([...p.tags, next]) }));
                setTagInput('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Ketik tag lalu Enter / koma"
            />
            <div className="flex flex-wrap gap-2">
              {tagsState
                .map((t: any) => (typeof t?.name === 'string' ? t.name : ''))
                .filter(Boolean)
                .slice(0, 10)
                .map((name: string) => (
                  <button
                    key={name.toLowerCase()}
                    type="button"
                    onClick={() => setValue((p) => ({ ...p, tags: dedupeTags([...p.tags, name]) }))}
                    className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-extrabold border border-indigo-100 hover:bg-indigo-100"
                  >
                    {name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      <MediaPickerModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        initialTab="UPLOAD"
        onSelect={(item) => {
          setValue((p) => ({ ...p, featuredImageUrl: item.url }));
        }}
      />
    </div>
  );
}
