"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, X, Video, FileText } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

const lessonSchema = z.object({
  title: z.string().min(3, "Judul pelajaran minimal 3 karakter"),
  type: z.enum(['VIDEO', 'TEXT']),
  content: z.string().optional(),
  videoUrl: z.string().optional(),
});

type LessonFormData = z.infer<typeof lessonSchema>;

interface LessonEditorProps {
  courseId: string;
  moduleId: string;
  lesson: any;
  onClose: () => void;
}

export default function LessonEditor({ courseId, moduleId, lesson, onClose }: LessonEditorProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeType, setActiveType] = useState<'VIDEO' | 'TEXT'>(lesson.type);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LessonFormData>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: lesson.title,
      type: lesson.type,
      content: typeof lesson.content === 'string' 
        ? lesson.content 
        : (lesson.content?.content?.[0]?.text || ''), // Simple unwrap for rich text
      videoUrl: lesson.videoId ? `https://www.youtube.com/watch?v=${lesson.videoId}` : '',
    }
  });

  const currentVideoUrl = watch('videoUrl');
  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  const previewVideoId = activeType === 'VIDEO' && currentVideoUrl ? getYoutubeId(currentVideoUrl) : null;

  const onSubmit = async (data: LessonFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons/${lesson.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, type: activeType, moduleId }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan perubahan');

      toast.success('Pelajaran berhasil diperbarui');
      router.refresh();
      onClose();
    } catch (error) {
      toast.error('Terjadi kesalahan saat menyimpan pelajaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Edit Pelajaran</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">Judul Pelajaran</label>
            <input 
              {...register('title')} 
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 text-slate-900 font-medium"
              placeholder="Contoh: Pengenalan Geologi Dasar"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-3">Tipe Materi</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => { setActiveType('VIDEO'); setValue('type', 'VIDEO'); }}
                className={twMerge(
                  "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all",
                  activeType === 'VIDEO' 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700" 
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                )}
              >
                <Video className="w-5 h-5" />
                <span className="font-medium">Video</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveType('TEXT'); setValue('type', 'TEXT'); }}
                className={twMerge(
                  "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all",
                  activeType === 'TEXT' 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700" 
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                )}
              >
                <FileText className="w-5 h-5" />
                <span className="font-medium">Teks / Artikel</span>
              </button>
            </div>
          </div>

          {/* Dynamic Content Fields */}
          {activeType === 'VIDEO' ? (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-bold text-slate-800 mb-1.5">URL Video</label>
              <input 
                {...register('videoUrl')} 
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 text-slate-900"
                placeholder="https://youtube.com/..."
              />
              <p className="text-xs text-slate-500 mt-1">Masukkan link video dari YouTube, Vimeo, atau hosting lainnya.</p>
              
              {previewVideoId && (
                <div className="mt-4 aspect-video rounded-lg overflow-hidden bg-black shadow-sm border border-slate-200">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${previewVideoId}`}
                    title="Video Preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-bold text-slate-800 mb-1.5">Konten Artikel</label>
              <textarea 
                {...register('content')} 
                rows={8}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 text-slate-900"
                placeholder="Tulis materi pelajaran di sini..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
