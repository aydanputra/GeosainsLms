"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { X, Search, Upload, ImageIcon, Check, Loader2, Copy, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

type MediaAsset = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: string;
};

type MediaListResponse = {
  items: MediaAsset[];
  total: number;
  take: number;
  skip: number;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialTab = 'GALLERY',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: { id: string; url: string; alt: string | null; filename: string }) => void;
  initialTab?: 'GALLERY' | 'UPLOAD';
}) {
  const [tab, setTab] = useState<'GALLERY' | 'UPLOAD'>(initialTab);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [alt, setAlt] = useState('');
  const [detailAlt, setDetailAlt] = useState('');
  const [isSavingAlt, setIsSavingAlt] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('scope', 'mine');
    if (q.trim()) p.set('q', q.trim());
    p.set('take', '60');
    p.set('skip', '0');
    return p.toString();
  }, [q]);

  const loadGallery = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/media?${queryString}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal memuat media');
      }
      const data = (await res.json()) as MediaListResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat media');
      setItems([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setSelectedId(null);
    setAlt('');
    setDetailAlt('');
    setDeleteConfirmOpen(false);
    void loadGallery();
  }, [isOpen, initialTab, loadGallery]);

  useEffect(() => {
    if (!isOpen) return;
    if (tab !== 'GALLERY') return;
    void loadGallery();
  }, [tab, isOpen, loadGallery]);

  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;

  useEffect(() => {
    if (!isOpen) return;
    if (tab !== 'GALLERY') return;
    setDetailAlt(selected?.alt || '');
    setDeleteConfirmOpen(false);
  }, [selected?.id, isOpen, tab, selected?.alt]);

  const handleConfirm = () => {
    if (!selected) {
      toast.error('Pilih gambar terlebih dahulu');
      return;
    }
    onSelect({ id: selected.id, url: selected.url, alt: selected.alt, filename: selected.filename });
    onClose();
  };

  const handleCopyUrl = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.url);
      toast.success('URL disalin');
    } catch {
      toast.error('Gagal menyalin URL');
    }
  };

  const handleSaveAlt = async () => {
    if (!selected) return;
    setIsSavingAlt(true);
    try {
      const res = await fetch(`/api/media/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: detailAlt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menyimpan alt');
      }
      const updated = (await res.json()) as MediaAsset;
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.success('Alt tersimpan');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan alt');
    } finally {
      setIsSavingAlt(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/media/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghapus media');
      }
      toast.success('Media dihapus');
      setDeleteConfirmOpen(false);
      setSelectedId(null);
      await loadGallery();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus media');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      if (alt.trim()) form.set('alt', alt.trim());

      const res = await fetch('/api/media/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal upload');
      }
      const created = (await res.json()) as MediaAsset;
      toast.success('Upload berhasil. Klik Simpan untuk menggunakan.');
      setTab('GALLERY');
      setQ('');
      setSelectedId(created.id);
      await loadGallery();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal upload');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full h-full sm:h-[90vh] sm:max-w-5xl sm:rounded-2xl overflow-hidden border border-slate-200 shadow-2xl flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-bold text-slate-900 truncate">Media</div>
            <div className="text-xs text-slate-500 mt-0.5">Pilih dari galeri atau upload baru.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-4">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 border border-slate-200 w-full sm:w-fit">
            <button
              type="button"
              onClick={() => setTab('GALLERY')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                tab === 'GALLERY' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Galeri Saya
            </button>
            <button
              type="button"
              onClick={() => setTab('UPLOAD')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                tab === 'UPLOAD' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upload Baru
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'GALLERY' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari nama file..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="text-xs text-slate-500 font-medium">{total} file</div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Memuat galeri...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-7 h-7 text-slate-400" />
                  </div>
                  <div className="font-bold text-slate-900">Galeri kosong</div>
                  <div className="text-sm text-slate-500 mt-1">Upload gambar baru untuk mulai.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {items.map((asset) => {
                        const isSelected = selectedId === asset.id;
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => setSelectedId(asset.id)}
                            className={`text-left rounded-2xl border overflow-hidden bg-white transition-colors ${
                              isSelected
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="aspect-square bg-slate-100 relative">
                              <Image src={asset.url} alt={asset.alt || asset.filename} fill unoptimized className="object-cover" />
                              {isSelected ? (
                                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : null}
                            </div>
                            <div className="p-2">
                              <div className="text-xs font-bold text-slate-800 truncate">{asset.filename}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-0">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <div className="text-sm font-bold text-slate-900">Detail Media</div>
                        <div className="text-xs text-slate-500 mt-0.5">Pilih 1 gambar untuk melihat detail.</div>
                      </div>

                      {selected ? (
                        <div className="p-4 space-y-4">
                          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                            <Image src={selected.url} alt={selected.alt || selected.filename} fill unoptimized className="object-cover" />
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-bold text-slate-900 break-words">{selected.filename}</div>
                            <div className="text-xs text-slate-500">
                              <div>Ukuran: {formatBytes(selected.size)}</div>
                              <div>Tipe: {selected.mimeType}</div>
                              <div>Upload: {formatDate(selected.createdAt)}</div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Alt Text</label>
                            <textarea
                              rows={2}
                              value={detailAlt}
                              onChange={(e) => setDetailAlt(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              placeholder="Deskripsi gambar (opsional)"
                            />
                            <button
                              type="button"
                              onClick={handleSaveAlt}
                              disabled={isSavingAlt}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 disabled:opacity-50 w-full"
                            >
                              <Save className="w-4 h-4" />
                              {isSavingAlt ? 'Menyimpan...' : 'Simpan Alt'}
                            </button>
                          </div>

                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={handleCopyUrl}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 w-full"
                            >
                              <Copy className="w-4 h-4" /> Copy URL
                            </button>

                            {!deleteConfirmOpen ? (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmOpen(true)}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-xs hover:bg-red-100 w-full"
                              >
                                <Trash2 className="w-4 h-4" /> Hapus
                              </button>
                            ) : (
                              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 space-y-2">
                                <div className="text-xs font-bold text-red-700">Hapus gambar ini?</div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmOpen(false)}
                                    className="px-3 py-2 rounded-xl border border-red-200 bg-white text-red-700 font-bold text-xs hover:bg-red-50 w-full"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    className="px-3 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 w-full"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-sm text-slate-500">
                          Pilih gambar dari galeri untuk melihat preview, mengubah alt text, atau menghapus.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="text-sm font-bold text-slate-900">Upload gambar</div>
                <div className="text-xs text-slate-500 mt-1">Mendukung JPG, PNG, WEBP, GIF (maks 10MB).</div>

                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Alt (opsional)</label>
                    <input
                      value={alt}
                      onChange={(e) => setAlt(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Deskripsi gambar"
                    />
                  </div>

                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-slate-300 bg-white hover:bg-slate-50 cursor-pointer text-slate-700 font-bold">
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? 'Mengupload...' : 'Pilih File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(file);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {tab === 'GALLERY' ? (selected ? `Dipilih: ${selected.filename}` : 'Pilih 1 gambar') : 'Upload gambar baru'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 w-full sm:w-auto"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={tab !== 'GALLERY' || !selected}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 w-full sm:w-auto"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
