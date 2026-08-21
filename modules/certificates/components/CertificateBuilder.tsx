/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  BookOpen,
  Clock,
  GraduationCap,
  Image as ImageIcon,
  Layout,
  Library,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Save,
  Signature,
  Type,
  User,
  CheckCircle2,
  Eye,
  FileText,
  Hash,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterVertical,
  Bold,
  Italic,
  Trash2,
  Undo,
  Redo,
  Layers,
  Search,
  ChevronLeft,
  Settings,
  MoreVertical,
  Zap,
  Boxes,
  Percent,
  List,
  Lock,
  Unlock,
  Copy,
  FlipVertical,
  FlipHorizontal,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Palette,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const COMMON_FONTS = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Playfair', value: '"Playfair Display", serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'Dancing', value: '"Dancing Script", cursive' },
  { name: 'Cinzel', value: 'Cinzel, serif' },
];

type CertificatePageOrientation = 'LANDSCAPE' | 'PORTRAIT';

interface CanvasElement {
  id: string;
  type: 'TEXT' | 'COURSE' | 'NAME' | 'INSTRUCTOR' | 'SIGNATURE' | 'SERIAL' | 'QR' | 'DATE' | 'DURATION' | 'POINT' | 'GRADE' | 'BUNDLE' | 'IMAGE' | 'SHAPE';
  x: number;
  y: number;
  width: number;
  height: number;
  src?: string;
  librarySvg?: string;
  librarySlots?: string[];
  libraryC1?: string;
  libraryC2?: string;
  libraryPxW?: number;
  libraryPxH?: number;
  lineStrokeWidth?: number;
  qrColor?: string;
  qrBgColor?: string;
  qrBgRadius?: number;
  qrPadding?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  content?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  opacity?: number;
  locked?: boolean;
  flipV?: boolean;
  flipH?: boolean;
  zIndex: number;
}

interface CertificateBuilderProps {
  initialSettings: any;
}

export default function CertificateBuilder({ initialSettings }: CertificateBuilderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');
  const courseId = searchParams.get('courseId');
  
  const handleClose = () => {
    const path = String(pathname || '');
    if (path.startsWith('/dashboard/mentor/certificates/builder')) {
      router.push('/dashboard/mentor/certificates');
      return;
    }
    router.back();
  };

  const [, setIsLoading] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'ELEMENTS' | 'MEDIA' | 'LIBRARY' | 'BACKDROPS' | 'LAYERS' | 'SETTINGS'>('ELEMENTS');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [designTitle, setDesignTitle] = useState<string>('Untitled Design');
  const [isEditingDesignTitle, setIsEditingDesignTitle] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [targetCourseId, setTargetCourseId] = useState<string>(courseId || '');
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateId || '');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [coursePickerQuery, setCoursePickerQuery] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerQuery, setTemplatePickerQuery] = useState('');
  const [coursePickerAnchor, setCoursePickerAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const [templatePickerAnchor, setTemplatePickerAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  
  const [certificatePageOrientation, setCertificatePageOrientation] = useState<CertificatePageOrientation>(initialSettings.certificatePageOrientation ?? 'LANDSCAPE');
  const [certificatePageSize, setCertificatePageSize] = useState<'A4' | 'LETTER'>((initialSettings.certificatePageSize === 'LETTER' ? 'LETTER' : 'A4') as any);
  const [certificateBackgroundImageUrl, setCertificateBackgroundImageUrl] = useState<string>(initialSettings.certificateBackgroundImageUrl ?? '');
  const [certificateAccentColor, setCertificateAccentColor] = useState<string>(initialSettings.certificateAccentColor ?? '#4F46E5');
  const [backdropsView, setBackdropsView] = useState<'HOME' | 'PATTERNS' | 'BACKDROPS'>('HOME');
  const [isGeneratingBackdrop, setIsGeneratingBackdrop] = useState(false);
  const [isUploadingBackdrop, setIsUploadingBackdrop] = useState(false);
  const [backdropUploads, setBackdropUploads] = useState<any[]>([]);
  const [isLoadingBackdropUploads, setIsLoadingBackdropUploads] = useState(false);
  const [isUploadingPattern, setIsUploadingPattern] = useState(false);
  const [patternUploads, setPatternUploads] = useState<any[]>([]);
  const [isLoadingPatternUploads, setIsLoadingPatternUploads] = useState(false);
  const [mentorSignatureUrl, setMentorSignatureUrl] = useState<string>(initialSettings.mentorSignatureUrl ?? '');
  const [meRole, setMeRole] = useState<'ADMIN' | 'MENTOR' | 'STUDENT' | null>(null);
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [activeLibraryColorIndex, setActiveLibraryColorIndex] = useState(0);
  
  const [builderZoom, setBuilderZoom] = useState(0.8);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<'ALL' | 'SHAPES' | 'ILLUSTRATIONS' | 'EDGES' | 'BORDERS'>('ALL');
  const [isAddingLibraryItem, setIsAddingLibraryItem] = useState(false);
  const [isRecoloringLibrary, setIsRecoloringLibrary] = useState(false);
  const [libraryUploads, setLibraryUploads] = useState<any[]>([]);
  const [isLoadingLibraryUploads, setIsLoadingLibraryUploads] = useState(false);
  const [isUploadingLibrarySvg, setIsUploadingLibrarySvg] = useState(false);
  const [libraryUploadCategory, setLibraryUploadCategory] = useState<'SHAPES' | 'ILLUSTRATIONS' | 'EDGES' | 'BORDERS'>('ILLUSTRATIONS');
  const elementNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [floatingPos, setFloatingPos] = useState<{ left: number; top: number; placement: 'top' | 'bottom' } | null>(null);
  const [layerDragId, setLayerDragId] = useState<string | null>(null);
  const [layerDragOverId, setLayerDragOverId] = useState<string | null>(null);
  const [layerDragPointerId, setLayerDragPointerId] = useState<number | null>(null);
  const layerRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const layersScrollRef = useRef<HTMLDivElement | null>(null);
  const coursePickerBtnRef = useRef<HTMLButtonElement | null>(null);
  const templatePickerBtnRef = useRef<HTMLButtonElement | null>(null);

  const certificatePage = useMemo(() => {
    const a4 = certificatePageOrientation === 'PORTRAIT' ? { widthMm: 210, heightMm: 297 } : { widthMm: 297, heightMm: 210 };
    const letter = certificatePageOrientation === 'PORTRAIT' ? { widthMm: 215.9, heightMm: 279.4 } : { widthMm: 279.4, heightMm: 215.9 };
    return certificatePageSize === 'LETTER' ? letter : a4;
  }, [certificatePageOrientation, certificatePageSize]);

  const certificatePagePx = useMemo(() => {
    const baseW = certificatePageOrientation === 'LANDSCAPE' ? 1122 : 794;
    const ratio = certificatePage.heightMm / certificatePage.widthMm;
    return { w: baseW, h: Math.max(1, Math.round(baseW * ratio)) };
  }, [certificatePage.widthMm, certificatePage.heightMm, certificatePageOrientation]);

  useEffect(() => {
    if (!showPreviewModal) return;
    const update = () => {
      const pad = 140;
      const maxW = Math.max(240, window.innerWidth - pad);
      const maxH = Math.max(240, window.innerHeight - pad);
      const scale = Math.max(0.2, Math.min(1.25, Math.min(maxW / certificatePagePx.w, maxH / certificatePagePx.h)));
      setPreviewScale(scale);
    };
    update();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPreviewModal(false);
    };
    window.addEventListener('resize', update);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('keydown', onKey);
    };
  }, [showPreviewModal, certificatePagePx.w, certificatePagePx.h]);

  // This history snapshot should run only when the certificate page size changes.
   
  useEffect(() => {
    setCanvasElements((prev) => {
      if (!prev.length) return prev;
      let changed = false;
      const next = prev.map((el) => {
        const width = Math.max(5, Math.min(el.width, certificatePage.widthMm));
        const height = Math.max(5, Math.min(el.height, certificatePage.heightMm));
        const maxX = Math.max(0, certificatePage.widthMm - width);
        const maxY = Math.max(0, certificatePage.heightMm - height);
        const x = Math.max(0, Math.min(maxX, el.x));
        const y = Math.max(0, Math.min(maxY, el.y));
        if (width === el.width && height === el.height && x === el.x && y === el.y) return el;
        changed = true;
        return { ...el, width, height, x, y };
      });
      if (!changed) return prev;
      saveToHistory(next);
      return next;
    });
  }, [certificatePage.widthMm, certificatePage.heightMm]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedElement = useMemo(() => 
    canvasElements.find(el => el.id === selectedElementId) || null
  , [canvasElements, selectedElementId]);

  const selectedLibrarySlots = useMemo(() => {
    if (!selectedElement?.librarySvg) return [];
    if (Array.isArray(selectedElement.librarySlots) && selectedElement.librarySlots.length > 0) return selectedElement.librarySlots;
    const legacy = [selectedElement.libraryC1, selectedElement.libraryC2].filter(Boolean) as string[];
    return legacy;
  }, [selectedElement]);

  const sortedElements = useMemo(() => 
    [...canvasElements].sort((a, b) => a.zIndex - b.zIndex)
  , [canvasElements]);

  const getLayerLabel = (type: CanvasElement['type']) => {
    if (type === 'NAME') return 'Student Name';
    if (type === 'INSTRUCTOR') return 'Instructor';
    if (type === 'COURSE') return 'Course';
    if (type === 'SERIAL') return 'Verification ID';
    if (type === 'QR') return 'QR';
    if (type === 'SIGNATURE') return 'Signature';
    if (type === 'IMAGE') return 'Photo';
    if (type === 'TEXT') return 'Text';
    if (type === 'DATE') return 'Time';
    if (type === 'DURATION') return 'Duration';
    if (type === 'POINT') return 'Point';
    if (type === 'GRADE') return 'Grade';
    if (type === 'BUNDLE') return 'Bundle Courses';
    return type;
  };

  const getLayerIcon = (type: CanvasElement['type']) => {
    if (type === 'NAME' || type === 'INSTRUCTOR') return User;
    if (type === 'COURSE' || type === 'BUNDLE') return BookOpen;
    if (type === 'SERIAL') return Hash;
    if (type === 'QR') return QrCode;
    if (type === 'SIGNATURE') return Signature;
    if (type === 'IMAGE') return ImageIcon;
    if (type === 'TEXT') return Type;
    if (type === 'DATE') return Clock;
    if (type === 'DURATION') return Zap;
    if (type === 'POINT') return Award;
    if (type === 'GRADE') return Percent;
    return FileText;
  };

  const layersElements = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    return [...canvasElements]
      .map((el) => ({ el, label: getLayerLabel(el.type), Icon: getLayerIcon(el.type) }))
      .filter((x) => (q ? x.label.toLowerCase().includes(q) : true))
      .sort((a, b) => b.el.zIndex - a.el.zIndex);
  }, [canvasElements, sidebarSearch]);

  const selectedCourseLabel = useMemo(() => {
    const id = String(targetCourseId || '').trim();
    if (!id) return '';
    const c = (availableCourses || []).find((x: any) => String(x?.id || '') === id);
    return c ? String(c?.title || c?.slug || c?.id || '') : '';
  }, [availableCourses, targetCourseId]);

  const filteredCourses = useMemo(() => {
    const q = coursePickerQuery.trim().toLowerCase();
    const list = Array.isArray(availableCourses) ? availableCourses : [];
    if (!q) return list;
    return list.filter((c: any) => {
      const t = String(c?.title || '').toLowerCase();
      const s = String(c?.slug || '').toLowerCase();
      return t.includes(q) || s.includes(q);
    });
  }, [availableCourses, coursePickerQuery]);

  const selectedTemplateLabel = useMemo(() => {
    const id = String(selectedTemplateId || '').trim();
    if (!id) return '';
    const t = (availableTemplates || []).find((x: any) => String(x?.id || '') === id);
    return t ? String(t?.name || t?.id || '') : '';
  }, [availableTemplates, selectedTemplateId]);

  const filteredTemplates = useMemo(() => {
    const q = templatePickerQuery.trim().toLowerCase();
    const list = Array.isArray(availableTemplates) ? availableTemplates : [];
    if (!q) return list;
    return list.filter((t: any) => String(t?.name || t?.id || '').toLowerCase().includes(q));
  }, [availableTemplates, templatePickerQuery]);

  const templatesForPanel = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    const list = Array.isArray(availableTemplates) ? availableTemplates : [];
    if (!q) return list;
    return list.filter((t: any) => String(t?.name || t?.id || '').toLowerCase().includes(q));
  }, [availableTemplates, sidebarSearch]);

  const reorderLayersByDragDrop = (dragId: string, overId: string, opts?: { commit?: boolean }) => {
    if (!dragId || !overId || dragId === overId) return;
    setCanvasElements((prev) => {
      const fullOrder = [...prev].sort((a, b) => b.zIndex - a.zIndex).map((e) => e.id);
      const q = sidebarSearch.trim().toLowerCase();
      const idToLabel = new Map<string, string>();
      prev.forEach((el) => idToLabel.set(el.id, getLayerLabel(el.type).toLowerCase()));
      const isVisible = (id: string) => {
        if (!q) return true;
        const label = idToLabel.get(id) || '';
        return label.includes(q);
      };
      const visibleIds = fullOrder.filter((id) => isVisible(id));
      const from = visibleIds.indexOf(dragId);
      const to = visibleIds.indexOf(overId);
      if (from === -1 || to === -1) return prev;
      if (from === to) return prev;

      visibleIds.splice(from, 1);
      visibleIds.splice(to, 0, dragId);

      let vi = 0;
      const nextFullOrder = fullOrder.map((id) => {
        if (!isVisible(id)) return id;
        const replacement = visibleIds[vi];
        vi++;
        return replacement;
      });

      const n = nextFullOrder.length;
      const idToZ = new Map<string, number>();
      for (let i = 0; i < n; i++) idToZ.set(nextFullOrder[i], n - i);

      const next = prev.map((el) => ({ ...el, zIndex: idToZ.get(el.id) ?? el.zIndex }));
      if (opts?.commit) saveToHistory(next);
      return next;
    });
  };

  // Pointer listeners are intentionally keyed to the active drag session.
   
  useEffect(() => {
    if (!layerDragId || layerDragPointerId === null) return;
    const move = (e: PointerEvent) => {
      if (layerDragPointerId !== null && e.pointerId !== layerDragPointerId) return;
      const root = layersScrollRef.current;
      if (root) {
        const rr = root.getBoundingClientRect();
        const edge = 56;
        if (e.clientY - rr.top < edge) root.scrollTop -= 16;
        if (rr.bottom - e.clientY < edge) root.scrollTop += 16;
      }

      let over: string | null = null;
      for (const { el } of layersElements) {
        const node = layerRowRefs.current[el.id];
        if (!node) continue;
        const r = node.getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) {
          over = el.id;
          break;
        }
      }
      if (!over) {
        const first = layersElements[0]?.el?.id;
        const last = layersElements[layersElements.length - 1]?.el?.id;
        const rootRect = layersScrollRef.current?.getBoundingClientRect();
        if (rootRect && e.clientY < rootRect.top) over = first || null;
        if (rootRect && e.clientY > rootRect.bottom) over = last || null;
      }
      if (over && over !== layerDragOverId) setLayerDragOverId(over);
    };

    const up = (e: PointerEvent) => {
      if (layerDragPointerId !== null && e.pointerId !== layerDragPointerId) return;
      if (layerDragId && layerDragOverId) reorderLayersByDragDrop(layerDragId, layerDragOverId, { commit: true });
      setLayerDragId(null);
      setLayerDragOverId(null);
      setLayerDragPointerId(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [layerDragId, layerDragOverId, layerDragPointerId, layersElements, sidebarSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial template hydration is intentionally driven by routing/query state.
   
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        const user = data?.user;
        if (user && typeof user === 'object') {
          if (user.role === 'ADMIN' || user.role === 'MENTOR' || user.role === 'STUDENT') setMeRole(user.role);
          if (typeof user.signatureUrl === 'string') setMentorSignatureUrl(user.signatureUrl);
        }
      } catch {
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Floating toolbar is recalculated from the active selection and zoom only.
   
  useEffect(() => {
    setTargetCourseId(courseId || '');
  }, [courseId]);

  // The resize listener only needs the current component scheduler.
   
  useEffect(() => {
    setSelectedTemplateId(templateId || '');
  }, [templateId]);

  useEffect(() => {
    if (activeTab !== 'SETTINGS' && activeTab !== 'TEMPLATES') return;
    if (!meRole) return;
    let active = true;
    (async () => {
      try {
        setIsLoadingTemplates(true);
        const res = await fetch('/api/certificate-templates', { cache: 'no-store' });
        const data = await res.json().catch(() => ([]));
        if (!active) return;
        const items = Array.isArray(data) ? data : [];
        setAvailableTemplates(items);
      } catch {
        if (!active) return;
        setAvailableTemplates([]);
      } finally {
        if (!active) return;
        setIsLoadingTemplates(false);
      }
    })();
    if (activeTab === 'SETTINGS') {
      (async () => {
        try {
          setIsLoadingCourses(true);
          if (meRole === 'ADMIN') {
            const res = await fetch(`/api/dashboard/admin/course-reports?tab=courses&limit=100`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!active) return;
            const courses = Array.isArray(data?.courses) ? data.courses : [];
            setAvailableCourses(courses);
          } else if (meRole === 'MENTOR') {
            const res = await fetch(`/api/dashboard/mentor/courses`, { cache: 'no-store' });
            const data = await res.json().catch(() => ([]));
            if (!active) return;
            const courses = Array.isArray(data) ? data : [];
            setAvailableCourses(courses);
          } else {
            setAvailableCourses([]);
          }
        } catch {
          if (!active) return;
          setAvailableCourses([]);
        } finally {
          if (!active) return;
          setIsLoadingCourses(false);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [activeTab, meRole]);

  useEffect(() => {
    if (!showCoursePicker && !showTemplatePicker) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.settings-picker-panel') || target.closest('.settings-picker-trigger')) return;
      setShowCoursePicker(false);
      setShowTemplatePicker(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCoursePicker(false);
        setShowTemplatePicker(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [showCoursePicker, showTemplatePicker]);

  const openCoursePicker = () => {
    const r = coursePickerBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setCoursePickerAnchor({ left: r.left, top: r.bottom + 8, width: r.width });
    setShowCoursePicker(true);
    setShowTemplatePicker(false);
    setCoursePickerQuery('');
  };

  const openTemplatePicker = () => {
    const r = templatePickerBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setTemplatePickerAnchor({ left: r.left, top: r.bottom + 8, width: r.width });
    setShowTemplatePicker(true);
    setShowCoursePicker(false);
    setTemplatePickerQuery('');
  };

  const saveToHistory = (elements: CanvasElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...elements.map(el => ({...el}))]);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCanvasElements([...prev.map(el => ({...el}))]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCanvasElements([...next.map(el => ({...el}))]);
    }
  };

  const applyTemplateRecord = (template: any) => {
    if (!template || typeof template !== 'object') return;
    const content = (template as any).content;
    if (!content || typeof content !== 'object') return;

    if (typeof (template as any).name === 'string' && (template as any).name.trim()) setDesignTitle((template as any).name.trim());
    if (Array.isArray((content as any).elements)) {
      const els = (content as any).elements as any[];
      setCanvasElements(els as any);
      saveToHistory(els as any);
    }
    if ((content as any).orientation) setCertificatePageOrientation((content as any).orientation);
    if ((content as any).pageSize === 'LETTER' || (content as any).pageSize === 'A4') setCertificatePageSize((content as any).pageSize);
    if ((content as any).background) setCertificateBackgroundImageUrl((content as any).background);
    if (typeof (content as any).accent === 'string') setCertificateAccentColor((content as any).accent);

    setSelectedElementId(null);
    setShowSettingsPopover(false);
    setShowTextEditor(false);
    setShowColorPicker(false);
    setShowFontPicker(false);
    toast.success('Template diterapkan');
  };

  const handleApplyTemplateById = async (id: string) => {
    const tid = String(id || '').trim();
    setSelectedTemplateId(tid);
    if (!tid) return;
    try {
      const existing = Array.isArray(availableTemplates) ? availableTemplates.find((t: any) => t?.id === tid) : null;
      if (existing) {
        applyTemplateRecord(existing);
        return;
      }
      setIsLoadingTemplates(true);
      const res = await fetch('/api/certificate-templates', { cache: 'no-store' });
      const data = await res.json().catch(() => ([]));
      const items = Array.isArray(data) ? data : [];
      setAvailableTemplates(items);
      const found = items.find((t: any) => t?.id === tid);
      if (found) applyTemplateRecord(found);
      else toast.error('Template tidak ditemukan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menerapkan template');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const addElement = (type: CanvasElement['type']) => {
    const id = Math.random().toString(36).substr(2, 9);
    const maxZ = canvasElements.length > 0 ? Math.max(...canvasElements.map(e => e.zIndex)) : 0;
    
    let props: Partial<CanvasElement> = {
      fontSize: 16,
      color: '#000000',
      fontFamily: 'Inter, sans-serif',
      align: 'center',
      opacity: 100,
      width: 100,
      height: 20,
      zIndex: maxZ + 1,
    };

    if (type === 'NAME') {
      props = { ...props, fontSize: 42, bold: true, color: certificateAccentColor, width: 200, height: 25 };
    } else if (type === 'COURSE') {
      props = { ...props, fontSize: 28, bold: true, color: '#1e293b', width: 200, height: 20 };
    } else if (type === 'TEXT') {
      props = { ...props, content: 'Masukkan teks di sini...', width: 150, height: 15 };
    } else if (type === 'SIGNATURE' || type === 'SHAPE') {
      props = { ...props, width: 40, height: 40 };
    } else if (type === 'QR') {
      props = {
        ...props,
        width: 35,
        height: 35,
        qrColor: '#000000',
        qrBgColor: '#FFFFFF',
        qrBgRadius: 6,
        qrPadding: 2,
      };
    } else if (type === 'IMAGE') {
      props = { ...props, width: 80, height: 60 };
    }

    const newElement: CanvasElement = {
      id,
      type,
      x: certificatePage.widthMm / 2 - (props.width! / 2),
      y: certificatePage.heightMm / 2 - (props.height! / 2),
      ...props,
    } as CanvasElement;
    
    const nextElements = [...canvasElements, newElement];
    setCanvasElements(nextElements);
    setSelectedElementId(id);
    saveToHistory(nextElements);
    toast.success(`${type} ditambahkan`);
  };

  const addImageElement = (src: string) => {
    const t = src.trim();
    if (!t) return;
    const id = Math.random().toString(36).substr(2, 9);
    const maxZ = canvasElements.length > 0 ? Math.max(...canvasElements.map(e => e.zIndex)) : 0;
    const w = 80;
    const h = 60;
    const newElement: CanvasElement = {
      id,
      type: 'IMAGE',
      x: certificatePage.widthMm / 2 - w / 2,
      y: certificatePage.heightMm / 2 - h / 2,
      width: w,
      height: h,
      zIndex: maxZ + 1,
      opacity: 100,
      src: t,
      align: 'center',
    };
    const nextElements = [...canvasElements, newElement];
    setCanvasElements(nextElements);
    setSelectedElementId(id);
    saveToHistory(nextElements);
  };

  const svgToPngDataUrl = async (svg: string, size: { w: number; h: number }) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      const load = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Gagal memuat SVG'));
      });
      img.src = url;
      await load;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(size.w));
      canvas.height = Math.max(1, Math.floor(size.h));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const backdropPx = useMemo(() => {
    return { w: certificatePagePx.w, h: certificatePagePx.h };
  }, [certificatePagePx.w, certificatePagePx.h]);

  const wrapBackdropSvg = (innerSvg: string) => {
    const w = backdropPx.w;
    const h = backdropPx.h;
    const body = innerSvg.replace(/<\/?svg[^>]*>/gi, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  };

  const wrapThumbSvg = (innerSvg: string, size: { w: number; h: number }) => {
    const w = size.w;
    const h = size.h;
    const body = innerSvg.replace(/<\/?svg[^>]*>/gi, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  };

  const applyBackdropFromSvg = async (svgInner: string) => {
    setIsGeneratingBackdrop(true);
    try {
      const svg = wrapBackdropSvg(svgInner);
      const png = await svgToPngDataUrl(svg, { w: backdropPx.w, h: backdropPx.h });
      setCertificateBackgroundImageUrl(png);
      toast.success('Backdrop diterapkan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menerapkan backdrop');
    } finally {
      setIsGeneratingBackdrop(false);
    }
  };

  const backdropColors = useMemo(() => {
    return [
      '#000000',
      '#ffffff',
      '#ef4444',
      '#f97316',
      '#f59e0b',
      '#84cc16',
      '#22c55e',
      '#14b8a6',
      '#06b6d4',
      '#3b82f6',
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
      '#ec4899',
      '#64748b',
      '#0f172a',
    ];
  }, []);

  const patternPresets = useMemo(() => {
    const a = certificateAccentColor || '#4F46E5';
    const lineStep = 18;
    const dotStep = 18;
    const chevronX = 40;
    const chevronY = 38;
    const ringStep = 36;
    return [
      {
        id: 'pattern-lines',
        name: 'Lines',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g stroke="${a}" stroke-width="1" opacity="0.06">${Array.from({ length: Math.ceil(backdropPx.h / lineStep) + 4 }).map((_, i) => `<path d="M0 ${12 + i * lineStep} H ${backdropPx.w}"/>`).join('')}</g>`,
      },
      {
        id: 'pattern-gelombang',
        name: 'Gelombang',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><defs><pattern id="p-gel" width="56" height="16" patternUnits="userSpaceOnUse"><path d="M0 8 C 14 4, 28 12, 42 8 C 49 6, 56 4, 56 8" fill="none" stroke="${a}" stroke-width="1.1" opacity="0.05" stroke-linecap="round"/></pattern></defs><rect width="100%" height="100%" fill="url(#p-gel)"/>`,
      },
      {
        id: 'pattern-dots',
        name: 'Dots',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g fill="${a}" opacity="0.08">${Array.from({ length: Math.ceil(backdropPx.h / dotStep) + 3 }).map((_, y) => Array.from({ length: Math.ceil(backdropPx.w / dotStep) + 3 }).map((__, x) => `<circle cx="${10 + x * dotStep}" cy="${10 + y * dotStep}" r="1.4"/>`).join('')).join('')}</g>`,
      },
      {
        id: 'pattern-diagonal',
        name: 'Diagonal',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g stroke="${a}" stroke-width="4" opacity="0.045" stroke-linecap="round">${Array.from({ length: Math.ceil((backdropPx.w + backdropPx.h) / 52) + 8 }).map((_, i) => `<path d="M${-backdropPx.h + i * 52} ${backdropPx.h} L ${i * 52} 0"/>`).join('')}</g>`,
      },
      {
        id: 'pattern-grid',
        name: 'Grid',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><defs><pattern id="p-grid-s" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="${a}" stroke-width="1" opacity="0.025"/></pattern><pattern id="p-grid-m" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="${a}" stroke-width="1" opacity="0.045"/></pattern></defs><rect width="100%" height="100%" fill="url(#p-grid-s)"/><rect width="100%" height="100%" fill="url(#p-grid-m)"/>`,
      },
      {
        id: 'pattern-crosshatch',
        name: 'Crosshatch',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g stroke="${a}" stroke-width="3" opacity="0.04" stroke-linecap="round">${Array.from({ length: Math.ceil((backdropPx.w + backdropPx.h) / 60) + 10 }).map((_, i) => `<path d="M${-backdropPx.h + i * 60} ${backdropPx.h} L ${i * 60} 0"/>`).join('')}${Array.from({ length: Math.ceil((backdropPx.w + backdropPx.h) / 60) + 10 }).map((_, i) => `<path d="M${-backdropPx.h + i * 60} 0 L ${i * 60} ${backdropPx.h}"/>`).join('')}</g>`,
      },
      {
        id: 'pattern-chevrons',
        name: 'Chevrons',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g fill="none" stroke="${a}" stroke-width="6" opacity="0.045" stroke-linecap="round" stroke-linejoin="round">${Array.from({ length: Math.ceil(backdropPx.h / chevronY) + 3 }).map((_, y) => Array.from({ length: Math.ceil(backdropPx.w / chevronX) + 3 }).map((__, x) => `<path d="M${12 + x * chevronX} ${12 + y * chevronY} l12 12 l12-12"/>`).join('')).join('')}</g>`,
      },
      {
        id: 'pattern-waves',
        name: 'Waves',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><defs><pattern id="p-wv" width="48" height="14" patternUnits="userSpaceOnUse"><path d="M0 7 C 12 3, 24 11, 36 7 C 42 5, 48 3, 48 7" fill="none" stroke="${a}" stroke-width="1" opacity="0.045" stroke-linecap="round"/></pattern></defs><rect width="100%" height="100%" fill="url(#p-wv)"/>`,
      },
      {
        id: 'pattern-triangles',
        name: 'Triangles',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g fill="${a}" opacity="0.045">${Array.from({ length: Math.ceil(backdropPx.h / 34) + 3 }).map((_, y) => Array.from({ length: Math.ceil(backdropPx.w / 34) + 3 }).map((__, x) => {
          const cx = 12 + x * 34;
          const cy = 12 + y * 34;
          return `<path d="M${cx} ${cy - 7} L${cx + 7} ${cy + 7} L${cx - 7} ${cy + 7} Z"/>`;
        }).join('')).join('')}</g>`,
      },
      {
        id: 'pattern-rings',
        name: 'Rings',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g fill="none" stroke="${a}" stroke-width="2" opacity="0.045">${Array.from({ length: Math.ceil(backdropPx.h / ringStep) + 3 }).map((_, y) => Array.from({ length: Math.ceil(backdropPx.w / ringStep) + 3 }).map((__, x) => `<circle cx="${14 + x * ringStep}" cy="${14 + y * ringStep}" r="7"/>`).join('')).join('')}</g>`,
      },
      {
        id: 'pattern-confetti',
        name: 'Confetti',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><g opacity="0.08" fill="${a}">${Array.from({ length: 140 }).map((_, i) => {
          const x = (i * 73) % backdropPx.w;
          const y = (i * 131) % backdropPx.h;
          const w = 4 + (i % 6);
          const h = 2 + (i % 2);
          const r = (i * 19) % 360;
          return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" transform="rotate(${r} ${x} ${y})"/>`;
        }).join('')}</g>`,
      },
    ];
  }, [certificateAccentColor, backdropPx.w, backdropPx.h]);

  const backdropPresets = useMemo(() => {
    const a = certificateAccentColor || '#4F46E5';
    return [
      {
        id: 'backdrop-clean',
        name: 'Clean',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><path d="M0 0H${backdropPx.w}V${Math.round(backdropPx.h * 0.12)}H0Z" fill="${a}" opacity="0.04"/><path d="M0 ${Math.round(backdropPx.h * 0.86)}H${backdropPx.w}V${backdropPx.h}H0Z" fill="${a}" opacity="0.04"/>`,
      },
      {
        id: 'backdrop-left-band',
        name: 'Left Band',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><rect x="0" y="0" width="${Math.round(backdropPx.w * 0.08)}" height="${backdropPx.h}" fill="${a}" opacity="0.85"/><rect x="${Math.round(backdropPx.w * 0.08)}" y="0" width="${Math.round(backdropPx.w * 0.02)}" height="${backdropPx.h}" fill="${a}" opacity="0.18"/>`,
      },
      {
        id: 'backdrop-corners',
        name: 'Corners',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><circle cx="${Math.round(backdropPx.w * 0.08)}" cy="${Math.round(backdropPx.h * 0.10)}" r="${Math.round(backdropPx.h * 0.12)}" fill="${a}" opacity="0.10"/><circle cx="${Math.round(backdropPx.w * 0.92)}" cy="${Math.round(backdropPx.h * 0.88)}" r="${Math.round(backdropPx.h * 0.16)}" fill="${a}" opacity="0.10"/><path d="M0 ${Math.round(backdropPx.h * 0.86)} Q ${Math.round(backdropPx.w * 0.25)} ${Math.round(backdropPx.h * 0.76)} ${Math.round(backdropPx.w * 0.46)} ${Math.round(backdropPx.h * 0.86)} T ${Math.round(backdropPx.w)} ${Math.round(backdropPx.h * 0.86)} V ${backdropPx.h} H 0 Z" fill="${a}" opacity="0.05"/>`,
      },
      {
        id: 'backdrop-wave',
        name: 'Wave',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><path d="M0 ${Math.round(backdropPx.h * 0.24)} C ${Math.round(backdropPx.w * 0.18)} ${Math.round(backdropPx.h * 0.10)} ${Math.round(backdropPx.w * 0.32)} ${Math.round(backdropPx.h * 0.36)} ${Math.round(backdropPx.w * 0.50)} ${Math.round(backdropPx.h * 0.22)} C ${Math.round(backdropPx.w * 0.66)} ${Math.round(backdropPx.h * 0.10)} ${Math.round(backdropPx.w * 0.82)} ${Math.round(backdropPx.h * 0.34)} ${backdropPx.w} ${Math.round(backdropPx.h * 0.18)} V 0 H 0 Z" fill="${a}" opacity="0.10"/><path d="M0 ${Math.round(backdropPx.h * 0.96)} C ${Math.round(backdropPx.w * 0.22)} ${Math.round(backdropPx.h * 0.82)} ${Math.round(backdropPx.w * 0.36)} ${Math.round(backdropPx.h * 1.02)} ${Math.round(backdropPx.w * 0.52)} ${Math.round(backdropPx.h * 0.88)} C ${Math.round(backdropPx.w * 0.70)} ${Math.round(backdropPx.h * 0.72)} ${Math.round(backdropPx.w * 0.82)} ${Math.round(backdropPx.h * 0.98)} ${backdropPx.w} ${Math.round(backdropPx.h * 0.82)} V ${backdropPx.h} H 0 Z" fill="${a}" opacity="0.06"/>`,
      },
      {
        id: 'backdrop-frame',
        name: 'Frame',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><rect x="18" y="18" width="${backdropPx.w - 36}" height="${backdropPx.h - 36}" rx="38" fill="none" stroke="${a}" stroke-width="10" opacity="0.35"/><rect x="44" y="44" width="${backdropPx.w - 88}" height="${backdropPx.h - 88}" rx="30" fill="none" stroke="${a}" stroke-width="4" opacity="0.18"/>`,
      },
      {
        id: 'backdrop-top-right',
        name: 'Top Right',
        innerSvg: `<rect width="100%" height="100%" fill="#ffffff"/><path d="M${Math.round(backdropPx.w * 0.62)} 0 H ${backdropPx.w} V ${Math.round(backdropPx.h * 0.36)} C ${Math.round(backdropPx.w * 0.86)} ${Math.round(backdropPx.h * 0.18)} ${Math.round(backdropPx.w * 0.72)} ${Math.round(backdropPx.h * 0.12)} ${Math.round(backdropPx.w * 0.62)} 0 Z" fill="${a}" opacity="0.12"/><circle cx="${Math.round(backdropPx.w * 0.82)}" cy="${Math.round(backdropPx.h * 0.16)}" r="${Math.round(backdropPx.h * 0.10)}" fill="${a}" opacity="0.08"/>`,
      },
    ];
  }, [certificateAccentColor, backdropPx.w, backdropPx.h]);

  const applyLibrarySvgColors = (svgTemplate: string, c1: string, c2?: string) => {
    const primary = (c1 || '#4F46E5').trim();
    const secondary = (c2 || '#F59E0B').trim();
    return svgTemplate
      .replaceAll('__C1__', primary)
      .replaceAll('__C2__', secondary)
      .replaceAll('__LW__', '28');
  };

  const applyLibrarySlots = (svgTemplate: string, slots: string[]) => {
    let out = svgTemplate;
    for (let i = 0; i < Math.min(16, slots.length); i++) {
      out = out.replaceAll(`__L${i}__`, (slots[i] || '#000000').trim());
    }
    if (out.includes('__C1__') || out.includes('__C2__')) {
      out = out.replaceAll('__C1__', (slots[0] || '#4F46E5').trim());
      out = out.replaceAll('__C2__', (slots[1] || '#F59E0B').trim());
    }
    return out;
  };

  const applyLibraryLineWidth = (svgTemplate: string, lineStrokeWidth?: number) => {
    const nextWidth = Math.max(4, Math.min(120, Math.round(Number(lineStrokeWidth) || 28)));
    return svgTemplate.replaceAll('__LW__', String(nextWidth));
  };

  const renderLibraryElementSvg = (svgTemplate: string, slots: string[], lineStrokeWidth?: number) => {
    return applyLibraryLineWidth(applyLibrarySlots(svgTemplate, slots), lineStrokeWidth);
  };

  const parseLibraryCategory = (alt: unknown): 'SHAPES' | 'ILLUSTRATIONS' | 'EDGES' | 'BORDERS' => {
    const t = typeof alt === 'string' ? alt : '';
    const key = 'certificate-library-svg:';
    const idx = t.toLowerCase().indexOf(key);
    if (idx === -1) return 'ILLUSTRATIONS';
    const after = t.slice(idx + key.length).trim();
    const raw = after.split('|')[0].trim().toUpperCase();
    if (raw === 'SHAPES' || raw === 'ILLUSTRATIONS' || raw === 'EDGES' || raw === 'BORDERS') return raw;
    return 'ILLUSTRATIONS';
  };

  const sanitizeSvgForUse = (raw: string) => {
    return raw
      .replace(/\uFEFF/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  };

  const extractSvgSize = (svg: string) => {
    const widthMatch = svg.match(/\bwidth\s*=\s*["']\s*([0-9.]+)\s*(px)?\s*["']/i);
    const heightMatch = svg.match(/\bheight\s*=\s*["']\s*([0-9.]+)\s*(px)?\s*["']/i);
    const vbMatch = svg.match(/\bviewBox\s*=\s*["']\s*([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s*["']/i);
    const w = widthMatch ? Number(widthMatch[1]) : vbMatch ? Number(vbMatch[3]) : 512;
    const h = heightMatch ? Number(heightMatch[1]) : vbMatch ? Number(vbMatch[4]) : 512;
    return {
      pxW: Number.isFinite(w) && w > 0 ? w : 512,
      pxH: Number.isFinite(h) && h > 0 ? h : 512,
    };
  };

  const normalizeHex = (input: string) => {
    const t = input.trim().toLowerCase();
    const m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    const hex = m[1].toLowerCase();
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    return `#${hex}`;
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    const to2 = (n: number) => clamp(n).toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  };

  const colorTokenToHex = (token: string) => {
    const t = token.trim().toLowerCase();
    const hx = normalizeHex(t);
    if (hx) return hx;
    const rgb = t.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
    if (rgb) return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
    const named: Record<string, string> = {
      black: '#000000',
      white: '#ffffff',
      red: '#ff0000',
      green: '#00ff00',
      blue: '#0000ff',
      yellow: '#ffff00',
      orange: '#ffa500',
      purple: '#800080',
      gray: '#808080',
      grey: '#808080',
    };
    if (named[t]) return named[t];
    return null;
  };

  const normalizeSvgToPalette = (svgRaw: string, maxColors = 8) => {
    const sanitized = sanitizeSvgForUse(svgRaw);
    if (!sanitized.toLowerCase().includes('<svg')) throw new Error('SVG tidak valid');

    const size = extractSvgSize(sanitized);
    if (sanitized.includes('__L0__') || sanitized.includes('__L1__')) {
      const slots: string[] = ['#4F46E5'];
      if (sanitized.includes('__L1__')) slots.push('#F59E0B');
      return { svgTemplate: sanitized, slots, pxW: size.pxW, pxH: size.pxH };
    }

    if (sanitized.includes('__C1__') || sanitized.includes('__C2__')) {
      return {
        svgTemplate: sanitized.replaceAll('__C1__', '__L0__').replaceAll('__C2__', '__L1__'),
        slots: ['#4F46E5', '#F59E0B'].slice(0, sanitized.includes('__C2__') ? 2 : 1),
        pxW: size.pxW,
        pxH: size.pxH,
      };
    }

    let templ = sanitized;

    const found: { raw: string; hex: string }[] = [];
    const pushUnique = (raw: string) => {
      const hex = colorTokenToHex(raw);
      if (!hex) return;
      if (hex === '#000000' && raw.trim().toLowerCase() === 'none') return;
      if (raw.trim().toLowerCase() === 'none') return;
      if (raw.trim().toLowerCase() === 'transparent') return;
      if (!found.some((x) => x.hex === hex)) found.push({ raw, hex });
    };

    if (/\bcurrentColor\b/i.test(templ)) {
      pushUnique('#4F46E5');
    }

    const hexRe = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
    const rgbRe = /\brgba?\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+(?:\s*,\s*[0-9.]+)?\s*\)/gi;
    const namedRe = /\b(black|white|red|green|blue|yellow|orange|purple|gray|grey)\b/gi;

    for (const m of templ.match(hexRe) || []) pushUnique(m);
    for (const m of templ.match(rgbRe) || []) pushUnique(m);
    for (const m of templ.match(namedRe) || []) pushUnique(m);

    const slots = found.map((x) => x.hex).slice(0, Math.max(1, Math.min(16, maxColors)));
    if (slots.length === 0) {
      throw new Error('SVG ini tidak memiliki warna yang bisa dideteksi. Gunakan __L0__/__L1__ atau __C1__/__C2__.');
    }

    const hexToIndex = new Map<string, number>();
    slots.forEach((h, i) => hexToIndex.set(h, i));

    templ = templ.replace(/\bcurrentColor\b/gi, () => '__L0__');
    templ = templ.replace(hexRe, (raw) => {
      const hx = colorTokenToHex(raw);
      if (!hx) return raw;
      const idx = hexToIndex.get(hx);
      if (idx === undefined) return raw;
      return `__L${idx}__`;
    });
    templ = templ.replace(rgbRe, (raw) => {
      const hx = colorTokenToHex(raw);
      if (!hx) return raw;
      const idx = hexToIndex.get(hx);
      if (idx === undefined) return raw;
      return `__L${idx}__`;
    });
    templ = templ.replace(namedRe, (raw) => {
      const hx = colorTokenToHex(raw);
      if (!hx) return raw;
      const idx = hexToIndex.get(hx);
      if (idx === undefined) return raw;
      return `__L${idx}__`;
    });

    if (!templ.includes('__L0__')) {
      templ = templ.replaceAll(slots[0], '__L0__');
    }

    return { svgTemplate: templ, slots, pxW: size.pxW, pxH: size.pxH };
  };

  const LIBRARY_ITEMS = useMemo(() => {
    const mk = (args: { id: string; category: 'SHAPES' | 'ILLUSTRATIONS' | 'EDGES' | 'BORDERS'; name: string; svgTemplate: string; defaultC1: string; defaultC2?: string; defaultLineWidth?: number; mm: { w: number; h: number }; px: { w: number; h: number } }) => {
      return {
        ...args,
        kind: 'BUILTIN' as const,
        svg: applyLibraryLineWidth(applyLibrarySvgColors(args.svgTemplate, args.defaultC1, args.defaultC2), args.defaultLineWidth),
      };
    };

    const shapeSquare = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect x="64" y="64" width="384" height="384" rx="40" fill="__C1__"/></svg>`;
    const shapeCircle = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><circle cx="256" cy="256" r="190" fill="__C1__"/></svg>`;
    const shapeTriangle = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><path d="M256 70 L458 442 H54 Z" fill="__C1__"/></svg>`;
    const shapeStar = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><path d="M256 60l55 140 150 12-115 95 36 146-126-78-126 78 36-146-115-95 150-12z" fill="__C1__"/></svg>`;
    const shapePlus = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect x="210" y="90" width="92" height="332" rx="30" fill="__C1__"/><rect x="90" y="210" width="332" height="92" rx="30" fill="__C1__"/></svg>`;
    const shapeHex = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><path d="M256 62l160 92v204l-160 92-160-92V154z" fill="__C1__"/></svg>`;
    const shapeLine = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="256"><path d="M72 128 H952" fill="none" stroke="__C1__" stroke-width="__LW__" stroke-linecap="round"/></svg>`;

    const illuBadge1 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect x="70" y="120" width="372" height="272" rx="52" fill="__C1__"/><rect x="95" y="145" width="322" height="222" rx="40" fill="rgba(255,255,255,0.18)"/><rect x="120" y="250" width="272" height="78" rx="22" fill="__C2__" opacity="0.95"/><text x="256" y="232" font-size="84" font-family="Inter, Arial, sans-serif" text-anchor="middle" fill="#fff" font-weight="900">MAKERS</text><text x="256" y="306" font-size="52" font-family="Inter, Arial, sans-serif" text-anchor="middle" fill="#fff" font-weight="900">GONNA</text></svg>`;
    const illuBadge2 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><circle cx="256" cy="256" r="190" fill="__C1__"/><circle cx="256" cy="256" r="145" fill="#fff"/><path d="M160 270l56 56 136-160" fill="none" stroke="__C2__" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/><text x="256" y="430" font-size="46" font-family="Inter, Arial, sans-serif" text-anchor="middle" fill="__C1__" font-weight="900">CERTIFIED</text></svg>`;
    const illuSticker = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><path d="M120 140c0-30 24-54 54-54h164c30 0 54 24 54 54v120c0 60-48 108-108 108H174c-30 0-54-24-54-54V140z" fill="__C1__"/><path d="M170 130h172v36H170z" fill="__C2__" opacity="0.65"/><text x="256" y="270" font-size="86" font-family="Inter, Arial, sans-serif" text-anchor="middle" fill="#fff" font-weight="900">WOW</text><circle cx="392" cy="152" r="18" fill="#fff"/></svg>`;

    const edgeDots = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="256"><rect width="1024" height="256" fill="none"/><g fill="__C1__" opacity="0.55">${Array.from({ length: 22 }).map((_, i) => `<circle cx="${40 + i * 44}" cy="128" r="8"/>`).join('')}</g></svg>`;
    const edgeZigzag = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="256"><path d="M0 150 L64 106 L128 150 L192 106 L256 150 L320 106 L384 150 L448 106 L512 150 L576 106 L640 150 L704 106 L768 150 L832 106 L896 150 L960 106 L1024 150" fill="none" stroke="__C1__" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    const edgeWave = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="256"><path d="M0 140 C128 80 256 200 384 140 C512 80 640 200 768 140 C896 80 960 200 1024 140" fill="none" stroke="__C1__" stroke-width="16" stroke-linecap="round"/></svg>`;

    const borderSimple = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="724"><rect x="24" y="24" width="976" height="676" rx="40" fill="none" stroke="__C1__" stroke-width="18"/><rect x="54" y="54" width="916" height="616" rx="32" fill="none" stroke="__C1__" stroke-width="6" opacity="0.35"/></svg>`;
    const borderCorner = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="724"><rect width="1024" height="724" fill="none"/><g stroke="__C1__" stroke-width="16" stroke-linecap="round"><path d="M70 190 V70 H190"/><path d="M834 70 H954 V190"/><path d="M70 534 V654 H190"/><path d="M834 654 H954 V534"/></g></svg>`;
    const borderRibbon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="724"><rect x="28" y="28" width="968" height="668" rx="44" fill="none" stroke="__C1__" stroke-width="10"/><path d="M28 140 H996" stroke="__C1__" stroke-width="10" opacity="0.6"/><path d="M28 584 H996" stroke="__C1__" stroke-width="10" opacity="0.6"/></svg>`;

    return [
      mk({ id: 'shape-square', category: 'SHAPES', name: 'Square', svgTemplate: shapeSquare, defaultC1: '#4F46E5', mm: { w: 40, h: 40 }, px: { w: 512, h: 512 } }),
      mk({ id: 'shape-line', category: 'SHAPES', name: 'Line', svgTemplate: shapeLine, defaultC1: '#334155', defaultLineWidth: 28, mm: { w: 90, h: 10 }, px: { w: 1024, h: 256 } }),
      mk({ id: 'shape-circle', category: 'SHAPES', name: 'Circle', svgTemplate: shapeCircle, defaultC1: '#10B981', mm: { w: 40, h: 40 }, px: { w: 512, h: 512 } }),
      mk({ id: 'shape-triangle', category: 'SHAPES', name: 'Triangle', svgTemplate: shapeTriangle, defaultC1: '#F59E0B', mm: { w: 40, h: 40 }, px: { w: 512, h: 512 } }),
      mk({ id: 'shape-star', category: 'SHAPES', name: 'Star', svgTemplate: shapeStar, defaultC1: '#EF4444', mm: { w: 40, h: 40 }, px: { w: 512, h: 512 } }),
      mk({ id: 'shape-plus', category: 'SHAPES', name: 'Plus', svgTemplate: shapePlus, defaultC1: '#8B5CF6', mm: { w: 40, h: 40 }, px: { w: 512, h: 512 } }),
      mk({ id: 'shape-hex', category: 'SHAPES', name: 'Hexagon', svgTemplate: shapeHex, defaultC1: '#3B82F6', mm: { w: 40, h: 40 }, px: { w: 512, h: 512 } }),

      mk({ id: 'illu-makers', category: 'ILLUSTRATIONS', name: 'Makers', svgTemplate: illuBadge1, defaultC1: '#7C3AED', defaultC2: '#F59E0B', mm: { w: 70, h: 55 }, px: { w: 512, h: 512 } }),
      mk({ id: 'illu-certified', category: 'ILLUSTRATIONS', name: 'Certified', svgTemplate: illuBadge2, defaultC1: '#0EA5E9', defaultC2: '#10B981', mm: { w: 55, h: 55 }, px: { w: 512, h: 512 } }),
      mk({ id: 'illu-wow', category: 'ILLUSTRATIONS', name: 'Wow', svgTemplate: illuSticker, defaultC1: '#F97316', defaultC2: '#FFFFFF', mm: { w: 60, h: 55 }, px: { w: 512, h: 512 } }),

      mk({ id: 'edge-dots', category: 'EDGES', name: 'Dots', svgTemplate: edgeDots, defaultC1: '#64748B', mm: { w: 180, h: 18 }, px: { w: 1024, h: 256 } }),
      mk({ id: 'edge-zigzag', category: 'EDGES', name: 'Zigzag', svgTemplate: edgeZigzag, defaultC1: '#4F46E5', mm: { w: 180, h: 18 }, px: { w: 1024, h: 256 } }),
      mk({ id: 'edge-wave', category: 'EDGES', name: 'Wave', svgTemplate: edgeWave, defaultC1: '#10B981', mm: { w: 180, h: 18 }, px: { w: 1024, h: 256 } }),

      mk({ id: 'border-simple', category: 'BORDERS', name: 'Simple', svgTemplate: borderSimple, defaultC1: '#0EA5E9', mm: { w: 250, h: 175 }, px: { w: 1024, h: 724 } }),
      mk({ id: 'border-corner', category: 'BORDERS', name: 'Corner', svgTemplate: borderCorner, defaultC1: '#F59E0B', mm: { w: 250, h: 175 }, px: { w: 1024, h: 724 } }),
      mk({ id: 'border-ribbon', category: 'BORDERS', name: 'Ribbon', svgTemplate: borderRibbon, defaultC1: '#EF4444', mm: { w: 250, h: 175 }, px: { w: 1024, h: 724 } }),
    ];
  }, []);

  const uploadedLibraryItems = useMemo(() => {
    return (libraryUploads || [])
      .filter((m) => m && typeof m === 'object' && typeof m.url === 'string' && (m.mimeType === 'image/svg+xml' || String(m.url).toLowerCase().endsWith('.svg')))
      .map((m) => {
        const filename = typeof m.filename === 'string' ? m.filename : 'SVG';
        const name = filename.replace(/\.svg$/i, '');
        const category = parseLibraryCategory(m.alt);
        return {
          id: `uploaded-${String(m.id || m.url)}`,
          kind: 'UPLOADED' as const,
          category,
          name,
          url: String(m.url),
        };
      });
  }, [libraryUploads]);

  const allLibraryItems = useMemo(() => {
    return [...LIBRARY_ITEMS, ...uploadedLibraryItems];
  }, [LIBRARY_ITEMS, uploadedLibraryItems]);

  const filteredLibraryItems = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    return allLibraryItems.filter((it: any) => {
      if (libraryCategory !== 'ALL' && it.category !== libraryCategory) return false;
      if (!q) return true;
      return it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q);
    });
  }, [allLibraryItems, sidebarSearch, libraryCategory]);

  const addLibraryItem = async (it: any) => {
    if (typeof document === 'undefined') return;
    setIsAddingLibraryItem(true);
    try {
      if (it.kind === 'UPLOADED') {
        const res = await fetch(it.url, { cache: 'no-store' });
        const txt = await res.text();
        const normalized = normalizeSvgToPalette(txt, 8);
        const initialLineStrokeWidth = normalized.svgTemplate.includes('__LW__') ? 28 : undefined;
        const svg = renderLibraryElementSvg(normalized.svgTemplate, normalized.slots, initialLineStrokeWidth);
        const png = await svgToPngDataUrl(svg, { w: normalized.pxW, h: normalized.pxH });

        const ratio = normalized.pxH / normalized.pxW;
        const maxW =
          it.category === 'BORDERS' ? 250 : it.category === 'EDGES' ? 180 : it.category === 'SHAPES' ? 40 : 70;
        const maxH = it.category === 'BORDERS' ? 175 : it.category === 'EDGES' ? 30 : 70;
        const wMm = maxW;
        const hMm = Math.max(8, Math.min(maxH, wMm * ratio));

        const id = Math.random().toString(36).substr(2, 9);
        const maxZ = canvasElements.length > 0 ? Math.max(...canvasElements.map(e => e.zIndex)) : 0;
        const newElement: CanvasElement = {
          id,
          type: 'IMAGE',
          x: certificatePage.widthMm / 2 - wMm / 2,
          y: certificatePage.heightMm / 2 - hMm / 2,
          width: wMm,
          height: hMm,
          zIndex: maxZ + 1,
          opacity: 100,
          src: png,
          align: 'center',
          librarySvg: normalized.svgTemplate,
          librarySlots: normalized.slots,
          libraryC1: normalized.slots[0],
          libraryC2: normalized.slots[1],
          libraryPxW: normalized.pxW,
          libraryPxH: normalized.pxH,
          lineStrokeWidth: initialLineStrokeWidth,
        };
        const nextElements = [...canvasElements, newElement];
        setCanvasElements(nextElements);
        setSelectedElementId(id);
        saveToHistory(nextElements);
        toast.success('Item ditambahkan');
        return;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const maxZ = canvasElements.length > 0 ? Math.max(...canvasElements.map(e => e.zIndex)) : 0;
      const template = String(it.svgTemplate || '').replaceAll('__C1__', '__L0__').replaceAll('__C2__', '__L1__');
      const slots = [String(it.defaultC1 || '#4F46E5'), it.defaultC2 ? String(it.defaultC2) : null].filter(Boolean) as string[];
      const initialLineStrokeWidth = typeof it.defaultLineWidth === 'number' ? it.defaultLineWidth : undefined;
      const svg = renderLibraryElementSvg(template, slots, initialLineStrokeWidth);
      const png = await svgToPngDataUrl(svg, it.px);
      const newElement: CanvasElement = {
        id,
        type: 'IMAGE',
        x: certificatePage.widthMm / 2 - it.mm.w / 2,
        y: certificatePage.heightMm / 2 - it.mm.h / 2,
        width: it.mm.w,
        height: it.mm.h,
        zIndex: maxZ + 1,
        opacity: 100,
        src: png,
        align: 'center',
        librarySvg: template,
        librarySlots: slots,
        libraryC1: slots[0],
        libraryC2: slots[1],
        libraryPxW: it.px?.w,
        libraryPxH: it.px?.h,
        lineStrokeWidth: initialLineStrokeWidth,
      };
      const nextElements = [...canvasElements, newElement];
      setCanvasElements(nextElements);
      setSelectedElementId(id);
      saveToHistory(nextElements);
      toast.success('Item ditambahkan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambahkan item');
    } finally {
      setIsAddingLibraryItem(false);
    }
  };

  const recolorLibraryElement = async (id: string, updates: { index: number; color: string }) => {
    const el = canvasElements.find((x) => x.id === id);
    if (!el?.librarySvg) return;
    setIsRecoloringLibrary(true);
    try {
      const baseSlots =
        Array.isArray(el.librarySlots) && el.librarySlots.length > 0
          ? [...el.librarySlots]
          : [el.libraryC1 || '#4F46E5', el.libraryC2 || '#F59E0B'].filter(Boolean);
      const idx = Math.max(0, Math.min(baseSlots.length - 1, Number(updates.index) || 0));
      baseSlots[idx] = (updates.color || '#000000').trim();
      const svg = renderLibraryElementSvg(el.librarySvg, baseSlots, el.lineStrokeWidth);
      const png = await svgToPngDataUrl(svg, { w: el.libraryPxW || 512, h: el.libraryPxH || 512 });
      const nextElements = canvasElements.map((x) =>
        x.id === id
          ? { ...x, src: png, librarySlots: baseSlots, libraryC1: baseSlots[0], libraryC2: baseSlots[1] }
          : x
      );
      setCanvasElements(nextElements);
      saveToHistory(nextElements);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengubah warna');
    } finally {
      setIsRecoloringLibrary(false);
    }
  };

  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    setCanvasElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const updateLibraryLineThickness = async (id: string, nextStrokeWidth: number) => {
    const el = canvasElements.find((x) => x.id === id);
    if (!el?.librarySvg || !el.librarySvg.includes('__LW__')) return;

    const safeStrokeWidth = Math.max(4, Math.min(120, Math.round(Number(nextStrokeWidth) || 28)));
    const baseSlots =
      Array.isArray(el.librarySlots) && el.librarySlots.length > 0
        ? [...el.librarySlots]
        : [el.libraryC1 || '#4F46E5', el.libraryC2 || '#F59E0B'].filter(Boolean);

    try {
      const svg = renderLibraryElementSvg(el.librarySvg, baseSlots, safeStrokeWidth);
      const png = await svgToPngDataUrl(svg, { w: el.libraryPxW || 512, h: el.libraryPxH || 512 });
      const nextElements = canvasElements.map((x) =>
        x.id === id ? { ...x, src: png, lineStrokeWidth: safeStrokeWidth } : x
      );
      setCanvasElements(nextElements);
      saveToHistory(nextElements);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengubah ketebalan garis');
    }
  };

  const deleteElement = (id: string) => {
    const nextElements = canvasElements.filter(el => el.id !== id);
    setCanvasElements(nextElements);
    setSelectedElementId(null);
    saveToHistory(nextElements);
  };

  const duplicateElement = (id: string) => {
    const el = canvasElements.find(e => e.id === id);
    if (!el) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newEl = { ...el, id: newId, x: el.x + 5, y: el.y + 5, zIndex: Math.max(...canvasElements.map(e => e.zIndex)) + 1 };
    const nextElements = [...canvasElements, newEl];
    setCanvasElements(nextElements);
    setSelectedElementId(newId);
    saveToHistory(nextElements);
  };

  const moveZIndex = (id: string, direction: 'UP' | 'DOWN' | 'TOP' | 'BOTTOM') => {
    setCanvasElements(prev => {
      const el = prev.find(e => e.id === id);
      if (!el) return prev;
      
      const otherElements = prev.filter(e => e.id !== id);
      const sortedOthers = [...otherElements].sort((a, b) => a.zIndex - b.zIndex);
      
      let newZ = el.zIndex;
      if (direction === 'TOP') {
        newZ = sortedOthers.length > 0 ? sortedOthers[sortedOthers.length - 1].zIndex + 1 : 1;
      } else if (direction === 'BOTTOM') {
        newZ = sortedOthers.length > 0 ? sortedOthers[0].zIndex - 1 : 0;
      } else if (direction === 'UP') {
        // Find the first element with zIndex greater than current
        const nextEl = sortedOthers.find(e => e.zIndex > el.zIndex);
        if (nextEl) {
          // Swap zIndex
          const nextZ = nextEl.zIndex;
          return prev.map(e => {
            if (e.id === id) return { ...e, zIndex: nextZ };
            if (e.id === nextEl.id) return { ...e, zIndex: el.zIndex };
            return e;
          });
        }
        newZ = el.zIndex + 1;
      } else if (direction === 'DOWN') {
        // Find the last element with zIndex less than current
        const prevEl = [...sortedOthers].reverse().find(e => e.zIndex < el.zIndex);
        if (prevEl) {
          // Swap zIndex
          const prevZ = prevEl.zIndex;
          return prev.map(e => {
            if (e.id === id) return { ...e, zIndex: prevZ };
            if (e.id === prevEl.id) return { ...e, zIndex: el.zIndex };
            return e;
          });
        }
        newZ = el.zIndex - 1;
      }
      
      const nextElements = prev.map(e => e.id === id ? { ...e, zIndex: newZ } : e);
      saveToHistory(nextElements);
      return nextElements;
    });
  };

  const alignToCanvas = (id: string, alignment: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CENTER_H' | 'CENTER_V') => {
    setCanvasElements(prev => {
      const nextElements = prev.map(el => {
        if (el.id !== id) return el;
        
        const updates: Partial<CanvasElement> = {};
        if (alignment === 'TOP') updates.y = 0;
        if (alignment === 'BOTTOM') updates.y = certificatePage.heightMm - el.height;
        if (alignment === 'LEFT') updates.x = 0;
        if (alignment === 'RIGHT') updates.x = certificatePage.widthMm - el.width;
        if (alignment === 'CENTER_H') updates.x = (certificatePage.widthMm - el.width) / 2;
        if (alignment === 'CENTER_V') updates.y = (certificatePage.heightMm - el.height) / 2;
        
        return { ...el, ...updates };
      });
      saveToHistory(nextElements);
      return nextElements;
    });
  };

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close all popovers if clicking outside popover areas
      if (!target.closest('.popover-container') && !target.closest('.toolbar-trigger')) {
        setShowSettingsPopover(false);
        setShowTextEditor(false);
        setShowColorPicker(false);
        setShowFontPicker(false);
      }
    };

    if (showSettingsPopover || showTextEditor || showColorPicker || showFontPicker) {
      window.addEventListener('mousedown', handleGlobalClick);
    }
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [showSettingsPopover, showTextEditor, showColorPicker, showFontPicker]);

  useEffect(() => {
    if (templateId) {
      setIsLoading(true);
      fetch(`/api/certificate-templates`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          const items = Array.isArray(data) ? data : [];
          setAvailableTemplates(items);
          const template = items.find((t: any) => t.id === templateId);
          if (template) applyTemplateRecord(template);
        })
        .finally(() => setIsLoading(false));
    } else {
      const els = Array.isArray(initialSettings?.elements) ? (initialSettings.elements as any[]) : [];
      setCanvasElements(els as any);
      saveToHistory(els as any);
    }
  }, [templateId, initialSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 'MEDIA') return;
    let active = true;
    const q = sidebarSearch.trim();
    const t = window.setTimeout(async () => {
      try {
        setIsLoadingMedia(true);
        const url = `/api/media?scope=mine&take=60&skip=0&alt=${encodeURIComponent('certificate-media')}&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat media');
        const items = Array.isArray(data?.items) ? data.items : [];
        setMediaItems(items);
      } catch (e: any) {
        if (!active) return;
        toast.error(e?.message || 'Gagal memuat media');
        setMediaItems([]);
      } finally {
        if (!active) return;
        setIsLoadingMedia(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [activeTab, sidebarSearch]);

  useEffect(() => {
    if (activeTab !== 'LIBRARY') return;
    let active = true;
    (async () => {
      try {
        setIsLoadingLibraryUploads(true);
        const url = `/api/media?scope=mine&take=200&skip=0&alt=${encodeURIComponent('certificate-library-svg')}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat library');
        const items = Array.isArray(data?.items) ? data.items : [];
        setLibraryUploads(items);
      } catch (e: any) {
        if (!active) return;
        setLibraryUploads([]);
        toast.error(e?.message || 'Gagal memuat library');
      } finally {
        if (!active) return;
        setIsLoadingLibraryUploads(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'BACKDROPS') return;
    setBackdropsView('HOME');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'BACKDROPS') return;
    let active = true;
    const q = sidebarSearch.trim();
    const t = window.setTimeout(async () => {
      try {
        setIsLoadingBackdropUploads(true);
        const url = `/api/media?scope=mine&take=60&skip=0&alt=${encodeURIComponent('certificate-backdrop')}&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat backdrop');
        const items = Array.isArray(data?.items) ? data.items : [];
        setBackdropUploads(items);
      } catch (e: any) {
        if (!active) return;
        setBackdropUploads([]);
        toast.error(e?.message || 'Gagal memuat backdrop');
      } finally {
        if (!active) return;
        setIsLoadingBackdropUploads(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [activeTab, sidebarSearch]);

  useEffect(() => {
    if (activeTab !== 'BACKDROPS') return;
    let active = true;
    const q = sidebarSearch.trim();
    const t = window.setTimeout(async () => {
      try {
        setIsLoadingPatternUploads(true);
        const url = `/api/media?scope=mine&take=60&skip=0&alt=${encodeURIComponent('certificate-pattern')}&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat pattern');
        const items = Array.isArray(data?.items) ? data.items : [];
        setPatternUploads(items);
      } catch (e: any) {
        if (!active) return;
        setPatternUploads([]);
        toast.error(e?.message || 'Gagal memuat pattern');
      } finally {
        if (!active) return;
        setIsLoadingPatternUploads(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [activeTab, sidebarSearch]);

  const handleUploadMedia = async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('alt', 'certificate-media');
      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: form });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadJson?.error || 'Gagal upload file');
      const url = typeof uploadJson?.url === 'string' ? uploadJson.url : '';
      if (!url) throw new Error('URL file tidak valid');
      toast.success('File berhasil di-upload');
      setMediaItems((prev) => {
        const createdId = typeof uploadJson?.id === 'string' ? uploadJson.id : null;
        const next = createdId ? prev.filter((p) => String(p?.id || '') !== createdId) : prev;
        return [uploadJson, ...next];
      });
      addImageElement(url);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal upload file');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleUploadBackdrop = async (file: File) => {
    setIsUploadingBackdrop(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('alt', 'certificate-backdrop');
      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: form });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadJson?.error || 'Gagal upload backdrop');
      const url = typeof uploadJson?.url === 'string' ? uploadJson.url : '';
      if (!url) throw new Error('URL file tidak valid');
      setSidebarSearch('');
      setCertificateBackgroundImageUrl(url);
      toast.success('Backdrop berhasil di-upload');
      setBackdropUploads((prev) => {
        const createdId = typeof uploadJson?.id === 'string' ? uploadJson.id : null;
        const next = createdId ? prev.filter((p) => String(p?.id || '') !== createdId) : prev;
        return [uploadJson, ...next];
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal upload backdrop');
    } finally {
      setIsUploadingBackdrop(false);
    }
  };

  const handleUploadPattern = async (file: File) => {
    setIsUploadingPattern(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('alt', 'certificate-pattern');
      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: form });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadJson?.error || 'Gagal upload pattern');
      const url = typeof uploadJson?.url === 'string' ? uploadJson.url : '';
      if (!url) throw new Error('URL file tidak valid');
      setSidebarSearch('');
      setCertificateBackgroundImageUrl(url);
      toast.success('Pattern berhasil di-upload');
      setPatternUploads((prev) => {
        const createdId = typeof uploadJson?.id === 'string' ? uploadJson.id : null;
        const next = createdId ? prev.filter((p) => String(p?.id || '') !== createdId) : prev;
        return [uploadJson, ...next];
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal upload pattern');
    } finally {
      setIsUploadingPattern(false);
    }
  };

  const handleUploadLibrarySvg = async (file: File) => {
    setIsUploadingLibrarySvg(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('alt', `certificate-library-svg:${libraryUploadCategory}`);
      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: form });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadJson?.error || 'Gagal upload SVG');
      toast.success('SVG berhasil ditambahkan ke library');
      setLibraryUploads((prev) => {
        const createdId = typeof uploadJson?.id === 'string' ? uploadJson.id : null;
        const next = createdId ? prev.filter((p) => String(p?.id || '') !== createdId) : prev;
        return [uploadJson, ...next];
      });
    } catch (e: any) {
      toast.error(e?.message || 'Gagal upload SVG');
    } finally {
      setIsUploadingLibrarySvg(false);
    }
  };

  const certificatePreviewRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; startXmm: number; startYmm: number; } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string; startX: number; startY: number; startW: number; startH: number; startXmm: number; startYmm: number; } | null>(null);
  const [isShiftDown, setIsShiftDown] = useState(false);

  const scheduleUpdateFloating = () => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      if (!selectedElementId) return;
      const node = elementNodeRefs.current[selectedElementId];
      if (!node) return;
      const r = node.getBoundingClientRect();
      const toolbarH = 52;
      const margin = 14;
      const desiredTop = r.top - toolbarH - margin;
      const desiredBottom = r.bottom + margin;
      const placement = desiredTop >= 8 ? 'top' : 'bottom';
      const top = placement === 'top' ? Math.max(8, desiredTop) : Math.min(window.innerHeight - toolbarH - 8, desiredBottom);
      const left = r.left + r.width / 2;
      setFloatingPos({ left, top, placement });
    });
  };

  useEffect(() => {
    if (!selectedElementId) {
      setFloatingPos(null);
      return;
    }
    scheduleUpdateFloating();
  }, [selectedElementId, builderZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveLibraryColorIndex(0);
  }, [selectedElementId]);

  useEffect(() => {
    if (!floatingPos) return;
    const id = window.requestAnimationFrame(() => {
      const node = toolbarRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const minX = 8 + r.width / 2;
      const maxX = window.innerWidth - 8 - r.width / 2;
      const minY = 8;
      const maxY = window.innerHeight - 8 - r.height;
      const nextLeft = Math.max(minX, Math.min(maxX, floatingPos.left));
      const nextTop = Math.max(minY, Math.min(maxY, floatingPos.top));
      if (Math.abs(nextLeft - floatingPos.left) > 0.5 || Math.abs(nextTop - floatingPos.top) > 0.5) {
        setFloatingPos((prev) => (prev ? { ...prev, left: nextLeft, top: nextTop } : prev));
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [floatingPos, showColorPicker, showFontPicker, showTextEditor, showSettingsPopover]);

  useEffect(() => {
    const onResize = () => scheduleUpdateFloating();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const handlePointerDown = (id: string, e: ReactPointerEvent) => {
    e.stopPropagation();
    setSelectedElementId(id);
    const el = canvasElements.find(e => e.id === id);
    if (!el) return;
    if (el.locked) {
      scheduleUpdateFloating();
      return;
    }
    setDrag({ id, startX: e.clientX, startY: e.clientY, startXmm: el.x, startYmm: el.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerDown = (e: ReactPointerEvent) => {
    // Only deselect if clicking exactly on the canvas background
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setSelectedElementId(null);
      setShowSettingsPopover(false);
      setShowTextEditor(false);
    }
  };

  const handleResizeDown = (id: string, handle: string, e: ReactPointerEvent) => {
    e.stopPropagation();
    const el = canvasElements.find(e => e.id === id);
    if (!el) return;
    if (el.locked) return;
    setResizing({ id, handle, startX: e.clientX, startY: e.clientY, startW: el.width, startH: el.height, startXmm: el.x, startYmm: el.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    const container = certificatePreviewRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mmPerPxX = certificatePage.widthMm / rect.width;
    const mmPerPxY = certificatePage.heightMm / rect.height;

    if (drag) {
      const dx = (e.clientX - drag.startX) * mmPerPxX;
      const dy = (e.clientY - drag.startY) * mmPerPxY;
      const current = canvasElements.find((el) => el.id === drag.id);
      const w = current?.width ?? 0;
      const h = current?.height ?? 0;
      const maxX = Math.max(0, certificatePage.widthMm - w);
      const maxY = Math.max(0, certificatePage.heightMm - h);
      const nextX = Math.max(0, Math.min(maxX, drag.startXmm + dx));
      const nextY = Math.max(0, Math.min(maxY, drag.startYmm + dy));
      updateElement(drag.id, { x: nextX, y: nextY });
      scheduleUpdateFloating();
    } else if (resizing) {
      const dx = (e.clientX - resizing.startX) * mmPerPxX;
      const dy = (e.clientY - resizing.startY) * mmPerPxY;
      
      const clampW = (v: number) => Math.max(10, v);
      const clampH = (v: number) => Math.max(5, v);
      const aspect = resizing.startH > 0 ? resizing.startW / resizing.startH : 1;

      let nextW = resizing.startW;
      let nextH = resizing.startH;
      let nextX = resizing.startXmm;
      let nextY = resizing.startYmm;

      if (resizing.handle.includes('right')) nextW = clampW(resizing.startW + dx);
      if (resizing.handle.includes('bottom')) nextH = clampH(resizing.startH + dy);
      if (resizing.handle.includes('left')) {
        nextW = clampW(resizing.startW - dx);
        nextX = resizing.startXmm + (resizing.startW - nextW);
      }
      if (resizing.handle.includes('top')) {
        nextH = clampH(resizing.startH - dy);
        nextY = resizing.startYmm + (resizing.startH - nextH);
      }

      if (e.shiftKey) {
        const hasH = resizing.handle.includes('left') || resizing.handle.includes('right');
        const hasV = resizing.handle.includes('top') || resizing.handle.includes('bottom');

        if (hasH && hasV) {
          const scaleW = resizing.startW > 0 ? nextW / resizing.startW : 1;
          const scaleH = resizing.startH > 0 ? nextH / resizing.startH : 1;
          const scale = Math.abs(scaleW - 1) >= Math.abs(scaleH - 1) ? scaleW : scaleH;

          const lockedW = clampW(resizing.startW * scale);
          const lockedH = clampH(resizing.startH * scale);

          if (resizing.handle.includes('left')) nextX = resizing.startXmm + (resizing.startW - lockedW);
          else nextX = resizing.startXmm;

          if (resizing.handle.includes('top')) nextY = resizing.startYmm + (resizing.startH - lockedH);
          else nextY = resizing.startYmm;

          nextW = lockedW;
          nextH = lockedH;
        } else if (hasH && !hasV) {
          const lockedH = clampH(nextW / (aspect || 1));
          const centerY = resizing.startYmm + resizing.startH / 2;
          nextH = lockedH;
          nextY = centerY - lockedH / 2;
        } else if (!hasH && hasV) {
          const lockedW = clampW(nextH * (aspect || 1));
          const centerX = resizing.startXmm + resizing.startW / 2;
          nextW = lockedW;
          nextX = centerX - lockedW / 2;
        }
      }

      if (nextX < 0) {
        nextW = clampW(nextW + nextX);
        nextX = 0;
      }
      if (nextY < 0) {
        nextH = clampH(nextH + nextY);
        nextY = 0;
      }
      if (nextX + nextW > certificatePage.widthMm) nextW = clampW(certificatePage.widthMm - nextX);
      if (nextY + nextH > certificatePage.heightMm) nextH = clampH(certificatePage.heightMm - nextY);

      const updates: any = { x: nextX, y: nextY, width: nextW, height: nextH };
      updateElement(resizing.id, updates);
      scheduleUpdateFloating();
    }
  };

  const handlePointerUp = () => {
    if (drag || resizing) {
      saveToHistory(canvasElements);
      setDrag(null);
      setResizing(null);
    }
  };

  const handleSaveAsTemplate = async () => {
    const name = designTitle.trim() || 'Untitled Design';
    setIsSavingTemplate(true);
    try {
      const content = { elements: canvasElements, orientation: certificatePageOrientation, pageSize: certificatePageSize, background: certificateBackgroundImageUrl, accent: certificateAccentColor };
      const res = await fetch('/api/certificate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Gagal menyimpan template');
      if (data && typeof data === 'object' && (data as any).id) {
        setAvailableTemplates((prev) => {
          const next = Array.isArray(prev) ? prev : [];
          const id = String((data as any).id);
          const without = next.filter((t: any) => String(t?.id || '') !== id);
          return [data as any, ...without];
        });
        setSelectedTemplateId(String((data as any).id));
      }
      toast.success('Template disimpan');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handlePublish = async (overrideCourseId?: unknown) => {
    const override = typeof overrideCourseId === 'string' ? overrideCourseId : null;
    const target = String((override ?? targetCourseId ?? courseId ?? '') || '').trim();
    if (!target) {
      toast.error('Pilih kursus terlebih dahulu di tab Settings.');
      return;
    }
    setIsPublishing(true);
    try {
      const payload = {
        certificateTemplate: 'CUSTOM',
        certificatePageSize,
        certificatePageOrientation,
        certificateBackgroundImageUrl,
        certificateAccentColor,
        elements: canvasElements,
        updatedAt: new Date().toISOString(),
      };
      const res = await fetch(`/api/courses/${encodeURIComponent(target)}/certificate-design`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan sertifikat kursus');
      toast.success('Sertifikat kursus berhasil dipublikasikan');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan sertifikat kursus');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveSettings = async () => {
    await handlePublish();
  };

  const handleNewCanvas = () => {
    setCanvasElements([]);
    saveToHistory([]);
    setCertificateBackgroundImageUrl('');
    setSelectedElementId(null);
    setShowSettingsPopover(false);
    setShowTextEditor(false);
    setShowColorPicker(false);
    setShowFontPicker(false);
    toast.success('Canvas kosong');
  };

  const getTemplatePageMm = (content: any) => {
    const orientation: CertificatePageOrientation = content?.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE';
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
    const sorted = [...els].sort((a, b) => (Number(a?.zIndex || 0) - Number(b?.zIndex || 0))).slice(0, 40);
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
      <div className="relative w-full bg-white overflow-hidden" style={{ aspectRatio: `${dims.widthMm} / ${dims.heightMm}` }}>
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
            const color = typeof el?.color === 'string' ? el.color : '#111827';
            const fontSize = Math.max(5, Math.round((Number(el?.fontSize || 14) as number) * 0.22));
            const opacity = typeof el?.opacity === 'number' ? Math.max(0, Math.min(100, el.opacity)) / 100 : 1;
            const align = el?.align === 'left' ? 'left' : el?.align === 'right' ? 'right' : 'center';
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
                <div
                  key={String(el?.id || idx)}
                  className="absolute"
                  style={{ left, top, width, height, opacity }}
                >
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
                  padding: 1,
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
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all active:scale-95"><ChevronLeft className="w-5 h-5" /></button>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-extrabold uppercase tracking-widest transition-all active:scale-95"
            title="Close"
          >
            <X className="w-4 h-4" /> Close
          </button>
          <div className="h-6 w-px bg-slate-200" />
          {isEditingDesignTitle ? (
            <input
              value={designTitle}
              onChange={(e) => setDesignTitle(e.target.value)}
              onBlur={() => {
                setDesignTitle((prev) => (prev.trim() ? prev.trim() : 'Untitled Design'));
                setIsEditingDesignTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              autoFocus
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 w-56"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingDesignTitle(true)}
              className="h-9 px-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-400 tracking-widest transition-all max-w-[240px] truncate"
              title="Klik untuk mengganti nama"
            >
              {designTitle || 'Untitled Design'}
            </button>
          )}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
           <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Certificate <span className="text-indigo-600">Builder</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mr-2">
            <button onClick={undo} disabled={historyIndex <= 0} className={twMerge("p-2 rounded-lg transition-all", historyIndex > 0 ? "hover:bg-white text-slate-500" : "text-slate-300 cursor-not-allowed")}><Undo className="w-4 h-4" /></button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} className={twMerge("p-2 rounded-lg transition-all", historyIndex < history.length - 1 ? "hover:bg-white text-slate-500" : "text-slate-300 cursor-not-allowed")}><Redo className="w-4 h-4" /></button>
          </div>
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-200"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button onClick={handleSaveAsTemplate} disabled={isSavingTemplate} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-200">
            {isSavingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save as Template
          </button>
          <button
            type="button"
            onClick={() => handlePublish()}
            disabled={isPublishing}
            className={twMerge(
              "flex items-center gap-2 px-6 py-2.5 text-xs font-extrabold text-white rounded-xl transition-all shadow-lg uppercase",
              isPublishing ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
            )}
          >
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Publish
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-[72px] bg-[#1e1e2d] flex flex-col items-center py-6 gap-6 shrink-0 z-40">
          <SidebarIcon icon={Layout} label="Templates" active={activeTab === 'TEMPLATES'} onClick={() => setActiveTab('TEMPLATES')} />
          <SidebarIcon icon={Plus} label="Elements" active={activeTab === 'ELEMENTS'} onClick={() => setActiveTab('ELEMENTS')} />
          <SidebarIcon icon={ImageIcon} label="Media" active={activeTab === 'MEDIA'} onClick={() => setActiveTab('MEDIA')} />
          <SidebarIcon icon={Library} label="Library" active={activeTab === 'LIBRARY'} onClick={() => setActiveTab('LIBRARY')} />
          <SidebarIcon icon={Layers} label="Backdrops" active={activeTab === 'BACKDROPS'} onClick={() => setActiveTab('BACKDROPS')} />
          <div className="flex-1" />
          <SidebarIcon icon={List} label="Layers" active={activeTab === 'LAYERS'} onClick={() => setActiveTab('LAYERS')} />
          <SidebarIcon icon={Settings} label="Settings" active={activeTab === 'SETTINGS'} onClick={() => setActiveTab('SETTINGS')} />
        </aside>

        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-30 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-100">
            {activeTab === 'SETTINGS' ? (
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold text-slate-900">Settings</div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder={
                    activeTab === 'TEMPLATES'
                      ? 'Cari template...'
                      : activeTab === 'MEDIA'
                        ? 'Cari file...'
                        : activeTab === 'LIBRARY'
                          ? 'Cari library...'
                          : activeTab === 'LAYERS'
                            ? 'Cari layer...'
                            : 'Search...'
                  }
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
                />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'TEMPLATES' && (
              <div className="p-4 space-y-4">
                <button
                  type="button"
                  onClick={handleNewCanvas}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">Canvas Kosong</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Mulai dari nol</div>
                    </div>
                  </div>
                </button>

                {isLoadingTemplates ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <div className="w-full bg-slate-100 animate-pulse" style={{ aspectRatio: `1 / 1.414` }} />
                        <div className="p-3">
                          <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                          <div className="h-2 w-1/2 bg-slate-100 rounded mt-2 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : templatesForPanel.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Tidak ada template</div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Simpan desain sebagai template untuk muncul di sini</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {templatesForPanel.map((t: any) => (
                      <button
                        key={String(t?.id || '')}
                        type="button"
                        onClick={() => handleApplyTemplateById(String(t?.id || ''))}
                        className={twMerge(
                          "group rounded-2xl border bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all text-left",
                          selectedTemplateId && String(t?.id || '') === String(selectedTemplateId) ? "border-indigo-400 ring-1 ring-indigo-300/40" : "border-slate-200"
                        )}
                        title={String(t?.name || 'Template')}
                      >
                        <div className="w-full bg-slate-50">
                          {renderTemplateThumb(t)}
                        </div>
                        <div className="p-3">
                          <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest truncate">{String(t?.name || 'Untitled')}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Template</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'ELEMENTS' && (
              <div className="p-4 grid grid-cols-2 gap-3">
                <ElementButton icon={Type} label="Text" onClick={() => addElement('TEXT')} />
                <ElementButton icon={BookOpen} label="Course" onClick={() => addElement('COURSE')} />
                <ElementButton icon={User} label="Student Name" onClick={() => addElement('NAME')} />
                <ElementButton icon={GraduationCap} label="Instructor" onClick={() => addElement('INSTRUCTOR')} />
                <ElementButton icon={Signature} label="Signature" onClick={() => addElement('SIGNATURE')} />
                <ElementButton icon={Hash} label="Verification ID" onClick={() => addElement('SERIAL')} />
                <ElementButton icon={QrCode} label="QR" onClick={() => addElement('QR')} />
                <ElementButton icon={Clock} label="Time" onClick={() => addElement('DATE')} />
                <ElementButton icon={Zap} label="Duration" onClick={() => addElement('DURATION')} />
                <ElementButton icon={Award} label="Point" onClick={() => addElement('POINT')} />
                <ElementButton icon={Percent} label="Grade" onClick={() => addElement('GRADE')} />
                <ElementButton icon={Boxes} label="Bundle Courses" onClick={() => addElement('BUNDLE')} />
              </div>
            )}
            {activeTab === 'MEDIA' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase tracking-widest border border-indigo-100">
                    My Files
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <label className="w-full">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingMedia}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        handleUploadMedia(file);
                        e.currentTarget.value = '';
                      }}
                      className="hidden"
                    />
                    <div
                      className={twMerge(
                        "w-full h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-widest transition-all",
                        isUploadingMedia ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                      )}
                    >
                      {isUploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Upload File
                    </div>
                  </label>
                  <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Klik gambar untuk menambahkan ke kanvas
                  </div>
                </div>

                {isLoadingMedia ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-square rounded-2xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : mediaItems.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Belum ada file</div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Upload file untuk mulai</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {mediaItems.map((m) => (
                      <button
                        type="button"
                        key={m.id || m.url}
                        onClick={() => addImageElement(String(m.url || ''))}
                        className="group aspect-square rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all"
                        title={String(m.filename || m.alt || 'Media')}
                      >
                        <img alt="" src={String(m.url || '')} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'LIBRARY' && (
              <div className="p-4 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={libraryUploadCategory}
                      onChange={(e) => {
                        const v = e.target.value as any;
                        if (v === 'SHAPES' || v === 'ILLUSTRATIONS' || v === 'EDGES' || v === 'BORDERS') setLibraryUploadCategory(v);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-700"
                    >
                      <option value="ILLUSTRATIONS">Illustration</option>
                      <option value="SHAPES">Shape</option>
                      <option value="EDGES">Edge</option>
                      <option value="BORDERS">Border</option>
                    </select>
                    <label
                      className={twMerge(
                        "px-3 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-widest border cursor-pointer flex items-center gap-2 justify-center",
                        isUploadingLibrarySvg ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                      )}
                    >
                      {isUploadingLibrarySvg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Upload SVG
                      <input
                        type="file"
                        accept=".svg,image/svg+xml"
                        disabled={isUploadingLibrarySvg}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          handleUploadLibrarySvg(file);
                          e.currentTarget.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {isLoadingLibraryUploads ? 'Memuat library...' : 'SVG yang di-upload akan muncul di kategori yang dipilih'}
                  </div>
                </div>

                {libraryCategory !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setLibraryCategory('ALL')}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-extrabold uppercase tracking-widest"
                  >
                    Kembali
                  </button>
                )}

                {libraryCategory === 'ALL' && (
                  <>
                    {(['SHAPES', 'ILLUSTRATIONS', 'EDGES', 'BORDERS'] as const).map((cat) => {
                      const title =
                        cat === 'SHAPES' ? 'Shape' : cat === 'ILLUSTRATIONS' ? 'Illustration' : cat === 'EDGES' ? 'Edge' : 'Border';
                      const subset = filteredLibraryItems.filter((x) => x.category === cat).slice(0, 6);
                      return (
                        <div key={cat} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{title}</div>
                            <button
                              type="button"
                              onClick={() => setLibraryCategory(cat)}
                              className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
                            >
                              View all
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {subset.map((it) => (
                              <button
                                type="button"
                                key={it.id}
                                disabled={isAddingLibraryItem}
                                onClick={() => addLibraryItem(it)}
                                className={twMerge(
                                  "aspect-square rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                                  isAddingLibraryItem ? "opacity-60 cursor-not-allowed" : ""
                                )}
                                title={it.name}
                              >
                                <img alt="" src={it.kind === 'UPLOADED' ? String(it.url) : `data:image/svg+xml;utf8,${encodeURIComponent(it.svg)}`}
                                  className="w-full h-full object-contain p-2"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {libraryCategory !== 'ALL' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                        {libraryCategory === 'SHAPES' ? 'Shape' : libraryCategory === 'ILLUSTRATIONS' ? 'Illustration' : libraryCategory === 'EDGES' ? 'Edge' : 'Border'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {filteredLibraryItems.length} items
                      </div>
                    </div>
                    {filteredLibraryItems.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Tidak ada item</div>
                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Coba kata kunci lain</div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        {filteredLibraryItems.map((it) => (
                          <button
                            type="button"
                            key={it.id}
                            disabled={isAddingLibraryItem}
                            onClick={() => addLibraryItem(it)}
                            className={twMerge(
                              "aspect-square rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                              isAddingLibraryItem ? "opacity-60 cursor-not-allowed" : ""
                            )}
                            title={it.name}
                          >
                            <img alt="" src={it.kind === 'UPLOADED' ? String(it.url) : `data:image/svg+xml;utf8,${encodeURIComponent(it.svg)}`}
                              className="w-full h-full object-contain p-2"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'BACKDROPS' && (
              <div className="p-4 space-y-6">
                {backdropsView !== 'HOME' && (
                  <button
                    type="button"
                    onClick={() => setBackdropsView('HOME')}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-extrabold uppercase tracking-widest"
                  >
                    Kembali
                  </button>
                )}

                {backdropsView === 'HOME' && (
                  <>
                    <div className="space-y-3">
                      <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Color</div>
                      <div className="grid grid-cols-8 gap-2">
                        {backdropColors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCertificateAccentColor(c)}
                            className={twMerge(
                              "w-7 h-7 rounded-full border-2 transition-transform active:scale-90",
                              (certificateAccentColor || '').toLowerCase() === c ? "border-slate-900" : "border-slate-200"
                            )}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Pattern</div>
                        <button
                          type="button"
                          onClick={() => setBackdropsView('PATTERNS')}
                          className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
                        >
                          View all
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <label
                          className={twMerge(
                            "aspect-square rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-center cursor-pointer",
                            isUploadingPattern ? "opacity-60 cursor-not-allowed" : ""
                          )}
                        >
                          <div className="flex flex-col items-center gap-2">
                            {isUploadingPattern ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Plus className="w-5 h-5 text-slate-400" />}
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Upload</div>
                          </div>
                          <input
                            type="file"
                            accept="image/*,.svg,image/svg+xml"
                            disabled={isUploadingPattern}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              handleUploadPattern(file);
                              e.currentTarget.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                        {patternUploads.slice(0, 2).map((m) => {
                          const url = String(m?.url || '');
                          if (!url) return null;
                          const active = certificateBackgroundImageUrl === url;
                          return (
                            <button
                              key={String(m?.id || url)}
                              type="button"
                              onClick={() => setCertificateBackgroundImageUrl(url)}
                              className={twMerge(
                                "aspect-square rounded-2xl border bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                                active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                              )}
                              title={String(m?.filename || m?.alt || 'Pattern')}
                            >
                              <img alt="" src={url} className="w-full h-full object-cover" />
                            </button>
                          );
                        })}
                        {patternPresets.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isGeneratingBackdrop}
                            onClick={() => applyBackdropFromSvg(p.innerSvg)}
                            className={twMerge(
                              "aspect-square rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                              isGeneratingBackdrop ? "opacity-60 cursor-not-allowed" : ""
                            )}
                            title={p.name}
                          >
                            <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(wrapThumbSvg(p.innerSvg, { w: 240, h: 240 }))}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Backdrop</div>
                        <button
                          type="button"
                          onClick={() => setBackdropsView('BACKDROPS')}
                          className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
                        >
                          View all
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCertificateBackgroundImageUrl('')}
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                          <div className="w-full bg-slate-50 flex items-center justify-center" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">None</div>
                          </div>
                        </button>
                        <label
                          className={twMerge(
                            "rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer",
                            isUploadingBackdrop ? "opacity-60 cursor-not-allowed" : ""
                          )}
                        >
                          <div className="w-full bg-slate-50 flex items-center justify-center" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                            <div className="flex flex-col items-center gap-2">
                              {isUploadingBackdrop ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Plus className="w-5 h-5 text-slate-400" />}
                              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Upload</div>
                            </div>
                          </div>
                          <input
                            type="file"
                            accept="image/*,.svg,image/svg+xml"
                            disabled={isUploadingBackdrop}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              handleUploadBackdrop(file);
                              e.currentTarget.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                        {backdropUploads.slice(0, 2).map((m) => {
                          const url = String(m?.url || '');
                          const active = !!url && certificateBackgroundImageUrl === url;
                          return (
                            <button
                              key={String(m?.id || url)}
                              type="button"
                              onClick={() => setCertificateBackgroundImageUrl(url)}
                              className={twMerge(
                                "rounded-2xl border bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                                active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                              )}
                              title={String(m?.filename || m?.alt || 'Backdrop')}
                            >
                              <div className="w-full bg-white" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                                <img alt="" src={url} className="w-full h-full object-cover" />
                              </div>
                            </button>
                          );
                        })}
                        {backdropPresets.slice(0, 2).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            disabled={isGeneratingBackdrop}
                            onClick={() => applyBackdropFromSvg(b.innerSvg)}
                            className={twMerge(
                              "rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                              isGeneratingBackdrop ? "opacity-60 cursor-not-allowed" : ""
                            )}
                            title={b.name}
                          >
                            <div className="w-full bg-white" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                              <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(wrapThumbSvg(b.innerSvg, { w: 360, h: 240 }))}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Orientation</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCertificatePageOrientation('LANDSCAPE')}
                          className={twMerge(
                            "py-2 text-[10px] font-bold rounded-xl border transition-all",
                            certificatePageOrientation === 'LANDSCAPE' ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          LANDSCAPE
                        </button>
                        <button
                          type="button"
                          onClick={() => setCertificatePageOrientation('PORTRAIT')}
                          className={twMerge(
                            "py-2 text-[10px] font-bold rounded-xl border transition-all",
                            certificatePageOrientation === 'PORTRAIT' ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          PORTRAIT
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {backdropsView === 'PATTERNS' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Uploads</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {isLoadingPatternUploads ? 'Loading...' : `${patternUploads.length} items`}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <label
                          className={twMerge(
                            "aspect-square rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-center cursor-pointer",
                            isUploadingPattern ? "opacity-60 cursor-not-allowed" : ""
                          )}
                        >
                          <div className="flex flex-col items-center gap-2">
                            {isUploadingPattern ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Plus className="w-5 h-5 text-slate-400" />}
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Upload</div>
                          </div>
                          <input
                            type="file"
                            accept="image/*,.svg,image/svg+xml"
                            disabled={isUploadingPattern}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              handleUploadPattern(file);
                              e.currentTarget.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                        {isLoadingPatternUploads ? (
                          <>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className="aspect-square rounded-2xl border border-slate-200 bg-slate-100 animate-pulse" />
                            ))}
                          </>
                        ) : patternUploads.length === 0 ? (
                          <div className="col-span-3 text-center py-6">
                            <div className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Belum ada pattern</div>
                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Upload pattern untuk mulai</div>
                          </div>
                        ) : (
                          patternUploads.map((m) => {
                            const url = String(m?.url || '');
                            if (!url) return null;
                            const active = certificateBackgroundImageUrl === url;
                            return (
                              <button
                                key={String(m?.id || url)}
                                type="button"
                                onClick={() => setCertificateBackgroundImageUrl(url)}
                                className={twMerge(
                                  "aspect-square rounded-2xl border bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                                  active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                                )}
                                title={String(m?.filename || m?.alt || 'Pattern')}
                              >
                                <img alt="" src={url} className="w-full h-full object-cover" />
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Presets</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patternPresets.length} items</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {patternPresets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isGeneratingBackdrop}
                            onClick={() => applyBackdropFromSvg(p.innerSvg)}
                            className={twMerge(
                              "aspect-square rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                              isGeneratingBackdrop ? "opacity-60 cursor-not-allowed" : ""
                            )}
                            title={p.name}
                          >
                            <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(wrapThumbSvg(p.innerSvg, { w: 240, h: 240 }))}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {backdropsView === 'BACKDROPS' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Uploads</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {isLoadingBackdropUploads ? 'Loading...' : `${backdropUploads.length} items`}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCertificateBackgroundImageUrl('')}
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                          <div className="w-full bg-slate-50 flex items-center justify-center" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">None</div>
                          </div>
                        </button>
                        <label
                          className={twMerge(
                            "rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer",
                            isUploadingBackdrop ? "opacity-60 cursor-not-allowed" : ""
                          )}
                        >
                          <div className="w-full bg-slate-50 flex items-center justify-center" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                            <div className="flex flex-col items-center gap-2">
                              {isUploadingBackdrop ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Plus className="w-5 h-5 text-slate-400" />}
                              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Upload</div>
                            </div>
                          </div>
                          <input
                            type="file"
                            accept="image/*,.svg,image/svg+xml"
                            disabled={isUploadingBackdrop}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              handleUploadBackdrop(file);
                              e.currentTarget.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                        {isLoadingBackdropUploads ? (
                          <>
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="rounded-2xl border border-slate-200 bg-slate-100 animate-pulse" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }} />
                            ))}
                          </>
                        ) : backdropUploads.length === 0 ? (
                          <div className="col-span-2 text-center py-6">
                            <div className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Belum ada backdrop</div>
                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Upload backdrop untuk mulai</div>
                          </div>
                        ) : (
                          backdropUploads.map((m) => {
                            const url = String(m?.url || '');
                            if (!url) return null;
                            const active = certificateBackgroundImageUrl === url;
                            return (
                              <button
                                key={String(m?.id || url)}
                                type="button"
                                onClick={() => setCertificateBackgroundImageUrl(url)}
                                className={twMerge(
                                  "rounded-2xl border bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                                  active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                                )}
                                title={String(m?.filename || m?.alt || 'Backdrop')}
                              >
                                <div className="w-full bg-white" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                                  <img alt="" src={url} className="w-full h-full object-cover" />
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Presets</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{backdropPresets.length} items</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {backdropPresets.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            disabled={isGeneratingBackdrop}
                            onClick={() => applyBackdropFromSvg(b.innerSvg)}
                            className={twMerge(
                              "rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all",
                              isGeneratingBackdrop ? "opacity-60 cursor-not-allowed" : ""
                            )}
                            title={b.name}
                          >
                            <div className="w-full bg-white" style={{ aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}>
                              <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(wrapThumbSvg(b.innerSvg, { w: 480, h: 320 }))}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'LAYERS' && (
              <div className="p-4">
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-[#1e1e2d] px-4 py-3 flex items-center justify-between">
                    <div className="text-[10px] font-extrabold text-slate-200 uppercase tracking-widest">Layers</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{layersElements.length} items</div>
                  </div>
                  <div ref={layersScrollRef} className="bg-[#151522] max-h-[calc(100vh-220px)] overflow-y-auto">
                    {layersElements.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Tidak ada layer</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Coba kata kunci lain</div>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {layersElements.map(({ el, label, Icon }) => (
                          <div
                            key={el.id}
                            ref={(node) => {
                              layerRowRefs.current[el.id] = node;
                            }}
                            className={twMerge(
                              "px-3 py-2 flex items-center gap-2 select-none transition-colors",
                              selectedElementId === el.id ? "bg-white/10" : "hover:bg-white/5",
                              layerDragId === el.id ? "opacity-80" : "",
                              layerDragOverId === el.id && layerDragId && layerDragId !== el.id ? "bg-indigo-500/10 ring-1 ring-indigo-400/40" : "",
                              layerDragOverId === el.id && layerDragId && layerDragId !== el.id ? "relative before:absolute before:left-0 before:right-0 before:top-0 before:h-[2px] before:bg-indigo-400" : ""
                            )}
                          >
                            <button
                              type="button"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLayerDragId(el.id);
                                setLayerDragOverId(el.id);
                                setLayerDragPointerId(e.pointerId);
                                setSelectedElementId(el.id);
                                try {
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                } catch {
                                }
                              }}
                              className={twMerge(
                                "p-1.5 rounded-lg hover:bg-white/10 text-slate-300",
                                layerDragId === el.id ? "cursor-grabbing" : "cursor-grab"
                              )}
                              title="Drag"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setSelectedElementId(el.id)} className="flex-1 flex items-center gap-2 min-w-0">
                              <Icon className="w-4 h-4 text-slate-300 shrink-0" />
                              <div className="text-xs font-semibold text-slate-200 truncate">{label}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateElement(el.id, { locked: !el.locked })}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
                              title={el.locked ? 'Unlock' : 'Lock'}
                            >
                              {el.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'SETTINGS' && (
              <div className="p-4 space-y-6">
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-[#2b2f3a] px-4 py-3">
                    <div className="text-[11px] font-extrabold text-slate-200">Course</div>
                  </div>
                  <div className="bg-[#1f2430] p-4 space-y-3">
                    <button
                      ref={coursePickerBtnRef}
                      type="button"
                      onClick={openCoursePicker}
                      disabled={isLoadingCourses}
                      className={twMerge(
                        "settings-picker-trigger w-full px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 transition-all",
                        isLoadingCourses
                          ? "bg-white/5 border-white/10 text-slate-500 cursor-not-allowed"
                          : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10"
                      )}
                    >
                      <span className="truncate">{targetCourseId ? (selectedCourseLabel || 'Kursus dipilih') : isLoadingCourses ? 'Memuat kursus...' : 'Pilih kursus'}</span>
                      <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {targetCourseId ? 'Kursus ini akan menerima desain sertifikat saat Anda menekan Publish / Save Settings' : 'Pilih kursus untuk mengatur sertifikatnya'}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-[#2b2f3a] px-4 py-3">
                    <div className="text-[11px] font-extrabold text-slate-200">Template</div>
                  </div>
                  <div className="bg-[#1f2430] p-4 space-y-3">
                    <button
                      ref={templatePickerBtnRef}
                      type="button"
                      onClick={openTemplatePicker}
                      disabled={isLoadingTemplates}
                      className={twMerge(
                        "settings-picker-trigger w-full px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 transition-all",
                        isLoadingTemplates
                          ? "bg-white/5 border-white/10 text-slate-500 cursor-not-allowed"
                          : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10"
                      )}
                    >
                      <span className="truncate">{selectedTemplateId ? (selectedTemplateLabel || 'Template dipilih') : isLoadingTemplates ? 'Memuat template...' : 'Pilih template untuk diterapkan'}</span>
                      <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Memilih template akan mengganti desain kanvas saat ini
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-[#2b2f3a] px-4 py-3">
                    <div className="text-[11px] font-extrabold text-slate-200">Choose Size</div>
                  </div>
                  <div className="bg-[#1f2430] p-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCertificatePageSize('LETTER')}
                      className={twMerge(
                        "rounded-2xl border p-3 text-left transition-all",
                        certificatePageSize === 'LETTER'
                          ? "border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-200" />
                        <div className="text-xs font-extrabold text-slate-100">Letter</div>
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">215.9 × 279.4 mm</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCertificatePageSize('A4')}
                      className={twMerge(
                        "rounded-2xl border p-3 text-left transition-all",
                        certificatePageSize === 'A4'
                          ? "border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-200" />
                        <div className="text-xs font-extrabold text-slate-100">A4</div>
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">210 × 297 mm</div>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-[#2b2f3a] px-4 py-3">
                    <div className="text-[11px] font-extrabold text-slate-200">Orientation</div>
                  </div>
                  <div className="bg-[#1f2430] p-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCertificatePageOrientation('LANDSCAPE')}
                      className={twMerge(
                        "rounded-2xl border p-3 text-left transition-all",
                        certificatePageOrientation === 'LANDSCAPE'
                          ? "border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="text-xs font-extrabold text-slate-100">Landscape</div>
                      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wide</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCertificatePageOrientation('PORTRAIT')}
                      className={twMerge(
                        "rounded-2xl border p-3 text-left transition-all",
                        certificatePageOrientation === 'PORTRAIT'
                          ? "border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_2px_rgba(99,102,241,0.25)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="text-xs font-extrabold text-slate-100">Portrait</div>
                      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tall</div>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isPublishing || !targetCourseId}
                  className={twMerge(
                    "w-full h-11 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all border",
                    isPublishing || !targetCourseId
                      ? "bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed"
                      : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {isPublishing ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}
          </div>
        </aside>

        <main 
          className="flex-1 relative overflow-hidden flex flex-col bg-[#f0f2f5] p-20 items-center justify-center" 
          onPointerDown={handleCanvasPointerDown}
        >
          <div style={{ transform: `scale(${builderZoom})`, transformOrigin: 'center' }} className="transition-transform duration-300">
            <div
              ref={certificatePreviewRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-white overflow-hidden select-none touch-none canvas-bg"
              style={{ width: `${certificatePagePx.w}px`, aspectRatio: `${certificatePage.widthMm} / ${certificatePage.heightMm}` }}
            >
              {certificateBackgroundImageUrl && <img alt="" src={certificateBackgroundImageUrl} className="absolute inset-0 w-full h-full object-fill pointer-events-none" />}
              
              {sortedElements.map(el => (
                <div
                  key={el.id}
                  ref={(node) => {
                    elementNodeRefs.current[el.id] = node;
                  }}
                  onPointerDown={(e) => handlePointerDown(el.id, e)}
                  className={twMerge(
                    'absolute transition-shadow flex items-center justify-center',
                    selectedElementId === el.id ? 'z-[100]' : ''
                  )}
                  style={{
                    left: `${(el.x / certificatePage.widthMm) * 100}%`,
                    top: `${(el.y / certificatePage.heightMm) * 100}%`,
                    width: `${(el.width / certificatePage.widthMm) * 100}%`,
                    height: `${(el.height / certificatePage.heightMm) * 100}%`,
                    zIndex: selectedElementId === el.id ? 1000 : el.zIndex,
                  }}
                >
                  {/* Actual Content (This one flips) */}
                  <div 
                    className={twMerge(
                      "w-full h-full flex transition-all",
                      el.align === 'left' ? "justify-start text-left" : el.align === 'right' ? "justify-end text-right" : "justify-center text-center",
                      "items-center",
                      selectedElementId === el.id ? "" : "hover:ring-1 hover:ring-indigo-300 cursor-move"
                    )}
                    style={{
                      fontSize: el.fontSize ? `${el.fontSize * 0.3527 * (certificatePagePx.w / certificatePage.widthMm)}px` : undefined,
                      color: el.color,
                      fontFamily: el.fontFamily,
                      fontWeight: el.bold ? 'bold' : 'normal',
                      fontStyle: el.italic ? 'italic' : 'normal',
                      opacity: (el.opacity || 100) / 100,
                      transform: `scaleX(${el.flipH ? -1 : 1}) scaleY(${el.flipV ? -1 : 1})`,
                    }}
                  >
                    {el.type === 'TEXT' && (el.content || '[ Text ]')}
                    {el.type === 'NAME' && '[ student_name ]'}
                    {el.type === 'COURSE' && '[ course_title ]'}
                    {el.type === 'INSTRUCTOR' && '[ instructor_name ]'}
                    {el.type === 'SERIAL' && '[ serial_id ]'}
                    {el.type === 'DATE' && '[ issue_date ]'}
                    {el.type === 'QR' && (
                      <QrPreview
                        sizeMm={Math.min(el.width, el.height)}
                        qrColor={el.qrColor || '#000000'}
                        bgColor={el.qrBgColor || '#FFFFFF'}
                        bgRadiusMm={typeof el.qrBgRadius === 'number' ? el.qrBgRadius : 6}
                        paddingMm={typeof el.qrPadding === 'number' ? el.qrPadding : 2}
                      />
                    )}
                    {el.type === 'SIGNATURE' && (
                      mentorSignatureUrl ? (
                        <img alt="" src={mentorSignatureUrl} className="w-full h-full object-contain" />
                      ) : (
                        <Signature className="w-full h-full p-1" />
                      )
                    )}
                    {el.type === 'IMAGE' && (
                      el.src ? (
                        <img alt="" src={el.src} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-full h-full p-2 text-slate-300" />
                      )
                    )}
                    {el.type === 'DURATION' && '[ duration ]'}
                    {el.type === 'POINT' && '[ points ]'}
                    {el.type === 'GRADE' && '[ grade ]'}
                    {el.type === 'BUNDLE' && '[ bundle_courses ]'}
                  </div>

                  {/* Selection UI (This one NEVER flips) */}
                  {selectedElementId === el.id && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Bounding Box Ring */}
                      <div className={twMerge(
                        "absolute -inset-[2px] border-2 transition-colors",
                        el.locked ? "border-red-400" : "border-indigo-500"
                      )} />

                      {!el.locked && (
                        <>
                          {/* Resize Handles */}
                          <div className="absolute inset-0 pointer-events-auto">
                            {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'].map(h => (
                              <div key={h} onPointerDown={(e) => handleResizeDown(el.id, h, e)} className={twMerge(
                                "absolute bg-white border-2 border-indigo-500 z-[110] shadow-sm",
                                h.includes('-') ? "w-3 h-3 rounded-full" : (h === 'top' || h === 'bottom' ? "w-6 h-2 left-1/2 -translate-x-1/2 rounded-full" : "w-2 h-6 top-1/2 -translate-y-1/2 rounded-full"),
                                h === 'top-left' && "-top-2 -left-2 cursor-nwse-resize",
                                h === 'top-right' && "-top-2 -right-2 cursor-nesw-resize",
                                h === 'bottom-left' && "-bottom-2 -left-2 cursor-nesw-resize",
                                h === 'bottom-right' && "-bottom-2 -right-2 cursor-nwse-resize",
                                h === 'top' && "-top-1.5 cursor-ns-resize",
                                h === 'bottom' && "-bottom-1.5 cursor-ns-resize",
                                h === 'left' && "-left-1.5 cursor-ew-resize",
                                h === 'right' && "-right-1.5 cursor-ew-resize"
                              )} />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Lock Indicator UI */}
                      {el.locked && (
                         <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 shadow-xl border border-red-400/50 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
                            <Lock className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Locked</span>
                            <button onClick={() => updateElement(el.id, { locked: false })} className="ml-2 hover:bg-white/20 p-1 rounded transition-colors"><Unlock className="w-3 h-3" /></button>
                         </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-6 right-6 flex items-center gap-1.5 p-1.5 bg-[#1e1e2d] rounded-lg shadow-2xl z-50">
            <button onClick={() => setBuilderZoom(z => Math.max(0.2, z - 0.1))} className="p-1.5 hover:bg-slate-700 rounded text-white transition-all"><Minus className="w-3.5 h-3.5" /></button>
            <div className="px-2 text-[10px] font-bold text-white min-w-[50px] text-center">{Math.round(builderZoom * 100)}%</div>
            <button onClick={() => setBuilderZoom(z => Math.min(2, z + 0.1))} className="p-1.5 hover:bg-slate-700 rounded text-white transition-all"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </main>
      </div>
      {typeof document !== 'undefined' && (showCoursePicker || showTemplatePicker)
        ? createPortal(
            <div className="fixed inset-0 z-[99997]">
              <div className="absolute inset-0" />
              {showCoursePicker && coursePickerAnchor ? (
                <div
                  className="fixed settings-picker-panel"
                  style={{ left: coursePickerAnchor.left, top: coursePickerAnchor.top, width: coursePickerAnchor.width }}
                >
                  <div className="rounded-2xl bg-[#1e1e2d] border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden">
                    <div className="p-3 border-b border-white/10">
                      <input
                        value={coursePickerQuery}
                        onChange={(e) => setCoursePickerQuery(e.target.value)}
                        placeholder="Cari kursus..."
                        className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300/30"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetCourseId('');
                          setShowCoursePicker(false);
                        }}
                        className="w-full px-3 py-2.5 text-left text-xs font-bold text-slate-200 hover:bg-white/5"
                      >
                        Pilih kursus
                      </button>
                      {filteredCourses.map((c: any) => {
                        const id = String(c?.id || '');
                        const title = String(c?.title || c?.slug || c?.id || '');
                        const active = targetCourseId === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setTargetCourseId(id);
                              setShowCoursePicker(false);
                            }}
                            className={twMerge(
                              "w-full px-3 py-2.5 text-left text-xs font-bold hover:bg-white/5",
                              active ? "bg-indigo-500/10 text-indigo-200" : "text-slate-200"
                            )}
                          >
                            {title}
                          </button>
                        );
                      })}
                      {filteredCourses.length === 0 ? (
                        <div className="px-3 py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Tidak ada kursus
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {showTemplatePicker && templatePickerAnchor ? (
                <div
                  className="fixed settings-picker-panel"
                  style={{ left: templatePickerAnchor.left, top: templatePickerAnchor.top, width: templatePickerAnchor.width }}
                >
                  <div className="rounded-2xl bg-[#1e1e2d] border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden">
                    <div className="p-3 border-b border-white/10">
                      <input
                        value={templatePickerQuery}
                        onChange={(e) => setTemplatePickerQuery(e.target.value)}
                        placeholder="Cari template..."
                        className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300/30"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId('');
                          setShowTemplatePicker(false);
                        }}
                        className="w-full px-3 py-2.5 text-left text-xs font-bold text-slate-200 hover:bg-white/5"
                      >
                        Pilih template
                      </button>
                      {filteredTemplates.map((t: any) => {
                        const id = String(t?.id || '');
                        const name = String(t?.name || t?.id || '');
                        const active = selectedTemplateId === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              handleApplyTemplateById(id);
                              setShowTemplatePicker(false);
                            }}
                            className={twMerge(
                              "w-full px-3 py-2.5 text-left text-xs font-bold hover:bg-white/5",
                              active ? "bg-indigo-500/10 text-indigo-200" : "text-slate-200"
                            )}
                          >
                            {name}
                          </button>
                        );
                      })}
                      {filteredTemplates.length === 0 ? (
                        <div className="px-3 py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Tidak ada template
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
      {typeof document !== 'undefined' && showPreviewModal
        ? createPortal(
            <div className="fixed inset-0 z-[99998]">
              <button
                type="button"
                className="absolute inset-0 bg-black/60"
                onClick={() => setShowPreviewModal(false)}
              />
              <div className="relative w-full h-full flex items-center justify-center p-10">
                <div className="absolute top-6 right-6 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="h-10 px-4 rounded-xl bg-white/90 hover:bg-white text-slate-800 text-xs font-extrabold uppercase tracking-widest flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </button>
                </div>
                <div
                  className="bg-white shadow-[0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden"
                  style={{
                    width: `${certificatePagePx.w}px`,
                    height: `${certificatePagePx.h}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'center',
                  }}
                >
                  {certificateBackgroundImageUrl ? (
                    <img alt="" src={certificateBackgroundImageUrl} className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
                  ) : null}
                  <div className="relative w-full h-full">
                    {sortedElements.map((el) => (
                      <div
                        key={`preview-${el.id}`}
                        className="absolute flex items-center justify-center pointer-events-none"
                        style={{
                          left: `${(el.x / certificatePage.widthMm) * 100}%`,
                          top: `${(el.y / certificatePage.heightMm) * 100}%`,
                          width: `${(el.width / certificatePage.widthMm) * 100}%`,
                          height: `${(el.height / certificatePage.heightMm) * 100}%`,
                          zIndex: el.zIndex,
                        }}
                      >
                        <div
                          className={twMerge(
                            "w-full h-full flex",
                            el.align === 'left' ? "justify-start text-left" : el.align === 'right' ? "justify-end text-right" : "justify-center text-center",
                            "items-center"
                          )}
                          style={{
                            fontSize: el.fontSize ? `${el.fontSize * 0.3527 * (certificatePagePx.w / certificatePage.widthMm)}px` : undefined,
                            color: el.color,
                            fontFamily: el.fontFamily,
                            fontWeight: el.bold ? 'bold' : 'normal',
                            fontStyle: el.italic ? 'italic' : 'normal',
                            opacity: (el.opacity || 100) / 100,
                            transform: `scaleX(${el.flipH ? -1 : 1}) scaleY(${el.flipV ? -1 : 1})`,
                          }}
                        >
                          {el.type === 'TEXT' && (el.content || '[ Text ]')}
                          {el.type === 'NAME' && '[ student_name ]'}
                          {el.type === 'COURSE' && '[ course_title ]'}
                          {el.type === 'INSTRUCTOR' && '[ instructor_name ]'}
                          {el.type === 'SERIAL' && '[ serial_id ]'}
                          {el.type === 'DATE' && '[ issue_date ]'}
                          {el.type === 'QR' && (
                            <QrPreview
                              sizeMm={Math.min(el.width, el.height)}
                              qrColor={el.qrColor || '#000000'}
                              bgColor={el.qrBgColor || '#FFFFFF'}
                              bgRadiusMm={typeof el.qrBgRadius === 'number' ? el.qrBgRadius : 6}
                              paddingMm={typeof el.qrPadding === 'number' ? el.qrPadding : 2}
                            />
                          )}
                          {el.type === 'SIGNATURE' && (
                            mentorSignatureUrl ? (
                              <img alt="" src={mentorSignatureUrl} className="w-full h-full object-contain" />
                            ) : (
                              <Signature className="w-full h-full p-1" />
                            )
                          )}
                          {el.type === 'IMAGE' && (
                            el.src ? (
                              <img alt="" src={el.src} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-full h-full p-2 text-slate-300" />
                            )
                          )}
                          {el.type === 'DURATION' && '[ duration ]'}
                          {el.type === 'POINT' && '[ points ]'}
                          {el.type === 'GRADE' && '[ grade ]'}
                          {el.type === 'BUNDLE' && '[ bundle_courses ]'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {typeof document !== 'undefined' && !showPreviewModal && selectedElement && floatingPos
        ? createPortal(
            <div className="fixed inset-0 z-[99999] pointer-events-none">
              {(() => {
                if (typeof window === 'undefined') return null;
                const toolbarH = 52;
                const gap = 12;
                const toolbarTop = floatingPos.top;
                const centerX = floatingPos.left;
                const pickTop = (popH: number) => {
                  const topAbove = toolbarTop - gap - popH;
                  const topBelow = toolbarTop + toolbarH + gap;
                  const vh = window.innerHeight;
                  const rawTop = topAbove >= 8 ? topAbove : topBelow + popH <= vh - 8 ? topBelow : topBelow;
                  return Math.max(8, Math.min(vh - 8 - popH, rawTop));
                };
                const clampX = (w: number) => Math.max(8 + w / 2, Math.min(window.innerWidth - 8 - w / 2, centerX));
                const clampY = (h: number, top: number) => Math.max(8, Math.min(window.innerHeight - 8 - h, top));

                const toolbarLeft = clampX(toolbarRef.current?.getBoundingClientRect()?.width || 360);
                const toolbarY = clampY(toolbarH, toolbarTop);

                const pop = (w: number, h: number) => ({ left: clampX(w), top: pickTop(h) });

                const colorPop = pop(256, selectedElement.librarySvg ? 240 : selectedElement.type === 'QR' ? 220 : 280);
                const fontPop = pop(256, 320);
                const textPop = pop(320, 240);
                const settingsPop = pop(320, 560);

                return (
                  <>
                    <div
                      className="fixed left-0 top-0 pointer-events-none"
                      style={{ transform: `translate(${toolbarLeft}px, ${toolbarY}px) translateX(-50%)` }}
                    >
                      <div
                        className="relative flex items-center bg-[#1e1e2d] text-white p-2 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/20 pointer-events-auto toolbar-trigger"
                        ref={toolbarRef}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-0.5 px-1">
                          {selectedElement.librarySvg && selectedLibrarySlots.length > 0 ? (
                            <>
                              <div className="flex items-center gap-1.5 pr-2">
                                {selectedLibrarySlots.slice(0, 8).map((c, i) => (
                                  <button
                                    key={`${c}-${i}`}
                                    type="button"
                                    className={twMerge(
                                      "w-4 h-4 rounded-full border-2 transition-transform active:scale-90",
                                      activeLibraryColorIndex === i ? "border-white" : "border-white/20"
                                    )}
                                    style={{ backgroundColor: c }}
                                    onClick={() => {
                                      setActiveLibraryColorIndex(i);
                                      setShowColorPicker(true);
                                      setShowFontPicker(false);
                                      setShowTextEditor(false);
                                      setShowSettingsPopover(false);
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="w-px h-5 bg-white/20 mx-1.5" />
                            </>
                          ) : null}
                          <ToolbarButton
                            icon={Palette}
                            active={showColorPicker}
                            onClick={() => {
                              setShowColorPicker(!showColorPicker);
                              setShowFontPicker(false);
                              setShowTextEditor(false);
                              setShowSettingsPopover(false);
                            }}
                          />

                          {(selectedElement.type === 'TEXT' ||
                            selectedElement.type === 'NAME' ||
                            selectedElement.type === 'COURSE' ||
                            selectedElement.type === 'INSTRUCTOR' ||
                            selectedElement.type === 'SERIAL' ||
                            selectedElement.type === 'DATE') && (
                            <>
                              <ToolbarButton
                                icon={Type}
                                active={showFontPicker}
                                onClick={() => {
                                  setShowFontPicker(!showFontPicker);
                                  setShowColorPicker(false);
                                  setShowTextEditor(false);
                                  setShowSettingsPopover(false);
                                }}
                              />
                              <div className="w-px h-5 bg-white/20 mx-1.5" />
                              <ToolbarButton
                                icon={Bold}
                                active={selectedElement.bold}
                                onClick={() => updateElement(selectedElement.id, { bold: !selectedElement.bold })}
                              />
                              <ToolbarButton
                                icon={Italic}
                                active={selectedElement.italic}
                                onClick={() => updateElement(selectedElement.id, { italic: !selectedElement.italic })}
                              />
                              <div className="w-px h-5 bg-white/20 mx-1.5" />
                              <ToolbarButton
                                icon={AlignLeft}
                                active={selectedElement.align === 'left'}
                                onClick={() => updateElement(selectedElement.id, { align: 'left' })}
                              />
                              <ToolbarButton
                                icon={AlignCenter}
                                active={selectedElement.align === 'center'}
                                onClick={() => updateElement(selectedElement.id, { align: 'center' })}
                              />
                              <ToolbarButton
                                icon={AlignRight}
                                active={selectedElement.align === 'right'}
                                onClick={() => updateElement(selectedElement.id, { align: 'right' })}
                              />
                            </>
                          )}
                        </div>

                        <div className="w-px h-5 bg-white/20 mx-1.5" />

                        {selectedElement.type === 'TEXT' && (
                          <>
                            <ToolbarButton
                              icon={FileText}
                              active={showTextEditor}
                              onClick={() => {
                                setShowTextEditor(!showTextEditor);
                                setShowSettingsPopover(false);
                                setShowColorPicker(false);
                              }}
                            />
                            <div className="w-px h-5 bg-white/20 mx-1.5" />
                          </>
                        )}

                        <div className="flex items-center gap-0.5">
                          <ToolbarButton
                            icon={SlidersHorizontal}
                            onClick={() => {
                              setShowSettingsPopover(!showSettingsPopover);
                              setShowTextEditor(false);
                              setShowColorPicker(false);
                              setShowFontPicker(false);
                            }}
                            active={showSettingsPopover}
                          />
                          <ToolbarButton icon={Copy} onClick={() => duplicateElement(selectedElement.id)} />
                          <ToolbarButton icon={Unlock} onClick={() => updateElement(selectedElement.id, { locked: true })} />
                          <ToolbarButton
                            icon={Trash2}
                            onClick={() => deleteElement(selectedElement.id)}
                            className="text-red-400 hover:bg-red-500/20"
                          />
                        </div>
                      </div>
                      <div className="absolute left-0 top-full text-[10px] font-bold text-white/50 mt-2 pointer-events-none">
                        {isShiftDown ? 'SHIFT: Rasio terkunci' : null}
                      </div>
                    </div>

                    {showColorPicker ? (
                      <div
                        className="fixed w-64 bg-[#1e1e2d] text-white p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[130] border border-white/20 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto popover-container"
                        style={{ left: colorPop.left, top: colorPop.top, transform: 'translateX(-50%)', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {selectedElement.librarySvg ? (
                          (() => {
                            const slots = selectedLibrarySlots;
                            const idx = Math.max(0, Math.min(slots.length - 1, activeLibraryColorIndex));
                            const current = (slots[idx] || slots[0] || '#4F46E5').trim();
                            const quick = ['#000000', '#ffffff', '#4F46E5', '#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'];
                            return (
                              <>
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-3">Colors</label>
                                {slots.length > 0 ? (
                                  <div className="flex items-center gap-2 mb-4">
                                    {slots.slice(0, 8).map((c, i) => (
                                      <button
                                        key={`${c}-${i}`}
                                        type="button"
                                        className={twMerge(
                                          "w-6 h-6 rounded-full border-2 transition-transform active:scale-90",
                                          i === idx ? "border-white" : "border-white/20"
                                        )}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setActiveLibraryColorIndex(i)}
                                      />
                                    ))}
                                  </div>
                                ) : null}

                                <div className="grid grid-cols-5 gap-3 mb-4">
                                  {quick.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      disabled={isRecoloringLibrary || slots.length === 0}
                                      onClick={() => recolorLibraryElement(selectedElement.id, { index: idx, color: c })}
                                      className={twMerge(
                                        "w-8 h-8 rounded-lg border-2 transition-transform active:scale-90",
                                        current.toLowerCase() === c ? "border-white" : "border-white/10",
                                        isRecoloringLibrary || slots.length === 0 ? "opacity-60 cursor-not-allowed" : ""
                                      )}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>

                                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                                  <input
                                    type="color"
                                    value={current}
                                    disabled={isRecoloringLibrary || slots.length === 0}
                                    onChange={(e) => recolorLibraryElement(selectedElement.id, { index: idx, color: e.target.value })}
                                    className="w-8 h-8 rounded-lg overflow-hidden bg-transparent border border-white/10"
                                  />
                                  <input
                                    type="text"
                                    value={current}
                                    disabled={isRecoloringLibrary || slots.length === 0}
                                    onChange={(e) => recolorLibraryElement(selectedElement.id, { index: idx, color: e.target.value })}
                                    className="bg-transparent text-[11px] font-mono w-full focus:outline-none"
                                  />
                                </div>
                              </>
                            );
                          })()
                        ) : selectedElement.type === 'QR' ? (
                          <>
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-4">QR Colors</label>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">QR</div>
                                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                                  <input
                                    type="color"
                                    value={selectedElement.qrColor || '#000000'}
                                    onChange={(e) => updateElement(selectedElement.id, { qrColor: e.target.value })}
                                    className="w-8 h-8 rounded-lg overflow-hidden bg-transparent border border-white/10"
                                  />
                                  <input
                                    type="text"
                                    value={selectedElement.qrColor || '#000000'}
                                    onChange={(e) => updateElement(selectedElement.id, { qrColor: e.target.value })}
                                    className="bg-transparent text-[11px] font-mono w-full focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">Background</div>
                                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                                  <input
                                    type="color"
                                    value={selectedElement.qrBgColor || '#FFFFFF'}
                                    onChange={(e) => updateElement(selectedElement.id, { qrBgColor: e.target.value })}
                                    className="w-8 h-8 rounded-lg overflow-hidden bg-transparent border border-white/10"
                                  />
                                  <input
                                    type="text"
                                    value={selectedElement.qrBgColor || '#FFFFFF'}
                                    onChange={(e) => updateElement(selectedElement.id, { qrBgColor: e.target.value })}
                                    className="bg-transparent text-[11px] font-mono w-full focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-4">Pick Color</label>
                            <div className="grid grid-cols-5 gap-3 mb-5">
                              {['#000000', '#ffffff', '#4F46E5', '#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'].map(
                                (color) => (
                                  <button
                                    key={color}
                                    onClick={() => updateElement(selectedElement.id, { color })}
                                    className={twMerge(
                                      "w-8 h-8 rounded-lg border-2 transition-transform active:scale-90",
                                      selectedElement.color === color ? "border-white" : "border-white/10"
                                    )}
                                    style={{ backgroundColor: color }}
                                  />
                                )
                              )}
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/10">
                              <div
                                className="w-8 h-8 rounded-lg border border-white/20 shrink-0"
                                style={{ backgroundColor: selectedElement.color }}
                              />
                              <input
                                type="text"
                                value={selectedElement.color || '#000000'}
                                onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                                className="bg-transparent text-[11px] font-mono w-full focus:outline-none"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    {showFontPicker ? (
                      <div
                        className="fixed w-64 bg-[#1e1e2d] text-white p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[130] border border-white/20 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto popover-container"
                        style={{ left: fontPop.left, top: fontPop.top, transform: 'translateX(-50%)', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-4">Select Font</label>
                        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Font Size</span>
                            <span className="text-xs font-bold text-white">{Math.max(8, Math.min(160, Number(selectedElement.fontSize || 16)))} pt</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={8}
                              max={160}
                              step={1}
                              value={Math.max(8, Math.min(160, Number(selectedElement.fontSize || 16)))}
                              onChange={(e) =>
                                updateElement(selectedElement.id, {
                                  fontSize: Math.max(8, Math.min(160, Number(e.target.value) || 16)),
                                })
                              }
                              className="h-2 w-full cursor-pointer accent-indigo-500"
                            />
                            <input
                              type="number"
                              min={8}
                              max={160}
                              step={1}
                              value={Math.max(8, Math.min(160, Number(selectedElement.fontSize || 16)))}
                              onChange={(e) =>
                                updateElement(selectedElement.id, {
                                  fontSize: Math.max(8, Math.min(160, Number(e.target.value) || 16)),
                                })
                              }
                              className="w-16 rounded-lg border border-white/10 bg-[#141422] px-2 py-1.5 text-right text-xs font-bold text-white outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                          {COMMON_FONTS.map((font) => (
                            <button
                              key={font.value}
                              onClick={() => updateElement(selectedElement.id, { fontFamily: font.value })}
                              className={twMerge(
                                "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group",
                                selectedElement.fontFamily === font.value ? "bg-indigo-600 text-white" : "hover:bg-white/5 text-white/70"
                              )}
                            >
                              <span style={{ fontFamily: font.value }} className="text-sm">{font.name}</span>
                              {selectedElement.fontFamily === font.value && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {showTextEditor && selectedElement.type === 'TEXT' ? (
                      <div
                        className="fixed w-80 bg-[#1e1e2d] text-white p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[130] border border-white/20 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto popover-container"
                        style={{ left: textPop.left, top: textPop.top, transform: 'translateX(-50%)', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-3">Edit Content</label>
                        <textarea
                          autoFocus
                          value={selectedElement.content || ''}
                          onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] leading-relaxed"
                          placeholder="Type something..."
                        />
                      </div>
                    ) : null}

                    {showSettingsPopover ? (
                      <div
                        className="fixed w-80 bg-[#1e1e2d] text-white p-6 rounded-[24px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] z-[130] border border-white/20 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto popover-container"
                        style={{ left: settingsPop.left, top: settingsPop.top, transform: 'translateX(-50%)', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-2 gap-4 mb-8">
                          <button
                            onClick={() => updateElement(selectedElement.id, { flipV: !selectedElement.flipV })}
                            className={twMerge(
                              "flex flex-col items-center justify-center gap-3 py-4 rounded-2xl transition-all border-2",
                              selectedElement.flipV ? "bg-indigo-600 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]" : "bg-white/5 border-white/5 hover:bg-white/10"
                            )}
                          >
                            <FlipVertical className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em]">Flip Vertical</span>
                          </button>
                          <button
                            onClick={() => updateElement(selectedElement.id, { flipH: !selectedElement.flipH })}
                            className={twMerge(
                              "flex flex-col items-center justify-center gap-3 py-4 rounded-2xl transition-all border-2",
                              selectedElement.flipH ? "bg-indigo-600 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]" : "bg-white/5 border-white/5 hover:bg-white/10"
                            )}
                          >
                            <FlipHorizontal className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em]">Flip Horizontal</span>
                          </button>
                        </div>

                        <div className="space-y-8">
                          {selectedElement.librarySvg?.includes('__LW__') && (
                            <div>
                              <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] block mb-4">Line Thickness</label>
                              <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">Stroke Width</div>
                                  <span className="text-[11px] font-black text-indigo-400 bg-indigo-600/10 px-3 py-1 rounded-xl border border-indigo-500/20">
                                    {Math.max(4, Math.min(120, Math.round(Number(selectedElement.lineStrokeWidth) || 28)))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="range"
                                    min="4"
                                    max="120"
                                    value={Math.max(4, Math.min(120, Math.round(Number(selectedElement.lineStrokeWidth) || 28)))}
                                    onChange={(e) => updateLibraryLineThickness(selectedElement.id, Number(e.target.value))}
                                    className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                  />
                                  <input
                                    type="number"
                                    min="4"
                                    max="120"
                                    step="1"
                                    value={Math.max(4, Math.min(120, Math.round(Number(selectedElement.lineStrokeWidth) || 28)))}
                                    onChange={(e) => updateLibraryLineThickness(selectedElement.id, Number(e.target.value))}
                                    className="w-16 rounded-lg border border-white/10 bg-[#141422] px-2 py-1.5 text-right text-xs font-bold text-white outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {selectedElement.type === 'QR' && (
                            <div>
                              <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] block mb-4">QR Background</label>
                              <div className="space-y-5">
                                <div>
                                  <div className="flex justify-between items-center mb-3">
                                    <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">Border Radius</div>
                                    <span className="text-[11px] font-black text-indigo-400 bg-indigo-600/10 px-3 py-1 rounded-xl border border-indigo-500/20">
                                      {Math.round(typeof selectedElement.qrBgRadius === 'number' ? selectedElement.qrBgRadius : 6)}mm
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="24"
                                    value={typeof selectedElement.qrBgRadius === 'number' ? selectedElement.qrBgRadius : 6}
                                    onChange={(e) => updateElement(selectedElement.id, { qrBgRadius: Number(e.target.value) })}
                                    className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                  />
                                </div>

                                <div>
                                  <div className="flex justify-between items-center mb-3">
                                    <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">Padding</div>
                                    <span className="text-[11px] font-black text-indigo-400 bg-indigo-600/10 px-3 py-1 rounded-xl border border-indigo-500/20">
                                      {Math.round(typeof selectedElement.qrPadding === 'number' ? selectedElement.qrPadding : 2)}mm
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="12"
                                    value={typeof selectedElement.qrPadding === 'number' ? selectedElement.qrPadding : 2}
                                    onChange={(e) => updateElement(selectedElement.id, { qrPadding: Number(e.target.value) })}
                                    className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] block mb-4">Canvas Alignment</label>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <ToolbarButton icon={AlignLeft} onClick={() => alignToCanvas(selectedElement.id, 'LEFT')} label="Left" className="bg-white/5 py-3 rounded-xl hover:bg-white/10" />
                              <ToolbarButton icon={AlignCenter} onClick={() => alignToCanvas(selectedElement.id, 'CENTER_H')} label="Center" className="bg-white/5 py-3 rounded-xl hover:bg-white/10" />
                              <ToolbarButton icon={AlignRight} onClick={() => alignToCanvas(selectedElement.id, 'RIGHT')} label="Right" className="bg-white/5 py-3 rounded-xl hover:bg-white/10" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <ToolbarButton icon={AlignStartVertical} onClick={() => alignToCanvas(selectedElement.id, 'TOP')} label="Top" className="bg-white/5 py-3 rounded-xl hover:bg-white/10" />
                              <ToolbarButton icon={AlignCenterVertical} onClick={() => alignToCanvas(selectedElement.id, 'CENTER_V')} label="Middle" className="bg-white/5 py-3 rounded-xl hover:bg-white/10" />
                              <ToolbarButton icon={AlignEndVertical} onClick={() => alignToCanvas(selectedElement.id, 'BOTTOM')} label="Bottom" className="bg-white/5 py-3 rounded-xl hover:bg-white/10" />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] block mb-4">Layers</label>
                            <div className="bg-black/20 p-2 rounded-2xl border border-white/5">
                              <div className="grid grid-cols-2 gap-2">
                                <ToolbarButton icon={ArrowUp} onClick={() => moveZIndex(selectedElement.id, 'TOP')} label="Front" className="py-3" />
                                <ToolbarButton icon={ChevronUp} onClick={() => moveZIndex(selectedElement.id, 'UP')} label="Forward" className="py-3" />
                                <ToolbarButton icon={ChevronDown} onClick={() => moveZIndex(selectedElement.id, 'DOWN')} label="Backward" className="py-3" />
                                <ToolbarButton icon={ArrowDown} onClick={() => moveZIndex(selectedElement.id, 'BOTTOM')} label="Back" className="py-3" />
                              </div>
                              <div className="mt-2 flex justify-center">
                                <span className="text-[11px] font-black text-indigo-400 bg-indigo-400/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">Z:{selectedElement.zIndex}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] block">Transparency</label>
                              <span className="text-[12px] font-black text-indigo-400 bg-indigo-600/10 px-3 py-1 rounded-xl border border-indigo-500/20">{selectedElement.opacity || 100}%</span>
                            </div>
                            <div className="px-2">
                              <input
                                type="range"
                                min="0" max="100"
                                value={selectedElement.opacity || 100}
                                onChange={(e) => updateElement(selectedElement.id, { opacity: Number(e.target.value) })}
                                className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function SidebarIcon({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={twMerge("flex flex-col items-center gap-1.5 group transition-all w-full relative", active ? "text-indigo-400" : "text-slate-500 hover:text-slate-300")}>
      <div className={twMerge("p-2.5 rounded-xl transition-all", active ? "bg-indigo-600/10" : "group-hover:bg-white/5")}><Icon className="w-5 h-5" /></div>
      <span className="text-[8px] font-bold uppercase tracking-widest">{label}</span>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />}
    </button>
  );
}

function ElementButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border bg-white border-slate-100 text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group active:scale-95 shadow-sm">
      <Icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
      <span className="text-[10px] font-bold leading-tight">{label}</span>
    </button>
  );
}

function ToolbarButton({ icon: Icon, onClick, active, className, label }: { icon: any; onClick: () => void; active?: boolean; className?: string; label?: string }) {
  return (
    <button onClick={onClick} className={twMerge(
      "flex flex-col items-center gap-1 p-2 rounded-lg transition-all hover:bg-white/10",
      active ? "text-indigo-400 bg-indigo-500/10" : "text-white/70",
      className
    )}>
      <Icon className="w-4 h-4" />
      {label && <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>}
    </button>
  );
}

function QrPreview({
  sizeMm,
  qrColor,
  bgColor,
  bgRadiusMm,
  paddingMm,
}: {
  sizeMm: number;
  qrColor: string;
  bgColor: string;
  bgRadiusMm: number;
  paddingMm: number;
}) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const mod: any = await import('qrcode');
        const QR: any = mod?.default ?? mod;
        const url = await QR.toDataURL('https://example.com/certificate/verify/[serial]', {
          margin: 0,
          scale: 8,
          color: {
            dark: qrColor || '#000000',
            light: '#0000',
          },
        });
        if (!active) return;
        setDataUrl(typeof url === 'string' ? url : '');
      } catch {
        if (!active) return;
        setDataUrl('');
      }
    })();
    return () => {
      active = false;
    };
  }, [qrColor]);

  const safeSize = Math.max(1, sizeMm || 1);
  const padPct = Math.max(0, Math.min(35, (Math.max(0, paddingMm) / safeSize) * 100));
  const radiusPct = Math.max(0, Math.min(50, (Math.max(0, bgRadiusMm) / safeSize) * 100));

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          backgroundColor: bgColor || '#FFFFFF',
          borderRadius: `${radiusPct}%`,
          padding: `${padPct}%`,
        }}
      >
        {dataUrl ? (
          <img alt="" src={dataUrl} className="w-full h-full object-contain" />
        ) : (
          <QrCode className="w-full h-full p-2" style={{ color: qrColor || '#000000' } as any} />
        )}
      </div>
    </div>
  );
}
