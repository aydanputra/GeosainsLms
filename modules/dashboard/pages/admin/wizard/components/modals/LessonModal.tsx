
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Save, FileText, Video, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import LessonAttachmentModal from '@/modules/media/components/LessonAttachmentModal';

// Dynamic Rich Text Editor
const RichTextEditor = dynamic(() => import('@/modules/course/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-50 animate-pulse rounded-xl" />
});

const lessonSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  content: z.any().default(''),
  videoUrl: z.string().default(''),
  duration: z.number().min(0).default(0),
  isPreview: z.boolean().default(false),
});

type LessonFormInput = z.input<typeof lessonSchema>;
type LessonFormData = z.output<typeof lessonSchema>;

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDraftCreated?: (lesson: any) => void;
  initialData?: any;
  isLoading?: boolean;
  courseId: string;
  moduleId: string;
  initialOrder?: number;
}

export default function LessonModal({
  isOpen,
  onClose,
  onSave,
  onDraftCreated,
  initialData,
  isLoading,
  courseId,
  moduleId,
  initialOrder = 0,
}: LessonModalProps) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<LessonFormInput>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: '',
      content: '',
      videoUrl: '',
      duration: 0,
      isPreview: false,
    }
  });

  const [hasVideo, setHasVideo] = useState(true);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [durationHours, setDurationHours] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lessonIdForUpload, setLessonIdForUpload] = useState<string | null>(null);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);

  const onlyDigits = (v: string) => v.replace(/[^\d]/g, '');
  const parseNonNegativeInt = (v: string) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const toDurationMinutes = (h: string, m: string, s: string) => {
    const hours = parseNonNegativeInt(h);
    const minutes = parseNonNegativeInt(m);
    const seconds = parseNonNegativeInt(s);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0;
  };
  const syncDurationField = (h: string, m: string, s: string) => {
    const minutes = toDurationMinutes(h, m, s);
    setValue('duration', minutes, { shouldDirty: true, shouldValidate: true });
  };
  const normalizeDurationParts = (h: string, m: string, s: string) => {
    const hours = parseNonNegativeInt(h);
    const minutes = parseNonNegativeInt(m);
    const seconds = parseNonNegativeInt(s);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    const nextHours = Math.floor(totalSeconds / 3600);
    const rem = totalSeconds % 3600;
    const nextMinutes = Math.floor(rem / 60);
    const nextSeconds = rem % 60;

    const nextH = nextHours > 0 ? String(nextHours) : '';
    const nextM = nextMinutes > 0 ? String(nextMinutes) : '';
    const nextS = nextSeconds > 0 ? String(nextSeconds) : '';

    setDurationHours(nextH);
    setDurationMinutes(nextM);
    setDurationSeconds(nextS);
    syncDurationField(nextH, nextM, nextS);
  };

  const normalizeEditorContent = (raw: any) => {
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      const doc = raw as any;
      const first = Array.isArray(doc?.content) ? doc.content[0] : null;
      const legacyText = typeof first?.text === 'string' && !first?.content ? first.text : null;
      return legacyText ?? raw;
    }
    return String(raw);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const inferredHasVideo = Boolean(initialData.type === 'VIDEO' || initialData.videoId || initialData.videoUrl);
        const inferredHasDocuments = Array.isArray(initialData.attachments) ? initialData.attachments.length > 0 : false;
        setHasVideo(inferredHasVideo);
        setHasDocuments(inferredHasDocuments);

        const inferredVideoUrl =
          typeof initialData.videoUrl === 'string' && initialData.videoUrl
            ? initialData.videoUrl
            : typeof initialData.videoId === 'string' && initialData.videoId
              ? `https://www.youtube.com/watch?v=${initialData.videoId}`
              : '';

        reset({
          title: initialData.title,
          content: normalizeEditorContent(initialData.content),
          videoUrl: inferredVideoUrl,
          duration: initialData.duration || 0,
          isPreview: initialData.isPreview || false,
        });
        const initMinutes = typeof initialData.duration === 'number' ? Math.max(0, Math.floor(initialData.duration)) : 0;
        if (initMinutes > 0) {
          const initHours = Math.floor(initMinutes / 60);
          const initMins = initMinutes % 60;
          setDurationHours(initHours > 0 ? String(initHours) : '');
          setDurationMinutes(initMins > 0 ? String(initMins) : '');
          setDurationSeconds('');
        } else {
          setDurationHours('');
          setDurationMinutes('');
          setDurationSeconds('');
        }
        setAttachments(initialData.attachments || []);
        setLessonIdForUpload(typeof initialData.id === 'string' ? initialData.id : null);
      } else {
        reset({ title: '', content: '', videoUrl: '', duration: 0, isPreview: false });
        setAttachments([]);
        setHasVideo(true);
        setHasDocuments(false);
        setDurationHours('');
        setDurationMinutes('');
        setDurationSeconds('');
        setLessonIdForUpload(null);
      }
    }
  }, [isOpen, initialData, reset]);

  const createDraftLessonIfNeeded = async () => {
    if (lessonIdForUpload) return lessonIdForUpload;
    if (!courseId || !moduleId) throw new Error('Konteks kursus/modul tidak ditemukan');

    const title = (watch('title') || '').trim() || 'Pelajaran Baru';
    const content = watch('content') || '';
    const videoUrl = watch('videoUrl') || '';
    const duration = Number(watch('duration') || 0) || 0;
    const isPreview = Boolean(watch('isPreview'));

    const payload = {
      title,
      content,
      type: hasVideo ? 'VIDEO' : 'TEXT',
      videoUrl: hasVideo ? videoUrl : '',
      duration,
      isPreview,
      moduleId,
      order: initialOrder,
    };

    const res = await fetch(`/api/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Gagal membuat pelajaran');
    }
    if (data && typeof data.id === 'string') {
      setLessonIdForUpload(data.id);
      onDraftCreated?.(data);
      return data.id as string;
    }
    throw new Error('Gagal membuat pelajaran');
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);
    try {
      const lessonId = await createDraftLessonIfNeeded();
      const uploaded: any[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('lessonId', lessonId);

        const res = await fetch('/api/uploads/lesson-attachment', { method: 'POST', body: formData });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Gagal mengunggah');
        }

        uploaded.push(data);
      }

      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success('Dokumen berhasil diunggah');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengunggah dokumen');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!attachmentId) return;
    setDeletingId(attachmentId);
    try {
      const res = await fetch(`/api/uploads/lesson-attachment/${attachmentId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menghapus');
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success('Lampiran dihapus');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus lampiran');
    } finally {
      setDeletingId(null);
    }
  };

  const onSubmit = async (data: LessonFormInput) => {
    const parsed: LessonFormData = lessonSchema.parse(data);
    await onSave({
      ...parsed,
      type: hasVideo ? 'VIDEO' : 'TEXT',
      videoUrl: hasVideo ? parsed.videoUrl : '',
      attachments,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 lg:p-4 animate-in fade-in">
      <div className="bg-white lg:rounded-2xl w-full h-full lg:h-[85vh] lg:max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col lg:flex-row">
        
        {/* Main Content (Left) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 h-full overflow-hidden">
          <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0 h-16 lg:h-auto">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="lg:hidden p-1 -ml-2 text-slate-500"><X className="w-5 h-5"/></button>
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 hidden lg:block">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base lg:text-lg text-slate-900 leading-tight">
                  {initialData ? 'Edit Pelajaran' : 'Tambah Pelajaran'}
                </h3>
                <p className="text-xs text-slate-500 hidden lg:block">Isi materi pembelajaran video dan/atau dokumen</p>
              </div>
            </div>
            <button onClick={onClose} className="hidden lg:block p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Judul Pelajaran</label>
              <input 
                {...register('title')}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 outline-none text-slate-900 font-medium placeholder:font-normal placeholder:text-slate-400"
                placeholder="Contoh: Pengenalan ArcGIS Pro"
              />
              {errors.title && <p className="text-red-500 text-xs font-medium">{errors.title.message}</p>}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Tipe Materi</label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={
                    hasVideo
                      ? "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-bold text-sm transition-all cursor-pointer select-none"
                      : "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold text-sm transition-all cursor-pointer select-none"
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={hasVideo}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (!next && !hasDocuments) {
                        toast.error('Pilih minimal satu tipe materi');
                        return;
                      }
                      setHasVideo(next);
                    }}
                  />
                  <Video className="w-4 h-4" />
                  Video
                </label>

                <label
                  className={
                    hasDocuments
                      ? "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-bold text-sm transition-all cursor-pointer select-none"
                      : "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold text-sm transition-all cursor-pointer select-none"
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={hasDocuments}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (!next && !hasVideo) {
                        toast.error('Pilih minimal satu tipe materi');
                        return;
                      }
                      setHasDocuments(next);
                    }}
                  />
                  <FileText className="w-4 h-4" />
                  Dokumen
                </label>
              </div>
            </div>

            <div className="space-y-1.5 h-full min-h-[300px] flex flex-col">
              <label className="text-sm font-bold text-slate-700">Konten / Deskripsi</label>
              <div className="prose-sm flex-1 border border-slate-200 rounded-xl overflow-hidden">
                <RichTextEditor 
                  value={watch('content') || ''} 
                  onChange={(html) => setValue('content', html)} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Settings (Right) */}
        <div className="w-full lg:w-80 bg-slate-50 flex flex-col shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 h-auto lg:h-full max-h-[40vh] lg:max-h-none overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 hidden lg:block">
            <h4 className="font-bold text-slate-800 text-sm">Pengaturan</h4>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Featured Image */}
            <div className="space-y-2 hidden lg:block">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gambar Unggulan</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-100 transition-colors cursor-pointer bg-white">
                <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                <span className="text-xs text-slate-500 font-medium">Unggah Gambar</span>
              </div>
            </div>

            {/* Video Source */}
            {hasVideo ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sumber Video</label>
                <div className="space-y-2">
                  <input 
                    {...register('videoUrl')}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-600 outline-none text-slate-800 font-medium"
                    placeholder="URL YouTube..."
                  />
                  <input type="hidden" {...register('duration', { valueAsNumber: true })} />
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        inputMode="numeric"
                        value={durationHours}
                        onChange={(e) => {
                          const next = onlyDigits(e.target.value);
                          setDurationHours(next);
                          syncDurationField(next, durationMinutes, durationSeconds);
                        }}
                        onBlur={() => normalizeDurationParts(durationHours, durationMinutes, durationSeconds)}
                        className="w-full pl-3 pr-12 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-600 outline-none text-slate-800 font-bold"
                        placeholder=""
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">hour</span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        inputMode="numeric"
                        value={durationMinutes}
                        onChange={(e) => {
                          const next = onlyDigits(e.target.value);
                          setDurationMinutes(next);
                          syncDurationField(durationHours, next, durationSeconds);
                        }}
                        onBlur={() => normalizeDurationParts(durationHours, durationMinutes, durationSeconds)}
                        className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-600 outline-none text-slate-800 font-bold"
                        placeholder=""
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">min</span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        inputMode="numeric"
                        value={durationSeconds}
                        onChange={(e) => {
                          const next = onlyDigits(e.target.value);
                          setDurationSeconds(next);
                          syncDurationField(durationHours, durationMinutes, next);
                        }}
                        onBlur={() => normalizeDurationParts(durationHours, durationMinutes, durationSeconds)}
                        className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-600 outline-none text-slate-800 font-bold"
                        placeholder=""
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">sec</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Attachments */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lampiran</label>
              <div className="space-y-2">
                {attachments.length > 0 ? (
                  <div className="space-y-1">
                    {attachments.slice(0, 3).map((file) => (
                      <div key={file.id} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="truncate max-w-[150px] text-slate-700 font-medium">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setIsAttachmentModalOpen(true)}
                          className="text-slate-500 hover:text-slate-700 font-bold"
                        >
                          Kelola
                        </button>
                      </div>
                    ))}
                    {attachments.length > 3 ? (
                      <div className="text-[11px] text-slate-500 text-center">+{attachments.length - 3} dokumen lainnya</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 bg-slate-100 p-3 rounded-lg text-center border border-slate-200">
                    {lessonIdForUpload ? 'Belum ada dokumen.' : 'Unggah dokumen akan otomatis membuat pelajaran draft.'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsAttachmentModalOpen(true)}
                  disabled={!hasDocuments}
                  className="w-full inline-flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold transition-all border border-dashed disabled:opacity-60 disabled:cursor-not-allowed border-indigo-200 text-indigo-600 bg-white hover:bg-slate-50 hover:border-indigo-400"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Kelola Dokumen
                </button>
                {!hasDocuments ? (
                  <div className="text-[11px] text-slate-500 text-center">Aktifkan Dokumen pada Tipe Materi untuk mengunggah lampiran.</div>
                ) : null}
              </div>
            </div>

            {/* Preview Toggle */}
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-slate-700">Gratis (Public)</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register('isPreview')} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-white flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:shadow-none z-10">
             <button 
               type="button" 
               onClick={onClose}
               className="hidden lg:block px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-sm transition-colors"
             >
               Batal
             </button>
             <button 
               type="button" 
               onClick={handleSubmit(onSubmit)}
               disabled={isSubmitting || isLoading}
               className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
             >
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               Simpan
             </button>
          </div>
        </div>

      </div>
      {isAttachmentModalOpen ? (
        <LessonAttachmentModal
          isOpen={isAttachmentModalOpen}
          onClose={() => setIsAttachmentModalOpen(false)}
          attachments={attachments}
          onUploadFiles={uploadFiles}
          onDeleteAttachment={handleDeleteAttachment}
          isUploading={isUploading}
          deletingId={deletingId}
          disabled={!hasDocuments}
        />
      ) : null}
    </div>
  );
}
