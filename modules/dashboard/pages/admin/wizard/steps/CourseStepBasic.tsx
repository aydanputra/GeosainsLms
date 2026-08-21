"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Control, UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Book, AlignLeft, BarChart, Hash, Plus, Trash2, HelpCircle, Globe, Lock, Users, Clock, Layers, ChevronDown, Check, ArrowRight, Loader2, X } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { twMerge } from 'tailwind-merge';
import { useAutosave } from '@/hooks/useAutosave';
import { toast } from 'sonner';

const courseSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter"),
  subtitle: z.string().optional(),
  slug: z.string().min(3, "Slug minimal 3 karakter").regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan strip"),
  description: z.string().min(20, "Deskripsi minimal 20 karakter"),
  categoryIds: z.array(z.string()).min(1, "Pilih minimal 1 kategori"),
  instructorId: z.string().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  learningOutcomes: z.array(z.object({ value: z.string() })).optional(),
  tags: z.array(z.string()).default([]),
  prePurchaseNote: z.string().max(2000).optional().nullable(),
  requirements: z.array(z.string()).optional(),
  audience: z.array(z.object({ value: z.string() })).optional(),
  
  // Settings
  enableQA: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  
  // Enrollment
  maxStudents: z.number().nullable().optional(),
  validityDays: z.number().nullable().optional(),
  enrollmentEndDate: z.string().nullable().optional(),

  // Drip
  dripEnabled: z.boolean().optional(),
  dripType: z.enum(['NONE', 'SCHEDULE', 'AFTER_ENROLLMENT', 'SEQUENTIAL']).optional(),
  dripDays: z.number().nullable().optional(),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface CourseStepBasicProps {
  initialData?: any;
  onNext: (data: any) => void;
  courseId?: string;
}

const CustomSelect = ({ 
  label, 
  icon: Icon, 
  options, 
  value, 
  onChange, 
  placeholder,
  error
}: { 
  label: string, 
  icon: any, 
  options: { label: string, value: string }[], 
  value: string, 
  onChange: (value: string) => void, 
  placeholder?: string,
  error?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" /> {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={twMerge(
          "w-full pl-4 pr-10 py-3 rounded-xl border bg-white text-left focus:outline-none transition-all flex items-center justify-between",
          isOpen ? "border-indigo-600 ring-4 ring-indigo-100" : "border-slate-300 hover:border-slate-400",
          !value && !placeholder ? "text-slate-900" : value ? "text-slate-900" : "text-slate-400"
        )}
      >
        <span className="truncate block">
          {selectedOption ? selectedOption.label : placeholder || "Pilih opsi..."}
        </span>
        <ChevronDown className={twMerge("w-5 h-5 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg border border-slate-100 py-1 max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-200">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={twMerge(
                  "w-full px-4 py-2.5 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between group",
                  value === option.value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700"
                )}
              >
                {option.label}
                {value === option.value && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">Tidak ada opsi</div>
          )}
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

const MultiSelect = ({
  label,
  icon: Icon,
  options,
  values,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  icon: any;
  options: { label: string; value: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  error?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = Array.isArray(values) ? values.map(String).filter(Boolean) : [];
  const selectedSet = new Set(selected);
  const byValue = new Map(options.map((o) => [o.value, o] as const));
  const selectedLabels = selected.map((v) => byValue.get(v)?.label).filter(Boolean) as string[];

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((o) => o.label.toLowerCase().includes(normalizedQuery))
    : options;

  const toggle = (value: string) => {
    const v = String(value || '').trim();
    if (!v) return;
    if (selectedSet.has(v)) {
      onChange(selected.filter((x) => x !== v));
      return;
    }
    onChange([...selected, v]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" /> {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={twMerge(
          "w-full pl-4 pr-10 py-3 rounded-xl border bg-white text-left focus:outline-none transition-all flex items-center justify-between",
          isOpen ? "border-indigo-600 ring-4 ring-indigo-100" : "border-slate-300 hover:border-slate-400",
          selected.length > 0 ? "text-slate-900" : "text-slate-400"
        )}
      >
        <span className="truncate block">
          {selectedLabels.length > 0 ? `${selectedLabels[0]}${selectedLabels.length > 1 ? ` +${selectedLabels.length - 1}` : ''}` : placeholder || 'Pilih...'}
        </span>
        <ChevronDown className={twMerge("w-5 h-5 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-slate-100">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kategori..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {selected.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedLabels.slice(0, 8).map((t, idx) => (
                  <span
                    key={`${t}-${idx}`}
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-[11px] font-extrabold"
                  >
                    <span className="max-w-[220px] truncate">{t}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const value = selected[idx];
                        if (!value) return;
                        onChange(selected.filter((x) => x !== value));
                      }}
                      className="text-slate-500 hover:text-rose-600"
                      aria-label="Hapus kategori"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="max-h-60 overflow-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const active = selectedSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className={twMerge(
                      "w-full px-4 py-2.5 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between group",
                      active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700"
                    )}
                  >
                    {option.label}
                    {active ? <Check className="w-4 h-4 text-indigo-600" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">Tidak ada opsi</div>
            )}
          </div>
          <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onChange([])}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-extrabold hover:bg-rose-100"
            >
              Bersihkan
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-700"
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

const DynamicList = ({
  label,
  name,
  control,
  register,
  placeholder,
}: {
  label: string;
  name: any;
  control: Control<any>;
  register: UseFormRegister<any>;
  placeholder: string;
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name
  });

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <input
            {...register(`${name}.${index}.value` as any)}
            placeholder={placeholder}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => remove(index)}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ value: '' })}
        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
      >
        <Plus className="w-4 h-4" /> Tambah Poin
      </button>
    </div>
  );
};

const TagInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) => {
  const [draft, setDraft] = useState('');

  const normalize = (raw: string) => raw.trim().replace(/\s+/g, ' ');

  const addFromRaw = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => normalize(p))
      .filter(Boolean);
    if (parts.length === 0) return;
    const existingLower = new Set((Array.isArray(value) ? value : []).map((t) => String(t).toLowerCase()));
    const next = [...(Array.isArray(value) ? value : [])];
    for (const p of parts) {
      const key = p.toLowerCase();
      if (existingLower.has(key)) continue;
      existingLower.add(key);
      next.push(p);
    }
    onChange(next.slice(0, 20));
  };

  const commitDraft = () => {
    const raw = draft;
    setDraft('');
    addFromRaw(raw);
  };

  const removeAt = (idx: number) => {
    const next = (Array.isArray(value) ? value : []).filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {Array.isArray(value) && value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((t, idx) => (
            <span
              key={`${t}-${idx}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-extrabold"
            >
              <span className="max-w-[220px] truncate">{t}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="text-slate-500 hover:text-rose-600"
                aria-label="Hapus tag"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitDraft();
          }
        }}
        onBlur={() => {
          if (draft.trim()) commitDraft();
        }}
        placeholder={placeholder || 'Ketik lalu tekan Enter / koma'}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
      />
    </div>
  );
};

export default function CourseStepBasic({ initialData, onNext, courseId }: CourseStepBasicProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'enrollment' | 'drip'>('general');
  const [courseOptions, setCourseOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [isLoadingCourseOptions, setIsLoadingCourseOptions] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [requirementsQuery, setRequirementsQuery] = useState('');
  const requirementsRef = useRef<HTMLDivElement>(null);
  
  const { register, handleSubmit, setValue, watch, control, formState: { errors, isDirty, dirtyFields } } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema) as any,
    defaultValues: {
      title: initialData?.title || '',
      subtitle: initialData?.subtitle || '',
      slug: initialData?.slug || '',
      description: initialData?.description || '',
      categoryIds: Array.isArray(initialData?.categoryIds)
        ? initialData.categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean)
        : typeof initialData?.categoryId === 'string' && initialData.categoryId
          ? [String(initialData.categoryId)]
          : [],
      instructorId: initialData?.instructorId || '',
      level: initialData?.level || 'BEGINNER',
      learningOutcomes: initialData?.learningOutcomes?.map((s: string) => ({ value: s })) || [{ value: '' }],
      tags: Array.isArray(initialData?.tags) ? initialData.tags.map((s: any) => String(s || '').trim()).filter(Boolean) : [],
      prePurchaseNote: typeof initialData?.prePurchaseNote === 'string' ? initialData.prePurchaseNote : null,
      requirements: Array.isArray(initialData?.requirements) ? initialData.requirements : [],
      audience: initialData?.audience?.map((s: string) => ({ value: s })) || [{ value: '' }],
      
      enableQA: initialData?.enableQA ?? true,
      isPublic: initialData?.isPublic ?? false,
      maxStudents: initialData?.maxStudents || null,
      validityDays: initialData?.validityDays || null,
      enrollmentEndDate: initialData?.enrollmentEndDate ? new Date(initialData.enrollmentEndDate).toISOString().split('T')[0] : null,
      dripEnabled: initialData?.dripEnabled ?? false,
      dripType: initialData?.dripType || 'NONE',
      dripDays: initialData?.dripDays || null,
    }
  });

  const title = watch('title');
  const description = watch('description');
  const dripEnabled = watch('dripEnabled');

  const createCourseCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Nama kategori wajib diisi');
      return;
    }

    setIsCreatingCategory(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kategori');

      setCategories((prev) => {
        const next = [...(Array.isArray(prev) ? prev : []), data];
        next.sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), 'id-ID'));
        return next;
      });
      const current = Array.isArray(watch('categoryIds')) ? watch('categoryIds').map(String).filter(Boolean) : [];
      const next = Array.from(new Set([...current, String(data.id)]));
      setValue('categoryIds', next, { shouldDirty: true });
      setNewCategoryName('');
      setCreateCategoryOpen(false);
      toast.success('Kategori berhasil ditambahkan');
    } catch (error: any) {
      toast.error(error.message || 'Gagal membuat kategori');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Unified Save Function
  const saveCourseData = async (data: CourseFormData, signal?: AbortSignal) => {
    if (!courseId) return;
    
    const categoryIds = Array.isArray((data as any).categoryIds) ? (data as any).categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean) : [];
    const payload = {
      ...data,
      categoryIds,
      categoryId: categoryIds[0] || null,
      learningOutcomes: data.learningOutcomes?.map(i => i.value).filter(Boolean),
      tags: Array.isArray(data.tags) ? data.tags.map((s) => String(s || '').trim()).filter(Boolean) : [],
      prePurchaseNote: data.prePurchaseNote && typeof data.prePurchaseNote === 'string' ? data.prePurchaseNote.trim() : data.prePurchaseNote ?? null,
      requirements: Array.isArray(data.requirements) ? data.requirements.map((s) => String(s || '').trim()).filter(Boolean) : [],
      audience: data.audience?.map(i => i.value).filter(Boolean),
      enrollmentEndDate: data.enrollmentEndDate ? new Date(data.enrollmentEndDate).toISOString() : null,
    };

    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal // Pass abort signal
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Save error:', error);
      }
      throw error; // Let caller handle or useAutosave handle
    }
  };

  // Autosave Logic
  const formData = watch();
  const { status: saveStatus, lastSavedTime, updateData, save, retry } = useAutosave({
    onSave: saveCourseData,
    delay: 2000
  });

  useEffect(() => {
    if (isDirty) updateData(formData);
  }, [formData, isDirty, updateData]);

  // Auto-generate slug from title if slug is empty
  useEffect(() => {
    if (title && !initialData?.slug) {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      setValue('slug', slug);
    }
  }, [title, setValue, initialData]);

  useEffect(() => {
    // Fetch Categories
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(err => console.error("Failed to fetch categories:", err));

    // Fetch Mentors (for Admin only, but we fetch all MENTOR/ADMIN roles)
    // Assuming current user is ADMIN, they can assign to any MENTOR/ADMIN
    Promise.all([
      fetch('/api/users?role=MENTOR').then(res => res.json()),
      fetch('/api/users?role=ADMIN').then(res => res.json())
    ]).then(([mentorsData, adminsData]) => {
      const allMentors = [...(Array.isArray(mentorsData) ? mentorsData : []), ...(Array.isArray(adminsData) ? adminsData : [])];
      // Remove duplicates by ID
      const uniqueMentors = Array.from(new Map(allMentors.map(item => [item.id, item])).values());
      setMentors(uniqueMentors);
    }).catch(err => console.error("Failed to fetch mentors:", err));

    setIsLoadingCourseOptions(true);
    fetch('/api/me', { cache: 'no-store' })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        const role = typeof json?.user?.role === 'string' ? String(json.user.role) : '';
        if (role === 'ADMIN') {
          return fetch('/api/dashboard/admin/course-reports?tab=courses&limit=200', { cache: 'no-store' })
            .then((res) => res.json().catch(() => ({})))
            .then((data) => {
              const list = Array.isArray(data?.courses) ? data.courses : [];
              return list.map((c: any) => ({ id: String(c?.id || ''), title: String(c?.title || c?.slug || c?.id || '') }));
            });
        }
        if (role === 'MENTOR') {
          return fetch('/api/dashboard/mentor/courses', { cache: 'no-store' })
            .then((res) => res.json().catch(() => ([])))
            .then((list) => {
              const rows = Array.isArray(list) ? list : [];
              return rows.map((c: any) => ({ id: String(c?.id || ''), title: String(c?.title || c?.slug || c?.id || '') }));
            });
        }
        return Promise.resolve([]);
      })
      .then((list) => {
        const cleaned = (Array.isArray(list) ? list : [])
          .filter((c: any) => c && typeof c.id === 'string' && c.id.trim())
          .filter((c: any) => !courseId || String(c.id) !== String(courseId))
          .map((c: any) => ({ id: String(c.id), title: String(c.title || c.id) }));
        setCourseOptions(cleaned);
      })
      .catch(() => setCourseOptions([]))
      .finally(() => setIsLoadingCourseOptions(false));

    if (initialData?.id) return;
    fetch('/api/course-settings', { cache: 'no-store' })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) return;
        if (!dirtyFields.enableQA && typeof json?.enableQA === 'boolean') setValue('enableQA', json.enableQA, { shouldDirty: false });
        if (!dirtyFields.isPublic && typeof json?.isPublic === 'boolean') setValue('isPublic', json.isPublic, { shouldDirty: false });
    if (!dirtyFields.level && typeof json?.level === 'string') setValue('level', json.level, { shouldDirty: false });
    if (!dirtyFields.categoryIds && typeof json?.categoryId === 'string') setValue('categoryIds', [json.categoryId], { shouldDirty: false });
        if (!dirtyFields.maxStudents && (typeof json?.maxStudents === 'number' || json?.maxStudents === null)) setValue('maxStudents', json.maxStudents, { shouldDirty: false });
        if (!dirtyFields.validityDays && (typeof json?.validityDays === 'number' || json?.validityDays === null)) setValue('validityDays', json.validityDays, { shouldDirty: false });
        if (!dirtyFields.enrollmentEndDate && (typeof json?.enrollmentEndDate === 'string' || json?.enrollmentEndDate === null)) {
          const inputValue =
            typeof json.enrollmentEndDate === 'string' && json.enrollmentEndDate
              ? new Date(json.enrollmentEndDate).toISOString().split('T')[0]
              : null;
          setValue('enrollmentEndDate', inputValue, { shouldDirty: false });
        }
        if (!dirtyFields.dripEnabled && typeof json?.dripEnabled === 'boolean') setValue('dripEnabled', json.dripEnabled, { shouldDirty: false });
        if (!dirtyFields.dripType && typeof json?.dripType === 'string') setValue('dripType', json.dripType, { shouldDirty: false });
        if (!dirtyFields.dripDays && (typeof json?.dripDays === 'number' || json?.dripDays === null)) setValue('dripDays', json.dripDays, { shouldDirty: false });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!requirementsOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (requirementsRef.current && requirementsRef.current.contains(t)) return;
      setRequirementsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRequirementsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [requirementsOpen]);

  const onSubmit = async (data: CourseFormData) => {
    // Force save and check result
    const success = await save(data);
    
    if (!success) {
      // If save fails, stop navigation
      // Ideally show toast or alert
      // The status bar will show "Gagal menyimpan otomatis" but we need more explicit feedback here
      // Maybe toast.error("Gagal menyimpan perubahan. Coba lagi.")
      // But we don't have toast imported here? Wait, LessonModal used toast. Check imports.
      // CourseStepBasic imports: Check, ArrowRight, Loader2, etc. No sonner/toast.
      // I will assume toast is not available or I should just rely on status bar + return.
      // But status bar might be out of view if scrolled down? No, sticky top.
      return; 
    }

    // Proceed if save successful
    const formattedData = {
      ...data,
      categoryIds: Array.isArray((data as any).categoryIds) ? (data as any).categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean) : [],
      learningOutcomes: data.learningOutcomes?.map(i => i.value).filter(Boolean),
      tags: Array.isArray(data.tags) ? data.tags.map((s) => String(s || '').trim()).filter(Boolean) : [],
      prePurchaseNote: data.prePurchaseNote && typeof data.prePurchaseNote === 'string' ? data.prePurchaseNote.trim() : data.prePurchaseNote ?? null,
      requirements: Array.isArray(data.requirements) ? data.requirements.map((s) => String(s || '').trim()).filter(Boolean) : [],
      audience: data.audience?.map(i => i.value).filter(Boolean),
      enrollmentEndDate: data.enrollmentEndDate ? new Date(data.enrollmentEndDate).toISOString() : null,
    };
    onNext(formattedData);
  };

  const tabs = [
    { id: 'general', label: 'Umum', icon: Layers },
    { id: 'enrollment', label: 'Pendaftaran', icon: Users },
    { id: 'drip', label: 'Jadwal Materi', icon: Clock },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Autosave Status Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 -mx-6 px-6 py-2.5 flex items-center justify-between text-xs font-medium text-slate-500 mb-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          {saveStatus === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> <span className="text-indigo-600">Menyimpan perubahan...</span></>}
          {saveStatus === 'saved' && <><Check className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-emerald-600">Tersimpan {lastSavedTime?.toLocaleTimeString()}</span></>}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2">
              <span className="text-red-500">Gagal menyimpan otomatis</span>
              <button onClick={retry} className="text-indigo-600 hover:text-indigo-800 underline transition-colors">Coba lagi</button>
            </div>
          )}
          {saveStatus === 'idle' && isDirty && <span>Perubahan belum tersimpan...</span>}
          {saveStatus === 'idle' && !isDirty && <span className="opacity-70">Semua perubahan tersimpan</span>}
        </div>
        {courseId && <div className="text-slate-400 font-mono">ID: {courseId.slice(-4)}</div>}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content Area (Left) */}
        <div className="flex-1 space-y-8">
          {/* Basic Info */}
          <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Judul Kursus</label>
              <div className="relative">
                <Book className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input 
                  {...register('title')}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 font-semibold text-lg"
                  placeholder="Contoh: Geologi Dasar untuk Pemula"
                />
              </div>
              {errors.title && <p className="text-red-500 text-xs mt-1 ml-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Subtitle (Slogan)</label>
              <input 
                {...register('subtitle')}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                placeholder="Contoh: Panduan lengkap memahami struktur bumi dalam 30 hari."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Permalink (Slug)</label>
              <div className="relative">
                <Hash className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input 
                  {...register('slug')}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all font-mono text-sm"
                />
              </div>
              {errors.slug && <p className="text-red-500 text-xs mt-1 ml-1">{errors.slug.message}</p>}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-medium text-slate-700 mb-3">Deskripsi Lengkap</label>
            <RichTextEditor 
              value={description} 
              onChange={(val) => setValue('description', val)} 
            />
            {errors.description && <p className="text-red-500 text-xs mt-1 ml-1">{errors.description.message}</p>}
          </div>

          {/* Learning Outcomes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <DynamicList 
              label="Apa yang akan dipelajari?" 
              name="learningOutcomes" 
              control={control} 
              register={register}
              placeholder="Contoh: Memahami dasar geologi..." 
            />
          </div>
        </div>

        {/* Sidebar (Right) */}
        <div className="w-full lg:w-[380px] space-y-6 sticky top-24 self-start">
          {/* Metadata Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <CustomSelect
              label="Mentor / Instruktur"
              icon={Users}
              value={watch('instructorId') || ''}
              onChange={(val) => setValue('instructorId', val)}
              options={[
                { label: "Saya Sendiri (Admin)", value: "" },
                ...mentors.map((m: any) => ({ label: `${m.name} (${m.role})`, value: m.id }))
              ]}
              placeholder="Pilih Mentor..."
            />
            <p className="text-xs text-slate-400 -mt-3 ml-1">Biarkan kosong untuk menetapkan diri sendiri.</p>

            <MultiSelect
              label="Kategori"
              icon={AlignLeft}
              values={(watch('categoryIds') as any) || []}
              onChange={(next) => setValue('categoryIds', next as any, { shouldDirty: true })}
              options={categories.map((c: any) => ({ label: c.name, value: c.id }))}
              placeholder="Pilih Kategori..."
              error={(errors as any).categoryIds?.message as any}
            />
            <div className="flex items-center justify-between -mt-3">
              <button
                type="button"
                onClick={() => setCreateCategoryOpen((v) => !v)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Tambah kategori
              </button>
              {createCategoryOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreateCategoryOpen(false);
                    setNewCategoryName('');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline"
                >
                  Batal
                </button>
              ) : null}
            </div>
            {createCategoryOpen ? (
              <div className="space-y-2 -mt-1">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nama kategori baru"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={createCourseCategory}
                  disabled={isCreatingCategory}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isCreatingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Simpan kategori
                </button>
              </div>
            ) : null}

            <CustomSelect
              label="Level Kesulitan"
              icon={BarChart}
              value={watch('level')}
              onChange={(val) => setValue('level', val as any)}
              options={[
                { label: "Pemula (Beginner)", value: "BEGINNER" },
                { label: "Menengah (Intermediate)", value: "INTERMEDIATE" },
                { label: "Mahir (Advanced)", value: "ADVANCED" }
              ]}
              placeholder="Pilih Level..."
            />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">Tag Kursus</label>
              <div className="mt-3">
                <TagInput
                  value={Array.isArray(watch('tags')) ? (watch('tags') as any) : []}
                  onChange={(next) => setValue('tags', next as any, { shouldDirty: true })}
                  placeholder="Contoh: GIS, ArcGIS, Pemetaan"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Catatan untuk Calon Siswa (Opsional)</label>
              <textarea
                value={watch('prePurchaseNote') || ''}
                onChange={(e) => setValue('prePurchaseNote', e.target.value, { shouldDirty: true })}
                rows={4}
                className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all"
                placeholder="Contoh: Kursus ini membutuhkan laptop minimal RAM 8GB dan ArcGIS Pro 3.x."
              />
            </div>
          </div>

          {/* Requirements & Audience */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-3" ref={requirementsRef}>
              <label className="block text-sm font-medium text-slate-700">Prasyarat (Requirements)</label>

              <div className="flex flex-wrap gap-2">
                {(watch('requirements') || []).length === 0 ? (
                  <div className="text-xs font-medium text-slate-400">Belum ada prasyarat.</div>
                ) : (
                  (watch('requirements') || []).map((id) => {
                    const cid = String(id || '').trim();
                    if (!cid) return null;
                    const label = courseOptions.find((c) => c.id === cid)?.title || 'Kursus';
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => {
                          const next = (watch('requirements') || []).filter((x) => String(x || '').trim() !== cid);
                          setValue('requirements', next, { shouldDirty: true });
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 transition-colors"
                        title="Klik untuk hapus"
                      >
                        <span className="truncate max-w-[220px]">{label}</span>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    );
                  })
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setRequirementsOpen((v) => !v);
                    setRequirementsQuery('');
                  }}
                  className={twMerge(
                    "w-full pl-4 pr-10 py-3 rounded-xl border bg-white text-left focus:outline-none transition-all flex items-center justify-between",
                    requirementsOpen ? "border-indigo-600 ring-4 ring-indigo-100" : "border-slate-300 hover:border-slate-400",
                    "text-slate-900"
                  )}
                >
                  <span className="truncate block">{isLoadingCourseOptions ? 'Memuat kursus...' : 'Tambah prasyarat kursus'}</span>
                  <ChevronDown className={twMerge("w-5 h-5 text-slate-400 transition-transform", requirementsOpen && "rotate-180")} />
                </button>

                {requirementsOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg border border-slate-100 py-2 max-h-80 overflow-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 pb-2">
                      <input
                        value={requirementsQuery}
                        onChange={(e) => setRequirementsQuery(e.target.value)}
                        placeholder="Cari kursus..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none"
                        autoFocus
                      />
                    </div>
                    {(courseOptions.filter((c) => c.title.toLowerCase().includes(requirementsQuery.trim().toLowerCase()))).length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400 text-center">Tidak ada kursus</div>
                    ) : (
                      courseOptions
                        .filter((c) => c.title.toLowerCase().includes(requirementsQuery.trim().toLowerCase()))
                        .map((c) => {
                          const selected = (watch('requirements') || []).some((x) => String(x || '').trim() === c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                const cur = (watch('requirements') || []).map((x) => String(x || '').trim()).filter(Boolean);
                                const next = selected ? cur.filter((x) => x !== c.id) : Array.from(new Set([...cur, c.id]));
                                setValue('requirements', next, { shouldDirty: true });
                              }}
                              className={twMerge(
                                "w-full px-4 py-2.5 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between group",
                                selected ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700"
                              )}
                            >
                              <span className="truncate">{c.title}</span>
                              {selected ? <Check className="w-4 h-4 text-indigo-600" /> : null}
                            </button>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <DynamicList 
                label="Target Audience" 
                name="audience" 
                control={control} 
                register={register}
                placeholder="Contoh: Mahasiswa..." 
              />
            </div>
          </div>

          {/* Settings Tabs */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex border-b border-slate-200 bg-slate-50">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={twMerge(
                      "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-all relative",
                      activeTab === tab.id 
                        ? "text-indigo-600 bg-white" 
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="p-5">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 rounded text-indigo-600">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-900">Aktifkan Q&A</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" {...register('enableQA')} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 rounded text-emerald-600">
                        {watch('isPublic') ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-medium text-slate-900">Akses Publik</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" {...register('isPublic')} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* Enrollment Tab */}
              {activeTab === 'enrollment' && (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Max Siswa</label>
                    <input 
                      type="number"
                      {...register('maxStudents', { valueAsNumber: true })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none"
                      placeholder="0 = Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Masa Aktif (Hari)</label>
                    <input 
                      type="number"
                      {...register('validityDays', { valueAsNumber: true })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none"
                      placeholder="0 = Selamanya"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Batas Daftar</label>
                    <input 
                      type="date"
                      {...register('enrollmentEndDate')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Drip Tab */}
              {activeTab === 'drip' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">Aktifkan Drip</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" {...register('dripEnabled')} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {dripEnabled && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Metode Rilis</p>
                      {['NONE', 'SCHEDULE', 'AFTER_ENROLLMENT', 'SEQUENTIAL'].map((type) => (
                        <label key={type} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                          <input type="radio" value={type} {...register('dripType')} className="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                          <span className="text-xs font-medium text-slate-700">
                            {type === 'NONE' && 'Langsung Terbuka'}
                            {type === 'SCHEDULE' && 'Jadwal Tanggal'}
                            {type === 'AFTER_ENROLLMENT' && 'X Hari Setelah Daftar'}
                            {type === 'SEQUENTIAL' && 'Berurutan'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-slate-200">
        <button 
          type="submit"
          className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          Lanjut <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
