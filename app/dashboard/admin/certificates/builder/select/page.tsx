/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  ChevronLeft,
  Loader2,
  Layout,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

function TemplateSelectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/certificate-templates');
      if (!res.ok) throw new Error('Gagal mengambil template');
      const data = await res.json();
      setTemplates(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (id: string) => {
    const params = new URLSearchParams();
    params.set('templateId', id);
    if (courseId) params.set('courseId', courseId);
    router.push(`/dashboard/admin/certificates/builder?${params.toString()}`);
  };

  const handleEmptyCanvas = () => {
    const params = new URLSearchParams();
    if (courseId) params.set('courseId', courseId);
    const qs = params.toString();
    router.push(qs ? `/dashboard/admin/certificates/builder?${qs}` : '/dashboard/admin/certificates/builder');
  };

  const getTemplatePageMm = (content: any) => {
    const orientation = content?.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE';
    const pageSize = content?.pageSize === 'LETTER' ? 'LETTER' : 'A4';
    const a4 = orientation === 'PORTRAIT' ? { widthMm: 210, heightMm: 297 } : { widthMm: 297, heightMm: 210 };
    const letter = orientation === 'PORTRAIT' ? { widthMm: 215.9, heightMm: 279.4 } : { widthMm: 279.4, heightMm: 215.9 };
    return pageSize === 'LETTER' ? letter : a4;
  };

  const renderTemplateThumb = (template: any) => {
    const content = template?.content && typeof template.content === 'object' ? template.content : {};
    const dims = getTemplatePageMm(content);
    const bg = typeof (content as any).background === 'string' ? String((content as any).background) : '';
    const els = Array.isArray((content as any).elements) ? ((content as any).elements as any[]) : [];
    const sorted = [...els].sort((a, b) => (Number(a?.zIndex || 0) - Number(b?.zIndex || 0))).slice(0, 50);
    const getText = (el: any) => {
      switch (el?.type) {
        case 'TEXT':
          return String(el?.content || '').trim() || 'Text';
        case 'NAME':
          return '[ student_name ]';
        case 'COURSE':
          return '[ course_title ]';
        case 'INSTRUCTOR':
          return '[ instructor_name ]';
        case 'SERIAL':
          return '[ verification_id ]';
        case 'DATE':
          return '[ date ]';
        case 'DURATION':
          return '[ duration ]';
        case 'POINT':
          return '[ points ]';
        case 'GRADE':
          return '[ grade ]';
        case 'BUNDLE':
          return '[ bundle_courses ]';
        default:
          return '';
      }
    };
    return (
      <div className="relative w-full h-full bg-white overflow-hidden" style={{ aspectRatio: `${dims.widthMm} / ${dims.heightMm}` }}>
        {bg ? <img alt="" src={bg} className="absolute inset-0 w-full h-full object-cover" /> : null}
        <div className="absolute inset-0">
          {sorted.map((el: any, idx: number) => {
            const x = Number(el?.x || 0);
            const y = Number(el?.y || 0);
            const w = Math.max(1, Number(el?.width || 1));
            const h = Math.max(1, Number(el?.height || 1));
            const left = `${(x / dims.widthMm) * 100}%`;
            const top = `${(y / dims.heightMm) * 100}%`;
            const width = `${(w / dims.widthMm) * 100}%`;
            const height = `${(h / dims.heightMm) * 100}%`;
            const opacity = typeof el?.opacity === 'number' ? Math.max(0, Math.min(100, el.opacity)) / 100 : 1;
            if (el?.type === 'IMAGE') {
              const src = typeof el?.src === 'string' ? el.src : '';
              return (
                <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                  {src ? <img alt="" src={src} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100" />}
                </div>
              );
            }
            if (el?.type === 'QR') {
              return (
                <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                  <div className="w-full h-full border border-slate-300 bg-white" />
                </div>
              );
            }
            if (el?.type === 'SIGNATURE') {
              return (
                <div key={String(el?.id || idx)} className="absolute" style={{ left, top, width, height, opacity }}>
                  <div className="w-full h-full border-b border-slate-300" />
                </div>
              );
            }
            const text = getText(el);
            if (!text) return null;
            const color = typeof el?.color === 'string' ? el.color : '#111827';
            const align = el?.align === 'left' ? 'left' : el?.align === 'right' ? 'right' : 'center';
            const fontSize = Math.max(8, Math.round((Number(el?.fontSize || 16) as number) * 0.32));
            return (
              <div
                key={String(el?.id || idx)}
                className="absolute overflow-hidden"
                style={{
                  left,
                  top,
                  width,
                  height,
                  opacity,
                  color,
                  fontSize,
                  fontWeight: el?.bold ? 800 : 700,
                  fontStyle: el?.italic ? 'italic' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
                  textAlign: align as any,
                  padding: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                <span className="truncate">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Pilih Template Sertifikat</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Geo-Workshop LMS</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {/* Canvas Kosong Button */}
          <button
            onClick={handleEmptyCanvas}
            className="group aspect-[1.414/1] bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1"
          >
            <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-white transition-all shadow-sm group-hover:shadow-md">
              <Plus className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <div className="text-center">
              <span className="block text-xs font-extrabold text-slate-700 uppercase tracking-widest">Canvas Kosong</span>
              <span className="block text-[10px] text-slate-400 mt-1 font-bold">Mulai dari nol</span>
            </div>
          </button>

          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="group relative aspect-[1.414/1] bg-white rounded-3xl border-2 border-slate-100 overflow-hidden hover:border-indigo-400 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Preview Mockup */}
                <div 
                  className="w-full h-full bg-slate-100 flex items-center justify-center cursor-pointer"
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  {renderTemplateThumb(template)}
                </div>

                {/* Info Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                   <div className="flex items-center justify-between">
                      <div className="text-white">
                         <h3 className="text-xs font-extrabold uppercase tracking-widest">{template.name}</h3>
                         <p className="text-[9px] font-bold text-white/60 uppercase mt-1">Template Kustom</p>
                      </div>
                      <button 
                        onClick={() => handleSelectTemplate(template.id)}
                        className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg active:scale-95 transition-all"
                      >
                         <CheckCircle2 className="w-4 h-4" />
                      </button>
                   </div>
                </div>

                {/* Badge if System */}
                {template.isSystem && (
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm border border-slate-100">
                    <span className="text-[8px] font-extrabold text-indigo-600 uppercase tracking-widest">System</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!isLoading && templates.length === 0 && (
          <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Layout className="w-8 h-8 text-slate-300" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest">Belum ada template tersimpan</h2>
            <p className="text-xs text-slate-300 font-bold mt-2 uppercase">Mulai dengan Canvas Kosong dan simpan desain Anda sebagai template</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TemplateSelectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <TemplateSelectPageContent />
    </Suspense>
  );
}
