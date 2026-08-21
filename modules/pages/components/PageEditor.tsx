"use client";

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus, Trash2, Save, GripVertical, Eye, Settings2, Code2, ArrowUp, ArrowDown, LayoutTemplate, ChevronDown } from 'lucide-react';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';

interface Block {
  type: string;
  content: string;
  order: number;
}

interface PageEditorProps {
  initialData?: {
    id?: string;
    title: string;
    slug?: string;
    published: boolean;
    blocks: Block[];
  };
  onSuccess?: () => void;
  formId?: string;
  hideFooterActions?: boolean;
  onSavingChange?: (isSaving: boolean) => void;
  closeAfterSave?: boolean;
  onSaved?: (page: any) => void;
}

type HeroWidthMode = 'FULL' | 'BOXED' | 'CUSTOM';
type HeroButtonVariant = 'PRIMARY' | 'SECONDARY' | 'OUTLINE';

type HeroButton = {
  text?: string;
  href?: string;
  variant?: HeroButtonVariant;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
};

type HeroSlide = {
  heading?: string;
  subheading?: string;
  background?: {
    imageUrl?: string;
    overlayOpacity?: number;
    fit?: 'COVER' | 'CONTAIN';
    position?: 'CENTER' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  };
  buttons?: HeroButton[];
};

type HeroContent = {
  heading?: string;
  subheading?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  primaryCta?: { text?: string; href?: string };
  secondaryCta?: { text?: string; href?: string };
  layout?: {
    widthMode?: HeroWidthMode;
    customMaxWidthPx?: number;
    customPaddingXClass?: string;
    baseBackgroundMode?: 'DARK' | 'NONE' | 'CUSTOM';
    baseBackgroundColor?: string;
    minHeightPx?: number;
  };
  slider?: {
    enabled?: boolean;
    autoplayMs?: number;
    transitionMs?: number;
    showDots?: boolean;
    showArrows?: boolean;
  };
  slides?: HeroSlide[];
};

type SectionContent = {
  id: string;
  layout?: {
    maxWidth?: 'FULL' | 'BOXED';
    paddingY?: 'SM' | 'MD' | 'LG';
    columnsGap?: 'SM' | 'MD' | 'LG';
  };
  columns: Array<{
    id: string;
    widgets: Array<{ id: string; type: string; content: string }>;
  }>;
};

type GridItem = {
  title: string;
  description: string;
  imageUrl?: string;
  href?: string;
  bgColor?: string;
  textColor?: string;
};

type GridContent = {
  heading?: string;
  subheading?: string;
  columns?: number;
  rows?: number;
  maxItems?: number;
  mobileTwoColumns?: boolean;
  highlightEnabled?: boolean;
  highlightIndex?: number | null;
  highlightIndexes?: number[];
  highlightBgColor?: string;
  highlightTextColor?: string;
  items: GridItem[];
};

function safeJsonParse(value: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(value) };
  } catch {
    return { ok: false, error: 'Konten JSON tidak valid. Gunakan mode JSON untuk memperbaiki.' };
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createId(prefix: string) {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${uuid}`;
}

function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  right,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between gap-4">
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-bold text-slate-900 truncate">{title}</div>
          {description ? <div className="text-xs text-slate-500 mt-0.5">{description}</div> : null}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {right ? <div className="flex items-center gap-2">{right}</div> : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-1 rounded-lg hover:bg-white/60 text-slate-500"
            aria-label={open ? 'Tutup' : 'Buka'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open ? <div className="p-4">{children}</div> : null}
    </div>
  );
}

function BlockSpacingEditor({
  content,
  onChange,
  defaultOpen = false,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  defaultOpen?: boolean;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  if (!parsed.ok) return null;

  const data = (parsed.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>) : {}) as Record<string, unknown>;
  const spacingRaw = (data.spacing && typeof data.spacing === 'object' ? (data.spacing as Record<string, unknown>) : {}) as Record<string, unknown>;

  const ptPx = typeof spacingRaw.ptPx === 'number' ? spacingRaw.ptPx : undefined;
  const pbPx = typeof spacingRaw.pbPx === 'number' ? spacingRaw.pbPx : undefined;
  const pxPx = typeof spacingRaw.pxPx === 'number' ? spacingRaw.pxPx : undefined;
  const mtPx = typeof spacingRaw.mtPx === 'number' ? spacingRaw.mtPx : undefined;
  const mbPx = typeof spacingRaw.mbPx === 'number' ? spacingRaw.mbPx : undefined;
  const mxPx = typeof spacingRaw.mxPx === 'number' ? spacingRaw.mxPx : undefined;

  const setSpacing = (next: { ptPx?: number; pbPx?: number; pxPx?: number; mtPx?: number; mbPx?: number; mxPx?: number }) => {
    const cleaned: Record<string, number> = {};
    if (typeof next.ptPx === 'number') cleaned.ptPx = clampNumber(next.ptPx, 0, 240);
    if (typeof next.pbPx === 'number') cleaned.pbPx = clampNumber(next.pbPx, 0, 240);
    if (typeof next.pxPx === 'number') cleaned.pxPx = clampNumber(next.pxPx, 0, 120);
    if (typeof next.mtPx === 'number') cleaned.mtPx = clampNumber(next.mtPx, -240, 240);
    if (typeof next.mbPx === 'number') cleaned.mbPx = clampNumber(next.mbPx, -240, 240);
    if (typeof next.mxPx === 'number') cleaned.mxPx = clampNumber(next.mxPx, -120, 120);

    const nextData: Record<string, unknown> = { ...data };
    if (Object.keys(cleaned).length === 0) delete nextData.spacing;
    else nextData.spacing = cleaned;
    onChange(JSON.stringify(nextData, null, 2));
  };

  return (
    <CollapsibleSection title="Jarak (Spacing)" description="Atur padding dan margin untuk blok ini." defaultOpen={defaultOpen}>
      <div className="text-xs font-bold text-slate-700 mb-2">Padding</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">Atas (px)</label>
          <input
            type="number"
            min={0}
            max={240}
            value={typeof ptPx === 'number' ? ptPx : ''}
            onChange={(e) => setSpacing({ ptPx: e.target.value === '' ? undefined : Number(e.target.value), pbPx, pxPx, mtPx, mbPx, mxPx })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="contoh: 24"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">Bawah (px)</label>
          <input
            type="number"
            min={0}
            max={240}
            value={typeof pbPx === 'number' ? pbPx : ''}
            onChange={(e) => setSpacing({ ptPx, pbPx: e.target.value === '' ? undefined : Number(e.target.value), pxPx, mtPx, mbPx, mxPx })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="contoh: 24"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">Kiri/Kanan (px)</label>
          <input
            type="number"
            min={0}
            max={120}
            value={typeof pxPx === 'number' ? pxPx : ''}
            onChange={(e) => setSpacing({ ptPx, pbPx, pxPx: e.target.value === '' ? undefined : Number(e.target.value), mtPx, mbPx, mxPx })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="contoh: 16"
          />
        </div>
      </div>

      <div className="text-xs font-bold text-slate-700 mt-5 mb-2">Margin</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">Atas (px)</label>
          <input
            type="number"
            min={-240}
            max={240}
            value={typeof mtPx === 'number' ? mtPx : ''}
            onChange={(e) => setSpacing({ ptPx, pbPx, pxPx, mtPx: e.target.value === '' ? undefined : Number(e.target.value), mbPx, mxPx })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="contoh: 24"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">Bawah (px)</label>
          <input
            type="number"
            min={-240}
            max={240}
            value={typeof mbPx === 'number' ? mbPx : ''}
            onChange={(e) => setSpacing({ ptPx, pbPx, pxPx, mtPx, mbPx: e.target.value === '' ? undefined : Number(e.target.value), mxPx })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="contoh: 24"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">Kiri/Kanan (px)</label>
          <input
            type="number"
            min={-120}
            max={120}
            value={typeof mxPx === 'number' ? mxPx : ''}
            onChange={(e) => setSpacing({ ptPx, pbPx, pxPx, mtPx, mbPx, mxPx: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="contoh: 0"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setSpacing({})}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
        >
          Reset
        </button>
      </div>
    </CollapsibleSection>
  );
}

export default function PageEditor({
  initialData,
  onSuccess,
  formId = 'page-editor-form',
  hideFooterActions = false,
  onSavingChange,
  closeAfterSave = true,
  onSaved,
}: PageEditorProps) {
  const [pageId, setPageId] = useState<string | undefined>(initialData?.id);
  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [published, setPublished] = useState(initialData?.published || false);
  const [blocks, setBlocks] = useState<Block[]>(initialData?.blocks || []);
  const [loading, setLoading] = useState(false);
  const [blockEditorMode, setBlockEditorMode] = useState<Record<number, 'FORM' | 'JSON'>>({});
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);

  const addBlock = (type: string) => {
    let defaultContent = '{}';
    if (type === 'HERO') {
      defaultContent = JSON.stringify({
        layout: { widthMode: 'FULL', baseBackgroundMode: 'DARK', minHeightPx: 520 },
        slider: { enabled: true, autoplayMs: 8000, transitionMs: 1000, showDots: true, showArrows: true },
        slides: [
          {
            heading: 'Belajar Geosains Lebih Terarah',
            subheading: 'Materi terstruktur, kuis, tugas, dan sertifikat dalam satu platform.',
            background: { imageUrl: 'https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=2000&q=80', overlayOpacity: 55 },
            buttons: [
              { text: 'Jelajahi Kursus', href: '/courses', variant: 'PRIMARY' },
              { text: 'Masuk', href: '/login', variant: 'OUTLINE' }
            ]
          },
          {
            heading: 'Upgrade Skill Dengan Kurikulum Jelas',
            subheading: 'Belajar step-by-step dengan materi yang mudah diikuti dan progress yang terukur.',
            background: { imageUrl: 'https://images.unsplash.com/photo-1496307653780-42ee777d4833?auto=format&fit=crop&w=2000&q=80', overlayOpacity: 55 },
            buttons: [
              { text: 'Daftar', href: '/register', variant: 'PRIMARY', bgColor: '#10b981' },
              { text: 'Lihat Kursus', href: '/courses', variant: 'OUTLINE' }
            ]
          }
        ],
        heading: 'Belajar Geosains Lebih Terarah',
        subheading: 'Materi terstruktur, kuis, tugas, dan sertifikat dalam satu platform.',
        primaryCta: { text: 'Jelajahi Kursus', href: '/courses' },
        secondaryCta: { text: 'Masuk', href: '/login' },
      });
    }
    if (type === 'TEXT') defaultContent = JSON.stringify({ text: '<p>Tulis konten di sini...</p>', alignment: 'left' });
    if (type === 'FEATURES') {
      defaultContent = JSON.stringify({
        heading: 'Keunggulan Kami',
        features: [
          { title: 'Materi Terstruktur', description: 'Belajar step-by-step dengan kurikulum yang jelas.' },
          { title: 'Kuis & Tugas', description: 'Uji pemahaman dan dapatkan feedback.' },
          { title: 'Sertifikat', description: 'Terbit otomatis saat kursus selesai.' },
        ],
      });
    }
    if (type === 'COURSES') {
      defaultContent = JSON.stringify({
        heading: 'Kursus Populer',
        subheading: 'Pilih kursus terbaik untuk meningkatkan skill.',
        limit: 6,
        variant: 'grid',
        cta: { text: 'Lihat Semua Kursus', href: '/courses' },
      });
    }
    if (type === 'CTA') {
      defaultContent = JSON.stringify({
        heading: 'Siap Mulai Belajar?',
        subheading: 'Daftar sekarang dan mulai progres belajarmu hari ini.',
        buttonText: 'Daftar',
        buttonHref: '/register',
      });
    }
    if (type === 'GRID') {
      defaultContent = JSON.stringify(
        {
          heading: 'Layanan Kami',
          subheading: 'Pilih program yang sesuai kebutuhan Anda.',
          columns: 4,
          rows: 2,
          maxItems: 8,
          mobileTwoColumns: true,
          highlightEnabled: false,
          highlightIndex: null,
          highlightBgColor: '#2563eb',
          highlightTextColor: '#ffffff',
          items: [
            { title: 'Digital Single Course', description: 'Akses belajar kapanpun dan dimanapun, pelajari materi yang mudah dipahami', imageUrl: '', href: '' },
            { title: 'Geo Guidance', description: 'Bimbingan privat untuk fokus pada topik penelitian seluruh bidang geosains', imageUrl: '', href: '' },
            { title: 'Geo Bootcamp', description: 'Lebih intens dengan materi dan praktik langsung, kuasai skill saat Anda selesai belajar', imageUrl: '', href: '' },
            { title: 'Bestari Dive Center', description: 'Belajar menyelam aman dan profesional, mulai dari Bestari Dive Center', imageUrl: '', href: '' },
          ],
        } satisfies GridContent,
        null,
        2
      );
    }
    if (type === 'TESTIMONIALS') {
      defaultContent = JSON.stringify(
        {
          badgeText: 'Trusted By 900K+ Students',
          heading: 'Join Our Supportive Community 😊',
          subheading: 'GeoSains menyediakan komunitas belajar dan materi terstruktur untuk pemula hingga mahir.',
          backgroundFrom: '#070A1B',
          backgroundTo: '#0B1B3A',
          heightPx: 560,
          scrollSpeedPxPerSec: 18,
          motionMode: 'LOOP',
          buttons: [
            { text: 'Katalog Kelas', href: '/courses', variant: 'PRIMARY' },
            { text: 'Karya Students', href: '/courses', variant: 'OUTLINE' },
          ],
          testimonials: [
            { title: 'Berkualitas Tinggi', text: 'Materi jelas dan mudah diikuti dari awal sampai akhir.', authorName: 'Aqil', authorRole: 'Front-End Developer', avatarUrl: '' },
            { title: 'Pemula to Expert', text: 'Alur belajar rapi dan progres terasa banget.', authorName: 'Wahyu', authorRole: 'Mobile App Developer', avatarUrl: '' },
            { title: 'Always Up to Date', text: 'Materi mengikuti tools dan praktik terbaru.', authorName: 'Edi', authorRole: 'Full-Stack Developer', avatarUrl: '' },
            { title: 'Alur Belajar Jelas', text: 'Cocok untuk pemula yang mau naik level.', authorName: 'Rizqy', authorRole: 'UI/UX Designer', avatarUrl: '' },
            { title: 'Hemat Waktu', text: 'Penjelasan ringkas, langsung ke inti.', authorName: 'Evita', authorRole: 'UI/UX Designer', avatarUrl: '' },
            { title: 'Discover and Learn', text: 'Banyak insight baru di setiap kelasnya.', authorName: 'Sharen', authorRole: 'UI/UX Designer', avatarUrl: '' },
          ],
        },
        null,
        2
      );
    }
    if (type === 'FAQ') {
      defaultContent = JSON.stringify(
        {
          heading: 'Frequently Asked Questions',
          subheading: 'Pertanyaan yang sering ditanyakan seputar platform dan pembelajaran.',
          cta: { text: 'Hubungi Kami', href: '/profile' },
          items: [
            { question: 'Apakah kursus bisa diakses selamanya?', answer: 'Akses mengikuti kebijakan masing-masing kursus. Untuk kursus gratis umumnya bisa diakses kapan saja.' },
            { question: 'Bagaimana cara mendaftar kursus?', answer: 'Buka halaman Kursus, pilih kursus yang diinginkan, lalu ikuti instruksi pendaftaran.' },
            { question: 'Apakah ada sertifikat?', answer: 'Jika kursus menyediakan sertifikat, sertifikat akan tersedia setelah progres belajar selesai.' },
          ],
        },
        null,
        2
      );
    }
    if (type === 'LOGOS') {
      defaultContent = JSON.stringify(
        {
          heading: 'Telah Bekerjasama Dengan',
          subheading: 'Beberapa organisasi yang pernah berkolaborasi bersama kami.',
          layout: 'MARQUEE',
          grayscale: true,
          logoHeightPx: 36,
          durationSec: 22,
          items: [
            { name: 'Company A', imageUrl: '', href: '' },
            { name: 'Company B', imageUrl: '', href: '' },
            { name: 'Company C', imageUrl: '', href: '' },
            { name: 'Company D', imageUrl: '', href: '' },
            { name: 'Company E', imageUrl: '', href: '' },
            { name: 'Company F', imageUrl: '', href: '' },
          ],
        },
        null,
        2
      );
    }
    if (type === 'VENDORS') {
      defaultContent = JSON.stringify(
        {
          heading: 'Vendor Terverifikasi',
          subheading: 'Temukan vendor yang sudah terverifikasi dan memiliki produk berkualitas.',
          limit: 6,
          sort: 'TOP',
          cta: { text: 'Lihat Semua Vendor', href: '/geoservices' },
        },
        null,
        2
      );
    }
    if (type === 'GALLERY') {
      defaultContent = JSON.stringify(
        {
          heading: 'Galeri Kegiatan',
          subheading: 'Dokumentasi kegiatan, pelatihan, dan kolaborasi.',
          columns: 4,
          mobileColumns: 2,
          imageHeightPx: 220,
          showCaptions: true,
          items: [
            { imageUrl: '', caption: 'Foto 1', href: '' },
            { imageUrl: '', caption: 'Foto 2', href: '' },
            { imageUrl: '', caption: 'Foto 3', href: '' },
            { imageUrl: '', caption: 'Foto 4', href: '' },
          ],
        },
        null,
        2
      );
    }
    if (type === 'SECTION') {
      const section: SectionContent = {
        id: createId('section'),
        layout: { maxWidth: 'BOXED', paddingY: 'MD', columnsGap: 'MD' },
        columns: [{ id: createId('col'), widgets: [] }],
      };
      defaultContent = JSON.stringify(section, null, 2);
    }

    setBlocks([...blocks, { type, content: defaultContent, order: blocks.length }]);
  };

  const updateBlockContent = (index: number, content: string) => {
    const newBlocks = [...blocks];
    newBlocks[index].content = content;
    setBlocks(newBlocks);
  };

  const setMode = (index: number, mode: 'FORM' | 'JSON') => {
    setBlockEditorMode((prev) => ({ ...prev, [index]: mode }));
  };

  const removeBlock = (index: number) => {
    const next = blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i }));
    setBlocks(next);
    setSelectedBlockIndex((prev) => {
      if (next.length === 0) return 0;
      if (prev > index) return prev - 1;
      if (prev === index) return 0;
      return prev;
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.index === source.index) return;

    const next = [...blocks];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);

    const withOrder = next.map((b, i) => ({ ...b, order: i }));
    setBlocks(withOrder);
    setSelectedBlockIndex(destination.index);
  };

  const blockTitle = (block: Block) => {
    const parsed = safeJsonParse(block.content);
    if (!parsed.ok) return '';
    const data = parsed.data;
    if (typeof data !== 'object' || data === null) return '';
    const heading = (data as { heading?: unknown }).heading;
    return typeof heading === 'string' ? heading : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onSavingChange?.(true);

    try {
      const url = pageId 
        ? `/api/pages/${pageId}` 
        : '/api/pages';
      const method = pageId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug: slug.trim() || undefined, published, blocks }),
      });

      if (res.ok) {
        const saved = await res.json().catch(() => null);
        if (saved?.id && typeof saved.id === 'string') setPageId(saved.id);
        if (saved?.slug && typeof saved.slug === 'string') setSlug(saved.slug);
        toast.success('Halaman berhasil disimpan');
        onSaved?.(saved);
        if (closeAfterSave) onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menyimpan halaman');
      }
    } catch {
      toast.error('Gagal menyimpan halaman');
    } finally {
      setLoading(false);
      onSavingChange?.(false);
    }
  };

  return (
    <form id={formId} className="space-y-6" onSubmit={handleSubmit}>
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700">Judul Halaman</label>
            <input
              type="text"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700">Slug</label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="contoh: home"
            />
          </div>
        </div>
        <label className="flex items-center gap-3">
          <input
            id="published"
            type="checkbox"
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span className="text-sm font-bold text-slate-700">Terbitkan Halaman</span>
        </label>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Page Builder</h3>
            <div className="text-xs text-slate-500 mt-0.5">Drag & drop blok, lalu atur detail di panel kanan.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {slug.trim() ? (
              <Link
                href={`/preview/${encodeURIComponent(slug.trim())}`}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                <Eye className="w-4 h-4" />
                Preview
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => toast.error('Isi slug dan simpan halaman dulu untuk preview')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-white">
              <div className="text-sm font-bold text-slate-900">Blok</div>
              <div className="text-xs text-slate-500 mt-0.5">Pilih blok untuk mengedit.</div>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {['SECTION', 'HERO', 'GRID', 'COURSES', 'CTA', 'FEATURES', 'TEXT', 'TESTIMONIALS', 'FAQ', 'LOGOS', 'VENDORS', 'GALLERY', 'BLOG'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      addBlock(type);
                      setSelectedBlockIndex(blocks.length);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold hover:bg-indigo-100 border border-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" /> {type}
                  </button>
                ))}
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="page-blocks">
                  {(dropProvided) => (
                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-2 mt-3">
                      {blocks.map((block, index) => {
                        const isSelected = index === selectedBlockIndex;
                        const title = blockTitle(block);
                        return (
                          <Draggable key={`${block.type}-${index}`} draggableId={`${block.type}-${index}`} index={index}>
                            {(dragProvided) => (
                              <button
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                type="button"
                                onClick={() => setSelectedBlockIndex(index)}
                                className={`w-full text-left rounded-2xl border px-3 py-3 bg-white transition-colors ${
                                  isSelected
                                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                                    : 'border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 mt-0.5"
                                    aria-label="Drag"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-xs font-bold text-slate-900">{block.type}</div>
                                      <div className="text-[11px] text-slate-400 font-medium">#{index + 1}</div>
                                    </div>
                                    {title ? (
                                      <div className="text-xs text-slate-600 mt-1 line-clamp-2">{title}</div>
                                    ) : (
                                      <div className="text-xs text-slate-400 mt-1">Klik untuk atur</div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            )}
                          </Draggable>
                        );
                      })}
                      {dropProvided.placeholder}
                      {blocks.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-200 rounded-2xl bg-white">
                          Belum ada blok. Tambahkan blok untuk mulai.
                        </div>
                      ) : null}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">Pengaturan</div>
                <div className="text-xs text-slate-500 mt-0.5">Edit blok terpilih.</div>
              </div>
              {blocks[selectedBlockIndex] ? (
                <button
                  type="button"
                  onClick={() => removeBlock(selectedBlockIndex)}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                  title="Hapus blok"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            <div className="p-4">
              {blocks[selectedBlockIndex] ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-700">{blocks[selectedBlockIndex].type}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMode(selectedBlockIndex, 'FORM')}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                          (blockEditorMode[selectedBlockIndex] || 'FORM') === 'FORM'
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Settings2 className="w-4 h-4" /> Form
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode(selectedBlockIndex, 'JSON')}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                          (blockEditorMode[selectedBlockIndex] || 'FORM') === 'JSON'
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Code2 className="w-4 h-4" /> JSON
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const block = blocks[selectedBlockIndex];
                    const mode = blockEditorMode[selectedBlockIndex] || 'FORM';
                    if (mode === 'JSON') {
                      return (
                        <textarea
                          rows={18}
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          value={block.content}
                          onChange={(e) => updateBlockContent(selectedBlockIndex, e.target.value)}
                        />
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <BlockSpacingEditor content={block.content} onChange={(next) => updateBlockContent(selectedBlockIndex, next)} />

                        {block.type === 'HERO' ? (
                          <HeroBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'SECTION' ? (
                          <SectionBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'GRID' ? (
                          <GridBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'COURSES' ? (
                          <CoursesBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'TESTIMONIALS' ? (
                          <TestimonialsBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'FAQ' ? (
                          <FaqBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'LOGOS' ? (
                          <LogosBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'VENDORS' ? (
                          <VendorsBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'GALLERY' ? (
                          <GalleryBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : block.type === 'CTA' ? (
                          <CtaBlockEditor
                            content={block.content}
                            onChange={(next) => updateBlockContent(selectedBlockIndex, next)}
                            onSwitchToJson={() => setMode(selectedBlockIndex, 'JSON')}
                          />
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-bold text-slate-900">Form belum tersedia</div>
                            <div className="text-xs text-slate-600 mt-1">Untuk saat ini gunakan mode JSON untuk blok {block.type}.</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-sm text-slate-500">Tambahkan blok lalu pilih untuk mengedit.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!hideFooterActions ? (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-bold"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      ) : null}
    </form>
  );
}

function CoursesBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten COURSES tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  const data = (parsed.data || {}) as {
    heading?: string;
    subheading?: string;
    limit?: number;
    variant?: string;
    publicOnly?: boolean;
    cta?: { text?: string; href?: string };
  };

  const setData = (next: typeof data) => onChange(JSON.stringify(next, null, 2));

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Konten" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Judul</label>
            <input
              value={data.heading || ''}
              onChange={(e) => setData({ ...data, heading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Kursus Populer"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={2}
              value={data.subheading || ''}
              onChange={(e) => setData({ ...data, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Deskripsi singkat"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Jumlah Kursus</label>
              <input
                type="number"
                min={1}
                max={24}
                value={typeof data.limit === 'number' ? data.limit : 6}
                onChange={(e) => setData({ ...data, limit: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Tampilan</label>
              <select
                value={data.variant || 'grid'}
                onChange={(e) => setData({ ...data, variant: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="grid">Grid</option>
              </select>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Hanya Kursus Publik</div>
              <div className="text-xs text-slate-600 mt-0.5">Jika dicentang, hanya menampilkan kursus dengan isPublic = true.</div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
              checked={data.publicOnly === true}
              onChange={(e) => setData({ ...data, publicOnly: e.target.checked })}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="CTA (Opsional)" defaultOpen={false}>
        <div className="space-y-2">
          <input
            value={data.cta?.text || ''}
            onChange={(e) => setData({ ...data, cta: { ...(data.cta || {}), text: e.target.value } })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Teks tombol, contoh: Lihat Semua Kursus"
          />
          <input
            value={data.cta?.href || ''}
            onChange={(e) => setData({ ...data, cta: { ...(data.cta || {}), href: e.target.value } })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Link tombol, contoh: /courses"
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function CtaBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten CTA tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  const data = (parsed.data || {}) as {
    heading?: string;
    subheading?: string;
    buttonText?: string;
    buttonHref?: string;
    buttonLink?: string;
  };

  const setData = (next: typeof data) => onChange(JSON.stringify(next, null, 2));

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Konten" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Judul</label>
            <input
              value={data.heading || ''}
              onChange={(e) => setData({ ...data, heading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Siap Mulai Belajar?"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={2}
              value={data.subheading || ''}
              onChange={(e) => setData({ ...data, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Deskripsi singkat"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Tombol" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Teks Tombol</label>
            <input
              value={data.buttonText || ''}
              onChange={(e) => setData({ ...data, buttonText: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Daftar"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Link Tombol</label>
            <input
              value={data.buttonHref || data.buttonLink || ''}
              onChange={(e) => setData({ ...data, buttonHref: e.target.value, buttonLink: undefined })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="/register"
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function TestimonialsBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten TESTIMONIALS tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  type TestimonialsItem = {
    title?: string;
    text?: string;
    authorName?: string;
    authorRole?: string;
    avatarUrl?: string;
  };

  const data = (parsed.data || {}) as {
    badgeText?: string;
    heading?: string;
    subheading?: string;
    backgroundFrom?: string;
    backgroundTo?: string;
    heightPx?: number;
    scrollSpeedPxPerSec?: number;
    motionMode?: 'BOUNCE' | 'LOOP';
    buttons?: HeroButton[];
    testimonials?: TestimonialsItem[];
  };

  const setData = (next: typeof data) => onChange(JSON.stringify(next, null, 2));
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const items = Array.isArray(data.testimonials) ? data.testimonials : [];

  const updateButton = (index: number, updater: (prev: HeroButton) => HeroButton) => {
    const next = buttons.map((b, i) => (i === index ? updater(b || {}) : b));
    setData({ ...data, buttons: next });
  };

  const addButton = () => {
    setData({ ...data, buttons: [...buttons, { text: 'Tombol', href: '/courses', variant: 'PRIMARY' }] });
  };

  const removeButton = (index: number) => {
    setData({ ...data, buttons: buttons.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, updater: (prev: TestimonialsItem) => TestimonialsItem) => {
    const next = items.map((it, i) => (i === index ? updater(it || {}) : it));
    setData({ ...data, testimonials: next });
  };

  const addItem = () => {
    setData({
      ...data,
      testimonials: [
        ...items,
        { title: 'Judul', text: 'Tulis ulasan di sini', authorName: 'Nama', authorRole: 'Role', avatarUrl: '' },
      ],
    });
  };

  const removeItem = (index: number) => {
    setData({ ...data, testimonials: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Konten" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Badge</label>
            <input
              value={data.badgeText || ''}
              onChange={(e) => setData({ ...data, badgeText: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Trusted By 900K+ Students"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Judul</label>
            <input
              value={data.heading || ''}
              onChange={(e) => setData({ ...data, heading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Join Our Supportive Community 😊"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={3}
              value={data.subheading || ''}
              onChange={(e) => setData({ ...data, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Tampilan" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Background From</label>
            <input
              value={data.backgroundFrom || ''}
              onChange={(e) => setData({ ...data, backgroundFrom: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="#070A1B"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Background To</label>
            <input
              value={data.backgroundTo || ''}
              onChange={(e) => setData({ ...data, backgroundTo: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="#0B1B3A"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Tinggi (px)</label>
            <input
              type="number"
              min={320}
              max={900}
              value={typeof data.heightPx === 'number' ? data.heightPx : 560}
              onChange={(e) => setData({ ...data, heightPx: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Kecepatan Scroll</label>
            <input
              type="number"
              min={1}
              max={80}
              value={typeof data.scrollSpeedPxPerSec === 'number' ? data.scrollSpeedPxPerSec : 18}
              onChange={(e) => setData({ ...data, scrollSpeedPxPerSec: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-slate-600">Mode Motion</label>
            <select
              value={data.motionMode === 'LOOP' ? 'LOOP' : 'BOUNCE'}
              onChange={(e) => {
                const v = e.target.value === 'LOOP' ? 'LOOP' : 'BOUNCE';
                setData({ ...data, motionMode: v });
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="LOOP">LOOP (Infinity)</option>
              <option value="BOUNCE">BOUNCE (Balik Arah)</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Tombol" defaultOpen={false}>
        <div className="space-y-3">
          <button
            type="button"
            onClick={addButton}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Tambah Tombol
          </button>
          {buttons.map((b, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-900">Tombol #{idx + 1}</div>
                <button
                  type="button"
                  onClick={() => removeButton(idx)}
                  className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Teks</label>
                  <input
                    value={b.text || ''}
                    onChange={(e) => updateButton(idx, (prev) => ({ ...prev, text: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Link</label>
                  <input
                    value={b.href || ''}
                    onChange={(e) => updateButton(idx, (prev) => ({ ...prev, href: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600">Varian</label>
                  <select
                    value={b.variant || 'PRIMARY'}
                    onChange={(e) => {
                      const v = e.target.value as HeroButtonVariant;
                      updateButton(idx, (prev) => ({ ...prev, variant: v }));
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="PRIMARY">PRIMARY</option>
                    <option value="SECONDARY">SECONDARY</option>
                    <option value="OUTLINE">OUTLINE</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Ulasan" defaultOpen={false}>
        <div className="space-y-3">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Tambah Ulasan
          </button>
          {items.map((it, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-900">Ulasan #{idx + 1}</div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Judul</label>
                <input
                  value={it.title || ''}
                  onChange={(e) => updateItem(idx, (prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Konten</label>
                <textarea
                  rows={2}
                  value={it.text || ''}
                  onChange={(e) => updateItem(idx, (prev) => ({ ...prev, text: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Nama</label>
                  <input
                    value={it.authorName || ''}
                    onChange={(e) => updateItem(idx, (prev) => ({ ...prev, authorName: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Role</label>
                  <input
                    value={it.authorRole || ''}
                    onChange={(e) => updateItem(idx, (prev) => ({ ...prev, authorRole: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Avatar URL (opsional)</label>
                <input
                  value={it.avatarUrl || ''}
                  onChange={(e) => updateItem(idx, (prev) => ({ ...prev, avatarUrl: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function FaqBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten FAQ tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  type FaqItem = { question?: string; answer?: string };

  const data = (parsed.data || {}) as {
    heading?: string;
    subheading?: string;
    items?: FaqItem[];
    cta?: { text?: string; href?: string };
  };

  const setData = (next: typeof data) => onChange(JSON.stringify(next, null, 2));
  const items = Array.isArray(data.items) ? data.items : [];

  const updateItem = (index: number, updater: (prev: FaqItem) => FaqItem) => {
    const next = items.map((it, i) => (i === index ? updater(it || {}) : it));
    setData({ ...data, items: next });
  };

  const addItem = () => {
    setData({ ...data, items: [...items, { question: 'Pertanyaan', answer: 'Jawaban' }] });
  };

  const removeItem = (index: number) => {
    setData({ ...data, items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Konten" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Judul</label>
            <input
              value={data.heading || ''}
              onChange={(e) => setData({ ...data, heading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Frequently Asked Questions"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={2}
              value={data.subheading || ''}
              onChange={(e) => setData({ ...data, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Deskripsi singkat"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="CTA (Opsional)" defaultOpen={false}>
        <div className="space-y-2">
          <input
            value={data.cta?.text || ''}
            onChange={(e) => setData({ ...data, cta: { ...(data.cta || {}), text: e.target.value } })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Teks tombol, contoh: Hubungi Kami"
          />
          <input
            value={data.cta?.href || ''}
            onChange={(e) => setData({ ...data, cta: { ...(data.cta || {}), href: e.target.value } })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Link tombol, contoh: /contact"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Pertanyaan" defaultOpen={false}>
        <div className="space-y-3">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Tambah Pertanyaan
          </button>

          {items.map((it, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-900">FAQ #{idx + 1}</div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Pertanyaan</label>
                <input
                  value={it.question || ''}
                  onChange={(e) => updateItem(idx, (prev) => ({ ...prev, question: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Jawaban</label>
                <textarea
                  rows={3}
                  value={it.answer || ''}
                  onChange={(e) => updateItem(idx, (prev) => ({ ...prev, answer: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function LogosBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaInitialTab, setMediaInitialTab] = useState<'GALLERY' | 'UPLOAD'>('GALLERY');
  const [mediaItemIndex, setMediaItemIndex] = useState<number | null>(null);

  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten LOGOS tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  type LogoItem = { name?: string; imageUrl?: string; href?: string };
  const data = (parsed.data || {}) as {
    heading?: string;
    subheading?: string;
    layout?: 'GRID' | 'MARQUEE';
    grayscale?: boolean;
    logoHeightPx?: number;
    durationSec?: number;
    items?: LogoItem[];
  };

  const setData = (next: typeof data) => onChange(JSON.stringify(next, null, 2));
  const items = Array.isArray(data.items) ? data.items : [];

  const updateItem = (index: number, updater: (prev: LogoItem) => LogoItem) => {
    const next = items.map((it, i) => (i === index ? updater(it || {}) : it));
    setData({ ...data, items: next });
  };

  const addItem = () => {
    setData({ ...data, items: [...items, { name: 'Company', imageUrl: '', href: '' }] });
  };

  const removeItem = (index: number) => {
    setData({ ...data, items: items.filter((_, i) => i !== index) });
  };

  const openMediaForItem = (index: number, initialTab: 'GALLERY' | 'UPLOAD' = 'GALLERY') => {
    setMediaItemIndex(index);
    setMediaInitialTab(initialTab);
    setIsMediaModalOpen(true);
  };

  const addItemAndOpenMedia = (initialTab: 'GALLERY' | 'UPLOAD' = 'GALLERY') => {
    const nextIndex = items.length;
    setData({ ...data, items: [...items, { name: '', imageUrl: '', href: '' }] });
    openMediaForItem(nextIndex, initialTab);
  };

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Konten" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Judul</label>
            <input
              value={data.heading || ''}
              onChange={(e) => setData({ ...data, heading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Telah Bekerjasama Dengan"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={2}
              value={data.subheading || ''}
              onChange={(e) => setData({ ...data, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Deskripsi singkat"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Tampilan" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Layout</label>
            <select
              value={data.layout === 'MARQUEE' ? 'MARQUEE' : 'GRID'}
              onChange={(e) => setData({ ...data, layout: e.target.value === 'MARQUEE' ? 'MARQUEE' : 'GRID' })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="MARQUEE">MARQUEE</option>
              <option value="GRID">GRID</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Tinggi Logo (px)</label>
            <input
              type="number"
              min={16}
              max={96}
              value={typeof data.logoHeightPx === 'number' ? data.logoHeightPx : 36}
              onChange={(e) => setData({ ...data, logoHeightPx: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Durasi Marquee (detik)</label>
            <input
              type="number"
              min={8}
              max={120}
              value={typeof data.durationSec === 'number' ? data.durationSec : 22}
              onChange={(e) => setData({ ...data, durationSec: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="logos-grayscale"
              type="checkbox"
              checked={Boolean(data.grayscale)}
              onChange={(e) => setData({ ...data, grayscale: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="logos-grayscale" className="text-sm font-semibold text-slate-700">
              Grayscale
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Logo" defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => addItemAndOpenMedia('GALLERY')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> Upload Logo
            </button>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" /> Tambah Manual
            </button>
          </div>

          {items.map((it, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-900">Logo #{idx + 1}</div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Nama</label>
                  <input
                    value={it.name || ''}
                    onChange={(e) => updateItem(idx, (prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Link (opsional)</label>
                  <input
                    value={it.href || ''}
                    onChange={(e) => updateItem(idx, (prev) => ({ ...prev, href: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Logo URL</label>
                <input
                  value={it.imageUrl || ''}
                  onChange={(e) => updateItem(idx, (prev) => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="https://..."
                />
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => openMediaForItem(idx, 'GALLERY')}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 w-full sm:w-auto"
                  >
                    Upload / Pilih Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(idx, (prev) => ({ ...prev, imageUrl: '' }))}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-red-600 font-bold text-xs hover:bg-red-50 w-full sm:w-auto"
                  >
                    Hapus Logo
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <MediaPickerModal
        isOpen={isMediaModalOpen}
        onClose={() => {
          setIsMediaModalOpen(false);
          setMediaItemIndex(null);
        }}
        initialTab={mediaInitialTab}
        onSelect={(asset) => {
          if (mediaItemIndex === null) return;
          updateItem(mediaItemIndex, (prev) => ({ ...prev, imageUrl: asset.url }));
          setIsMediaModalOpen(false);
          setMediaItemIndex(null);
        }}
      />
    </div>
  );
}

function VendorsBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten VENDORS tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  const data = (parsed.data || {}) as {
    heading?: string;
    subheading?: string;
    limit?: number;
    sort?: 'TOP' | 'NEWEST' | 'NAME_ASC';
    cta?: { text?: string; href?: string };
  };

  const setData = (next: typeof data) => onChange(JSON.stringify(next, null, 2));

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Konten" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Judul</label>
            <input
              value={data.heading || ''}
              onChange={(e) => setData({ ...data, heading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Vendor Terverifikasi"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={2}
              value={data.subheading || ''}
              onChange={(e) => setData({ ...data, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Pengaturan" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Jumlah (limit)</label>
            <input
              type="number"
              min={1}
              max={24}
              value={typeof data.limit === 'number' ? data.limit : 6}
              onChange={(e) => setData({ ...data, limit: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Sort</label>
            <select
              value={data.sort === 'NEWEST' || data.sort === 'NAME_ASC' ? data.sort : 'TOP'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'TOP' || v === 'NEWEST' || v === 'NAME_ASC') setData({ ...data, sort: v });
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="TOP">Teratas</option>
              <option value="NEWEST">Terbaru</option>
              <option value="NAME_ASC">Nama A–Z</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="CTA (Opsional)" defaultOpen={false}>
        <div className="space-y-2">
          <input
            value={data.cta?.text || ''}
            onChange={(e) => setData({ ...data, cta: { ...(data.cta || {}), text: e.target.value } })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Teks tombol, contoh: Lihat Semua Vendor"
          />
          <input
            value={data.cta?.href || ''}
            onChange={(e) => setData({ ...data, cta: { ...(data.cta || {}), href: e.target.value } })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="Link tombol, contoh: /geoservices"
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function GalleryBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaInitialTab, setMediaInitialTab] = useState<'GALLERY' | 'UPLOAD'>('GALLERY');
  const [mediaItemIndex, setMediaItemIndex] = useState<number | null>(null);

  const parsed = useMemo(() => safeJsonParse(content), [content]);
  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten GALLERY tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  type GalleryItem = { imageUrl?: string; caption?: string; href?: string };
  const data = (parsed.data || {}) as {
    heading?: string;
    subheading?: string;
    columns?: number;
    mobileColumns?: 1 | 2;
    imageHeightPx?: number;
    showCaptions?: boolean;
    items?: GalleryItem[];
  };

  const setData = (next: typeof data) => onChange(JSON.stringify(next, null, 2));
  const items = Array.isArray(data.items) ? data.items : [];

  const updateItem = (index: number, updater: (prev: GalleryItem) => GalleryItem) => {
    const next = items.map((it, i) => (i === index ? updater(it || {}) : it));
    setData({ ...data, items: next });
  };

  const addItem = () => {
    setData({ ...data, items: [...items, { imageUrl: '', caption: '', href: '' }] });
  };

  const removeItem = (index: number) => {
    setData({ ...data, items: items.filter((_, i) => i !== index) });
  };

  const openMediaForItem = (index: number, initialTab: 'GALLERY' | 'UPLOAD' = 'GALLERY') => {
    setMediaItemIndex(index);
    setMediaInitialTab(initialTab);
    setIsMediaModalOpen(true);
  };

  const addItemAndOpenMedia = (initialTab: 'GALLERY' | 'UPLOAD' = 'GALLERY') => {
    const nextIndex = items.length;
    setData({ ...data, items: [...items, { imageUrl: '', caption: '', href: '' }] });
    openMediaForItem(nextIndex, initialTab);
  };

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Konten" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Judul</label>
            <input
              value={data.heading || ''}
              onChange={(e) => setData({ ...data, heading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Galeri"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={2}
              value={data.subheading || ''}
              onChange={(e) => setData({ ...data, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Tampilan" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Kolom (Desktop)</label>
            <input
              type="number"
              min={2}
              max={6}
              value={typeof data.columns === 'number' ? data.columns : 4}
              onChange={(e) => setData({ ...data, columns: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Kolom (Mobile)</label>
            <select
              value={data.mobileColumns === 2 ? 2 : 1}
              onChange={(e) => setData({ ...data, mobileColumns: e.target.value === '2' ? 2 : 1 })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value={1}>1 Kolom</option>
              <option value={2}>2 Kolom</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Tinggi Gambar (px)</label>
            <input
              type="number"
              min={120}
              max={520}
              value={typeof data.imageHeightPx === 'number' ? data.imageHeightPx : 220}
              onChange={(e) => setData({ ...data, imageHeightPx: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="gallery-captions"
              type="checkbox"
              checked={data.showCaptions !== false}
              onChange={(e) => setData({ ...data, showCaptions: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="gallery-captions" className="text-sm font-semibold text-slate-700">
              Tampilkan Caption
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Gambar" defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => addItemAndOpenMedia('GALLERY')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> Upload Gambar
            </button>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" /> Tambah Manual
            </button>
          </div>

          {items.map((it, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-900">Gambar #{idx + 1}</div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Gambar URL</label>
                <input
                  value={it.imageUrl || ''}
                  onChange={(e) => updateItem(idx, (prev) => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="https://..."
                />
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => openMediaForItem(idx, 'GALLERY')}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 w-full sm:w-auto"
                  >
                    Upload / Pilih Gambar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(idx, (prev) => ({ ...prev, imageUrl: '' }))}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-red-600 font-bold text-xs hover:bg-red-50 w-full sm:w-auto"
                  >
                    Hapus Gambar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Caption (opsional)</label>
                  <input
                    value={it.caption || ''}
                    onChange={(e) => updateItem(idx, (prev) => ({ ...prev, caption: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Link (opsional)</label>
                  <input
                    value={it.href || ''}
                    onChange={(e) => updateItem(idx, (prev) => ({ ...prev, href: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <MediaPickerModal
        isOpen={isMediaModalOpen}
        onClose={() => {
          setIsMediaModalOpen(false);
          setMediaItemIndex(null);
        }}
        initialTab={mediaInitialTab}
        onSelect={(asset) => {
          if (mediaItemIndex === null) return;
          updateItem(mediaItemIndex, (prev) => ({ ...prev, imageUrl: asset.url }));
          setIsMediaModalOpen(false);
          setMediaItemIndex(null);
        }}
      />
    </div>
  );
}

function GridBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaItemIndex, setMediaItemIndex] = useState<number | null>(null);
  const [mediaInitialTab, setMediaInitialTab] = useState<'GALLERY' | 'UPLOAD'>('GALLERY');

  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten GRID tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  const grid = (parsed.data || {}) as Partial<GridContent>;
  const items = Array.isArray(grid.items) ? grid.items : [];

  const safeGrid: GridContent = {
    heading: typeof grid.heading === 'string' ? grid.heading : '',
    subheading: typeof grid.subheading === 'string' ? grid.subheading : '',
    columns: typeof grid.columns === 'number' && Number.isFinite(grid.columns) ? clampNumber(Math.round(grid.columns), 1, 10) : 4,
    rows: typeof grid.rows === 'number' && Number.isFinite(grid.rows) ? clampNumber(Math.round(grid.rows), 1, 50) : undefined,
    maxItems:
      typeof grid.maxItems === 'number' && Number.isFinite(grid.maxItems) ? clampNumber(Math.round(grid.maxItems), 1, 500) : undefined,
    mobileTwoColumns: grid.mobileTwoColumns === true,
    highlightEnabled: grid.highlightEnabled === true,
    highlightIndex: typeof grid.highlightIndex === 'number' && Number.isFinite(grid.highlightIndex) ? Math.round(grid.highlightIndex) : null,
    highlightIndexes: Array.isArray(grid.highlightIndexes)
      ? Array.from(
          new Set(
            grid.highlightIndexes
              .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
              .map((v) => Math.round(v))
              .filter((v) => v >= 0 && v < items.length)
          )
        )
      : typeof grid.highlightIndex === 'number' && Number.isFinite(grid.highlightIndex)
        ? [Math.round(grid.highlightIndex)]
        : [],
    highlightBgColor: typeof grid.highlightBgColor === 'string' ? grid.highlightBgColor : '#2563eb',
    highlightTextColor: typeof grid.highlightTextColor === 'string' ? grid.highlightTextColor : '#ffffff',
    items: items
      .map((it) => ({
        title: typeof it.title === 'string' ? it.title : '',
        description: typeof it.description === 'string' ? it.description : '',
        imageUrl: typeof it.imageUrl === 'string' ? it.imageUrl : undefined,
        href: typeof it.href === 'string' ? it.href : undefined,
        bgColor: typeof it.bgColor === 'string' ? it.bgColor : undefined,
        textColor: typeof it.textColor === 'string' ? it.textColor : undefined,
      }))
      .filter((it) => it.title || it.description),
  };

  const setGrid = (next: GridContent) => onChange(JSON.stringify(next, null, 2));

  const updateItem = (index: number, updater: (prev: GridItem) => GridItem) => {
    const nextItems = [...safeGrid.items];
    const prevItem = nextItems[index] || { title: '', description: '' };
    nextItems[index] = updater(prevItem);
    setGrid({ ...safeGrid, items: nextItems });
  };

  const addItem = () => {
    setGrid({
      ...safeGrid,
      items: [...safeGrid.items, { title: 'Item Baru', description: 'Deskripsi singkat', imageUrl: '', href: '' }],
    });
  };

  const removeItem = (index: number) => {
    const nextItems = safeGrid.items.filter((_, i) => i !== index);
    const normalizedHighlights = Array.isArray(safeGrid.highlightIndexes) ? safeGrid.highlightIndexes : [];
    const nextHighlightIndexes = normalizedHighlights
      .filter((v) => v !== index)
      .map((v) => (v > index ? v - 1 : v))
      .filter((v) => v >= 0 && v < nextItems.length);
    const nextHighlightIndex = nextHighlightIndexes.length > 0 ? nextHighlightIndexes[0] : null;
    setGrid({ ...safeGrid, items: nextItems, highlightIndexes: nextHighlightIndexes, highlightIndex: nextHighlightIndex });
  };

  const openMediaForItem = (index: number, tab: 'GALLERY' | 'UPLOAD') => {
    setMediaItemIndex(index);
    setMediaInitialTab(tab);
    setIsMediaModalOpen(true);
  };

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Header & Layout" defaultOpen>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Judul</label>
              <input
                value={safeGrid.heading || ''}
                onChange={(e) => setGrid({ ...safeGrid, heading: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="Layanan Kami"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Kolom (Desktop)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={typeof safeGrid.columns === 'number' ? safeGrid.columns : 4}
                onChange={(e) => {
                  const next = e.target.value === '' ? 4 : Number(e.target.value);
                  setGrid({ ...safeGrid, columns: Number.isFinite(next) ? next : 4 });
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="1-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Baris (opsional)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={typeof safeGrid.rows === 'number' ? safeGrid.rows : ''}
                onChange={(e) => {
                  const next = e.target.value === '' ? undefined : Number(e.target.value);
                  setGrid({ ...safeGrid, rows: typeof next === 'number' && Number.isFinite(next) ? next : undefined });
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="contoh: 2"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Jumlah Item Ditampilkan (opsional)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={typeof safeGrid.maxItems === 'number' ? safeGrid.maxItems : ''}
                onChange={(e) => {
                  const next = e.target.value === '' ? undefined : Number(e.target.value);
                  setGrid({ ...safeGrid, maxItems: typeof next === 'number' && Number.isFinite(next) ? next : undefined });
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="contoh: 8"
              />
              <div className="text-[11px] text-slate-500">Jika Baris diisi, maksimal tampil = Baris × Kolom.</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Subjudul</label>
            <textarea
              rows={2}
              value={safeGrid.subheading || ''}
              onChange={(e) => setGrid({ ...safeGrid, subheading: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Deskripsi singkat"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Responsif" defaultOpen={false}>
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900">Mobile 2 Kolom</div>
            <div className="text-xs text-slate-600 mt-0.5">Jika dicentang, grid di mobile menjadi 2 kolom.</div>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
            checked={safeGrid.mobileTwoColumns === true}
            onChange={(e) => setGrid({ ...safeGrid, mobileTwoColumns: e.target.checked })}
          />
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Highlight" defaultOpen={false}>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Aktifkan Highlight</div>
              <div className="text-xs text-slate-600 mt-0.5">Jika aktif, pilih card yang ingin dibedakan.</div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
              checked={safeGrid.highlightEnabled === true}
              onChange={(e) =>
                setGrid({
                  ...safeGrid,
                  highlightEnabled: e.target.checked,
                  highlightIndex: e.target.checked ? safeGrid.highlightIndex : null,
                  highlightIndexes: e.target.checked ? (safeGrid.highlightIndexes || []) : [],
                })
              }
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Warna Highlight</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <input
                  type="color"
                  value={safeGrid.highlightBgColor || '#2563eb'}
                  onChange={(e) => setGrid({ ...safeGrid, highlightBgColor: e.target.value })}
                  className="w-10 h-7 rounded"
                  aria-label="Pilih warna highlight"
                  disabled={!safeGrid.highlightEnabled}
                />
                <input
                  type="text"
                  value={safeGrid.highlightBgColor || ''}
                  onChange={(e) => setGrid({ ...safeGrid, highlightBgColor: e.target.value })}
                  className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
                  placeholder="#2563eb"
                  disabled={!safeGrid.highlightEnabled}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Warna Teks Highlight</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <input
                  type="color"
                  value={safeGrid.highlightTextColor || '#ffffff'}
                  onChange={(e) => setGrid({ ...safeGrid, highlightTextColor: e.target.value })}
                  className="w-10 h-7 rounded"
                  aria-label="Pilih warna teks highlight"
                  disabled={!safeGrid.highlightEnabled}
                />
                <input
                  type="text"
                  value={safeGrid.highlightTextColor || ''}
                  onChange={(e) => setGrid({ ...safeGrid, highlightTextColor: e.target.value })}
                  className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
                  placeholder="#ffffff"
                  disabled={!safeGrid.highlightEnabled}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-600">
                Card yang di-highlight ({(safeGrid.highlightIndexes || []).length})
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!safeGrid.highlightEnabled || safeGrid.items.length === 0}
                  onClick={() => {
                    const next = safeGrid.items.map((_, idx) => idx);
                    setGrid({ ...safeGrid, highlightIndexes: next, highlightIndex: next[0] ?? null });
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-60"
                >
                  Pilih semua
                </button>
                <button
                  type="button"
                  disabled={!safeGrid.highlightEnabled || (safeGrid.highlightIndexes || []).length === 0}
                  onClick={() => setGrid({ ...safeGrid, highlightIndexes: [], highlightIndex: null })}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-60"
                >
                  Kosongkan
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {safeGrid.items.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">Belum ada item.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {safeGrid.items.map((it, idx) => {
                    const checked = (safeGrid.highlightIndexes || []).includes(idx);
                    return (
                      <label key={`highlight-${idx}`} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {idx + 1}. {it.title || 'Tanpa Judul'}
                          </div>
                          {it.description ? <div className="text-xs text-slate-500 truncate">{it.description}</div> : null}
                        </div>
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                          checked={checked}
                          disabled={!safeGrid.highlightEnabled}
                          onChange={(e) => {
                            const current = Array.isArray(safeGrid.highlightIndexes) ? safeGrid.highlightIndexes : [];
                            const next = e.target.checked
                              ? Array.from(new Set([...current, idx])).sort((a, b) => a - b)
                              : current.filter((v) => v !== idx);
                            setGrid({ ...safeGrid, highlightIndexes: next, highlightIndex: next[0] ?? null });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Item"
        defaultOpen
        right={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              addItem();
            }}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700"
          >
            + Item
          </button>
        }
      >
        <div className="space-y-3">
          {safeGrid.items.map((it, idx) => (
            <CollapsibleSection
              key={`grid-item-${idx}`}
              title={`Item ${idx + 1}${it.title ? ` — ${it.title}` : ''}`}
              defaultOpen={idx === 0}
              description="Klik untuk buka/tutup pengaturan item."
            >
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-red-600 font-bold text-xs hover:bg-red-50"
                  >
                    Hapus Item
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Judul</label>
                    <input
                      value={it.title}
                      onChange={(e) => updateItem(idx, (prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Gambar (URL)</label>
                    <input
                      value={it.imageUrl || ''}
                      onChange={(e) => updateItem(idx, (prev) => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Tempel URL atau pilih dari Media"
                    />
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => openMediaForItem(idx, 'GALLERY')}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 w-full sm:w-auto"
                      >
                        Pilih dari Media
                      </button>
                      <button
                        type="button"
                        onClick={() => openMediaForItem(idx, 'UPLOAD')}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 w-full sm:w-auto"
                      >
                        Upload Baru
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(idx, (prev) => ({ ...prev, imageUrl: '' }))}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-red-600 font-bold text-xs hover:bg-red-50 w-full sm:w-auto"
                      >
                        Hapus Gambar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Link URL (opsional)</label>
                    <input
                      value={it.href || ''}
                      onChange={(e) => updateItem(idx, (prev) => ({ ...prev, href: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="contoh: /bestari atau https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Warna Background (opsional)</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <input
                        type="color"
                        value={it.bgColor && it.bgColor.trim() ? it.bgColor : '#ffffff'}
                        onChange={(e) => updateItem(idx, (prev) => ({ ...prev, bgColor: e.target.value }))}
                        className="w-10 h-7 rounded"
                        aria-label="Pilih warna background"
                      />
                      <input
                        type="text"
                        value={it.bgColor || ''}
                        onChange={(e) => updateItem(idx, (prev) => ({ ...prev, bgColor: e.target.value }))}
                        className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
                        placeholder="#ffffff"
                      />
                      <button
                        type="button"
                        onClick={() => updateItem(idx, (prev) => ({ ...prev, bgColor: '' }))}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Warna Teks (opsional)</label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <input
                      type="color"
                      value={it.textColor && it.textColor.trim() ? it.textColor : '#111827'}
                      onChange={(e) => updateItem(idx, (prev) => ({ ...prev, textColor: e.target.value }))}
                      className="w-10 h-7 rounded"
                      aria-label="Pilih warna teks"
                    />
                    <input
                      type="text"
                      value={it.textColor || ''}
                      onChange={(e) => updateItem(idx, (prev) => ({ ...prev, textColor: e.target.value }))}
                      className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
                      placeholder="#111827"
                    />
                    <button
                      type="button"
                      onClick={() => updateItem(idx, (prev) => ({ ...prev, textColor: '' }))}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Konten</label>
                  <textarea
                    rows={2}
                    value={it.description}
                    onChange={(e) => updateItem(idx, (prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </CollapsibleSection>
          ))}
        </div>
      </CollapsibleSection>

      <MediaPickerModal
        isOpen={isMediaModalOpen}
        onClose={() => {
          setIsMediaModalOpen(false);
          setMediaItemIndex(null);
        }}
        initialTab={mediaInitialTab}
        onSelect={(asset) => {
          if (mediaItemIndex === null) return;
          updateItem(mediaItemIndex, (prev) => ({ ...prev, imageUrl: asset.url }));
          setIsMediaModalOpen(false);
          setMediaItemIndex(null);
        }}
      />
    </div>
  );
}

function SectionBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);
  const [selected, setSelected] = useState<{ colId: string; widgetId: string } | null>(null);

  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten SECTION tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  const section = (parsed.data || {}) as Partial<SectionContent>;
  const columns = Array.isArray(section.columns) ? section.columns : [];
  const safeSection: SectionContent = {
    id: typeof section.id === 'string' && section.id ? section.id : createId('section'),
    layout: section.layout,
    columns: columns.length > 0 ? columns : [{ id: createId('col'), widgets: [] }],
  };

  const setSection = (next: SectionContent) => onChange(JSON.stringify(next, null, 2));

  const setColumnsCount = (count: number) => {
    const nextCount = Math.max(1, Math.min(4, count));
    const existing = safeSection.columns;
    const nextCols = Array.from({ length: nextCount }).map((_, i) => existing[i] || { id: createId('col'), widgets: [] });
    setSection({ ...safeSection, columns: nextCols });
    setSelected(null);
  };

  const addWidget = (colId: string, type: string) => {
    const newWidget = { id: createId('widget'), type, content: createDefaultWidgetContent(type) };
    const nextCols = safeSection.columns.map((c) => (c.id === colId ? { ...c, widgets: [...(c.widgets || []), newWidget] } : c));
    setSection({ ...safeSection, columns: nextCols });
    setSelected({ colId, widgetId: newWidget.id });
  };

  const updateWidgetContent = (colId: string, widgetId: string, nextContent: string) => {
    const nextCols = safeSection.columns.map((c) => {
      if (c.id !== colId) return c;
      return { ...c, widgets: (c.widgets || []).map((w) => (w.id === widgetId ? { ...w, content: nextContent } : w)) };
    });
    setSection({ ...safeSection, columns: nextCols });
  };

  const deleteWidget = (colId: string, widgetId: string) => {
    const nextCols = safeSection.columns.map((c) => {
      if (c.id !== colId) return c;
      return { ...c, widgets: (c.widgets || []).filter((w) => w.id !== widgetId) };
    });
    setSection({ ...safeSection, columns: nextCols });
    setSelected(null);
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const sourceCol = safeSection.columns.find((c) => c.id === sourceColId);
    const destCol = safeSection.columns.find((c) => c.id === destColId);
    if (!sourceCol || !destCol) return;

    const sourceWidgets = [...(sourceCol.widgets || [])];
    const [moved] = sourceWidgets.splice(source.index, 1);
    if (!moved) return;

    const nextCols = safeSection.columns.map((c) => {
      if (c.id === sourceColId) return { ...c, widgets: sourceWidgets };
      if (c.id === destColId) {
        const destWidgets = [...(destCol.widgets || [])];
        destWidgets.splice(destination.index, 0, moved);
        return { ...c, widgets: destWidgets };
      }
      return c;
    });

    setSection({ ...safeSection, columns: nextCols });
    setSelected({ colId: destColId, widgetId: moved.id });
  };

  const selectedWidget = selected
    ? safeSection.columns
        .find((c) => c.id === selected.colId)
        ?.widgets?.find((w) => w.id === selected.widgetId)
    : undefined;

  return (
    <div className="space-y-4">
      <CollapsibleSection
        title="Pengaturan Section"
        defaultOpen
        right={
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-slate-500" />
            <select
              value={String(safeSection.columns.length)}
              onChange={(e) => setColumnsCount(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value="1">1 Kolom</option>
              <option value="2">2 Kolom</option>
              <option value="3">3 Kolom</option>
              <option value="4">4 Kolom</option>
            </select>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Max Width</label>
            <select
              value={safeSection.layout?.maxWidth || 'BOXED'}
              onChange={(e) =>
                setSection({
                  ...safeSection,
                  layout: { ...(safeSection.layout || {}), maxWidth: e.target.value as 'FULL' | 'BOXED' },
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="BOXED">Boxed</option>
              <option value="FULL">Full</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Padding Y</label>
            <select
              value={safeSection.layout?.paddingY || 'MD'}
              onChange={(e) =>
                setSection({
                  ...safeSection,
                  layout: { ...(safeSection.layout || {}), paddingY: e.target.value as 'SM' | 'MD' | 'LG' },
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="SM">Kecil</option>
              <option value="MD">Sedang</option>
              <option value="LG">Besar</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Gap Kolom</label>
            <select
              value={safeSection.layout?.columnsGap || 'MD'}
              onChange={(e) =>
                setSection({
                  ...safeSection,
                  layout: { ...(safeSection.layout || {}), columnsGap: e.target.value as 'SM' | 'MD' | 'LG' },
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="SM">Rapat</option>
              <option value="MD">Normal</option>
              <option value="LG">Longgar</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <CollapsibleSection title="Struktur" description="Tambah widget, drag & drop untuk urutan/kolom." defaultOpen>
            <DragDropContext onDragEnd={onDragEnd}>
              <div className={`grid gap-3 ${safeSection.columns.length === 1 ? 'grid-cols-1' : safeSection.columns.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : safeSection.columns.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                {safeSection.columns.map((col) => (
                  <div key={col.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-700">Kolom</div>
                      <button
                        type="button"
                        onClick={() => addWidget(col.id, 'HERO')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700"
                      >
                        <Plus className="w-3.5 h-3.5" /> Hero
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {['GRID', 'COURSES', 'CTA', 'TEXT', 'FEATURES', 'TESTIMONIALS', 'FAQ', 'LOGOS', 'VENDORS', 'GALLERY'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => addWidget(col.id, t)}
                            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 font-bold text-[11px] hover:bg-slate-50"
                          >
                            + {t}
                          </button>
                        ))}
                      </div>

                      <Droppable droppableId={col.id}>
                        {(dropProvided) => (
                          <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-2">
                            {(col.widgets || []).map((w, idx) => {
                              const isSelected = selected?.widgetId === w.id;
                              return (
                                <Draggable key={w.id} draggableId={w.id} index={idx}>
                                  {(dragProvided) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={`rounded-2xl border px-3 py-2 bg-white flex items-center justify-between gap-2 ${
                                        isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setSelected({ colId: col.id, widgetId: w.id })}
                                        className="text-left min-w-0 flex-1"
                                      >
                                        <div className="text-xs font-bold text-slate-900 truncate">{w.type}</div>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => deleteWidget(col.id, w.id)}
                                          className="p-2 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50"
                                          title="Hapus widget"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div
                                          {...dragProvided.dragHandleProps}
                                          className="p-2 rounded-xl border border-slate-200 text-slate-500 bg-slate-50"
                                          title="Drag"
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {dropProvided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                ))}
              </div>
            </DragDropContext>
          </CollapsibleSection>
        </div>

        <div className="lg:col-span-5">
          <CollapsibleSection title="Pengaturan Widget" description="Pilih widget dari struktur." defaultOpen>
            {selectedWidget ? (
              <div className="space-y-3">
                <BlockSpacingEditor
                  content={selectedWidget.content}
                  onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                />

                {selectedWidget.type === 'HERO' ? (
                  <HeroBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'GRID' ? (
                  <GridBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'COURSES' ? (
                  <CoursesBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'TESTIMONIALS' ? (
                  <TestimonialsBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'FAQ' ? (
                  <FaqBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'LOGOS' ? (
                  <LogosBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'VENDORS' ? (
                  <VendorsBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'GALLERY' ? (
                  <GalleryBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : selectedWidget.type === 'CTA' ? (
                  <CtaBlockEditor
                    content={selectedWidget.content}
                    onChange={(next) => updateWidgetContent(selected!.colId, selected!.widgetId, next)}
                    onSwitchToJson={() => undefined}
                  />
                ) : (
                  <textarea
                    rows={18}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={selectedWidget.content}
                    onChange={(e) => updateWidgetContent(selected!.colId, selected!.widgetId, e.target.value)}
                  />
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Klik widget pada kolom untuk mengedit.</div>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

function createDefaultWidgetContent(type: string) {
  if (type === 'HERO') {
    return JSON.stringify(
      {
        layout: { widthMode: 'FULL', baseBackgroundMode: 'DARK', minHeightPx: 520 },
        slider: { enabled: true, autoplayMs: 8000, transitionMs: 1000, showDots: true, showArrows: true },
        slides: [
          {
            heading: 'Belajar Geosains Lebih Terarah',
            subheading: 'Materi terstruktur, kuis, tugas, dan sertifikat dalam satu platform.',
            background: { imageUrl: '', overlayOpacity: 55 },
            buttons: [
              { text: 'Jelajahi Kursus', href: '/courses', variant: 'PRIMARY' },
              { text: 'Masuk', href: '/login', variant: 'OUTLINE' },
            ],
          },
        ],
      },
      null,
      2
    );
  }

  if (type === 'COURSES') {
    return JSON.stringify(
      {
        heading: 'Kursus Populer',
        subheading: 'Pilih kursus terbaik untuk meningkatkan skill.',
        limit: 6,
        variant: 'grid',
        cta: { text: 'Lihat Semua Kursus', href: '/courses' },
      },
      null,
      2
    );
  }

  if (type === 'CTA') {
    return JSON.stringify(
      {
        heading: 'Siap Mulai Belajar?',
        subheading: 'Daftar sekarang dan mulai progres belajarmu hari ini.',
        buttonText: 'Daftar',
        buttonHref: '/register',
      },
      null,
      2
    );
  }

  if (type === 'TEXT') {
    return JSON.stringify({ text: '<p>Tulis konten di sini...</p>', alignment: 'left' }, null, 2);
  }

  if (type === 'FEATURES') {
    return JSON.stringify(
      {
        heading: 'Keunggulan Kami',
        features: [
          { title: 'Materi Terstruktur', description: 'Belajar step-by-step dengan kurikulum yang jelas.' },
          { title: 'Kuis & Tugas', description: 'Uji pemahaman dan dapatkan feedback.' },
          { title: 'Sertifikat', description: 'Terbit otomatis saat kursus selesai.' },
        ],
      },
      null,
      2
    );
  }

  if (type === 'GRID') {
    return JSON.stringify(
      {
        heading: 'Layanan Kami',
        subheading: 'Pilih program yang sesuai kebutuhan Anda.',
        columns: 4,
        rows: 2,
        maxItems: 8,
        mobileTwoColumns: true,
        highlightEnabled: false,
        highlightIndex: null,
        highlightBgColor: '#2563eb',
        highlightTextColor: '#ffffff',
        items: [
          { title: 'Digital Single Course', description: 'Akses belajar kapanpun dan dimanapun, pelajari materi yang mudah dipahami', imageUrl: '', href: '' },
          { title: 'Geo Guidance', description: 'Bimbingan privat untuk fokus pada topik penelitian seluruh bidang geosains', imageUrl: '', href: '' },
          { title: 'Geo Bootcamp', description: 'Lebih intens dengan materi dan praktik langsung, kuasai skill saat Anda selesai belajar', imageUrl: '', href: '' },
          { title: 'Bestari Dive Center', description: 'Belajar menyelam aman dan profesional, mulai dari Bestari Dive Center', imageUrl: '', href: '' },
        ],
      } satisfies GridContent,
      null,
      2
    );
  }

  if (type === 'TESTIMONIALS') {
    return JSON.stringify(
      {
        badgeText: 'Trusted By 900K+ Students',
        heading: 'Join Our Supportive Community 😊',
        subheading: 'GeoSains menyediakan komunitas belajar dan materi terstruktur untuk pemula hingga mahir.',
        backgroundFrom: '#070A1B',
        backgroundTo: '#0B1B3A',
        heightPx: 560,
        scrollSpeedPxPerSec: 18,
        motionMode: 'LOOP',
        buttons: [
          { text: 'Katalog Kelas', href: '/courses', variant: 'PRIMARY' },
          { text: 'Karya Students', href: '/courses', variant: 'OUTLINE' },
        ],
        testimonials: [
          { title: 'Berkualitas Tinggi', text: 'Materi jelas dan mudah diikuti dari awal sampai akhir.', authorName: 'Aqil', authorRole: 'Front-End Developer', avatarUrl: '' },
          { title: 'Pemula to Expert', text: 'Alur belajar rapi dan progres terasa banget.', authorName: 'Wahyu', authorRole: 'Mobile App Developer', avatarUrl: '' },
          { title: 'Always Up to Date', text: 'Materi mengikuti tools dan praktik terbaru.', authorName: 'Edi', authorRole: 'Full-Stack Developer', avatarUrl: '' },
          { title: 'Alur Belajar Jelas', text: 'Cocok untuk pemula yang mau naik level.', authorName: 'Rizqy', authorRole: 'UI/UX Designer', avatarUrl: '' },
          { title: 'Hemat Waktu', text: 'Penjelasan ringkas, langsung ke inti.', authorName: 'Evita', authorRole: 'UI/UX Designer', avatarUrl: '' },
          { title: 'Discover and Learn', text: 'Banyak insight baru di setiap kelasnya.', authorName: 'Sharen', authorRole: 'UI/UX Designer', avatarUrl: '' },
        ],
      },
      null,
      2
    );
  }

  if (type === 'FAQ') {
    return JSON.stringify(
      {
        heading: 'Frequently Asked Questions',
        subheading: 'Pertanyaan yang sering ditanyakan seputar platform dan pembelajaran.',
        cta: { text: 'Hubungi Kami', href: '/profile' },
        items: [
          { question: 'Apakah kursus bisa diakses selamanya?', answer: 'Akses mengikuti kebijakan masing-masing kursus.' },
          { question: 'Bagaimana cara mendaftar kursus?', answer: 'Buka halaman Kursus, pilih kursus yang diinginkan, lalu ikuti instruksi pendaftaran.' },
          { question: 'Apakah ada sertifikat?', answer: 'Jika kursus menyediakan sertifikat, sertifikat akan tersedia setelah progres belajar selesai.' },
        ],
      },
      null,
      2
    );
  }

  if (type === 'LOGOS') {
    return JSON.stringify(
      {
        heading: 'Telah Bekerjasama Dengan',
        subheading: 'Beberapa organisasi yang pernah berkolaborasi bersama kami.',
        layout: 'MARQUEE',
        grayscale: true,
        logoHeightPx: 36,
        durationSec: 22,
        items: [
          { name: 'Company A', imageUrl: '', href: '' },
          { name: 'Company B', imageUrl: '', href: '' },
          { name: 'Company C', imageUrl: '', href: '' },
          { name: 'Company D', imageUrl: '', href: '' },
          { name: 'Company E', imageUrl: '', href: '' },
          { name: 'Company F', imageUrl: '', href: '' },
        ],
      },
      null,
      2
    );
  }

  if (type === 'VENDORS') {
    return JSON.stringify(
      {
        heading: 'Vendor Terverifikasi',
        subheading: 'Temukan vendor yang sudah terverifikasi dan memiliki produk berkualitas.',
        limit: 6,
        sort: 'TOP',
        cta: { text: 'Lihat Semua Vendor', href: '/geoservices' },
      },
      null,
      2
    );
  }

  if (type === 'GALLERY') {
    return JSON.stringify(
      {
        heading: 'Galeri Kegiatan',
        subheading: 'Dokumentasi kegiatan, pelatihan, dan kolaborasi.',
        columns: 4,
        mobileColumns: 2,
        imageHeightPx: 220,
        showCaptions: true,
        items: [
          { imageUrl: '', caption: 'Foto 1', href: '' },
          { imageUrl: '', caption: 'Foto 2', href: '' },
          { imageUrl: '', caption: 'Foto 3', href: '' },
          { imageUrl: '', caption: 'Foto 4', href: '' },
        ],
      },
      null,
      2
    );
  }

  return '{}';
}

function HeroBlockEditor({
  content,
  onChange,
  onSwitchToJson,
}: {
  content: string;
  onChange: (nextContent: string) => void;
  onSwitchToJson: () => void;
}) {
  const parsed = useMemo(() => safeJsonParse(content), [content]);

  const [tab, setTab] = useState<'TAMPILAN' | 'SLIDES'>('TAMPILAN');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showAdvancedLayout, setShowAdvancedLayout] = useState(false);
  const [showAdvancedColors, setShowAdvancedColors] = useState<Record<string, boolean>>({});
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaInitialTab, setMediaInitialTab] = useState<'GALLERY' | 'UPLOAD'>('GALLERY');
  const [mediaTarget, setMediaTarget] = useState<'ACTIVE_SLIDE_BG' | 'HERO_BG' | null>(null);

  if (!parsed.ok) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="text-sm font-bold text-red-700">Konten HERO tidak bisa dibuka dengan editor</div>
        <div className="text-xs text-red-600 mt-1">{parsed.error}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSwitchToJson}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Buka Mode JSON
          </button>
        </div>
      </div>
    );
  }

  const hero = (parsed.data || {}) as HeroContent;
  const slides = Array.isArray(hero.slides) ? hero.slides : [];

  const widthMode: HeroWidthMode = hero.layout?.widthMode || 'FULL';
  const customMaxWidthPx =
    typeof hero.layout?.customMaxWidthPx === 'number' ? hero.layout.customMaxWidthPx : undefined;
  const baseBackgroundMode = hero.layout?.baseBackgroundMode || 'DARK';
  const baseBackgroundColor = hero.layout?.baseBackgroundColor || '#0f172a';
  const minHeightPx = typeof hero.layout?.minHeightPx === 'number' ? hero.layout.minHeightPx : undefined;

  const sliderEnabled = hero.slider?.enabled === true || slides.length > 1;
  const autoplayMs = typeof hero.slider?.autoplayMs === 'number' ? hero.slider.autoplayMs : 8000;
  const transitionMs = typeof hero.slider?.transitionMs === 'number' ? hero.slider.transitionMs : 1000;
  const showDots = hero.slider?.showDots !== false;
  const showArrows = hero.slider?.showArrows !== false;

  const setHero = (next: HeroContent) => onChange(JSON.stringify(next, null, 2));

  const patchLayout = (patch: Partial<NonNullable<HeroContent['layout']>>) => {
    setHero({ ...hero, layout: { ...(hero.layout || {}), ...patch } });
  };

  const patchHero = (patch: Partial<HeroContent>) => {
    setHero({ ...hero, ...patch });
  };

  const patchSlider = (patch: Partial<NonNullable<HeroContent['slider']>>) => {
    setHero({ ...hero, slider: { ...(hero.slider || {}), ...patch } });
  };

  const convertSingleToSlides = () => {
    const primaryText = hero.primaryCta?.text || hero.ctaText || 'Jelajahi Kursus';
    const primaryHref = hero.primaryCta?.href || hero.ctaLink || '/courses';
    const secondaryText = hero.secondaryCta?.text || '';
    const secondaryHref = hero.secondaryCta?.href || '/login';

    setHero({
      ...hero,
      slider: { ...(hero.slider || {}), enabled: true },
      slides: [
        ...(slides.length > 0
          ? slides
          : [
              {
                heading: hero.heading || 'Judul Slide',
                subheading: hero.subheading || 'Subjudul slide',
                background: { imageUrl: hero.imageUrl, overlayOpacity: 55 },
                buttons: [
                  { text: primaryText, href: primaryHref, variant: 'PRIMARY' as const },
                  ...(secondaryText ? [{ text: secondaryText, href: secondaryHref, variant: 'OUTLINE' as const }] : []),
                ],
              },
            ]),
      ],
    });
    setTab('SLIDES');
    setActiveSlideIndex(0);
  };

  const convertSlidesToSingle = () => {
    const first = slides[0];
    const buttons = Array.isArray(first?.buttons) ? first?.buttons : [];
    const primary = buttons[0];
    const secondary = buttons[1];

    setHero({
      ...hero,
      slider: { ...(hero.slider || {}), enabled: false },
      slides: [],
      heading: first?.heading || hero.heading,
      subheading: first?.subheading || hero.subheading,
      imageUrl: first?.background?.imageUrl || hero.imageUrl,
      primaryCta: { text: primary?.text || hero.primaryCta?.text, href: primary?.href || hero.primaryCta?.href },
      secondaryCta: secondary?.text ? { text: secondary.text, href: secondary.href } : undefined,
    });
    setTab('TAMPILAN');
  };

  const updateSlide = (index: number, updater: (s: HeroSlide) => HeroSlide) => {
    const nextSlides = slides.map((s, i) => (i === index ? updater(s || {}) : s));
    setHero({ ...hero, slides: nextSlides });
  };

  const addSlide = () => {
    const next = [
      ...slides,
      {
        heading: 'Judul Slide',
        subheading: 'Subjudul slide',
        background: { imageUrl: '', overlayOpacity: 55 },
        buttons: [{ text: 'Jelajahi Kursus', href: '/courses', variant: 'PRIMARY' as const }],
      },
    ];
    setHero({ ...hero, slides: next, slider: { ...(hero.slider || {}), enabled: true } });
    setTab('SLIDES');
    setActiveSlideIndex(next.length - 1);
  };

  const removeSlide = (index: number) => {
    const nextSlides = slides.filter((_, i) => i !== index);
    setHero({ ...hero, slides: nextSlides, slider: { ...(hero.slider || {}), enabled: nextSlides.length > 1 } });
    setActiveSlideIndex((prev) => {
      if (prev > index) return prev - 1;
      if (prev === index) return 0;
      return prev;
    });
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === slides.length - 1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setHero({ ...hero, slides: next });
    setActiveSlideIndex(target);
  };

  const activeSlide = slides[activeSlideIndex] || slides[0];
  const activeButtons = Array.isArray(activeSlide?.buttons) ? activeSlide.buttons : [];

  const toggleAdvancedColors = (key: string) => {
    setShowAdvancedColors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openMediaFor = (target: 'ACTIVE_SLIDE_BG' | 'HERO_BG', initial: 'GALLERY' | 'UPLOAD') => {
    setMediaTarget(target);
    setMediaInitialTab(initial);
    setIsMediaModalOpen(true);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">Hero</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Atur tampilan hero dan (opsional) slider. Tidak perlu edit JSON.
          </div>
        </div>
        <button
          type="button"
          onClick={onSwitchToJson}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 w-full sm:w-auto"
        >
          Mode JSON
        </button>
      </div>

      <div className="px-4 sm:px-5 pt-4">
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setTab('TAMPILAN')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                tab === 'TAMPILAN' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tampilan
            </button>
            <button
              type="button"
              onClick={() => setTab('SLIDES')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                tab === 'SLIDES' ? 'bg-white text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
              disabled={!sliderEnabled}
            >
              Slides
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <div className="text-xs font-bold text-slate-600">Slider</div>
            <button
              type="button"
              onClick={() => {
                if (sliderEnabled) convertSlidesToSingle();
                else convertSingleToSlides();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                sliderEnabled
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {sliderEnabled ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-5">
        {tab === 'TAMPILAN' ? (
          <div className="space-y-3">
            <CollapsibleSection title="Layout & Slider" defaultOpen>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Lebar Hero</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={widthMode}
                  onChange={(e) => patchLayout({ widthMode: e.target.value as HeroWidthMode })}
                >
                  <option value="FULL">Full Width</option>
                  <option value="BOXED">Boxed</option>
                  <option value="CUSTOM">Custom</option>
                </select>
                <div className="text-[11px] text-slate-500">
                  Full = lebar penuh, Boxed = dalam container, Custom = atur max width.
                </div>
              </div>

              {widthMode === 'CUSTOM' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Max Width (px)</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={customMaxWidthPx || ''}
                    onChange={(e) =>
                      patchLayout({ customMaxWidthPx: e.target.value === '' ? undefined : Number(e.target.value) })
                    }
                    placeholder="contoh: 1100"
                    min={320}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Background (URL)</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      value={hero.imageUrl || ''}
                      onChange={(e) => patchHero({ imageUrl: e.target.value || undefined })}
                      placeholder="Tempel URL atau pilih dari Media"
                      disabled={sliderEnabled}
                    />
                    {!sliderEnabled ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => openMediaFor('HERO_BG', 'GALLERY')}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 w-full sm:w-auto"
                        >
                          Pilih dari Media
                        </button>
                        <button
                          type="button"
                          onClick={() => openMediaFor('HERO_BG', 'UPLOAD')}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 w-full sm:w-auto"
                        >
                          Upload Baru
                        </button>
                        <button
                          type="button"
                          onClick={() => patchHero({ imageUrl: undefined })}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-red-600 font-bold text-xs hover:bg-red-50 w-full sm:w-auto"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {sliderEnabled ? 'Background diatur per slide.' : 'Isi URL gambar background (opsional).'}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Pengaturan Slider</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">Autoplay (ms)</span>
                    <input
                      type="number"
                      className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                      value={autoplayMs}
                      min={4000}
                      step={500}
                      disabled={!sliderEnabled}
                      onChange={(e) => patchSlider({ autoplayMs: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">Kecepatan Geser (ms)</span>
                    <input
                      type="number"
                      className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                      value={transitionMs}
                      min={400}
                      max={2500}
                      step={50}
                      disabled={!sliderEnabled}
                      onChange={(e) => patchSlider({ transitionMs: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 px-3 py-2">
                      <span className="text-xs font-bold text-slate-700">Dots</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                        checked={showDots}
                        disabled={!sliderEnabled}
                        onChange={(e) => patchSlider({ showDots: e.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 px-3 py-2">
                      <span className="text-xs font-bold text-slate-700">Panah</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                        checked={showArrows}
                        disabled={!sliderEnabled}
                        onChange={(e) => patchSlider({ showArrows: e.target.checked })}
                      />
                    </label>
                  </div>
                  {!sliderEnabled ? (
                    <div className="text-[11px] text-slate-500">Aktifkan slider untuk menampilkan pengaturan ini.</div>
                  ) : null}
                </div>
              </div>
            </div>
            </CollapsibleSection>

            <CollapsibleSection title="Background & Tinggi" defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-600">Background Dasar Hero (biru di belakang)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={baseBackgroundMode}
                    onChange={(e) =>
                      patchLayout({
                        baseBackgroundMode: e.target.value as 'DARK' | 'NONE' | 'CUSTOM',
                        ...(e.target.value === 'CUSTOM' ? { baseBackgroundColor } : {}),
                      })
                    }
                  >
                    <option value="DARK">Aktif (Default)</option>
                    <option value="NONE">Nonaktif</option>
                    <option value="CUSTOM">Custom Warna</option>
                  </select>
                  {baseBackgroundMode === 'CUSTOM' ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <input
                        type="color"
                        value={baseBackgroundColor}
                        onChange={(e) => patchLayout({ baseBackgroundColor: e.target.value })}
                        className="w-10 h-7 rounded"
                        aria-label="Pilih warna"
                      />
                      <input
                        type="text"
                        value={baseBackgroundColor}
                        onChange={(e) => patchLayout({ baseBackgroundColor: e.target.value })}
                        className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
                        placeholder="#0f172a"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="text-[11px] text-slate-500">
                  Jika Boxed/Custom, warna dasar ini juga mempengaruhi panel di belakang konten.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Stabilkan Ukuran Slider</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">Kunci tinggi (anti “loncat”)</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                      checked={typeof minHeightPx === 'number'}
                      onChange={(e) => patchLayout({ minHeightPx: e.target.checked ? 520 : undefined })}
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                      value={typeof minHeightPx === 'number' ? minHeightPx : ''}
                      onChange={(e) => patchLayout({ minHeightPx: e.target.value === '' ? undefined : Number(e.target.value) })}
                      min={280}
                      step={10}
                      placeholder="contoh: 520"
                      disabled={typeof minHeightPx !== 'number'}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Gunakan 480–600px agar tinggi slide 1 & 2 konsisten.
                  </div>
                </div>
              </div>
            </div>
            </CollapsibleSection>

            <CollapsibleSection title="Konten" defaultOpen={!sliderEnabled}>
              {!sliderEnabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Judul</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={hero.heading || ''}
                    onChange={(e) => patchHero({ heading: e.target.value })}
                    placeholder="Judul hero"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Tombol Utama (Teks)</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={hero.primaryCta?.text || ''}
                    onChange={(e) => patchHero({ primaryCta: { ...(hero.primaryCta || {}), text: e.target.value } })}
                    placeholder="Jelajahi Kursus"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600">Subjudul</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={hero.subheading || ''}
                    onChange={(e) => patchHero({ subheading: e.target.value })}
                    placeholder="Subjudul hero"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Tombol Utama (Link)</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={hero.primaryCta?.href || ''}
                    onChange={(e) => patchHero({ primaryCta: { ...(hero.primaryCta || {}), href: e.target.value } })}
                    placeholder="/courses"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Tombol Kedua (Opsional)</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={hero.secondaryCta?.text || ''}
                    onChange={(e) =>
                      patchHero({ secondaryCta: e.target.value ? { ...(hero.secondaryCta || {}), text: e.target.value } : undefined })
                    }
                    placeholder="Masuk"
                  />
                </div>
              </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-sm font-bold text-slate-900">Slider aktif</div>
                <div className="text-xs text-slate-600 mt-1">
                  Background, judul, subjudul, dan tombol diatur per slide.
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setTab('SLIDES')}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
                  >
                    Atur Slides
                  </button>
                </div>
              </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="Lanjutan" defaultOpen={false}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedLayout((v) => !v)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    {showAdvancedLayout ? 'Sembunyikan Pengaturan Lanjutan' : 'Pengaturan Lanjutan'}
                  </button>
                  {showAdvancedLayout ? <div className="text-xs text-slate-500 font-medium">Untuk kebutuhan layout custom.</div> : null}
                </div>

                {showAdvancedLayout ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Padding X (Tailwind class)</label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        value={hero.layout?.customPaddingXClass || ''}
                        onChange={(e) => patchLayout({ customPaddingXClass: e.target.value || undefined })}
                        placeholder="px-4 sm:px-6 lg:px-8"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </CollapsibleSection>
          </div>
        ) : (
          <div className="space-y-4">
            {!sliderEnabled ? (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <div className="text-sm font-bold text-amber-800">Slider masih nonaktif</div>
                <div className="text-xs text-amber-700 mt-1">Aktifkan slider untuk menambah dan mengatur slide.</div>
              </div>
            ) : null}

            <CollapsibleSection
              title="Kelola Slide"
              defaultOpen
              right={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addSlide();
                  }}
                  disabled={!sliderEnabled}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Tambah Slide
                </button>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                {slides.map((s, idx) => {
                  const isActive = idx === activeSlideIndex;
                  const bg = s?.background?.imageUrl;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                        isActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-100 shrink-0 overflow-hidden">
                          {bg ? (
                            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }} />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{s?.heading || `Slide ${idx + 1}`}</div>
                          <div className="text-[11px] text-slate-500 truncate">{s?.subheading || 'Tanpa subjudul'}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {slides.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
                    Belum ada slide.
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4">
                {activeSlide ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{activeSlide.heading || `Slide ${activeSlideIndex + 1}`}</div>
                        <div className="text-xs text-slate-500">Edit konten slide yang dipilih.</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveSlide(activeSlideIndex, 'up')}
                          disabled={activeSlideIndex === 0}
                          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSlide(activeSlideIndex, 'down')}
                          disabled={activeSlideIndex === slides.length - 1}
                          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlide(activeSlideIndex)}
                          className="p-2 rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Judul</label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          value={activeSlide.heading || ''}
                          onChange={(e) => updateSlide(activeSlideIndex, (prev) => ({ ...prev, heading: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600">Background URL</label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            value={activeSlide.background?.imageUrl || ''}
                            onChange={(e) =>
                              updateSlide(activeSlideIndex, (prev) => ({
                                ...prev,
                                background: { ...(prev.background || {}), imageUrl: e.target.value || undefined },
                              }))
                            }
                            placeholder="Tempel URL atau pilih dari Media"
                          />

                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={() => openMediaFor('ACTIVE_SLIDE_BG', 'GALLERY')}
                              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 w-full sm:w-auto"
                            >
                              Pilih dari Media
                            </button>
                            <button
                              type="button"
                              onClick={() => openMediaFor('ACTIVE_SLIDE_BG', 'UPLOAD')}
                              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 w-full sm:w-auto"
                            >
                              Upload Baru
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSlide(activeSlideIndex, (prev) => ({
                                  ...prev,
                                  background: { ...(prev.background || {}), imageUrl: undefined },
                                }))
                              }
                              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-red-600 font-bold text-xs hover:bg-red-50 w-full sm:w-auto"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Mode Gambar</label>
                            <select
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              value={activeSlide.background?.fit || 'COVER'}
                              onChange={(e) =>
                                updateSlide(activeSlideIndex, (prev) => ({
                                  ...prev,
                                  background: { ...(prev.background || {}), fit: e.target.value as 'COVER' | 'CONTAIN' },
                                }))
                              }
                            >
                              <option value="COVER">Cover (potong otomatis)</option>
                              <option value="CONTAIN">Contain (tanpa potong)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600">Fokus Gambar</label>
                            <select
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              value={activeSlide.background?.position || 'CENTER'}
                              onChange={(e) =>
                                updateSlide(activeSlideIndex, (prev) => ({
                                  ...prev,
                                  background: { ...(prev.background || {}), position: e.target.value as 'CENTER' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' },
                                }))
                              }
                            >
                              <option value="CENTER">Tengah</option>
                              <option value="TOP">Atas</option>
                              <option value="BOTTOM">Bawah</option>
                              <option value="LEFT">Kiri</option>
                              <option value="RIGHT">Kanan</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-600">Subjudul</label>
                        <textarea
                          rows={2}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          value={activeSlide.subheading || ''}
                          onChange={(e) => updateSlide(activeSlideIndex, (prev) => ({ ...prev, subheading: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600">Gelapkan Background</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={90}
                          value={clampNumber(typeof activeSlide.background?.overlayOpacity === 'number' ? activeSlide.background.overlayOpacity : 55, 0, 90)}
                          onChange={(e) =>
                            updateSlide(activeSlideIndex, (prev) => ({
                              ...prev,
                              background: { ...(prev.background || {}), overlayOpacity: Number(e.target.value) },
                            }))
                          }
                          className="w-full"
                        />
                        <span className="text-xs font-bold text-slate-700 w-10 text-right">
                          {clampNumber(typeof activeSlide.background?.overlayOpacity === 'number' ? activeSlide.background.overlayOpacity : 55, 0, 90)}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-900">Tombol</div>
                        <button
                          type="button"
                          onClick={() =>
                            updateSlide(activeSlideIndex, (prev) => ({
                              ...prev,
                              buttons: [
                                ...(Array.isArray(prev.buttons) ? prev.buttons : []),
                                { text: 'Tombol', href: '/', variant: 'PRIMARY' as const },
                              ],
                            }))
                          }
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Tombol
                        </button>
                      </div>

                      {activeButtons.length === 0 ? (
                        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                          Belum ada tombol.
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        {activeButtons.map((btn, bIdx) => {
                          const key = `${activeSlideIndex}-${bIdx}`;
                          const variant: HeroButtonVariant = btn.variant || (bIdx === 0 ? 'PRIMARY' : 'OUTLINE');
                          const isAdvanced = showAdvancedColors[key] || !!btn.bgColor || !!btn.textColor || !!btn.borderColor;

                          return (
                            <div key={key} className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-bold text-slate-700">Tombol {bIdx + 1}</div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSlide(activeSlideIndex, (prev) => ({
                                      ...prev,
                                      buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).filter((_, i) => i !== bIdx),
                                    }))
                                  }
                                  className="p-2 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5 sm:col-span-2">
                                  <label className="text-xs font-bold text-slate-600">Teks</label>
                                  <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={btn.text || ''}
                                    onChange={(e) =>
                                      updateSlide(activeSlideIndex, (prev) => ({
                                        ...prev,
                                        buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).map((x, i) =>
                                          i === bIdx ? { ...x, text: e.target.value } : x
                                        ),
                                      }))
                                    }
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-600">Gaya</label>
                                  <select
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={variant}
                                    onChange={(e) =>
                                      updateSlide(activeSlideIndex, (prev) => ({
                                        ...prev,
                                        buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).map((x, i) =>
                                          i === bIdx ? { ...x, variant: e.target.value as HeroButtonVariant } : x
                                        ),
                                      }))
                                    }
                                  >
                                    <option value="PRIMARY">Primary</option>
                                    <option value="OUTLINE">Outline</option>
                                    <option value="SECONDARY">Secondary</option>
                                  </select>
                                </div>

                                <div className="space-y-1.5 sm:col-span-3">
                                  <label className="text-xs font-bold text-slate-600">Link</label>
                                  <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={btn.href || ''}
                                    onChange={(e) =>
                                      updateSlide(activeSlideIndex, (prev) => ({
                                        ...prev,
                                        buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).map((x, i) =>
                                          i === bIdx ? { ...x, href: e.target.value } : x
                                        ),
                                      }))
                                    }
                                    placeholder="/courses"
                                  />
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => toggleAdvancedColors(key)}
                                  className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-white"
                                >
                                  {isAdvanced ? 'Sembunyikan Warna Custom' : 'Warna Custom'}
                                </button>
                                <div className="text-[11px] text-slate-500">Opsional, hanya jika perlu.</div>
                              </div>

                              {isAdvanced ? (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600">BG</label>
                                    <input
                                      type="text"
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                      value={btn.bgColor || ''}
                                      onChange={(e) =>
                                        updateSlide(activeSlideIndex, (prev) => ({
                                          ...prev,
                                          buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).map((x, i) =>
                                            i === bIdx ? { ...x, bgColor: e.target.value || undefined } : x
                                          ),
                                        }))
                                      }
                                      placeholder="#10b981"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600">Teks</label>
                                    <input
                                      type="text"
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                      value={btn.textColor || ''}
                                      onChange={(e) =>
                                        updateSlide(activeSlideIndex, (prev) => ({
                                          ...prev,
                                          buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).map((x, i) =>
                                            i === bIdx ? { ...x, textColor: e.target.value || undefined } : x
                                          ),
                                        }))
                                      }
                                      placeholder="#ffffff"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600">Border</label>
                                    <input
                                      type="text"
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                      value={btn.borderColor || ''}
                                      onChange={(e) =>
                                        updateSlide(activeSlideIndex, (prev) => ({
                                          ...prev,
                                          buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).map((x, i) =>
                                            i === bIdx ? { ...x, borderColor: e.target.value || undefined } : x
                                          ),
                                        }))
                                      }
                                      placeholder="#ffffff"
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Pilih slide dari daftar untuk mulai mengedit.</div>
                )}
              </div>
            </div>
            </CollapsibleSection>
          </div>
        )}
      </div>

      <MediaPickerModal
        isOpen={isMediaModalOpen}
        initialTab={mediaInitialTab}
        onClose={() => {
          setIsMediaModalOpen(false);
          setMediaTarget(null);
        }}
        onSelect={(asset) => {
          if (mediaTarget === 'ACTIVE_SLIDE_BG') {
            updateSlide(activeSlideIndex, (prev) => ({
              ...prev,
              background: { ...(prev.background || {}), imageUrl: asset.url },
            }));
          } else if (mediaTarget === 'HERO_BG') {
            patchHero({ imageUrl: asset.url });
          }
          setIsMediaModalOpen(false);
          setMediaTarget(null);
        }}
      />
    </div>
  );
}
