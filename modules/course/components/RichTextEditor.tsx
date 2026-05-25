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

function sanitizeHref(raw: string) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (v.startsWith('/')) return v;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  return null;
}

function sanitizeImageSrc(raw: string) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (v.startsWith('/')) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return null;
}

function sanitizePastedHtml(rawHtml: string) {
  const html = String(rawHtml || '');
  if (!html.trim()) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const removeLeadingChars = (root: HTMLElement, count: number) => {
    let remaining = Math.max(0, Math.floor(count));
    if (!remaining) return;
    const w = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const toRemove: Text[] = [];
    while (remaining > 0 && w.nextNode()) {
      const textNode = w.currentNode as Text;
      const v = textNode.nodeValue || '';
      if (v.length <= remaining) {
        remaining -= v.length;
        toRemove.push(textNode);
      } else {
        textNode.nodeValue = v.slice(remaining);
        remaining = 0;
      }
    }
    toRemove.forEach((n) => n.remove());
  };

  const detectListMarker = (el: HTMLElement) => {
    const raw = String(el.textContent || '');
    const trimmed = raw.replace(/^\s+/, '');
    const leadingWsLen = raw.length - trimmed.length;
    if (!trimmed) return null;
    const ol = trimmed.match(/^(\d{1,3})[.)]\s+/);
    if (ol) return { type: 'ol' as const, removeChars: leadingWsLen + ol[0].length };
    const ul = trimmed.match(/^([•·‣▪●○-])\s+/);
    if (ul) return { type: 'ul' as const, removeChars: leadingWsLen + ul[0].length };
    return null;
  };

  const removeNodes = doc.querySelectorAll(
    'script,style,meta,link,title,noscript,iframe,object,embed,form,input,button,textarea,select,option,svg'
  );
  removeNodes.forEach((n) => n.remove());

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  comments.forEach((c) => c.remove());

  doc.querySelectorAll('o\\:p').forEach((n) => n.remove());

  doc.querySelectorAll('p,div').forEach((n) => {
    if (!(n instanceof HTMLElement)) return;
    const cls = String(n.getAttribute('class') || '');
    const style = String(n.getAttribute('style') || '');
    const clsMatch = cls.match(/MsoHeading([1-6])/i);
    const styleMatch = style.match(/mso-style-name\s*:\s*"?heading\s*([1-6])/i);
    const level = clsMatch ? Number(clsMatch[1]) : styleMatch ? Number(styleMatch[1]) : null;
    if (!level || level < 1 || level > 6) return;
    const hx = doc.createElement(`h${level}` as any);
    while (n.firstChild) hx.appendChild(n.firstChild);
    n.replaceWith(hx);
  });

  doc.querySelectorAll('b').forEach((n) => {
    const el = doc.createElement('strong');
    while (n.firstChild) el.appendChild(n.firstChild);
    n.replaceWith(el);
  });

  doc.querySelectorAll('i').forEach((n) => {
    const el = doc.createElement('em');
    while (n.firstChild) el.appendChild(n.firstChild);
    n.replaceWith(el);
  });

  doc.querySelectorAll('span').forEach((n) => {
    if (!(n instanceof HTMLElement)) return;
    const style = String(n.getAttribute('style') || '').toLowerCase();
    const isBold = /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
    const isItalic = /font-style\s*:\s*italic/.test(style);
    const isUnderline = /text-decoration\s*:\s*underline/.test(style);

    const frag = doc.createDocumentFragment();
    while (n.firstChild) frag.appendChild(n.firstChild);

    let wrapped: Node = frag;
    if (isUnderline) {
      const el = doc.createElement('u');
      el.appendChild(wrapped);
      wrapped = el;
    }
    if (isItalic) {
      const el = doc.createElement('em');
      el.appendChild(wrapped);
      wrapped = el;
    }
    if (isBold) {
      const el = doc.createElement('strong');
      el.appendChild(wrapped);
      wrapped = el;
    }

    n.replaceWith(wrapped);
  });

  doc.querySelectorAll('*').forEach((n) => {
    if (!(n instanceof HTMLElement)) return;
    const tag = n.tagName.toLowerCase();

    if (tag === 'a') {
      const href = sanitizeHref(n.getAttribute('href') || '');
      n.getAttributeNames().forEach((attr) => n.removeAttribute(attr));
      if (href) n.setAttribute('href', href);
      return;
    }

    if (tag === 'img') {
      const src = sanitizeImageSrc(n.getAttribute('src') || '');
      const alt = String(n.getAttribute('alt') || '').trim();
      n.getAttributeNames().forEach((attr) => n.removeAttribute(attr));
      if (!src) {
        n.remove();
        return;
      }
      n.setAttribute('src', src);
      if (alt) n.setAttribute('alt', alt);
      return;
    }

    n.getAttributeNames().forEach((attr) => n.removeAttribute(attr));

    if (!['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'u', 'a', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img'].includes(tag)) {
      if (tag === 'div') {
        const p = doc.createElement('p');
        while (n.firstChild) p.appendChild(n.firstChild);
        n.replaceWith(p);
        return;
      }
      const frag = doc.createDocumentFragment();
      while (n.firstChild) frag.appendChild(n.firstChild);
      n.replaceWith(frag);
    }
  });

  const body = doc.body;
  const fragment = doc.createDocumentFragment();
  let currentList: HTMLOListElement | HTMLUListElement | null = null;
  let currentListType: 'ol' | 'ul' | null = null;
  Array.from(body.children).forEach((child) => {
    const tag = child.tagName.toLowerCase();
    const isParagraph = tag === 'p';
    const marker = isParagraph ? detectListMarker(child as HTMLElement) : null;

    if (isParagraph && marker) {
      if (!currentList || currentListType !== marker.type) {
        if (currentList) fragment.appendChild(currentList);
        currentList = doc.createElement(marker.type) as any;
        currentListType = marker.type;
      }

      const p = child as HTMLElement;
      removeLeadingChars(p, marker.removeChars);
      const li = doc.createElement('li');
      while (p.firstChild) li.appendChild(p.firstChild);
      const liText = String(li.textContent || '').replace(/\u00a0/g, ' ').trim();
      const listEl = currentList;
      if (liText && listEl) listEl.appendChild(li);
      return;
    }

    if (currentList) {
      fragment.appendChild(currentList);
      currentList = null;
      currentListType = null;
    }

    fragment.appendChild(child);
  });
  if (currentList) fragment.appendChild(currentList);
  body.innerHTML = '';
  body.appendChild(fragment);

  const out = (doc.body.innerHTML || '').replace(/\u00a0/g, ' ').trim();
  return out;
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
      'rte-content',
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
        spellcheck: 'false',
        autocapitalize: 'off',
      },
      transformPastedHTML: (html) => sanitizePastedHtml(html),
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
