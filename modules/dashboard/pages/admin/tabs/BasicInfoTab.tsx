"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const courseSchema = z.object({
  title: z.string().min(3, "Judul kursus minimal 3 karakter"),
  description: z.string().optional(),
  instructorId: z.string().min(1, "Pilih mentor"),
  price: z.number().min(0, "Harga tidak boleh negatif"),
  thumbnailUrl: z.string().optional(),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface BasicInfoTabProps {
  course: any;
  mentors: { id: string; name: string }[];
}

export default function BasicInfoTab({ course, mentors }: BasicInfoTabProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: course.title,
      description: course.description || '',
      instructorId: course.instructorId || '',
      price: course.price,
      thumbnailUrl: course.thumbnailUrl || '',
    }
  });

  const onSubmit = async (data: CourseFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PUT', // Assuming PUT for update, or PATCH
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Gagal menyimpan perubahan');

      alert('Perubahan berhasil disimpan');
      router.refresh();
    } catch (error) {
      alert('Terjadi kesalahan saat menyimpan perubahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 p-2.5 text-sm text-slate-900 font-medium placeholder:text-slate-400";
  const labelClasses = "block text-sm font-bold text-slate-800 mb-1.5";
  const errorClasses = "text-red-500 text-xs mt-1.5";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className={labelClasses}>Judul Kursus</label>
          <input 
            {...register('title')} 
            className={inputClasses}
            placeholder="Contoh: Dasar-dasar Geologi Struktur"
          />
          {errors.title && <p className={errorClasses}>{errors.title.message}</p>}
        </div>

        <div>
          <label className={labelClasses}>Deskripsi</label>
          <textarea 
            {...register('description')} 
            rows={5}
            className={inputClasses}
            placeholder="Jelaskan detail kursus Anda di sini..."
          />
          <p className="text-xs text-slate-500 mt-1">Tulis deskripsi yang menarik untuk calon siswa.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClasses}>Mentor</label>
            <select 
              {...register('instructorId')} 
              className={inputClasses}
            >
              <option value="">Pilih Mentor</option>
              {mentors.map(mentor => (
                <option key={mentor.id} value={mentor.id}>{mentor.name}</option>
              ))}
            </select>
            {errors.instructorId && <p className={errorClasses}>{errors.instructorId.message}</p>}
          </div>

          <div>
            <label className={labelClasses}>Harga (IDR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-medium">Rp</span>
              <input 
                type="number"
                {...register('price', { valueAsNumber: true })} 
                className={twMerge(inputClasses, "pl-10")}
                placeholder="0"
              />
            </div>
            {errors.price && <p className={errorClasses}>{errors.price.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClasses}>Thumbnail URL</label>
          <input 
            {...register('thumbnailUrl')} 
            placeholder="https://example.com/image.jpg"
            className={inputClasses}
          />
          <p className="text-xs text-slate-500 mt-1">Masukkan URL gambar untuk cover kursus.</p>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button 
          type="submit" 
          disabled={isSubmitting || !isDirty}
          className="px-6 py-2.5 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Simpan Perubahan
            </>
          )}
        </button>
      </div>
    </form>
  );
}