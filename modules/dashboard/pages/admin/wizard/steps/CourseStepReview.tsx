"use client";

import { CheckCircle, AlertCircle, FileText, Video, User, Tag, DollarSign, Image as ImageIcon, ArrowRight, Check, XCircle, Eye } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface CourseStepReviewProps {
  courseData: any;
  onPublish: () => void;
  onBack: () => void;
  isPublishing: boolean;
}

export default function CourseStepReview({ courseData, onPublish, onBack, isPublishing }: CourseStepReviewProps) {
  if (!courseData) return null;

  const { title, description, instructor, category, price, normalPrice, thumbnailUrl, modules, slug } = courseData;

  // Ensure modules is an array
  const safeModules = Array.isArray(modules) ? modules : [];
  const totalLessons = safeModules.reduce((acc: number, m: any) => acc + (Array.isArray(m.lessons) ? m.lessons.length : 0), 0);

  // Debugging: Log courseData to check structure
  console.log("Review Step Data:", { modules: safeModules, totalLessons, courseData });

  // Validation Logic
  const checks = [
    {
      label: 'Judul Kursus',
      isValid: !!title && title.length >= 5,
      error: 'Judul minimal 5 karakter'
    },
    {
      label: 'Deskripsi',
      isValid: !!description && description.length >= 20,
      error: 'Deskripsi minimal 20 karakter'
    },
    {
      label: 'Thumbnail',
      isValid: !!thumbnailUrl,
      error: 'Wajib upload thumbnail'
    },
    {
      label: 'Kategori & Instruktur',
      isValid: !!(category?.id || courseData.categoryId) && !!(instructor?.id || courseData.instructorId),
      error: 'Pilih kategori dan instruktur'
    },
    {
      label: 'Kurikulum',
      isValid: safeModules.length > 0,
      error: 'Minimal 1 Modul'
    },
    {
      label: 'Konten Pelajaran',
      isValid: totalLessons > 0,
      error: 'Minimal 1 Pelajaran'
    },
    {
      label: 'Harga',
      isValid: price !== undefined && price !== null && price >= 0,
      error: 'Harga tidak valid'
    }
  ];

  const allValid = checks.every(c => c.isValid);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">Review & Publish</h3>
          <p className="text-sm text-slate-500">Periksa kembali semua informasi sebelum mempublikasikan kursus.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Validation Checklist */}
            <div className={`rounded-2xl p-4 sm:p-6 border ${allValid ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
              <h4 className={`font-bold flex items-center gap-2 mb-4 text-sm sm:text-base ${allValid ? 'text-emerald-800' : 'text-amber-800'}`}>
                {allValid ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {allValid ? 'Siap Publikasi' : 'Lengkapi Data Berikut'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {checks.map((check, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                    {check.isValid ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span className={check.isValid ? 'text-slate-700' : 'text-red-600 font-bold'}>
                      {check.label} {(!check.isValid && check.error) && <span className="text-xs text-red-400 font-normal">({check.error})</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-100 space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                <FileText className="w-4 h-4 text-indigo-600" /> Informasi Dasar
              </h4>
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold">Judul</span>
                  <p className="text-slate-900 font-bold text-base sm:text-lg leading-tight">{title}</p>
                </div>
                <div>
                  <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold">Deskripsi</span>
                  <p className="text-slate-600 text-sm mt-1 line-clamp-3 leading-relaxed">{description || '-'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                     <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1"><User className="w-3 h-3" /> Instruktur</span>
                     <p className="text-slate-900 font-medium text-sm">{instructor?.name || courseData.instructorId || '-'}</p>
                  </div>
                  <div>
                     <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1"><Tag className="w-3 h-3" /> Kategori</span>
                     <p className="text-slate-900 font-medium text-sm">{category?.name || courseData.categoryId || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Curriculum Summary */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                  <Video className="w-4 h-4 text-indigo-600" /> Kurikulum
                </h4>
                <span className="text-xs font-bold bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 w-fit">
                  {safeModules.length} Modul • {totalLessons} Pelajaran
                </span>
              </div>
              {safeModules.length > 0 ? (
                <div className="space-y-2">
                  {safeModules.map((m: any, idx: number) => (
                    <div key={m.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-700 truncate mr-2">{idx + 1}. {m.title}</span>
                      <span className="text-slate-400 text-xs shrink-0 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{m.lessons?.length || 0} Pelajaran</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Belum ada modul yang ditambahkan.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Pricing Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                <DollarSign className="w-4 h-4 text-indigo-600" /> Harga
              </h4>
              <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-100">
                {typeof normalPrice === 'number' && normalPrice > 0 && (price <= 0 || normalPrice > price) ? (
                  <div className="text-sm font-semibold text-slate-500 line-through">
                    IDR {Number(normalPrice).toLocaleString('id-ID')}
                  </div>
                ) : null}
                {price > 0 ? (
                  <div className="text-xl sm:text-2xl font-bold text-slate-900">IDR {price.toLocaleString('id-ID')}</div>
                ) : (
                  <div className="text-xl sm:text-2xl font-bold text-green-600">GRATIS</div>
                )}
              </div>
            </div>

            {/* Thumbnail Preview */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                <ImageIcon className="w-4 h-4 text-indigo-600" /> Thumbnail
              </h4>
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">No Image</div>
                )}
              </div>
            </div>

            {/* Publish Info */}
            <div className="bg-indigo-50 rounded-2xl p-4 sm:p-6 border border-indigo-100 space-y-4">
               <div className="flex gap-3">
                 <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                 <p className="text-xs sm:text-sm text-indigo-800 leading-relaxed font-medium">
                   Pastikan semua data sudah benar. Setelah dipublikasikan, kursus akan dapat diakses oleh siswa.
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions - Moved outside grid for better mobile layout */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 sm:pt-8 border-t border-slate-100 mt-8">
        <button 
            type="button" 
            onClick={onBack}
            className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors w-full sm:w-auto text-sm"
        >
            Kembali
        </button>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {slug && (
              <a 
                href={`/courses/${slug}?preview=student`} 
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-xl border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto text-sm"
              >
                <Eye className="w-4 h-4" /> Preview
              </a>
            )}
            <button 
                onClick={onPublish}
                disabled={isPublishing || !allValid}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto text-sm"
            >
                {isPublishing ? 'Publishing...' : 'Terbitkan'}
                <Check className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
}
