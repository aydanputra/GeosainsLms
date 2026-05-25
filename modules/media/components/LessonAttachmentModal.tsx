"use client";

import { useMemo, useState } from 'react';
import { Loader2, Search, Upload, X } from 'lucide-react';

type Attachment = {
  id: string;
  name: string;
  type: string;
  url: string;
};

export default function LessonAttachmentModal({
  isOpen,
  onClose,
  attachments,
  onUploadFiles,
  onDeleteAttachment,
  isUploading,
  deletingId,
  disabled,
}: {
  isOpen: boolean;
  onClose: () => void;
  attachments: Attachment[];
  onUploadFiles: (files: File[]) => Promise<void>;
  onDeleteAttachment: (id: string) => Promise<void>;
  isUploading: boolean;
  deletingId: string | null;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<'GALLERY' | 'UPLOAD'>('GALLERY');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const list = Array.isArray(attachments) ? attachments : [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((a) => String(a.name || '').toLowerCase().includes(query));
  }, [attachments, q]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full h-full sm:h-[90vh] sm:max-w-4xl sm:rounded-2xl overflow-hidden border border-slate-200 shadow-2xl flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-bold text-slate-900 truncate">Dokumen</div>
            <div className="text-xs text-slate-500 mt-0.5">Kelola dokumen lampiran pelajaran.</div>
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
              Lampiran
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
              </div>

              {disabled ? (
                <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                  Aktifkan Dokumen pada Tipe Materi untuk mengunggah lampiran.
                </div>
              ) : null}

              {filtered.length === 0 ? (
                <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
                  Belum ada dokumen.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filtered.map((file) => (
                    <div key={file.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{file.name}</div>
                        <div className="text-xs text-slate-500 truncate">{file.type}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {file.url ? (
                          <a
                            href={file.url}
                            target="_blank"
                            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                            rel="noreferrer"
                          >
                            Buka
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onDeleteAttachment(file.id)}
                          disabled={isUploading || deletingId === file.id}
                          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-60"
                        >
                          {deletingId === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="text-sm font-bold text-slate-900">Upload Dokumen</div>
                <div className="text-xs text-slate-500 mt-1">PDF, DOCX, PPTX, XLSX. Maks 10MB per file.</div>
                <div className="mt-4">
                  <label
                    className={
                      disabled
                        ? 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-sm cursor-not-allowed'
                        : 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 cursor-pointer'
                    }
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Pilih File
                    <input
                      type="file"
                      className="hidden"
                      disabled={disabled || isUploading}
                      multiple
                      accept=".pdf,.docx,.pptx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={async (e) => {
                        const list = e.currentTarget.files;
                        const files = list ? Array.from(list) : [];
                        e.currentTarget.value = '';
                        if (files.length === 0) return;
                        await onUploadFiles(files);
                        setTab('GALLERY');
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
            {tab === 'GALLERY' ? `${filtered.length} dokumen` : 'Upload dokumen baru'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 w-full sm:w-auto disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
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
