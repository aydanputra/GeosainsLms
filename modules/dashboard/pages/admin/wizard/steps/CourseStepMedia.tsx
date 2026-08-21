"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/incompatible-library */

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Image as ImageIcon, Upload, ArrowRight, Youtube, Video } from 'lucide-react';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const mediaSchema = z.object({
  thumbnailUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || v.startsWith('/') || isHttpUrl(v), { message: 'URL gambar tidak valid' }),
  introVideoUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || isHttpUrl(v), { message: 'URL video tidak valid' }),
});

type MediaFormData = z.infer<typeof mediaSchema>;

interface CourseStepMediaProps {
  initialData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
}

// Helper to extract Youtube/Vimeo ID for preview
const getVideoEmbedUrl = (url: string) => {
  if (!url) return null;
  
  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]*)/);
  if (ytMatch && ytMatch[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  
  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  
  return null;
};

export default function CourseStepMedia({ initialData, onNext, onBack }: CourseStepMediaProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'GALLERY' | 'UPLOAD'>('GALLERY');
  const initialThumbnail =
    typeof initialData?.thumbnailUrl === 'string' && initialData.thumbnailUrl.startsWith('blob:') ? '' : (initialData?.thumbnailUrl || '');
  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<MediaFormData>({
    resolver: zodResolver(mediaSchema),
    defaultValues: {
      thumbnailUrl: initialThumbnail,
      introVideoUrl: initialData?.introVideoUrl || '',
    }
  });

  const thumbnail = watch('thumbnailUrl');
  const introVideo = watch('introVideoUrl');
  const embedUrl = getVideoEmbedUrl(introVideo || '');
  const canPreviewThumbnail = useMemo(() => !!thumbnail && !thumbnail.startsWith('blob:'), [thumbnail]);

  const onSubmit = (data: MediaFormData) => {
    onNext(data);
  };

  return (
    <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900">Media & Preview</h3>
          <p className="text-slate-500">Unggah thumbnail dan materi pendukung visual kursus Anda.</p>
        </div>

        <form id="step-media-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-100 transition-colors group relative">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-indigo-600" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">Thumbnail Kursus</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Untuk upload media, gunakan modal Media. Format: JPG, PNG, atau WEBP. Ukuran rekomendasi 1280x720px.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setPickerTab('UPLOAD');
                  setIsPickerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
              >
                <Upload className="w-4 h-4" />
                Upload via Media
              </button>
              <button
                type="button"
                onClick={() => {
                  setPickerTab('GALLERY');
                  setIsPickerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                Pilih dari Media
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Atau gunakan URL Gambar</label>
            <div className="relative">
              <ImageIcon className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input 
                {...register('thumbnailUrl')}
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none text-slate-900"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            {errors.thumbnailUrl && <p className="text-red-500 text-xs mt-1">{errors.thumbnailUrl.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Video Intro (Opsional)</label>
            <div className="relative">
              <Youtube className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input 
                {...register('introVideoUrl')}
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none text-slate-900"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Masukkan URL video dari YouTube atau Vimeo.</p>
            {errors.introVideoUrl && <p className="text-red-500 text-xs mt-1">{errors.introVideoUrl.message}</p>}
          </div>

          {((thumbnail && canPreviewThumbnail) || embedUrl) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {thumbnail && canPreviewThumbnail && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Preview Thumbnail</label>
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 group">
                    <img src={thumbnail} alt="Preview" className="w-full h-full object-cover" />
                    {embedUrl && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Video className="w-5 h-5 text-indigo-600 ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {embedUrl && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Preview Video Intro</label>
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-black">
                    <iframe 
                      src={embedUrl} 
                      className="w-full h-full" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-6 border-t border-slate-200 mt-10">
            <button 
              type="button" 
              onClick={onBack}
              className="h-11 px-8 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Kembali
            </button>
            <button 
              type="submit" 
              className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              Lanjut <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
      <MediaPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        initialTab={pickerTab}
        onSelect={(item) => {
          setValue('thumbnailUrl', item.url, { shouldDirty: true, shouldValidate: true });
        }}
      />
    </div>
  );
}
