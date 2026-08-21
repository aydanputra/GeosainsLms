"use client";

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FileText, Video, ChevronDown, ChevronRight, GripVertical, ArrowRight, HelpCircle, Check, Loader2, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import LessonModal from '../components/modals/LessonModal';
import QuizModal from '../components/modals/QuizModal';
import AssignmentModal from '../components/modals/AssignmentModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useDebouncedCallback } from 'use-debounce';

interface CourseStepCurriculumProps {
  courseId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function CourseStepCurriculum({ courseId, onNext, onBack }: CourseStepCurriculumProps) {
  const [modules, setModules] = useState<any[]>([]);
  const [, setIsLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [moduleEditor, setModuleEditor] = useState<{
    isOpen: boolean;
    moduleId: string | null;
    title: string;
    description: string;
  }>({ isOpen: false, moduleId: null, title: '', description: '' });
  const [isSavingModule, setIsSavingModule] = useState(false);
  
  // Modals State
  const [modalState, setModalState] = useState<{
    type: 'LESSON' | 'QUIZ' | 'ASSIGNMENT' | null;
    isOpen: boolean;
    data: any | null;
    moduleId: string | null;
  }>({ type: null, isOpen: false, data: null, moduleId: null });

  const [isSavingLesson, setIsSavingLesson] = useState(false);

  // Reorder API Call (Debounced)
  const saveReorder = useDebouncedCallback(async (type: 'module' | 'lesson', items: any[]) => {
    setIsReordering(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          items: items.map((item, index) => ({ id: item.id, order: index, moduleId: item.moduleId })) 
        }),
      });
      
      if (!res.ok) throw new Error('Gagal menyimpan urutan');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan urutan');
    } finally {
      setIsReordering(false);
    }
  }, 1000);

  const moveModule = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === modules.length - 1)) return;
    
    const newModules = [...modules];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newModules[index], newModules[swapIndex]] = [newModules[swapIndex], newModules[index]];
    
    setModules(newModules);
    saveReorder('module', newModules);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus modul ini? Semua pelajaran di dalamnya akan ikut terhapus.')) return;
    
    try {
        const res = await fetch(`/api/courses/${courseId}/modules/${moduleId}`, {
            method: 'DELETE',
        });
        
        if (!res.ok) throw new Error('Gagal menghapus modul');
        
        setModules(prev => prev.filter(m => m.id !== moduleId));
        toast.success('Modul berhasil dihapus');
    } catch (error) {
        toast.error('Gagal menghapus modul');
        console.error(error);
    }
  };

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pelajaran ini?')) return;
    
    try {
        const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}`, {
            method: 'DELETE',
        });
        
        if (!res.ok) throw new Error('Gagal menghapus pelajaran');
        
        setModules(prev => prev.map(m => {
            if (m.id === moduleId) {
                return { ...m, lessons: m.lessons.filter((l: any) => l.id !== lessonId) };
            }
            return m;
        }));
        toast.success('Pelajaran berhasil dihapus');
    } catch (error) {
        toast.error('Gagal menghapus pelajaran');
        console.error(error);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // 1. Reorder Modules
    if (type === 'module') {
      const newModules = Array.from(modules);
      const [movedModule] = newModules.splice(source.index, 1);
      newModules.splice(destination.index, 0, movedModule);

      setModules(newModules);
      saveReorder('module', newModules);
    }

    // 2. Reorder Lessons
    if (type === 'lesson') {
      const sourceModuleIndex = modules.findIndex(m => m.id === source.droppableId);
      const destModuleIndex = modules.findIndex(m => m.id === destination.droppableId);

      if (sourceModuleIndex === -1 || destModuleIndex === -1) return;

      const newModules = [...modules];
      const sourceModule = newModules[sourceModuleIndex];
      const destModule = newModules[destModuleIndex];

      // Move within same module
      if (source.droppableId === destination.droppableId) {
        const newLessons = Array.from(sourceModule.lessons || []);
        const [movedLesson] = newLessons.splice(source.index, 1);
        newLessons.splice(destination.index, 0, movedLesson);
        
        newModules[sourceModuleIndex] = { ...sourceModule, lessons: newLessons };
        setModules(newModules);
        saveReorder('lesson', newLessons);
      } 
      // Move between modules
      else {
        const sourceLessons = Array.from(sourceModule.lessons || []);
        const destLessons = Array.from(destModule.lessons || []);
        
        const [movedLesson] = sourceLessons.splice(source.index, 1);
         
        const updatedLesson: any = { ...(movedLesson as object), moduleId: destModule.id };
        
        destLessons.splice(destination.index, 0, updatedLesson);

        newModules[sourceModuleIndex] = { ...sourceModule, lessons: sourceLessons };
        newModules[destModuleIndex] = { ...destModule, lessons: destLessons };

        setModules(newModules);
        
        const allAffectedLessons = [...sourceLessons, ...destLessons];
        saveReorder('lesson', allAffectedLessons);
      }
    }
  };

  // Fetch modules
  useEffect(() => {
    if (!courseId) return;
    const fetchModules = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = await res.json();
          setModules(data.modules || []);
          setExpandedModules(data.modules?.map((m: any) => m.id) || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchModules();
  }, [courseId]);

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;
    try {
      const res = await fetch(`/api/courses/${courseId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newModuleTitle, description: newModuleDescription, order: modules.length + 1 }),
      });
      if (res.ok) {
        const newModule = await res.json();
        setModules([...modules, { ...newModule, lessons: [] }]);
        setNewModuleTitle('');
        setNewModuleDescription('');
        setIsAddingModule(false);
        setExpandedModules(prev => [...prev, newModule.id]);
        toast.success('Modul berhasil ditambahkan');
      }
    } catch {
      toast.error('Gagal menambah modul');
    }
  };

  const handleSaveModuleEdit = async () => {
    if (!moduleEditor.moduleId) return;
    const title = moduleEditor.title.trim();
    if (!title) {
      toast.error('Judul modul wajib diisi');
      return;
    }

    setIsSavingModule(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/modules/${moduleEditor.moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: moduleEditor.description,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memperbarui modul');

      setModules((prev) =>
        prev.map((m) => (m.id === moduleEditor.moduleId ? { ...m, title: data.title, description: data.description } : m))
      );
      toast.success('Modul diperbarui');
      setModuleEditor({ isOpen: false, moduleId: null, title: '', description: '' });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memperbarui modul');
    } finally {
      setIsSavingModule(false);
    }
  };

  const handleSaveItem = async (data: any) => {
    if (!modalState.moduleId) return;
    
    setIsSavingLesson(true);
    try {
      const isEdit = !!modalState.data;
      const url = isEdit 
        ? `/api/courses/${courseId}/lessons/${modalState.data.id}`
        : `/api/courses/${courseId}/lessons`;
      
      const payload = {
        ...data,
        moduleId: modalState.moduleId,
        order: isEdit ? modalState.data.order : (modules.find(m => m.id === modalState.moduleId)?.lessons?.length || 0)
      };

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedItem = await res.json();
        
        // Handle Quiz/Assignment Details
        if (data.type === 'QUIZ' && data.quiz) {
           await fetch(`/api/courses/${courseId}/lessons/${savedItem.id}/quiz`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(data.quiz),
           });
        }
        
        setModules((prev) =>
          prev.map((m) => {
            if (m.id !== modalState.moduleId) return m;

            const nextLesson = { ...savedItem, quiz: data.quiz, assignment: data.assignment };
            const currentLessons = Array.isArray(m.lessons) ? m.lessons : [];
            const exists = currentLessons.some((l: any) => l?.id === savedItem.id);

            if (isEdit) {
              return {
                ...m,
                lessons: exists ? currentLessons.map((l: any) => (l.id === savedItem.id ? nextLesson : l)) : [...currentLessons, nextLesson],
              };
            }

            return {
              ...m,
              lessons: [...currentLessons, nextLesson],
            };
          })
        );

        toast.success(isEdit ? 'Materi diperbarui' : 'Materi ditambahkan');

        if (!isEdit && modalState.type === 'LESSON') {
          setModalState({ type: 'LESSON', isOpen: true, data: savedItem, moduleId: modalState.moduleId });
        } else {
          setModalState({ type: null, isOpen: false, data: null, moduleId: null });
        }
      } else {
        throw new Error('Gagal menyimpan');
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan materi');
    } finally {
      setIsSavingLesson(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
             <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
               Struktur & Kurikulum
               {isReordering && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
             </h3>
             <p className="text-sm text-slate-500">Susun materi pembelajaran secara terstruktur.</p>
          </div>
          <button 
            onClick={() => setIsAddingModule(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Tambah Modul
          </button>
        </div>

        {isAddingModule && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-2">
              <input
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Judul Modul Baru..."
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-slate-900 text-sm"
                autoFocus
              />
              <textarea
                value={newModuleDescription}
                onChange={(e) => setNewModuleDescription(e.target.value)}
                placeholder="Deskripsi modul (opsional)..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-slate-900 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 sm:flex-col sm:justify-start">
              <button
                onClick={handleAddModule}
                disabled={!newModuleTitle.trim()}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Simpan
              </button>
              <button
                onClick={() => {
                  setIsAddingModule(false);
                  setNewModuleTitle('');
                  setNewModuleDescription('');
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-bold"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="modules" type="module">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {modules.map((module, index) => (
                  <Draggable key={module.id} draggableId={module.id} index={index}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-500 z-50' : 'hover:shadow-md'}`}
                      >
                        {/* Module Header */}
                        <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border-b border-slate-100 group">
                          <div className="flex items-center gap-3 w-full sm:flex-1">
                            <div 
                              {...provided.dragHandleProps} 
                              className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors hidden sm:block"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>
                            
                            {/* Mobile Reorder Buttons */}
                            <div className="flex flex-col gap-0.5 sm:hidden">
                              <button 
                                onClick={() => moveModule(index, 'up')}
                                disabled={index === 0}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => moveModule(index, 'down')}
                                disabled={index === modules.length - 1}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            <button 
                              onClick={() => {
                                if (expandedModules.includes(module.id)) {
                                  setExpandedModules(expandedModules.filter(id => id !== module.id));
                                } else {
                                  setExpandedModules([...expandedModules, module.id]);
                                }
                              }}
                              className="font-bold text-slate-800 flex items-start gap-2 flex-1 text-left text-sm sm:text-base w-full"
                            >
                              {expandedModules.includes(module.id) ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                              <span className="min-w-0">
                                <span className="truncate block">{module.title}</span>
                                {typeof module.description === 'string' && module.description.trim() ? (
                                  <span className="block text-[11px] sm:text-xs font-medium text-slate-500 mt-0.5 line-clamp-2">
                                    {module.description}
                                  </span>
                                ) : null}
                              </span>
                              <span className="ml-auto sm:ml-2 text-[10px] sm:text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                                {module.lessons?.length || 0} Materi
                              </span>
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-end gap-1 w-full sm:w-auto pl-8 sm:pl-0">
                             <button 
                                onClick={() => {
                                    setModuleEditor({
                                      isOpen: true,
                                      moduleId: module.id,
                                      title: typeof module.title === 'string' ? module.title : '',
                                      description: typeof module.description === 'string' ? module.description : '',
                                    });
                                }}
                                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                                title="Edit Modul"
                                >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                                onClick={() => handleDeleteModule(module.id)}
                                className="p-1.5 bg-white border border-slate-200 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                                title="Hapus Modul"
                                >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Lessons List - Collapsible with Grid Transition */}
                        <div 
                          className={`grid transition-all duration-500 ease-in-out ${
                            expandedModules.includes(module.id) 
                              ? 'grid-rows-[1fr] opacity-100 py-2' 
                              : 'grid-rows-[0fr] opacity-0 py-0'
                          }`}
                        >
                          <div className="overflow-hidden min-h-0">
                            <div className="bg-slate-50/50 rounded-b-xl">
                              <Droppable droppableId={module.id} type="lesson">
                                {(provided) => (
                                  <div 
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="p-2 space-y-2"
                                  >
                                    {(!module.lessons || module.lessons.length === 0) ? (
                                      <div className="text-center py-6 sm:py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg mx-2 bg-white">
                                        <p className="mb-1 font-medium">Belum ada materi</p>
                                        <p className="text-xs text-slate-400">Tambahkan konten untuk memulai</p>
                                      </div>
                                    ) : (
                                      module.lessons.map((lesson: any, lIndex: number) => (
                                        <Draggable key={lesson.id} draggableId={lesson.id} index={lIndex}>
                                          {(provided, snapshot) => (
                                            <div 
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className={`flex items-start sm:items-center justify-between p-3 bg-white border border-slate-200 rounded-lg group transition-all gap-3 ${snapshot.isDragging ? 'shadow-md ring-1 ring-indigo-500' : 'hover:border-indigo-200'}`}
                                            >
                                              <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                <div 
                                                  {...provided.dragHandleProps} 
                                                  className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 hidden sm:block shrink-0"
                                                >
                                                  <GripVertical className="w-4 h-4" />
                                                </div>

                                                {/* Icon Type */}
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                  lesson.type === 'QUIZ' || lesson.quiz ? 'bg-amber-50 text-amber-600' : 
                                                  lesson.assignment ? 'bg-purple-50 text-purple-600' :
                                                  lesson.type === 'VIDEO' ? 'bg-indigo-50 text-indigo-600' :
                                                  'bg-emerald-50 text-emerald-600'
                                                }`}>
                                                  {lesson.type === 'QUIZ' || lesson.quiz ? <HelpCircle className="w-4 h-4" /> :
                                                   lesson.assignment ? <FileText className="w-4 h-4" /> :
                                                   lesson.type === 'VIDEO' ? <Video className="w-4 h-4" /> :
                                                   <FileText className="w-4 h-4" />}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                    <span className="font-bold text-slate-700 truncate text-sm">{lesson.title}</span>
                                                    {lesson.isPreview && (
                                                      <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-[4px] text-[10px] flex items-center gap-0.5 shrink-0 border border-emerald-100 w-fit">
                                                        <Check className="w-2.5 h-2.5" /> Preview
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-medium">
                                                    <span className="capitalize">{lesson.assignment ? 'assignment' : lesson.type?.toLowerCase().replace('_', ' ')}</span>
                                                    {lesson.duration > 0 && <span>• {lesson.duration} menit</span>}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-1 shrink-0">
                                                <button 
                                                  onClick={() => {
                                                    const isQuiz = lesson.type === 'QUIZ' || Boolean(lesson.quiz);
                                                    const isAssignment = Boolean(lesson.assignment);
                                                    setModalState({ 
                                                      type: isQuiz ? 'QUIZ' : isAssignment ? 'ASSIGNMENT' : 'LESSON', 
                                                      isOpen: true, 
                                                      data: isAssignment ? { ...lesson, type: 'ASSIGNMENT' } : lesson, 
                                                      moduleId: module.id 
                                                    });
                                                  }}
                                                  className="p-1.5 bg-slate-50 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                                                  title="Edit Pelajaran"
                                                >
                                                  <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                  onClick={() => handleDeleteLesson(module.id, lesson.id)}
                                                  className="p-1.5 bg-slate-50 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                                  title="Hapus Pelajaran"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))
                                    )}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>

                              {/* Add Lesson Buttons (Compact Grid) */}
                              <div className="p-3 border-t border-slate-200 grid grid-cols-3 gap-2 bg-slate-50">
                                <button
                                  onClick={() => setModalState({ type: 'LESSON', isOpen: true, data: null, moduleId: module.id })}
                                  className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm hover:shadow-md"
                                >
                                  <Plus className="w-3.5 h-3.5" /> <span>Pelajaran</span>
                                </button>
                                <button
                                  onClick={() => setModalState({ type: 'QUIZ', isOpen: true, data: null, moduleId: module.id })}
                                  className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:border-amber-500 hover:text-amber-600 transition-all shadow-sm hover:shadow-md"
                                >
                                  <Plus className="w-3.5 h-3.5" /> <span>Kuis</span>
                                </button>
                                <button
                                  onClick={() => setModalState({ type: 'ASSIGNMENT', isOpen: true, data: null, moduleId: module.id })}
                                  className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:border-purple-500 hover:text-purple-600 transition-all shadow-sm hover:shadow-md"
                                >
                                  <Plus className="w-3.5 h-3.5" /> <span>Tugas</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors w-full sm:w-auto"
        >
          Kembali
        </button>
        <button
          onClick={onNext}
          className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          Lanjut <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Render Modals based on state */}
      {modalState.type === 'LESSON' && (
        <LessonModal 
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ ...modalState, isOpen: false })}
          onSave={handleSaveItem}
          onDraftCreated={(lesson) => {
            const moduleId = modalState.moduleId;
            if (moduleId) {
              setModules((prev) =>
                prev.map((m) => {
                  if (m.id !== moduleId) return m;
                  const currentLessons = Array.isArray(m.lessons) ? m.lessons : [];
                  const exists = currentLessons.some((l: any) => l?.id === lesson?.id);
                  return exists ? m : { ...m, lessons: [...currentLessons, lesson] };
                })
              );
            }
            setModalState((prev) => (prev.type === 'LESSON' ? { ...prev, data: lesson } : prev));
          }}
          initialData={modalState.data}
          isLoading={isSavingLesson}
          courseId={courseId}
          moduleId={modalState.moduleId || ''}
          initialOrder={(modules.find(m => m.id === modalState.moduleId)?.lessons?.length || 0)}
        />
      )}
      
      {modalState.type === 'QUIZ' && (
        <QuizModal 
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ ...modalState, isOpen: false })}
          onSave={handleSaveItem}
          initialData={modalState.data}
          isLoading={isSavingLesson}
        />
      )}

      {modalState.type === 'ASSIGNMENT' && (
        <AssignmentModal 
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ ...modalState, isOpen: false })}
          onSave={handleSaveItem}
          onDraftCreated={(lesson) => {
            if (lesson && typeof lesson.id === 'string') {
              setModalState((prev) => (prev.type === 'ASSIGNMENT' ? { ...prev, data: lesson } : prev));
            }
          }}
          initialData={modalState.data}
          isLoading={isSavingLesson}
          courseId={courseId}
          moduleId={modalState.moduleId || ''}
          initialOrder={(modules.find(m => m.id === modalState.moduleId)?.lessons?.length || 0)}
        />
      )}

      {moduleEditor.isOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-2xl overflow-hidden border border-slate-200 shadow-2xl flex flex-col">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-bold text-slate-900 truncate">Edit Modul</div>
                <div className="text-xs text-slate-500 mt-0.5">Ubah judul dan deskripsi modul.</div>
              </div>
              <button
                type="button"
                onClick={() => setModuleEditor({ isOpen: false, moduleId: null, title: '', description: '' })}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Judul</label>
                <input
                  value={moduleEditor.title}
                  onChange={(e) => setModuleEditor((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Judul modul..."
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Deskripsi (opsional)</label>
                <textarea
                  value={moduleEditor.description}
                  onChange={(e) => setModuleEditor((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  rows={4}
                  placeholder="Deskripsi modul..."
                />
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-200 bg-white flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setModuleEditor({ isOpen: false, moduleId: null, title: '', description: '' })}
                disabled={isSavingModule}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveModuleEdit}
                disabled={isSavingModule || !moduleEditor.title.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm disabled:opacity-60"
              >
                {isSavingModule ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
