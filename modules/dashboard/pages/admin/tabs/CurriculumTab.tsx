"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Edit2, 
  Video, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  X
} from 'lucide-react';

import { toast } from 'sonner';
import ConfirmDialog from '../../../components/ConfirmDialog';

import LessonEditor from '../lessons/LessonEditor';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface Lesson {
  id: string;
  title: string;
  type: 'VIDEO' | 'TEXT';
  content?: string;
  videoUrl?: string;
  order: number;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  lessons: Lesson[];
  order: number;
}

interface CurriculumTabProps {
  course: {
    id: string;
    modules: Module[];
  };
}

export default function CurriculumTab({ course }: CurriculumTabProps) {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>(course.modules);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [moduleEditor, setModuleEditor] = useState<{ isOpen: boolean; moduleId: string | null; title: string; description: string }>({
    isOpen: false,
    moduleId: null,
    title: '',
    description: '',
  });
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>(course.modules.map(m => m.id));
  const [addingLessonToModule, setAddingLessonToModule] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ lesson: Lesson; moduleId: string } | null>(null);
  const [newLessonTitle, setNewModuleLessonTitle] = useState('');
  
  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'DELETE_MODULE' | 'DELETE_LESSON';
    targetId: string;
    targetTitle?: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    type: 'DELETE_MODULE',
    targetId: '',
    isLoading: false
  });

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'module') {
      const newModules = Array.from(modules);
      const [reorderedModule] = newModules.splice(source.index, 1);
      newModules.splice(destination.index, 0, reorderedModule);

      const updatedModules = newModules.map((m, index) => ({ ...m, order: index + 1 }));
      setModules(updatedModules);
      
      try {
        await fetch(`/api/courses/${course.id}/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'module',
            items: updatedModules.map(m => ({ id: m.id, order: m.order }))
          })
        });
      } catch (error) {
        console.error('Failed to reorder modules', error);
      }

    } else if (type === 'lesson') {
      const sourceModuleId = source.droppableId;
      const destModuleId = destination.droppableId;

      if (sourceModuleId === destModuleId) {
        // Reordering within the same module
        const moduleIndex = modules.findIndex(m => m.id === sourceModuleId);
        const newLessons = Array.from(modules[moduleIndex].lessons);
        const [reorderedLesson] = newLessons.splice(source.index, 1);
        newLessons.splice(destination.index, 0, reorderedLesson);

        const updatedLessons = newLessons.map((l, index) => ({ ...l, order: index + 1 }));
        const newModules = [...modules];
        newModules[moduleIndex] = { ...newModules[moduleIndex], lessons: updatedLessons };
        setModules(newModules);

        try {
          await fetch(`/api/courses/${course.id}/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'lesson',
              items: updatedLessons.map(l => ({ id: l.id, order: l.order, moduleId: sourceModuleId }))
            })
          });
        } catch (error) {
          console.error('Failed to reorder lessons', error);
        }

      } else {
        // Moving lesson between modules
        const sourceModuleIndex = modules.findIndex(m => m.id === sourceModuleId);
        const destModuleIndex = modules.findIndex(m => m.id === destModuleId);
        
        const sourceLessons = Array.from(modules[sourceModuleIndex].lessons);
        const destLessons = Array.from(modules[destModuleIndex].lessons);
        
        const [movedLesson] = sourceLessons.splice(source.index, 1);
        destLessons.splice(destination.index, 0, movedLesson);
        
        const updatedSourceLessons = sourceLessons.map((l, index) => ({ ...l, order: index + 1 }));
        const updatedDestLessons = destLessons.map((l, index) => ({ ...l, order: index + 1 }));

        const newModules = [...modules];
        newModules[sourceModuleIndex] = { ...newModules[sourceModuleIndex], lessons: updatedSourceLessons };
        newModules[destModuleIndex] = { ...newModules[destModuleIndex], lessons: updatedDestLessons };
        
        setModules(newModules);
        
        try {
          await fetch(`/api/courses/${course.id}/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'lesson',
              items: [
                ...updatedSourceLessons.map(l => ({ id: l.id, order: l.order, moduleId: sourceModuleId })),
                ...updatedDestLessons.map(l => ({ id: l.id, order: l.order, moduleId: destModuleId }))
              ]
            })
          });
        } catch (error) {
          console.error('Failed to reorder lessons across modules', error);
        }
      }
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;

    try {
      const res = await fetch(`/api/courses/${course.id}/modules`, {
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
        router.refresh();
        toast.success('Modul berhasil ditambahkan');
      } else {
        throw new Error('Gagal menambah modul');
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
      const res = await fetch(`/api/courses/${course.id}/modules/${moduleEditor.moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: moduleEditor.description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal memperbarui modul');

      setModules((prev) =>
        prev.map((m) => (m.id === moduleEditor.moduleId ? { ...m, title: data.title, description: data.description } : m))
      );
      toast.success('Modul diperbarui');
      router.refresh();
      setModuleEditor({ isOpen: false, moduleId: null, title: '', description: '' });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memperbarui modul');
    } finally {
      setIsSavingModule(false);
    }
  };

  const confirmDeleteModule = (moduleId: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      type: 'DELETE_MODULE',
      targetId: moduleId,
      targetTitle: title,
      isLoading: false
    });
  };

  const confirmDeleteLesson = (lessonId: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      type: 'DELETE_LESSON',
      targetId: lessonId,
      targetTitle: title,
      isLoading: false
    });
  };

  const handleConfirmDelete = async () => {
    setConfirmDialog(prev => ({ ...prev, isLoading: true }));
    
    try {
      if (confirmDialog.type === 'DELETE_MODULE') {
        const res = await fetch(`/api/courses/${course.id}/modules/${confirmDialog.targetId}`, { method: 'DELETE' });
        if (res.ok) {
          setModules(modules.filter(m => m.id !== confirmDialog.targetId));
          toast.success('Modul berhasil dihapus');
          router.refresh();
        } else {
          throw new Error('Gagal menghapus modul');
        }
      } else if (confirmDialog.type === 'DELETE_LESSON') {
        // We need the module ID to construct the URL, but the API might handle it differently.
        // Assuming the route is /api/courses/[courseId]/lessons/[lessonId] or similar.
        // Checking route structure... Assuming direct lesson delete or via module.
        // Based on previous context, it might be /api/courses/[id]/modules/[moduleId]/lessons/[lessonId] OR just /api/courses/[id]/lessons/[lessonId]
        // Let's assume standard REST: /api/courses/[courseId]/lessons/[lessonId]
        
        // Wait, looking at handleAddLesson, it posts to /api/courses/[courseId]/lessons
        // So delete should be /api/courses/[courseId]/lessons/[lessonId]
        
        const res = await fetch(`/api/courses/${course.id}/lessons/${confirmDialog.targetId}`, { method: 'DELETE' });
        if (res.ok) {
          const newModules = modules.map(m => ({
            ...m,
            lessons: m.lessons.filter(l => l.id !== confirmDialog.targetId)
          }));
          setModules(newModules);
          toast.success('Pelajaran berhasil dihapus');
          router.refresh();
        } else {
          throw new Error('Gagal menghapus pelajaran');
        }
      }
    } catch {
      toast.error(confirmDialog.type === 'DELETE_MODULE' ? 'Gagal menghapus modul' : 'Gagal menghapus pelajaran');
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  const handleAddLesson = async (moduleId: string) => {
    if (!newLessonTitle.trim()) return;

    try {
      const res = await fetch(`/api/courses/${course.id}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newLessonTitle, 
          moduleId: moduleId,
          order: modules.find(m => m.id === moduleId)?.lessons.length || 0 
        }),
      });

      if (res.ok) {
        const newLesson = await res.json();
        setModules(modules.map(m => {
          if (m.id === moduleId) {
            return { ...m, lessons: [...m.lessons, newLesson] };
          }
          return m;
        }));
        setNewModuleLessonTitle('');
        setAddingLessonToModule(null);
        router.refresh();
        toast.success('Pelajaran berhasil ditambahkan');
      } else {
        throw new Error('Gagal menambah pelajaran');
      }
    } catch {
      toast.error('Gagal menambah pelajaran');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">Susunan Kurikulum</h2>
        <button 
          onClick={() => setIsAddingModule(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Tambah Modul
        </button>
      </div>

      {/* Add Module Form */}
      {isAddingModule && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
          <label className="block text-sm font-bold text-slate-800 mb-2">Judul Modul Baru</label>
          <div className="grid gap-2">
            <input 
              type="text" 
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Contoh: Pengenalan Geologi Dasar"
              className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 text-slate-900 font-medium placeholder:text-slate-400"
              autoFocus
            />
            <textarea
              value={newModuleDescription}
              onChange={(e) => setNewModuleDescription(e.target.value)}
              placeholder="Deskripsi modul (opsional)..."
              rows={3}
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 text-slate-900 font-medium placeholder:text-slate-400 resize-none"
            />
            <div className="flex gap-2">
              <button 
                onClick={handleAddModule}
                disabled={!newModuleTitle.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simpan
              </button>
              <button 
                onClick={() => {
                  setIsAddingModule(false);
                  setNewModuleTitle('');
                  setNewModuleDescription('');
                }}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Editor Modal */}
      {editingLesson && (
        <LessonEditor
          courseId={course.id}
          moduleId={editingLesson.moduleId}
          lesson={editingLesson.lesson}
          onClose={() => setEditingLesson(null)}
        />
      )}

      {/* Modules List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="modules" type="module">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {modules.length === 0 && !isAddingModule ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-slate-500 text-sm">Belum ada modul yang ditambahkan.</p>
                  <button 
                    onClick={() => setIsAddingModule(true)}
                    className="text-indigo-600 font-medium text-sm mt-2 hover:underline"
                  >
                    Mulai buat kurikulum
                  </button>
                </div>
              ) : (
                modules.map((module, index) => (
                  <Draggable key={module.id} draggableId={module.id} index={index}>
                    {(provided) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100">
                          <div className="flex items-center gap-3 flex-1">
                            <div {...provided.dragHandleProps} className="cursor-move text-slate-400 hover:text-slate-600">
                              <GripVertical className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <button 
                                onClick={() => toggleModule(module.id)}
                                className="font-semibold text-slate-800 text-sm flex items-center gap-2 hover:text-indigo-600 transition-colors min-w-0"
                              >
                                <span className="text-slate-500 font-normal shrink-0">Modul {index + 1}:</span>
                                <span className="truncate">{module.title}</span>
                                {expandedModules.includes(module.id) ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                              </button>
                              {typeof module.description === 'string' && module.description.trim() ? (
                                <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                  {module.description}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setModuleEditor({
                                  isOpen: true,
                                  moduleId: module.id,
                                  title: typeof module.title === 'string' ? module.title : '',
                                  description: typeof module.description === 'string' ? module.description : '',
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => confirmDeleteModule(module.id, module.title)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Lessons List */}
                        {expandedModules.includes(module.id) && (
                          <div className="p-4 bg-white">
                            <Droppable droppableId={module.id} type="lesson">
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className="space-y-2"
                                >
                                  {module.lessons.map((lesson, lIndex) => (
                                    <Draggable key={lesson.id} draggableId={lesson.id} index={lIndex}>
                                      {(provided) => (
                                        <div 
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:border-slate-300 transition-all group bg-white"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div {...provided.dragHandleProps} className="cursor-move text-slate-300 group-hover:text-slate-400">
                                              <GripVertical className="w-4 h-4" />
                                            </div>
                                            {lesson.type === 'VIDEO' ? (
                                              <Video className="w-4 h-4 text-indigo-500" />
                                            ) : (
                                              <FileText className="w-4 h-4 text-emerald-500" />
                                            )}
                                            <span className="text-sm text-slate-700">{lesson.title}</span>
                                          </div>
                                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                              onClick={() => setEditingLesson({ lesson, moduleId: module.id })}
                                              className="text-xs text-indigo-600 hover:underline p-1"
                                              title="Edit Konten"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                              onClick={() => confirmDeleteLesson(lesson.id, lesson.title)}
                                              className="text-xs text-red-500 hover:text-red-700 p-1"
                                              title="Hapus Pelajaran"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                            
                            {module.lessons.length === 0 && (
                              <p className="text-sm text-slate-400 italic text-center py-2">Belum ada materi pelajaran.</p>
                            )}
                            
                            <div className="mt-4">
                              {addingLessonToModule === module.id ? (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                  <input 
                                    type="text" 
                                    value={newLessonTitle}
                                    onChange={(e) => setNewModuleLessonTitle(e.target.value)}
                                    placeholder="Judul Pelajaran..."
                                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 text-slate-900 font-medium placeholder:text-slate-400"
                                    autoFocus
                                  />
                                  <button 
                                    onClick={() => handleAddLesson(module.id)}
                                    disabled={!newLessonTitle.trim()}
                                    className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                                  >
                                    Simpan
                                  </button>
                                  <button 
                                    onClick={() => setAddingLessonToModule(null)}
                                    className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setAddingLessonToModule(module.id);
                                    setNewModuleLessonTitle('');
                                  }}
                                  className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
                                >
                                  <Plus className="w-4 h-4" /> Tambah Pelajaran
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

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

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title={confirmDialog.type === 'DELETE_MODULE' ? 'Hapus Modul?' : 'Hapus Pelajaran?'}
        description={
          confirmDialog.type === 'DELETE_MODULE' 
            ? `Anda akan menghapus modul "${confirmDialog.targetTitle}" beserta semua pelajaran di dalamnya. Tindakan ini tidak dapat dibatalkan.`
            : `Anda akan menghapus pelajaran "${confirmDialog.targetTitle}". Tindakan ini tidak dapat dibatalkan.`
        }
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={confirmDialog.isLoading}
      />
    </div>
  );
}
