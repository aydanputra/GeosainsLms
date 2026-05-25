'use client';

import { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import MediaPickerModal from '@/modules/media/components/MediaPickerModal';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Undo,
  Redo,
  X,
  Image as ImageIcon,
  Strikethrough,
  Code,
  Minus,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string; // HTML string or JSON string
  onChange: (value: string) => void;
  placeholder?: string;
}

type ToolbarButtonProps = {
  onClick: () => void;
  isActive?: boolean;
  icon: ComponentType<{ className?: string }>;
  title: string;
};

function ToolbarButton({ onClick, isActive, icon: Icon, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded hover:bg-slate-100 transition-colors ${
        isActive ? 'bg-slate-100 text-indigo-600' : 'text-slate-500'
      }`}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const lastHtmlRef = useRef<string>(typeof value === 'string' ? value : '');
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [isMediaOpen, setIsMediaOpen] = useState(false);

  const editorContentClass = useMemo(() => {
    return [
      'prose',
      'prose-sm',
      'max-w-none',
      'focus:outline-none',
      'min-h-[150px]',
      'p-4',
      'text-slate-800',
      'placeholder:text-slate-400',
      'prose-headings:font-bold',
      'prose-headings:text-slate-900',
      'prose-p:text-slate-800',
      'prose-a:text-indigo-600',
      'prose-a:font-semibold',
      'prose-a:underline',
      'prose-a:underline-offset-2',
      'hover:prose-a:text-indigo-700',
      'prose-li:text-slate-800',
      'prose-img:rounded-xl',
      'prose-img:border',
      'prose-img:border-slate-200',
      'prose-hr:border-slate-200',
      'prose-pre:bg-slate-900',
      'prose-pre:text-slate-100',
      'prose-pre:rounded-xl',
      'prose-pre:px-4',
      'prose-pre:py-3',
    ].join(' ');
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions that might conflict or are added manually
        // history: false, // history is included in StarterKit
      }),
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl border border-slate-200 w-full',
          loading: 'lazy',
        },
      }),
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
          class: 'text-indigo-600 font-semibold underline underline-offset-2 hover:text-indigo-700',
        },
        validate: (href) => {
          const v = String(href || '').trim();
          if (!v) return false;
          if (v.startsWith('/')) return true;
          return /^https?:\/\/|^mailto:|^tel:/i.test(v);
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: editorContentClass,
        'data-placeholder': placeholder || '',
      },
    },
    onUpdate: ({ editor }) => {
      // Return JSON string for storage
      // const json = JSON.stringify(editor.getJSON());
      // OR HTML
      const html = editor.getHTML();
      lastHtmlRef.current = html;
      onChange(html);
    },
    immediatelyRender: false, // Fix SSR hydration mismatch
  });

  const openLinkEditor = () => {
    if (!editor) return;
    const current = (editor.getAttributes('link')?.href as string | undefined) || '';
    setLinkHref(current);
    setIsLinkOpen(true);
  };

  const normalizeHref = (raw: string) => {
    const v = raw.trim();
    if (!v) return '';
    if (v.startsWith('/')) return v;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
    return `https://${v}`;
  };

  const applyLink = (rawHref: string) => {
    if (!editor) return;
    const href = normalizeHref(rawHref);
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const { empty } = editor.state.selection;
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${href}">${href}</a>`)
        .run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  useEffect(() => {
    if (!editor) return;
    const incoming = typeof value === 'string' ? value : '';
    if (incoming === lastHtmlRef.current) return;

    const current = editor.getHTML();
    if (incoming === current) {
      lastHtmlRef.current = current;
      return;
    }

    editor.commands.setContent(incoming || '', { emitUpdate: false });
    lastHtmlRef.current = incoming || '';
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[200px] bg-slate-50 animate-pulse rounded-xl border border-slate-200" />;
  }

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:ring-4 focus-within:ring-indigo-100 focus-within:border-indigo-600 transition-all bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          icon={Heading1}
          title="Heading 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={Bold}
          title="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={Italic}
          title="Italic"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          icon={UnderlineIcon}
          title="Underline"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          icon={Strikethrough}
          title="Strikethrough"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          icon={Code}
          title="Inline Code"
        />

        <ToolbarButton
          onClick={openLinkEditor}
          isActive={editor.isActive('link')}
          icon={LinkIcon}
          title="Link"
        />
        
        <div className="w-px h-6 bg-slate-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          icon={Heading1}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          icon={Heading2}
          title="Heading 3"
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          icon={List}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          icon={ListOrdered}
          title="Ordered List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          icon={Quote}
          title="Quote"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          icon={Code}
          title="Code Block"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          title="Horizontal Rule"
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <ToolbarButton
          onClick={() => setIsMediaOpen(true)}
          icon={ImageIcon}
          title="Insert Image"
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          title="Undo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          title="Redo"
        />
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
      <MediaPickerModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        initialTab="UPLOAD"
        onSelect={(item) => {
          editor.chain().focus().setImage({ src: item.url, alt: item.alt || item.filename || '' }).run();
        }}
      />
      {typeof document !== 'undefined' && isLinkOpen
        ? createPortal(
            <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-3">
              <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="text-sm font-extrabold text-slate-900">Tambah Link</div>
                  <button
                    type="button"
                    onClick={() => setIsLinkOpen(false)}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    aria-label="Tutup"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-2 overflow-auto">
                  <label className="text-xs font-bold text-slate-600">URL</label>
                  <input
                    value={linkHref}
                    onChange={(e) => setLinkHref(e.target.value)}
                    placeholder="https://... atau /path"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsLinkOpen(false);
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyLink(linkHref);
                        setIsLinkOpen(false);
                      }
                    }}
                  />
                  <div className="text-[11px] text-slate-500">
                    Pilih teks terlebih dahulu untuk menautkan. Jika tidak ada teks yang dipilih, URL akan disisipkan sebagai link. Kosongkan untuk menghapus link.
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLinkOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyLink(linkHref);
                      setIsLinkOpen(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
