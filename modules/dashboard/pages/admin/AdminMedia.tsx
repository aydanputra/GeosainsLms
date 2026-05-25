"use client";

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Plus, Search, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import ConfirmDialog from '../../components/ConfirmDialog';

type MediaAsset = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: string | Date;
  user?: { id: string; name: string | null; email: string | null } | null;
};

export default function AdminMedia({
  initialItems,
  initialTotal,
}: {
  initialItems: MediaAsset[];
  initialTotal: number;
}) {
  const [items, setItems] = useState<MediaAsset[]>(initialItems || []);
  const [total, setTotal] = useState<number>(typeof initialTotal === 'number' ? initialTotal : 0);
  const [q, setQ] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => i.filename.toLowerCase().includes(term));
  }, [items, q]);

  const refresh = async () => {
    try {
      const res = await fetch('/api/media?scope=all&take=60&skip=0');
      if (!res.ok) throw new Error('Gagal memuat media');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch {
      toast.error('Gagal memuat media');
    }
  };

  const handleReindex = async () => {
    if (isReindexing) return;
    setIsReindexing(true);
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reindex', assignTo: 'me' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal sinkronisasi media');
      toast.success(`Sinkronisasi selesai: ${data?.created || 0} item dipulihkan`);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal sinkronisasi media');
    } finally {
      setIsReindexing(false);
    }
  };

  const visibleIds = useMemo(() => filtered.map((i) => i.id), [filtered]);
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

  const handleDelete = async () => {
    if (!deleteState.id) return;
    try {
      const res = await fetch(`/api/media/${deleteState.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghapus media');
      }
      toast.success('Media dihapus');
      setDeleteState({ isOpen: false, id: null });
      setSelectedIds((prev) => prev.filter((id) => id !== deleteState.id));
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus media');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.info('Pilih minimal 1 media');
      return;
    }

    if (!confirm(`Hapus ${selectedIds.length} media terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;

    setIsBulkDeleting(true);
    let failed = 0;
    try {
      for (const id of selectedIds) {
        const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
        if (!res.ok) failed += 1;
      }

      if (failed === 0) toast.success(`Berhasil menghapus ${selectedIds.length} media`);
      else toast.error(`${failed} media gagal dihapus`);

      setSelectedIds([]);
      await refresh();
    } catch {
      toast.error('Gagal menghapus media terpilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Media</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola galeri gambar untuk seluruh website.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReindex}
            disabled={isReindexing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-bold transition-all shadow-sm w-full sm:w-auto justify-center hover:bg-slate-50 disabled:opacity-60"
          >
            {isReindexing ? 'Menyinkronkan...' : 'Pulihkan Media Lama'}
          </button>
          <button
            onClick={() => setIsPickerOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-bold transition-all shadow-sm w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" /> Upload / Pilih
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari media..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-between w-full sm:w-auto">
          <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700">
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
            {selectedIds.length ? `${selectedIds.length} dipilih` : `${total} file`}
          </div>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0 || isBulkDeleting}
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-100 disabled:opacity-60"
          >
            Hapus Terpilih
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((asset) => (
          <div key={asset.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden group">
            <div className="aspect-square bg-slate-100 relative">
              <Image src={asset.url} alt={asset.alt || asset.filename} fill unoptimized className="object-cover" />
              <label className="absolute top-3 left-3 inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/90 border border-slate-200 shadow-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={selectedIds.includes(asset.id)}
                  onChange={() => toggleOne(asset.id)}
                  disabled={isBulkDeleting}
                  aria-label={`Pilih media ${asset.filename}`}
                />
              </label>
            </div>
            <div className="p-3 space-y-2">
              <div className="text-xs font-bold text-slate-900 truncate">{asset.filename}</div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(asset.url);
                    toast.success('URL disalin');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy URL
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteState({ isOpen: true, id: asset.id })}
                  className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-600">
          Tidak ada media.
        </div>
      ) : null}

      <MediaPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        initialTab="UPLOAD"
        onSelect={async (asset) => {
          await navigator.clipboard.writeText(asset.url);
          toast.success('URL disalin');
          await refresh();
        }}
      />

      <ConfirmDialog
        isOpen={deleteState.isOpen}
        onClose={() => setDeleteState({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Hapus Media?"
        description="Apakah Anda yakin ingin menghapus gambar ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
