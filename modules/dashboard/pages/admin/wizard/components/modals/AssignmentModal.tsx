
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Save, FileText, Upload, Calendar, Loader2, Paperclip } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import LessonAttachmentModal from '@/modules/media/components/LessonAttachmentModal';

// Dynamic Rich Text Editor
const RichTextEditor = dynamic(() => import('@/modules/course/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-50 animate-pulse rounded-xl" />
});

const assignmentSchema = z.object({
  title: z.string().min(3, "Judul tugas minimal 3 karakter"),
  description: z.string().default(''),
  timeLimitValue: z.number().min(0).default(0),
  timeLimitUnit: z.enum(['MINUTES', 'HOURS', 'DAYS', 'WEEKS']).default('WEEKS'),
  setDeadlineFromStartTime: z.boolean().default(false),
  totalPoints: z.number().min(0).default(10),
  passingGrade: z.number().min(0).default(8),
  fileUploadLimit: z.number().min(1).default(1),
  maxFileSize: z.number().min(1).max(50).default(2),
  allowResubmission: z.boolean().default(true),
  maxResubmissionAttempts: z.number().min(1).default(5),
});

type AssignmentFormInput = z.input<typeof assignmentSchema>;
type AssignmentFormData = z.output<typeof assignmentSchema>;

interface AssignmentModalProps {
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

function toMinutes(value: number, unit: AssignmentFormData['timeLimitUnit']) {
  const v = Number.isFinite(value) ? Number(value) : 0;
  if (v <= 0) return 0;
  if (unit === 'MINUTES') return Math.round(v);
  if (unit === 'HOURS') return Math.round(v * 60);
  if (unit === 'DAYS') return Math.round(v * 24 * 60);
  return Math.round(v * 7 * 24 * 60);
}

export default function AssignmentModal({
  isOpen,
  onClose,
  onSave,
  onDraftCreated,
  initialData,
  isLoading,
  courseId,
  moduleId,
  initialOrder = 0,
}: AssignmentModalProps) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<AssignmentFormInput>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: '',
      description: '',
      timeLimitValue: 0,
      timeLimitUnit: 'WEEKS',
      setDeadlineFromStartTime: false,
      totalPoints: 10,
      passingGrade: 8,
      fileUploadLimit: 1,
      maxFileSize: 2,
      allowResubmission: true,
      maxResubmissionAttempts: 5,
    }
  });

  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lessonIdForUpload, setLessonIdForUpload] = useState<string | null>(null);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);

  const totalPoints = Number(watch('totalPoints') || 0) || 0;
  const allowResubmission = Boolean(watch('allowResubmission'));

  useEffect(() => {
    if (isOpen) {
      if (initialData && initialData.type === 'ASSIGNMENT') {
        const assignmentData = initialData.assignment || {};
        const content = initialData.content && typeof initialData.content === 'object' ? initialData.content : {};
        const settings =
          content && typeof (content as any).assignmentSettings === 'object' && (content as any).assignmentSettings
            ? (content as any).assignmentSettings
            : {};

        const existingTimeLimitMinutes =
          typeof assignmentData.timeLimit === 'number' && Number.isFinite(assignmentData.timeLimit) ? Number(assignmentData.timeLimit) : 0;

        let timeLimitUnit: AssignmentFormData['timeLimitUnit'] = 'MINUTES';
        let timeLimitValue = existingTimeLimitMinutes;
        if (existingTimeLimitMinutes % (7 * 24 * 60) === 0 && existingTimeLimitMinutes > 0) {
          timeLimitUnit = 'WEEKS';
          timeLimitValue = existingTimeLimitMinutes / (7 * 24 * 60);
        } else if (existingTimeLimitMinutes % (24 * 60) === 0 && existingTimeLimitMinutes > 0) {
          timeLimitUnit = 'DAYS';
          timeLimitValue = existingTimeLimitMinutes / (24 * 60);
        } else if (existingTimeLimitMinutes % 60 === 0 && existingTimeLimitMinutes > 0) {
          timeLimitUnit = 'HOURS';
          timeLimitValue = existingTimeLimitMinutes / 60;
        }

        reset({
          title: initialData.title,
          description: assignmentData.description || '',
          timeLimitValue: typeof settings.timeLimitValue === 'number' ? settings.timeLimitValue : timeLimitValue,
          timeLimitUnit: typeof settings.timeLimitUnit === 'string' ? settings.timeLimitUnit : timeLimitUnit,
          setDeadlineFromStartTime: Boolean(settings.setDeadlineFromStartTime),
          totalPoints: typeof settings.totalPoints === 'number' ? settings.totalPoints : 10,
          passingGrade: typeof assignmentData.passingGrade === 'number' ? assignmentData.passingGrade : 0,
          fileUploadLimit: typeof settings.fileUploadLimit === 'number' ? settings.fileUploadLimit : 1,
          maxFileSize: typeof assignmentData.maxFileSize === 'number' ? assignmentData.maxFileSize : 2,
          allowResubmission: typeof settings.allowResubmission === 'boolean' ? settings.allowResubmission : true,
          maxResubmissionAttempts: typeof settings.maxResubmissionAttempts === 'number' ? settings.maxResubmissionAttempts : 5,
        });
        setAttachments(Array.isArray(initialData.attachments) ? initialData.attachments : []);
        setLessonIdForUpload(typeof initialData.id === 'string' ? initialData.id : null);
      } else {
        reset({
          title: '',
          description: '',
          timeLimitValue: 0,
          timeLimitUnit: 'WEEKS',
          setDeadlineFromStartTime: false,
          totalPoints: 10,
          passingGrade: 8,
          fileUploadLimit: 1,
          maxFileSize: 2,
          allowResubmission: true,
          maxResubmissionAttempts: 5,
        });
        setAttachments([]);
        setLessonIdForUpload(null);
      }
    }
  }, [isOpen, initialData, reset]);

  const createDraftLessonIfNeeded = async () => {
    if (lessonIdForUpload) return lessonIdForUpload;
    if (!courseId || !moduleId) throw new Error('Konteks kursus/modul tidak ditemukan');

    const title = (watch('title') || '').trim() || 'Tugas Baru';
    const payload = {
      title,
      type: 'ASSIGNMENT',
      assignment: {
        description: watch('description') || '',
        timeLimit: toMinutes(Number(watch('timeLimitValue') || 0) || 0, (watch('timeLimitUnit') as any) || 'WEEKS'),
        passingGrade: Number(watch('passingGrade') || 0) || 0,
        maxFileSize: Number(watch('maxFileSize') || 2) || 2,
      },
      content: {
        assignmentSettings: {
          timeLimitValue: Number(watch('timeLimitValue') || 0) || 0,
          timeLimitUnit: (watch('timeLimitUnit') as any) || 'WEEKS',
          setDeadlineFromStartTime: Boolean(watch('setDeadlineFromStartTime')),
          totalPoints: Number(watch('totalPoints') || 0) || 0,
          fileUploadLimit: Number(watch('fileUploadLimit') || 1) || 1,
          allowResubmission: Boolean(watch('allowResubmission')),
          maxResubmissionAttempts: Number(watch('maxResubmissionAttempts') || 1) || 1,
        },
      },
      moduleId,
      order: initialOrder,
    };

    const res = await fetch(`/api/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || data?.message || 'Gagal membuat tugas');
    if (data && typeof data.id === 'string') {
      setLessonIdForUpload(data.id);
      onDraftCreated?.(data);
      return data.id as string;
    }
    throw new Error('Gagal membuat tugas');
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
        if (!res.ok) throw new Error(data?.error || 'Gagal mengunggah');
        uploaded.push(data);
      }

      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success('Lampiran berhasil diunggah');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengunggah lampiran');
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
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus');
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success('Lampiran dihapus');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus lampiran');
    } finally {
      setDeletingId(null);
    }
  };

  const onSubmit = async (data: AssignmentFormInput) => {
    try {
      const parsed: AssignmentFormData = assignmentSchema.parse(data);
      const minutes = toMinutes(parsed.timeLimitValue, parsed.timeLimitUnit);
      const rawContent = initialData?.content && typeof initialData.content === 'object' ? initialData.content : {};
      const mergedContent =
        rawContent && typeof rawContent === 'object'
          ? {
              ...(rawContent as any),
              assignmentSettings: {
                timeLimitValue: parsed.timeLimitValue,
                timeLimitUnit: parsed.timeLimitUnit,
                setDeadlineFromStartTime: parsed.setDeadlineFromStartTime,
                totalPoints: parsed.totalPoints,
                fileUploadLimit: parsed.fileUploadLimit,
                allowResubmission: parsed.allowResubmission,
                maxResubmissionAttempts: parsed.maxResubmissionAttempts,
              },
            }
          : {
              assignmentSettings: {
                timeLimitValue: parsed.timeLimitValue,
                timeLimitUnit: parsed.timeLimitUnit,
                setDeadlineFromStartTime: parsed.setDeadlineFromStartTime,
                totalPoints: parsed.totalPoints,
                fileUploadLimit: parsed.fileUploadLimit,
                allowResubmission: parsed.allowResubmission,
                maxResubmissionAttempts: parsed.maxResubmissionAttempts,
              },
            };
      const payload = {
        title: parsed.title,
        type: 'ASSIGNMENT', // This will be handled by backend to create Assignment relation
        content: mergedContent,
        assignment: {
          description: parsed.description,
          timeLimit: minutes,
          passingGrade: parsed.passingGrade,
          maxFileSize: parsed.maxFileSize,
        }
      };
      await onSave(payload);
    } catch (error) {
      console.error("Error saving assignment:", error);
    }
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
              <div className="p-2 bg-purple-100 rounded-lg text-purple-600 hidden lg:block">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base lg:text-lg text-slate-900 leading-tight">
                  {initialData ? 'Edit Tugas' : 'Buat Tugas Baru'}
                </h3>
                <p className="text-xs text-slate-500 hidden lg:block">Tugas praktik untuk evaluasi pemahaman siswa</p>
              </div>
            </div>
            <button onClick={onClose} className="hidden lg:block p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Judul Tugas</label>
              <input 
                {...register('title')}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none text-slate-900 font-medium placeholder:font-normal placeholder:text-slate-400"
                placeholder="Contoh: Studi Kasus Lapangan..."
              />
              {errors.title && <p className="text-red-500 text-xs font-medium">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5 h-full min-h-[300px] flex flex-col">
              <label className="text-sm font-bold text-slate-700">Instruksi Tugas</label>
              <div className="prose-sm flex-1 border border-slate-200 rounded-xl overflow-hidden">
                <RichTextEditor 
                  value={watch('description') || ''}
                  onChange={(html) => setValue('description', html)} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Settings (Right) */}
        <div className="w-full lg:w-80 bg-slate-50 flex flex-col shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 h-auto lg:h-full max-h-[40vh] lg:max-h-none overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 hidden lg:block">
            <h4 className="font-bold text-slate-800 text-sm">Pengaturan Tugas</h4>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lampiran</label>
              <button
                type="button"
                onClick={() => setIsAttachmentModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-indigo-600 font-bold text-sm hover:bg-slate-50"
              >
                <Paperclip className="w-4 h-4" />
                Upload Lampiran
              </button>
              {attachments.length > 0 ? (
                <div className="text-[11px] text-slate-500 font-medium">{attachments.length} lampiran</div>
              ) : null}
            </div>

            {/* Time Limit */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batas Waktu</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    {...register('timeLimitValue', { valueAsNumber: true })}
                    className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-slate-800 font-bold text-sm"
                    placeholder="0"
                  />
                  <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                </div>
                <select
                  {...register('timeLimitUnit')}
                  className="w-32 px-3 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold text-sm outline-none focus:border-purple-600"
                >
                  <option value="MINUTES">Menit</option>
                  <option value="HOURS">Jam</option>
                  <option value="DAYS">Hari</option>
                  <option value="WEEKS">Minggu</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">0 = Tanpa batas waktu</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-slate-700">Deadline dari Waktu Mulai</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register('setDeadlineFromStartTime')} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Poin</label>
              <input
                type="number"
                {...register('totalPoints', { valueAsNumber: true })}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-slate-800 font-bold text-sm"
                min={0}
              />
            </div>

            {/* Passing Grade */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Poin Lulus Minimal</label>
              <input
                type="number"
                {...register('passingGrade', { valueAsNumber: true })}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-slate-800 font-bold text-sm"
                min={0}
                max={totalPoints || undefined}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batas Upload File</label>
              <input
                type="number"
                {...register('fileUploadLimit', { valueAsNumber: true })}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-slate-800 font-bold text-sm"
                min={1}
              />
              <p className="text-[10px] text-slate-400 font-medium">Maksimal jumlah file yang bisa dikirim dalam 1 submission.</p>
            </div>

            {/* Max File Size */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Maksimal Ukuran File</label>
              <div className="relative">
                <input 
                  type="number" 
                  {...register('maxFileSize', { valueAsNumber: true })}
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-slate-800 font-bold text-sm"
                  max={50} min={1}
                />
                <Upload className="absolute left-3.5 top-3 w-4 h-4 text-slate-400"/>
                <span className="absolute right-4 top-3 text-xs text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">MB</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Maksimal 50 MB per file.</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-slate-700">Izinkan Kirim Ulang</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register('allowResubmission')} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Maksimum Percobaan Kirim Ulang</label>
              <input
                type="number"
                {...register('maxResubmissionAttempts', { valueAsNumber: true })}
                disabled={!allowResubmission}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-slate-800 font-bold text-sm disabled:bg-slate-100 disabled:text-slate-400"
                min={1}
              />
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-800 font-medium">
                Siswa dapat mengunggah file PDF, DOCX, ZIP, atau Gambar sebagai jawaban tugas ini.
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

      <LessonAttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        attachments={attachments.map((a: any) => ({
          id: String(a.id),
          name: String(a.name || ''),
          type: String(a.type || ''),
          url: String(a.url || ''),
        }))}
        onUploadFiles={uploadFiles}
        onDeleteAttachment={handleDeleteAttachment}
        isUploading={isUploading}
        deletingId={deletingId}
        disabled={false}
      />
    </div>
  );
}
