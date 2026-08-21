/* eslint-disable react-hooks/incompatible-library */
import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Save, Plus, Trash2, HelpCircle, Clock, ChevronRight, Settings, Layout, Loader2, Award, ArrowLeft } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: 'Pilihan Ganda',
  TRUE_FALSE: 'Benar / Salah',
  SHORT_ANSWER: 'Jawaban Singkat',
  ESSAY: 'Esai'
};

const quizSchema = z.object({
  title: z.string().min(3, "Judul kuis minimal 3 karakter"),
  description: z.string().optional(),
  timeLimit: z.number().min(0).default(0), // in minutes
  retryLimit: z.number().nullable().optional(),
  passingGrade: z.number().min(0).max(100).default(80),
  hideQuizTime: z.boolean().default(false),
  quizAutoStart: z.boolean().default(false),
  questionLayout: z.enum(['SINGLE_QUESTION', 'ALL_QUESTIONS']).default('SINGLE_QUESTION'),
  questionOrder: z.enum(['RANDOM', 'ASCENDING', 'DESCENDING']).default('RANDOM'),
  questions: z.array(z.object({
    text: z.string().min(1, "Pertanyaan wajib diisi"),
    type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY']),
    options: z.array(z.string()).optional(),
    correctAnswer: z.number().optional(), // Index for single correct
    correctAnswers: z.array(z.number()).default([]), // Indices for multiple correct
    answerKey: z.string().optional(), // For Short Answer
    explanation: z.string().optional(),
    points: z.number().min(0).default(1),
    multipleCorrect: z.boolean().default(false),
    randomizeOptions: z.boolean().default(false),
    answerRequired: z.boolean().default(false),
    displayPoints: z.boolean().default(true),
  })).min(1, "Minimal harus ada 1 pertanyaan"),
});

type QuizFormInput = z.input<typeof quizSchema>;
type QuizFormOutput = z.output<typeof quizSchema>;

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  isLoading?: boolean;
}

export default function QuizModal({ isOpen, onClose, onSave, initialData, isLoading }: QuizModalProps) {
  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<QuizFormInput>({
    resolver: zodResolver(quizSchema),
    defaultValues: {
      title: '',
      description: '',
      timeLimit: 0,
      retryLimit: null,
      passingGrade: 80,
      hideQuizTime: false,
      quizAutoStart: false,
      questionLayout: 'SINGLE_QUESTION',
      questionOrder: 'RANDOM',
      questions: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions"
  });
  const watchedQuestions = watch('questions');
  const watchedHideQuizTime = watch('hideQuizTime');
  const watchedQuizAutoStart = watch('quizAutoStart');

  const [activeTab, setActiveTab] = useState<'details' | 'settings'>('details');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  useEffect(() => {
    if (isOpen) {
      if (initialData && initialData.type === 'QUIZ') {
        const quizData = initialData.quiz || {};
        reset({
          title: initialData.title,
          description: quizData.description || '',
          timeLimit: quizData.timeLimit || 0,
          retryLimit: quizData.retryLimit || null,
          passingGrade: quizData.passingGrade || 80,
          hideQuizTime: quizData.hideQuizTime || false,
          quizAutoStart: quizData.quizAutoStart || false,
          questionLayout: quizData.questionLayout || 'SINGLE_QUESTION',
          questionOrder: quizData.questionOrder || 'RANDOM',
          questions: quizData.questions?.map((q: any) => ({
            text: q.text,
            type: q.type || 'MULTIPLE_CHOICE',
            options: q.options?.map((o: any) => o.text) || [],
            correctAnswer: q.correctAnswer,
            correctAnswers: q.correctAnswers || [],
            answerKey: q.answerKey,
            explanation: q.explanation,
            points: q.points || 1,
            multipleCorrect: q.multipleCorrect || false,
            randomizeOptions: q.randomizeOptions || false,
            answerRequired: q.answerRequired || false,
            displayPoints: q.displayPoints !== false, // default true
          })) || []
        });
      } else {
        reset({
          title: '',
          description: '',
          timeLimit: 0,
          retryLimit: null,
          passingGrade: 80,
          hideQuizTime: false,
          quizAutoStart: false,
          questionLayout: 'SINGLE_QUESTION',
          questionOrder: 'RANDOM',
          questions: []
        });
      }
      setMobileView('list');
      setActiveTab('details');
      setActiveQuestionIndex(null);
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (data: QuizFormInput) => {
    const parsed: QuizFormOutput = quizSchema.parse(data);
    const payload = {
      title: parsed.title,
      type: 'QUIZ',
      quiz: {
        description: parsed.description,
        timeLimit: parsed.timeLimit,
        retryLimit: parsed.retryLimit,
        passingGrade: parsed.passingGrade,
        hideQuizTime: parsed.hideQuizTime,
        quizAutoStart: parsed.quizAutoStart,
        questionLayout: parsed.questionLayout,
        questionOrder: parsed.questionOrder,
        questions: parsed.questions.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options?.map(opt => ({ text: opt })) || [],
            correctAnswer: q.correctAnswer,
            correctAnswers: q.correctAnswers,
            answerKey: q.answerKey,
            explanation: q.explanation,
            points: q.points,
            multipleCorrect: q.multipleCorrect,
            randomizeOptions: q.randomizeOptions,
            answerRequired: q.answerRequired,
            displayPoints: q.displayPoints
        }))
      }
    };
    await onSave(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 lg:p-4 animate-in fade-in">
      <div className="bg-white lg:rounded-2xl w-full h-full lg:h-[90vh] lg:max-w-7xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col lg:flex-row">
        
        {/* SIDEBAR (List) - Visible on Desktop OR Mobile 'list' view */}
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 border-r border-slate-200 flex-col bg-slate-50 h-full shrink-0`}>
           <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white sticky top-0 z-10 h-16 shrink-0">
             <div className="flex items-center gap-2">
               <div className="bg-indigo-600 p-1.5 rounded-lg">
                 <Layout className="w-4 h-4 text-white"/>
               </div>
               <h3 className="font-bold text-slate-800">Quiz Builder</h3>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full lg:hidden"><X className="w-5 h-5 text-slate-500"/></button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {/* Quiz Info Card */}
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
               <div className="flex items-center gap-2 mb-1">
                 <Settings className="w-4 h-4 text-slate-400"/>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Info Kuis</label>
               </div>
               <input 
                 {...register('title')} 
                 className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-50 outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                 placeholder="Judul Kuis..."
               />
               {errors.title && <p className="text-red-500 text-xs font-medium">{errors.title.message}</p>}
               
               <button 
                  type="button" 
                  onClick={() => { setActiveTab('settings'); setMobileView('editor'); }}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 flex items-center justify-center gap-2 transition-colors"
               >
                 <Settings className="w-3.5 h-3.5" /> Pengaturan Lanjutan
               </button>
             </div>

             {/* Questions List */}
             <div className="flex items-center justify-between px-1">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daftar Pertanyaan</span>
               <button 
                 type="button"
                 onClick={() => {
                   append({ 
                     text: 'Pertanyaan Baru', 
                     type: 'MULTIPLE_CHOICE', 
                     points: 1,
                     options: ['Opsi 1', 'Opsi 2'], 
                     correctAnswer: 0,
                     correctAnswers: []
                   });
                   setActiveQuestionIndex(fields.length);
                   setActiveTab('details');
                   setMobileView('editor');
                 }}
                 className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-200 transition-all"
               >
                 <Plus className="w-3.5 h-3.5"/> Tambah
               </button>
             </div>

             <div className="space-y-2 pb-20 lg:pb-0">
             {fields.map((field, index) => (
               <div 
                 key={field.id}
                 onClick={() => { 
                    setActiveQuestionIndex(index); 
                    setActiveTab('details'); 
                    setMobileView('editor');
                 }}
                 className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${activeQuestionIndex === index ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}
               >
                 <div className="flex items-start gap-3">
                   <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${activeQuestionIndex === index ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                     {index + 1}
                   </div>
                   <div className="min-w-0 flex-1 pr-6">
                     <p className="text-sm font-bold text-slate-800 truncate">{watchedQuestions?.[index]?.text || 'Pertanyaan Baru'}</p>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-semibold uppercase tracking-tight">
                            {TYPE_LABELS[watchedQuestions?.[index]?.type || ''] || 'Pilihan Ganda'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{watchedQuestions?.[index]?.points} Poin</span>
                     </div>
                   </div>
                   <ChevronRight className="w-4 h-4 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2"/>
                 </div>
                 <button 
                   onClick={(e) => { 
                      e.stopPropagation(); 
                      remove(index); 
                      if(activeQuestionIndex === index) {
                          setActiveQuestionIndex(null);
                          setMobileView('list');
                      }
                   }}
                   className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                 >
                   <Trash2 className="w-3.5 h-3.5" />
                 </button>
               </div>
             ))}
             
             {fields.length === 0 && (
               <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100">
                    <Plus className="w-6 h-6 text-indigo-400"/>
                 </div>
                 <p className="text-sm font-medium text-slate-600">Belum ada pertanyaan</p>
                 <p className="text-xs text-slate-400 mt-1">Klik tombol Tambah di atas untuk mulai.</p>
               </div>
             )}
             </div>
           </div>

           {/* Mobile Bottom Bar (Save) */}
           <div className="p-4 bg-white border-t border-slate-200 lg:hidden sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={handleSubmit(onSubmit)} 
                    disabled={isSubmitting || isLoading}
                    className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                    Simpan Perubahan
                </button>
           </div>
        </div>

        {/* EDITOR AREA - Visible on Desktop OR Mobile 'editor' view */}
        <div className={`${mobileView === 'editor' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col bg-slate-50/30 overflow-hidden relative w-full h-full`}>
            
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between h-16 shrink-0 sticky top-0 z-20 shadow-sm lg:shadow-none">
                <div className="flex items-center gap-3">
                    <button onClick={() => setMobileView('list')} className="lg:hidden p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg leading-tight">
                            {activeTab === 'settings' ? 'Pengaturan Kuis' : (activeQuestionIndex !== null ? `Edit Pertanyaan ${activeQuestionIndex + 1}` : 'Editor Kuis')}
                        </h2>
                        <p className="text-xs text-slate-500 hidden sm:block">
                            {activeTab === 'settings' ? 'Konfigurasi global untuk kuis ini' : 'Sesuaikan konten dan opsi pertanyaan'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`p-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        title="Settings"
                    >
                        <Settings className="w-5 h-5"/>
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-1 hidden lg:block"></div>
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium text-sm hover:bg-slate-50 hidden lg:block">Batal</button>
                    <button 
                        onClick={handleSubmit(onSubmit)} 
                        disabled={isSubmitting || isLoading}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all items-center gap-2 hidden lg:flex disabled:opacity-70"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                        Simpan
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'settings' ? (
                    <div className="absolute inset-0 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
                        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 space-y-8">
                            {/* General Settings */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2">Umum</h3>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Deskripsi / Instruksi</label>
                                    <textarea 
                                        {...register('description')}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-sm min-h-[100px] placeholder:font-normal font-medium"
                                        placeholder="Instruksi untuk siswa sebelum memulai kuis..."
                                    />
                                </div>
                            </div>

                            {/* Scoring & Timing */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2">Waktu & Nilai</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Batas Waktu</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                {...register('timeLimit', { valueAsNumber: true })}
                                                className="w-full pl-10 pr-16 py-3 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-sm font-bold text-slate-800"
                                            />
                                            <Clock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400"/>
                                            <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">Menit</span>
                                        </div>
                                        <p className="text-xs text-slate-500">0 untuk tidak ada batas waktu.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Nilai Kelulusan</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                {...register('passingGrade', { valueAsNumber: true })}
                                                className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-sm font-bold text-slate-800"
                                                max={100} min={0}
                                            />
                                            <Award className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400"/>
                                            <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-bold">%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Batas Percobaan</label>
                                    <input 
                                        type="number" 
                                        {...register('retryLimit', { valueAsNumber: true })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-sm font-bold text-slate-800"
                                        placeholder="0 untuk Tak Terbatas"
                                    />
                                </div>
                            </div>

                            {/* Behavior */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2">Perilaku</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setValue('hideQuizTime', !watchedHideQuizTime)}>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-700">Sembunyikan Waktu</span>
                                            <span className="block text-xs text-slate-500 mt-0.5">Jangan tampilkan timer saat mengerjakan</span>
                                        </div>
                                        <input type="checkbox" {...register('hideQuizTime')} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 pointer-events-none" />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setValue('quizAutoStart', !watchedQuizAutoStart)}>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-700">Mulai Otomatis</span>
                                            <span className="block text-xs text-slate-500 mt-0.5">Langsung mulai saat halaman dibuka</span>
                                        </div>
                                        <input type="checkbox" {...register('quizAutoStart')} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 pointer-events-none" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">Tata Letak</label>
                                            <select {...register('questionLayout')} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 outline-none text-slate-800 bg-white font-bold">
                                                <option value="SINGLE_QUESTION">Satu per satu (Pagination)</option>
                                                <option value="ALL_QUESTIONS">Semua sekaligus (Scroll)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">Urutan Soal</label>
                                            <select {...register('questionOrder')} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 outline-none text-slate-800 bg-white font-bold">
                                                <option value="RANDOM">Acak (Random)</option>
                                                <option value="ASCENDING">Berurutan (A-Z)</option>
                                                <option value="DESCENDING">Terbalik (Z-A)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    activeQuestionIndex !== null && fields[activeQuestionIndex] ? (
                        <div className="flex flex-col lg:flex-row h-full">
                            {/* Question Editor (Left/Top) */}
                            <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 border-r border-slate-200">
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Pertanyaan</label>
                                        <textarea 
                                            {...register(`questions.${activeQuestionIndex}.text`)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 outline-none text-base text-slate-800 min-h-[120px] font-medium shadow-sm"
                                            placeholder="Tulis pertanyaan Anda di sini..."
                                        />
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6 space-y-4 shadow-sm">
                                        {/* Options Logic */}
                                        {watch(`questions.${activeQuestionIndex}.type`) === 'MULTIPLE_CHOICE' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Opsi Jawaban</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-slate-500">Jawaban Benar</span>
                                                    </div>
                                                </div>
                                                
                                                {watch(`questions.${activeQuestionIndex}.options`)?.map((opt, oIdx) => {
                                                    const isMultiple = watch(`questions.${activeQuestionIndex}.multipleCorrect`);
                                                    const isSelected = isMultiple 
                                                       ? (watch(`questions.${activeQuestionIndex}.correctAnswers`) || []).includes(oIdx)
                                                       : watch(`questions.${activeQuestionIndex}.correctAnswer`) === oIdx;

                                                    return (
                                                    <div key={oIdx} className="flex items-center gap-3 group">
                                                        <div className="shrink-0 pt-1">
                                                            <input 
                                                                type={isMultiple ? "checkbox" : "radio"}
                                                                name={isMultiple ? undefined : `correct-${activeQuestionIndex}`}
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if(isMultiple) {
                                                                        const current = watch(`questions.${activeQuestionIndex}.correctAnswers`) || [];
                                                                        if (e.target.checked) setValue(`questions.${activeQuestionIndex}.correctAnswers`, [...current, oIdx]);
                                                                        else setValue(`questions.${activeQuestionIndex}.correctAnswers`, current.filter(i => i !== oIdx));
                                                                    } else {
                                                                        setValue(`questions.${activeQuestionIndex}.correctAnswer`, oIdx);
                                                                    }
                                                                }}
                                                                className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                            />
                                                        </div>
                                                        <input 
                                                            {...register(`questions.${activeQuestionIndex}.options.${oIdx}` as const)}
                                                            className={`flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none transition-all font-medium ${isSelected ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900' : 'border-slate-300 focus:border-indigo-500'}`}
                                                            placeholder={`Opsi ${oIdx + 1}`}
                                                        />
                                                        <button type="button" onClick={() => {
                                                            const currentOpts = watch(`questions.${activeQuestionIndex}.options`) || [];
                                                            setValue(`questions.${activeQuestionIndex}.options`, currentOpts.filter((_, i) => i !== oIdx));
                                                        }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4"/></button>
                                                    </div>
                                                    );
                                                })}
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const currentOpts = watch(`questions.${activeQuestionIndex}.options`) || [];
                                                        setValue(`questions.${activeQuestionIndex}.options`, [...currentOpts, '']);
                                                    }}
                                                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-2 px-2 py-1.5 hover:bg-indigo-50 rounded-lg w-fit transition-colors"
                                                >
                                                    <Plus className="w-4 h-4"/> Tambah Opsi
                                                </button>
                                            </div>
                                        )}

                                        {/* True/False Logic */}
                                        {watch(`questions.${activeQuestionIndex}.type`) === 'TRUE_FALSE' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                {['Benar', 'Salah'].map((val, idx) => (
                                                <div 
                                                    key={val}
                                                    onClick={() => setValue(`questions.${activeQuestionIndex}.correctAnswer`, idx)}
                                                    className={`p-6 rounded-xl border-2 cursor-pointer text-center transition-all ${watch(`questions.${activeQuestionIndex}.correctAnswer`) === idx ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-md' : 'border-slate-200 hover:border-indigo-300 text-slate-600 font-medium hover:bg-slate-50'}`}
                                                >
                                                    <span className="text-lg">{val}</span>
                                                </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Short Answer Logic */}
                                        {watch(`questions.${activeQuestionIndex}.type`) === 'SHORT_ANSWER' && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-700">Kunci Jawaban</label>
                                                <input 
                                                    {...register(`questions.${activeQuestionIndex}.answerKey`)}
                                                    className="w-full px-4 py-3 rounded-xl border border-emerald-200 focus:border-emerald-500 outline-none text-sm bg-emerald-50 text-emerald-900 font-medium placeholder:text-emerald-400"
                                                    placeholder="Contoh: Gravitasi"
                                                />
                                                <p className="text-xs text-slate-500">Jawaban siswa harus sama persis (case-insensitive).</p>
                                            </div>
                                        )}

                                        {/* Essay Logic */}
                                        {watch(`questions.${activeQuestionIndex}.type`) === 'ESSAY' && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm flex items-start gap-3">
                                                <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600"/>
                                                <div>
                                                    <p className="font-bold text-amber-900">Penilaian Manual</p>
                                                    <p className="mt-1 leading-relaxed">Jawaban esai harus dinilai secara manual oleh instruktur.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Penjelasan (Opsional)</label>
                                        <textarea 
                                            {...register(`questions.${activeQuestionIndex}.explanation`)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-sm text-slate-800 min-h-[100px] font-medium placeholder:font-normal"
                                            placeholder="Penjelasan jawaban benar..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Question Settings (Right/Bottom) */}
                            <div className="w-full lg:w-72 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto p-5 space-y-6 pb-24 lg:pb-8 shrink-0">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipe Soal</label>
                                    <div className="relative">
                                        <select 
                                            {...register(`questions.${activeQuestionIndex}.type`)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-bold focus:border-indigo-600 outline-none text-slate-800 appearance-none shadow-sm"
                                        >
                                            <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
                                            <option value="TRUE_FALSE">Benar / Salah</option>
                                            <option value="SHORT_ANSWER">Jawaban Singkat</option>
                                            <option value="ESSAY">Esai</option>
                                        </select>
                                        <ChevronRight className="w-4 h-4 text-slate-400 absolute right-4 top-3 rotate-90 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Poin</label>
                                    <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                        <input 
                                            type="number" 
                                            {...register(`questions.${activeQuestionIndex}.points`, { valueAsNumber: true })}
                                            className="w-full px-3 py-2 text-center rounded-lg text-lg font-bold focus:ring-0 border-none outline-none text-indigo-600 bg-transparent placeholder-slate-300"
                                            min={1}
                                            placeholder="1"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Opsi Tambahan</label>
                                    
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-sm">
                                        <label className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                                            <span className="text-sm font-medium text-slate-700">Wajib Diisi</span>
                                            <input type="checkbox" {...register(`questions.${activeQuestionIndex}.answerRequired`)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                        </label>
                                        
                                        {watch(`questions.${activeQuestionIndex}.type`) === 'MULTIPLE_CHOICE' && (
                                            <>
                                                <label className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                                                    <span className="text-sm font-medium text-slate-700">Acak Opsi</span>
                                                    <input type="checkbox" {...register(`questions.${activeQuestionIndex}.randomizeOptions`)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                                </label>
                                                <label className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                                                    <span className="text-sm font-medium text-slate-700">Banyak Jawaban</span>
                                                    <input type="checkbox" {...register(`questions.${activeQuestionIndex}.multipleCorrect`)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center h-full">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Layout className="w-8 h-8 text-slate-300"/>
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-2">Pilih Pertanyaan</h3>
                            <p className="max-w-xs mx-auto text-sm">Pilih pertanyaan dari daftar di sebelah kiri atau buat pertanyaan baru.</p>
                            <button 
                                onClick={() => {
                                    append({ 
                                        text: 'Pertanyaan Baru', 
                                        type: 'MULTIPLE_CHOICE', 
                                        points: 1,
                                        options: ['Opsi 1', 'Opsi 2'], 
                                        correctAnswer: 0,
                                        correctAnswers: []
                                    });
                                    setActiveQuestionIndex(fields.length);
                                    setActiveTab('details');
                                    setMobileView('editor');
                                }}
                                className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                            >
                                Buat Pertanyaan
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
